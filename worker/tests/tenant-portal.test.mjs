import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {Script} from "node:vm";
import tenantPortal from "../src/tenant-portal.js";
import admin from "../src/staging.js";
import {setTenantCredentials} from "../src/services/super-admin-tenant-credentials.js";
import {passwordMatches} from "../src/services/tenant-auth.js";

const BASE="https://portalfrete-tenant-staging.example.workers.dev";
const ADMIN="https://portalfrete-super-admin-staging.example.workers.dev";
const ctx={access:{aud:"staging-audience-tenant-tests",async getIdentity(){return {email:"owner@example.test"};}}};
const access={SUPER_ADMIN_ACCESS_EMAIL:"owner@example.test",SUPER_ADMIN_ACCESS_AUD:"staging-audience-tenant-tests",
 SUPER_ADMIN_STAGING_WRITES:"enabled",SUPER_ADMIN_TENANT_WRITES:"enabled",
 SUPER_ADMIN_CREDENTIAL_WRITES:"enabled",SUPER_ADMIN_MEMBERSHIP_WRITES:"enabled"};

function database(){
 const sql=new DatabaseSync(":memory:");
 sql.exec("PRAGMA foreign_keys=ON");
 for(const migration of ["0001_tenants.sql","0002_tenant_portal.sql"])
  sql.exec(readFileSync(new URL("../migrations/super-admin/"+migration,import.meta.url),"utf8"));
 return {
  sql,
  prepare(query){
   const stmt=sql.prepare(query);
   return {
    first:async()=>stmt.get(),
    all:async()=>({results:stmt.all()}),
    run:async()=>stmt.run(),
    bind(...args){return{
      first:async()=>stmt.get(...args),
      all:async()=>({results:stmt.all(...args)}),
      run:async()=>stmt.run(...args),
      statement:stmt,args
    };}
   };
  },
  async batch(statements){
   sql.exec("BEGIN");
   try{const result=statements.map(s=>s.statement.run(...s.args));sql.exec("COMMIT");return result;}
   catch(error){sql.exec("ROLLBACK");throw error;}
  }
 };
}
function setup(){
 const db=database();
 for(const id of ["tenant-a","tenant-b"]){
  db.sql.prepare("INSERT INTO portal_tenants (id,name,status) VALUES (?,?,'active')").run(id,id);
  db.sql.prepare("INSERT INTO portal_tenant_users (tenant_id,user_id,role,active) VALUES (?,?,?,1)")
   .run(id,"USUARIO.TESTE","COMERCIAL");
  for(const module of ["fretes","bi"])db.sql.prepare(
   "INSERT INTO portal_tenant_modules (tenant_id,module_key,enabled) VALUES (?,?,1)"
  ).run(id,module);
 }
 return {TENANTS_DB:db,TENANT_BRANDS:{
  objects:new Map(),
  async get(key){const data=this.objects.get(key);return data?{body:new Response(data).body}:null;},
  async put(key,data){this.objects.set(key,new Uint8Array(data));}
 }};
}
const password="TesteSeguro!2418";
function req(path,method="GET",data,token,origin=BASE){
 return new Request(BASE+path,{method,headers:{
  ...(method!=="GET"?{"Origin":origin,"Content-Type":"application/json"}:{}),
  ...(token?{"Cookie":"__Host-tenant_session="+token}:{})
 },body:method==="GET"?undefined:JSON.stringify(data||{})});
}
function adminReq(path,method,body,origin=ADMIN){
 return new Request(ADMIN+path,{method,headers:{"Origin":origin,"Content-Type":"application/json"},
  body:JSON.stringify(body)});
}
async function seedPassword(environment,tenant="tenant-a"){
 const response=await setTenantCredentials(adminReq("/admin","PUT",{senha:password}),
  {...access,...environment},"owner-access",tenant,"USUARIO.TESTE");
 assert.equal(response.status,200);
}
async function login(environment,tenant="tenant-a",pass=password){
 const response=await tenantPortal.fetch(req("/api/login","POST",
  {tenantId:tenant,usuario:"USUARIO.TESTE",senha:pass}),environment);
 return response;
}
function cookie(response){
 return /__Host-tenant_session=([A-Za-z0-9_-]+)/.exec(response.headers.get("Set-Cookie")||"")?.[1]||"";
}

test("tenant staging page parses and does not reference legacy endpoints",async()=>{
 const response=await tenantPortal.fetch(req("/"),{});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/Acesso da transportadora/);
 assert.doesNotMatch(html,/api\.portalfrete\.net\.br|portal_gateway|__Host-portal_session/);
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match);
 assert.doesNotThrow(()=>new Script(match[1]));
 assert.match(response.headers.get("Content-Security-Policy"),/connect-src 'self'/);
});
test("migration 0002 runs independently on schema 0001 and creates FKs",()=>{
 const db=database();
 const names=db.sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'portal_tenant_%' ORDER BY name").all().map(x=>x.name);
 for(const name of ["portal_tenant_credentials","portal_tenant_sessions","portal_tenant_freights"])
  assert.ok(names.includes(name),name);
 assert.throws(()=>db.sql.prepare(`INSERT INTO portal_tenant_credentials
  (tenant_id,user_id,password_salt,password_hash,iterations,version)
  VALUES ('missing','bad','salt','hash',210000,'v')`).run());
});
test("owner provisioning uses PBKDF2, never stores password and is audited",async()=>{
 const env=setup();await seedPassword(env);
 const stored=env.TENANTS_DB.sql.prepare("SELECT * FROM portal_tenant_credentials WHERE tenant_id='tenant-a'").get();
 assert.equal(stored.iterations,210000);
 assert.notEqual(stored.password_hash,password);
 assert.notEqual(stored.password_salt,password);
 assert.equal(await passwordMatches(password,stored),true);
 assert.equal(await passwordMatches("wrong",stored),false);
 assert.equal(env.TENANTS_DB.sql.prepare("SELECT action FROM portal_tenant_audit").get().action,"credentials.reset");
 assert.equal(JSON.stringify(stored).includes(password),false);
});
test("owner-only staging route sets password; no unverified Access may reset",async()=>{
 const env={...setup(),...access};
 const path="/v1/super-admin/transportadoras/tenant-a/usuarios/USUARIO.TESTE/credenciais";
 assert.equal((await admin.fetch(adminReq(path,"PUT",{senha:password}),env)).status,403);
 assert.equal((await admin.fetch(adminReq(path,"PUT",{senha:password}),env,{
  access:{aud:"invalid",async getIdentity(){return {email:"owner@example.test"};}}
 })).status,403);
 const ok=await admin.fetch(adminReq(path,"PUT",{senha:password}),env,ctx);
 assert.equal(ok.status,200);
 assert.equal(JSON.stringify(await ok.json()).includes(password),false);
 assert.equal(env.TENANTS_DB.sql.prepare("SELECT COUNT(*) AS n FROM portal_tenant_credentials").get().n,1);
});
test("login requires tenant and membership active and returns HttpOnly cookie",async()=>{
 const env=setup();await seedPassword(env);
 assert.equal((await login(env,"tenant-a","incorrect")).status,401);
 const res=await login(env);
 assert.equal(res.status,200);
 const setCookie=res.headers.get("Set-Cookie");
 assert.match(setCookie,/HttpOnly/);
 assert.match(setCookie,/Secure/);
 assert.match(setCookie,/SameSite=Strict/);
 assert.match(setCookie,/__Host-tenant_session=/);
 const token=cookie(res);
 const me=await tenantPortal.fetch(req("/api/me","GET",null,token),env);
 assert.equal(me.status,200);
 const data=await me.json();
 assert.deepEqual(data.modules,["bi","fretes"]);
 assert.equal(data.tenant.id,"tenant-a");
 assert.equal(data.usuario,"USUARIO.TESTE");
 const unauth=await tenantPortal.fetch(req("/api/me"),env);
 assert.equal(unauth.status,401);
});
test("inactive tenant or inactive membership immediately blocks login and active sessions",async()=>{
 const env=setup();await seedPassword(env);let token=cookie(await login(env));
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_users SET active=0 WHERE tenant_id='tenant-a'").run();
 assert.equal((await tenantPortal.fetch(req("/api/me","GET",null,token),env)).status,401);
 assert.equal((await login(env)).status,401);
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_users SET active=1 WHERE tenant_id='tenant-a'").run();
 token=cookie(await login(env));
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenants SET status='inactive' WHERE id='tenant-a'").run();
 assert.equal((await tenantPortal.fetch(req("/api/me","GET",null,token),env)).status,401);
 assert.equal((await login(env)).status,401);
});
test("password reset revokes existing sessions and old password",async()=>{
 const env=setup();await seedPassword(env);
 const token=cookie(await login(env));
 await setTenantCredentials(adminReq("/admin","PUT",{senha:"NovaSenha#867341"}),{
  ...access,...env},"owner-access","tenant-a","USUARIO.TESTE");
 assert.equal((await tenantPortal.fetch(req("/api/me","GET",null,token),env)).status,401);
 assert.equal((await login(env)).status,401);
 assert.equal((await login(env,"tenant-a","NovaSenha#867341")).status,200);
});
test("login rate limits failed attempts for a tenant user",async()=>{
 const env=setup();await seedPassword(env);
 for(let i=0;i<8;i++)assert.equal((await login(env,"tenant-a","bad-password")).status,401);
 assert.equal((await login(env)).status,429);
});
test("login and change methods reject cross-site requests or bad content types",async()=>{
 const env=setup();await seedPassword(env);
 assert.equal((await tenantPortal.fetch(req("/api/login","POST",{
  tenantId:"tenant-a",usuario:"USUARIO.TESTE",senha:password},null,"https://attacker.test"),env)).status,403);
 const response=await tenantPortal.fetch(new Request(BASE+"/api/login",{method:"POST",
  headers:{Origin:BASE,"Content-Type":"application/x-www-form-urlencoded"},body:"usuario=test"}),env);
 assert.equal(response.status,400);
});
test("freights saved by one tenant are invisible to another tenant",async()=>{
 const env=setup();await seedPassword(env,"tenant-a");await seedPassword(env,"tenant-b");
 const a=cookie(await login(env,"tenant-a")),b=cookie(await login(env,"tenant-b"));
 const create=await tenantPortal.fetch(req("/api/fretes","POST",{
  origem:"Rio Verde - GO",destino:"Santos - SP",produto:"Soja",valorTon:220},a),env);
 assert.equal(create.status,201);
 const freight=(await create.json()).frete;
 const listA=await tenantPortal.fetch(req("/api/fretes","GET",null,a),env);
 assert.equal((await listA.json()).fretes.length,1);
 const listB=await tenantPortal.fetch(req("/api/fretes","GET",null,b),env);
 assert.equal((await listB.json()).fretes.length,0);
 const denied=await tenantPortal.fetch(req("/api/fretes/"+freight.id,"PATCH",
  {status:"finalizado"},b),env);
 assert.equal(denied.status,404);
 const updated=await tenantPortal.fetch(req("/api/fretes/"+freight.id,"PATCH",
  {status:"finalizado"},a),env);
 assert.equal(updated.status,200);
 const audit=env.TENANTS_DB.sql.prepare("SELECT tenant_id,action FROM portal_tenant_audit WHERE action LIKE 'freight.%'").all();
 assert.ok(audit.every(x=>x.tenant_id==="tenant-a"));
});
test("disabled freights module and read-only role never bypass server authorization",async()=>{
 const env=setup();await seedPassword(env);
 const token=cookie(await login(env));
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_modules SET enabled=0 WHERE tenant_id='tenant-a' AND module_key='fretes'").run();
 assert.equal((await tenantPortal.fetch(req("/api/fretes","GET",null,token),env)).status,403);
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_modules SET enabled=1 WHERE tenant_id='tenant-a' AND module_key='fretes'").run();
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_users SET role='PISO' WHERE tenant_id='tenant-a'").run();
 assert.equal((await tenantPortal.fetch(req("/api/fretes","POST",{
  origem:"A",destino:"B",produto:"Soja",valorTon:50},token),env)).status,403);
});
test("BI queries aggregate only the logged-in tenant and require its BI module",async()=>{
 const env=setup();await seedPassword(env);
 const token=cookie(await login(env));
 let response=await tenantPortal.fetch(req("/api/bi","GET",null,token),env);
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()),{ok:true,total:0,abertos:0,finalizados:0});
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_modules SET enabled=0 WHERE tenant_id='tenant-a' AND module_key='bi'").run();
 assert.equal((await tenantPortal.fetch(req("/api/bi","GET",null,token),env)).status,403);
});
test("logout destroys server session; Nova Frota production endpoints do not exist",async()=>{
 const env=setup();await seedPassword(env);
 const token=cookie(await login(env));
 const logout=await tenantPortal.fetch(req("/api/logout","POST",{},token),env);
 assert.equal(logout.status,200);
 assert.match(logout.headers.get("Set-Cookie"),/Max-Age=0/);
 assert.equal((await tenantPortal.fetch(req("/api/me","GET",null,token),env)).status,401);
 for(const path of ["/v1/login","/v1/portal-gateway","/v1/fretes","/v1/super-admin/me"])
  assert.equal((await tenantPortal.fetch(req(path),env)).status,404);
});

test("health requires dedicated D1 schema and private logo binding",async()=>{
 const env=setup();
 assert.equal((await tenantPortal.fetch(req("/health"),env)).status,200);
 assert.equal((await tenantPortal.fetch(req("/health"),{TENANTS_DB:env.TENANTS_DB})).status,503);
 const result=await tenantPortal.fetch(req("/health"),env);
 assert.equal((await result.json()).environment,"tenant-staging");
});
test("each authenticated tenant sees only its own private R2 logo",async()=>{
 const env=setup();await seedPassword(env,"tenant-a");await seedPassword(env,"tenant-b");
 const a=cookie(await login(env,"tenant-a")),b=cookie(await login(env,"tenant-b"));
 const imageA=new Uint8Array([137,80,78,71,13,10,26,10,1]);
 const imageB=new Uint8Array([137,80,78,71,13,10,26,10,2]);
 env.TENANT_BRANDS.objects.set("tenant/tenant-a/logo/abc.png",imageA);
 env.TENANT_BRANDS.objects.set("tenant/tenant-b/logo/def.png",imageB);
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenants SET logo_key=? WHERE id=?")
  .run("tenant/tenant-a/logo/abc.png","tenant-a");
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenants SET logo_key=? WHERE id=?")
  .run("tenant/tenant-b/logo/def.png","tenant-b");
 const ra=await tenantPortal.fetch(req("/api/logo","GET",null,a),env);
 const rb=await tenantPortal.fetch(req("/api/logo","GET",null,b),env);
 assert.equal(ra.status,200);assert.equal(rb.status,200);
 assert.deepEqual(new Uint8Array(await ra.arrayBuffer()),imageA);
 assert.deepEqual(new Uint8Array(await rb.arrayBuffer()),imageB);
 assert.equal((await tenantPortal.fetch(req("/api/logo"),env)).status,401);
});
