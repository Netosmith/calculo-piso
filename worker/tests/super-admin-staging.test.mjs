import test from "node:test";
import assert from "node:assert/strict";
import staging from "../src/staging.js";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

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
test("staging mutations remain off without explicit opt-in, despite verified Access",async()=>{
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

function dbForStaging(){
 const sql=new DatabaseSync(":memory:");
 sql.exec("PRAGMA foreign_keys=ON");
 sql.exec(readFileSync(new URL("../migrations/super-admin/0001_tenants.sql",import.meta.url),"utf8"));
 return {
  sql,
  prepare(query){
   const stmt=sql.prepare(query);
   return {
    first:async()=>stmt.get(),
    all:async()=>({results:stmt.all()}),
    bind(...args){return{
      first:async()=>stmt.get(...args),
      all:async()=>({results:stmt.all(...args)}),
      statement:stmt,args
    };}
   };
  },
  async batch(commands){
   sql.exec("BEGIN");
   try{const result=commands.map(command=>command.statement.run(...command.args));sql.exec("COMMIT");return result;}
   catch(error){sql.exec("ROLLBACK");throw error;}
  }
 };
}
function writableEnv(){
 return {
  ...accessEnv,TENANTS_DB:dbForStaging(),
  SUPER_ADMIN_STAGING_WRITES:"enabled",
  SUPER_ADMIN_TENANT_WRITES:"enabled",
  SUPER_ADMIN_MEMBERSHIP_WRITES:"enabled",
  SUPER_ADMIN_BRAND_WRITES:"enabled",
  TENANT_BRANDS:{
   objects:new Map(),
   async put(key,data){this.objects.set(key,new Uint8Array(data));},
   async get(key){const bytes=this.objects.get(key);return bytes?{body:new Response(bytes).body}:null;},
   async delete(key){this.objects.delete(key);}
  }
 };
}
function mutation(path,method,body,extra={}){
 return new Request(root+path,{
  method,
  headers:{"Origin":root,"Content-Type":"application/json",...extra},
  body:JSON.stringify(body)
 });
}
test("Cloudflare Access staging UI uses same-origin writes without a second token",async()=>{
 const config=writableEnv();
 const page=await staging.fetch(req("/super-admin"),config,accessCtx());
 assert.equal(page.status,200);
 const html=await page.text();
 assert.match(html,/const API_BASE = '';/);
 assert.match(html,/writeReady\?'liberada pelo Cloudflare Access'/);
 assert.match(html,/async function writeRequest\(path,method,data,contentType/);
 assert.match(html,/const canEdit=\(\)=>Boolean\(writeReady&&selected/);
 assert.doesNotMatch(html,/if\(!mfaToken\|\|!mfaActive\)throw/);
 assert.match(html,/\$\('adminAuth'\)\.hidden=true/);
 const inline=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(inline);
 assert.doesNotThrow(()=>new Script(inline[1]));
 const response=await staging.fetch(req("/v1/super-admin/me"),config,accessCtx());
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).capabilities,{
  tenantCatalog:true,legacyUserRead:false,
  tenantWrite:true,membershipWrite:true,brandWrite:true,userWrite:false
 });
});
test("staging Access owner can create and configure a real audited tenant",async()=>{
 const config=writableEnv(),ctx=accessCtx();
 let response=await staging.fetch(mutation("/v1/super-admin/transportadoras","POST",
  {id:"tenant-teste",name:"Transportadora Teste"}),config,ctx);
 assert.equal(response.status,201);
 assert.equal((await response.json()).transportadora.active,false);
 assert.equal(config.TENANTS_DB.sql.prepare("SELECT status FROM portal_tenants WHERE id='tenant-teste'").get().status,"inactive");
 response=await staging.fetch(mutation("/v1/super-admin/transportadoras/tenant-teste/modules","PUT",
  {modules:["fretes","bi"]}),config,ctx);
 assert.equal(response.status,200);
 response=await staging.fetch(mutation("/v1/super-admin/transportadoras/tenant-teste/usuarios","POST",
  {usuario:"usuario.teste",perfil:"COMERCIAL"}),config,ctx);
 assert.equal(response.status,201);
 assert.equal((await response.json()).usuario.ativo,false);
 response=await staging.fetch(mutation("/v1/super-admin/transportadoras/tenant-teste","PATCH",
  {name:"Transportadora Atualizada",status:"active"}),config,ctx);
 assert.equal(response.status,200);
 const list=await staging.fetch(req("/v1/super-admin/transportadoras"),config,ctx);
 const body=await list.json();
 assert.equal(body.transportadoras.find(company=>company.id==="tenant-teste").name,"Transportadora Atualizada");
 assert.deepEqual(body.transportadoras.find(company=>company.id==="tenant-teste").modules,["fretes","bi"]);
 const events=await staging.fetch(req("/v1/super-admin/transportadoras/tenant-teste/auditoria"),config,ctx);
 assert.equal((await events.json()).eventos.length,4);
});
test("staging logo upload reaches isolated R2, never the legacy brand store",async()=>{
 const config=writableEnv(),ctx=accessCtx();
 await staging.fetch(mutation("/v1/super-admin/transportadoras","POST",
  {id:"tenant-logo",name:"Transportadora Logo"}),config,ctx);
 const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
 const upload=new Request(root+"/v1/super-admin/transportadoras/tenant-logo/logo",{
  method:"PUT",headers:{Origin:root,"Content-Type":"image/png"},body:bytes
 });
 const response=await staging.fetch(upload,config,ctx);
 assert.equal(response.status,200);
 assert.equal(config.TENANT_BRANDS.objects.size,1);
 const logo=await staging.fetch(req("/v1/super-admin/transportadoras/tenant-logo/logo"),config,ctx);
 assert.equal(logo.status,200);
 assert.deepEqual(new Uint8Array(await logo.arrayBuffer()),bytes);
});
test("staging writes reject cross-site, missing Origin, forms and spoofed identities",async()=>{
 const config=writableEnv(),json={id:"tenant-evil",name:"Tenant Evil"},path="/v1/super-admin/transportadoras";
 for(const headers of [
   {Origin:"https://evil.example","Content-Type":"application/json"},
   {"Content-Type":"application/json"},
   {Origin:root,"Content-Type":"application/json","Sec-Fetch-Site":"cross-site"},
   {Origin:root,"Content-Type":"application/x-www-form-urlencoded"}
 ]){
  const request=new Request(root+path,{method:"POST",headers,body:JSON.stringify(json)});
  const res=await staging.fetch(request,config,accessCtx());
  assert.equal(res.status,403===res.status?403:415);
 }
 assert.equal((await staging.fetch(mutation(path,"POST",json),config,accessCtx("attacker@example.test"))).status,403);
 assert.equal(config.TENANTS_DB.sql.prepare("SELECT COUNT(*) AS n FROM portal_tenants").get().n,0);
});
test("Nova Frota is protected from administrative mutations in staging",async()=>{
 const config=writableEnv(),ctx=accessCtx();
 const existing=await staging.fetch(mutation("/v1/super-admin/transportadoras/nova-frota","PATCH",
  {name:"Nao alterar"}),config,ctx);
 assert.equal(existing.status,404);
 const created=await staging.fetch(mutation("/v1/super-admin/transportadoras","POST",
  {id:"nova-frota",name:"Nao alterar"}),config,ctx);
 assert.equal(created.status,400);
});
