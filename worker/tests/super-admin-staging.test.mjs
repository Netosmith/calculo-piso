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
test("administrative endpoint cannot run without owner session configuration",async()=>{
 const a=await staging.fetch(req("/v1/super-admin/me"),env);
 assert.equal(a.status,503);
 const b=await staging.fetch(req("/v1/super-admin/me"),{...env,PORTAL_KEY:"staging-only-secret",SUPER_ADMIN_USER:"OWNER"});
 assert.equal(b.status,401);
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
