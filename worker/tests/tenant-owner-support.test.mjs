import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {routeRequest} from "../src/router.js";
import {createSessionToken} from "../src/services/session.js";
import {corsHeaders} from "../src/middleware/cors.js";

const API="https://api.portalfrete.net.br";
const ORIGIN="https://portalfrete.net.br";
function fixture(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec("PRAGMA foreign_keys=ON");
 for(const migration of ["0001_tenants.sql","0002_tenant_portal.sql"])
  sqlite.exec(readFileSync(new URL("../migrations/super-admin/"+migration,import.meta.url),"utf8"));
 const tenants=[["teste-01","GNOVA","active"],["outra-empresa","Segunda","active"],["inativa","Inativa","inactive"]];
 for(const [id,name,status] of tenants){
  sqlite.prepare("INSERT INTO portal_tenants(id,name,status) VALUES(?,?,?)").run(id,name,status);
  for(const module of ["fretes","cadastros","bi"])
   sqlite.prepare("INSERT INTO portal_tenant_modules(tenant_id,module_key,enabled) VALUES(?,?,1)").run(id,module);
 }
 sqlite.prepare("INSERT INTO portal_tenant_users(tenant_id,user_id,role,active) VALUES('teste-01','ANDERSON','OPERACIONAL',1)").run();
 const db={
  prepare(query){
   const stmt=sqlite.prepare(query);
   return {
    first:async()=>stmt.get(),all:async()=>({results:stmt.all()}),
    bind(...args){return{
     first:async()=>stmt.get(...args),all:async()=>({results:stmt.all(...args)}),
     run:async()=>stmt.run(...args),statement:stmt,args
    };}
   };
  },
  async batch(statements){
   sqlite.exec("BEGIN");
   try{const out=statements.map(x=>x.statement.run(...x.args));sqlite.exec("COMMIT");return out;}
   catch(e){sqlite.exec("ROLLBACK");throw e;}
  }
 };
 return {sqlite,env:{
  TENANTS_DB:db,TENANT_PORTAL_ENABLED:"enabled",
  SUPER_ADMIN_USER:"LUZIANO",PORTAL_KEY:"owner-support-tests-key-not-public"
 }};
}
async function ownerCookie(env,username="LUZIANO",profile="ADMINISTRADOR",company="nova-frota"){
 const token=await createSessionToken(env,{
  usuario:username,perfil:profile,transportadoraId:company,
  createdAt:new Date().toISOString(),
  expiresAt:new Date(Date.now()+10*60*1000).toISOString()
 });
 return "__Host-portal_session="+token;
}
function request(path,method="GET",body,cookie="",extras={}){
 const headers={...(method==="GET"?{}:{Origin:ORIGIN,"Content-Type":"application/json"}),
  ...(cookie?{Cookie:cookie}:{}),...extras};
 return new Request(API+path,{method,headers,body:method==="GET"?undefined:JSON.stringify(body||{})});
}
test("LUZIANO gets a scoped support session at any company URL with existing signed Nova Frota login",async()=>{
 const {env,sqlite}=fixture();
 const cookie=await ownerCookie(env);
 for(const tenantId of ["teste-01","outra-empresa","inativa"]){
  const response=await routeRequest(request("/v1/tenant/context?tenantId="+tenantId,"GET",null,cookie),env);
  assert.equal(response.status,200,tenantId);
  const {session}=await response.json();
  assert.equal(session.ownerSupport,true);
  assert.equal(session.usuario,"LUZIANO");
  assert.equal(session.perfil,"ADMINISTRADOR");
  assert.equal(session.transportadoraId,tenantId);
  assert.equal(session.tenantMode,true);
  assert.ok(session.modules.includes("fretes"));
 }
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM portal_tenant_users WHERE user_id='LUZIANO'").get().n,0);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM portal_tenant_sessions").get().n,0);
});
test("Authenticated support API reads and writes only the transportadora requested on that call",async()=>{
 const {env,sqlite}=fixture(),cookie=await ownerCookie(env);
 const headers={"X-Portal-Support-Tenant":"teste-01"};
 const saved=await routeRequest(request("/v1/tenant/fretes","POST",{
  origem:"Rio Verde - GO",destino:"Santos - SP",produto:"Soja",valorTon:230
 },cookie,headers),env);
 assert.equal(saved.status,201,await saved.text());
 const a=await routeRequest(request("/v1/tenant/fretes","GET",null,cookie,headers),env);
 const b=await routeRequest(request("/v1/tenant/fretes","GET",null,cookie,{"X-Portal-Support-Tenant":"outra-empresa"}),env);
 assert.equal(a.status,200);
 assert.equal(b.status,200);
 assert.equal((await a.json()).fretes.length,1);
 assert.equal((await b.json()).fretes.length,0);
 const users=await routeRequest(request("/v1/tenant/usuarios","GET",null,cookie,headers),env);
 assert.equal(users.status,200);
 const accounts=(await users.json()).usuarios;
 assert.equal(accounts.length,1);
 assert.equal(accounts[0].Usuario,"ANDERSON");
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM portal_tenant_users WHERE user_id='LUZIANO'").get().n,0);
});
test("Owner support cannot be forged with headers, tenant URLs, ordinary users or stale cookies",async()=>{
 const {env}=fixture();
 const target="/v1/tenant/context?tenantId=teste-01";
 const data="/v1/tenant/usuarios";
 for(const cookie of ["",await ownerCookie(env,"OUTRO"),
  await ownerCookie(env,"LUZIANO","COMERCIAL"),
  await ownerCookie(env,"LUZIANO","ADMINISTRADOR","outra-empresa")]){
  const context=await routeRequest(request(target,"GET",null,cookie),env);
  assert.notEqual(context.status,200);
  const spoof=await routeRequest(request(data,"GET",null,cookie,{"X-Portal-Support-Tenant":"teste-01"}),env);
  assert.equal(spoof.status,403);
 }
 const owner=await ownerCookie(env);
 const mismatch=await routeRequest(request("/v1/tenant/logo?supportTenant=outra-empresa",
  "GET",null,owner,{"X-Portal-Support-Tenant":"teste-01"}),env);
 assert.equal(mismatch.status,403);
 const noOwner={...env,SUPER_ADMIN_USER:""};
 assert.equal((await routeRequest(request(target,"GET",null,owner),noOwner)).status,403);
 assert.equal((await routeRequest(request(data,"GET",null,owner,{"X-Portal-Support-Tenant":"x/../../"}),env)).status,403);
 assert.equal((await routeRequest(request("/v1/tenant/context?tenantId=nova-frota","GET",null,owner),env)).status,400);
});
test("Browser uses explicit support scope for session, API and visual assets without storing an owner in tenants",async()=>{
 const api=readFileSync(new URL("../../assets/js/api.js",import.meta.url),"utf8");
 const requests=[];
 const window={__PORTAL_TENANT_EXPECTED:"teste-01",__PORTAL_TENANT_SESSION:{
  tenantMode:true,ownerSupport:true,transportadoraId:"teste-01",perfil:"ADMINISTRADOR",usuario:"LUZIANO"
 }};
 const sandbox={window,fetch:async(url,options)=>{
  requests.push({url,headers:options.headers,method:options.method});
  return {ok:true,status:200,json:async()=>({ok:true,session:window.__PORTAL_TENANT_SESSION,data:[]})};
 }};
 assert.doesNotThrow(()=>new Script(api));
 new Script(api).runInNewContext(sandbox);
 await window.PortalAPI.session();
 await window.PortalAPI.tenantRequest("/usuarios");
 await window.PortalAPI.call("fretes","read",{});
 assert.equal(requests[0].url,API+"/v1/tenant/context?tenantId=teste-01");
 assert.equal(requests[1].headers["X-Portal-Support-Tenant"],"teste-01");
 assert.equal(requests[2].headers["X-Portal-Support-Tenant"],"teste-01");
 assert.equal(window.PortalAPI.tenantLogoUrl(),API+"/v1/tenant/logo?supportTenant=teste-01");
 assert.equal(window.PortalAPI.tenantResourceUrl("artes"),API+"/v1/tenant/artes?supportTenant=teste-01");
 const preflight=corsHeaders(new Request(API+"/v1/tenant/usuarios",{headers:{Origin:ORIGIN}}));
 assert.ok(preflight["Access-Control-Allow-Headers"].includes("X-Portal-Support-Tenant"));
});
test("Tenant page loader and branded resources honor support identity without a second login",()=>{
 const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
 const backend=read("worker/src/services/tenant-owner-support.js");
 assert.match(backend,/export async function ownerSupportPrincipal/);
 assert.doesNotMatch(backend,/document\.currentScript/);
 const loader=read("assets/js/tenant-page.js");
 const login=read("assets/js/tenant-login.js");
 const route=read("assets/js/tenant-route.js");
 assert.match(loader,/\/v1\/tenant\/context[?]tenantId=/);
 assert.ok(loader.indexOf('get("https://api.portalfrete.net.br/v1/session"') <
  loader.indexOf('get("/pages/"+page'));
 assert.match(login,/PortalAPI\.tenantContext\(tenantId\)/);
 assert.match(route,/portalTenantResourceUrl=tenantVisualUrl/);
 for(const p of ["assets/js/tenant-page.js","assets/js/tenant-login.js",
   "assets/js/tenant-route.js","assets/js/fretes.js","assets/js/fretes2.js"])
  assert.doesNotThrow(()=>new Script(read(p),{filename:p}),p);
});
