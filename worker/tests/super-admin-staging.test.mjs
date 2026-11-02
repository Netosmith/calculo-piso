import test from "node:test";
import assert from "node:assert/strict";
import staging from "../src/staging.js";

const root="https://portalfrete-super-admin-staging.example.workers.dev";
const env={
  TENANTS_DB:{prepare(sql){assert.match(sql,/portal_tenants/);return {first:async()=>null};}},
  TENANT_BRANDS:{}
};
function req(path,method="GET",headers={}){
  return new Request(root+path,{method,headers});
}

test("health probes the dedicated D1 schema and R2 binding only",async()=>{
 const response=await staging.fetch(req("/health"),env);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,environment:"staging",database:"ready",storage:"bound"});
 assert.equal(response.headers.get("Cache-Control"),"no-store");
 assert.equal(response.headers.get("X-Portal-Environment"),"super-admin-staging");
});
test("health fails safely if D1, R2 or migrated table is missing",async()=>{
 assert.equal((await staging.fetch(req("/health"),{TENANTS_DB:env.TENANTS_DB})).status,503);
 assert.equal((await staging.fetch(req("/health"),{
   ...env,TENANTS_DB:{prepare(){throw Error("no such table");}}
 })).status,503);
});
test("legacy operational routes are excluded from the staging Worker",async()=>{
 for(const path of ["/v1/portal-gateway","/v1/login","/v1/fleet/vehicles","/v1/games","/v1/monitor/state"]){
   const response=await staging.fetch(req(path),env);
   assert.equal(response.status,404,path);
 }
});
const accessEnv={...env,SUPER_ADMIN_ACCESS_EMAIL:"owner@example.test",SUPER_ADMIN_ACCESS_AUD:"staging-app-audience-tag"};
function accessCtx(email="owner@example.test",aud="staging-app-audience-tag"){
 return {access:{aud,async getIdentity(){return {email};}}};
}
test("staging admin endpoints deny requests without authenticated Cloudflare Access",async()=>{
 for(const path of ["/","/super-admin","/v1/super-admin/me","/v1/super-admin/transportadoras"]){
  const response=await staging.fetch(req(path),accessEnv);
  assert.equal(response.status,403,path);
 }
 const spoof=req("/v1/super-admin/me","GET",{
  "Cf-Access-Jwt-Assertion":"forged","Cf-Access-Authenticated-User-Email":"owner@example.test"
 });
 assert.equal((await staging.fetch(spoof,accessEnv)).status,403);
});
test("owner identity requires exact email and Access audience",async()=>{
 assert.equal((await staging.fetch(req("/v1/super-admin/me"),accessEnv,accessCtx("attacker@example.test"))).status,403);
 assert.equal((await staging.fetch(req("/v1/super-admin/me"),accessEnv,accessCtx("owner@example.test","wrong-aud"))).status,403);
 assert.equal((await staging.fetch(req("/v1/super-admin/me"),{...accessEnv,SUPER_ADMIN_ACCESS_AUD:""},accessCtx())).status,403);
 assert.equal((await staging.fetch(req("/v1/super-admin/me"),{...accessEnv,SUPER_ADMIN_ACCESS_EMAIL:""},accessCtx())).status,403);
});
test("verified Access owner can see same-origin admin panel and read D1 catalog",async()=>{
 const page=await staging.fetch(req("/super-admin"),accessEnv,accessCtx("OWNER@EXAMPLE.TEST"));
 assert.equal(page.status,200);
 assert.match(page.headers.get("Content-Type"),/text\/html/);
 assert.match(page.headers.get("Content-Security-Policy"),/connect-src 'self'/);
 const html=await page.text();
 assert.match(html,/const API_BASE = '';/);
 assert.doesNotMatch(html,/const API_BASE = 'https:\/\/api.portalfrete.net.br'/);
 assert.match(html,/Painel Super Admin/);
 const me=await staging.fetch(req("/v1/super-admin/me"),accessEnv,accessCtx());
 assert.equal(me.status,200);
 const profile=await me.json();
 assert.equal(profile.superAdmin,true);
 assert.equal(profile.usuario,"ACCESS_OWNER");
 assert.equal(profile.capabilities.tenantWrite,false);
 const companies=await staging.fetch(req("/v1/super-admin/transportadoras"),{
  ...accessEnv,TENANTS_DB:{prepare(sql){
   if(sql.includes("FROM portal_tenants ORDER BY name"))return{all:async()=>({results:[]})};
   return {bind(){return{all:async()=>({results:[]})};}};
  }}
 },accessCtx());
 assert.equal(companies.status,200);
 assert.equal((await companies.json()).catalogo,"d1");
});
test("Cloudflare Access owner alone never authorizes writes without separate OIDC MFA",async()=>{
 const res=await staging.fetch(req("/v1/super-admin/transportadoras","POST"),accessEnv,accessCtx());
 assert.equal(res.status,403);
});
test("staging browser requests deny unknown origin and permit configured origin",async()=>{
 const denied=await staging.fetch(req("/health","GET",{Origin:"https://evil.example"}),env);
 assert.equal(denied.status,403);
 assert.equal(denied.headers.get("Access-Control-Allow-Origin"),null);
 const trusted="https://staging.portalfrete.net.br";
 const response=await staging.fetch(req("/health","GET",{Origin:trusted}),{
   ...env,SUPER_ADMIN_STAGING_ALLOWED_ORIGIN:trusted
 });
 assert.equal(response.status,200);
 assert.equal(response.headers.get("Access-Control-Allow-Origin"),trusted);
 const preflight=await staging.fetch(req("/v1/super-admin/authorize","OPTIONS",{
   Origin:trusted,"Access-Control-Request-Headers":"authorization"
 }),{...env,SUPER_ADMIN_STAGING_ALLOWED_ORIGIN:trusted});
 assert.equal(preflight.status,204);
 assert.match(preflight.headers.get("Access-Control-Allow-Headers"),/Authorization/);
});
