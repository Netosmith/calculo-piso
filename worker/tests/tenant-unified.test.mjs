import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {Script} from "node:vm";
import {routeRequest} from "../src/router.js";
import {loginController,sessionController,logoutController} from "../src/controllers/session.js";
import {setTenantCredentials,credentialSchemaStatus} from "../src/services/super-admin-tenant-credentials.js";
import {createSessionToken} from "../src/services/session.js";
import {makePasswordRecord,passwordMatches} from "../src/services/tenant-auth.js";

const API="https://api.portalfrete.net.br",origin="https://portalfrete.net.br";
function db(){
 const sql=new DatabaseSync(":memory:");
 sql.exec("PRAGMA foreign_keys=ON");
 for(const file of ["0001_tenants.sql","0002_tenant_portal.sql"])
  sql.exec(readFileSync(new URL("../migrations/super-admin/"+file,import.meta.url),"utf8"));
 return {
  sql,
  prepare(query){
   const stmt=sql.prepare(query);
   return {
    first:async()=>stmt.get(),all:async()=>({results:stmt.all()}),run:async()=>stmt.run(),
    bind(...args){return{
      first:async()=>stmt.get(...args),all:async()=>({results:stmt.all(...args)}),
      run:async()=>stmt.run(...args),statement:stmt,args
    };}
   };
  },
  async batch(items){
   sql.exec("BEGIN");
   try{const out=items.map(item=>item.statement.run(...item.args));sql.exec("COMMIT");return out;}
   catch(error){sql.exec("ROLLBACK");throw error;}
  }
 };
}
function environment(){
 const database=db();
 for(const id of ["teste-01","outra-empresa","inativa"]){
  database.sql.prepare("INSERT INTO portal_tenants(id,name,status) VALUES(?,?,?)")
   .run(id,id,"inativa"===id?"inactive":"active");
  database.sql.prepare("INSERT INTO portal_tenant_users(tenant_id,user_id,role,active) VALUES(?,?,?,1)")
   .run(id,"USUARIO.TESTE","COMERCIAL");
  for(const module of ["fretes","bi"])
   database.sql.prepare("INSERT INTO portal_tenant_modules(tenant_id,module_key,enabled) VALUES(?,?,1)")
    .run(id,module);
 }
 return {TENANTS_DB:database,TENANT_PORTAL_ENABLED:"enabled",
   SUPER_ADMIN_CREDENTIAL_WRITES:"enabled",TENANT_BRANDS:{
    objects:new Map(),
    async get(key){const bytes=this.objects.get(key);return bytes?{body:new Response(bytes).body}:null;}
   }};
}
const password="SenhaTeste#123456";
function request(path,method="GET",body,token,extras={}){
 const headers={...((method!=="GET")?{Origin:origin,"Content-Type":"application/json"}:{}),...extras};
 if(token)headers.Cookie=token.startsWith("__Host-")?token:"__Host-tenant_session="+token;
 return new Request(API+path,{method,headers,
  body:method==="GET"?undefined:JSON.stringify(body||{})});
}
function cookie(response){
 const setCookie=response.headers.get("Set-Cookie")||"";
 const match=/__Host-tenant_session=([A-Za-z0-9_-]{43})/.exec(setCookie);
 return match?.[1]||"";
}
async function provision(env,id="teste-01",passwordValue=password){
 const response=await setTenantCredentials(request("/setup","PUT",{senha:passwordValue}),env,"OWNER",id,"USUARIO.TESTE");
 assert.equal(response.status,200);
}
async function login(env,id="teste-01",pass=password){
 return loginController(request("/v1/login","POST",{
  transportadoraId:id,usuario:"usuario.teste",senha:pass
 }),env);
}
test("new password records use one Cloudflare-compatible 100k PBKDF2 call",async()=>{
 const record=await makePasswordRecord("SenhaTeste#123456");
 assert.equal(record.iterations,100000);
 assert.match(record.password_hash,/^pbkdf2-sha256-100k:[A-Za-z0-9_-]+$/);
 assert.equal(await passwordMatches("SenhaTeste#123456",record),true);
 assert.equal(await passwordMatches("senha-errada-123",record),false);
 assert.equal(await passwordMatches("SenhaTeste#123456",null),false);
 assert.notEqual((await makePasswordRecord("SenhaTeste#123456")).password_hash,record.password_hash);
});
test("old two-pass records remain verifiable after the Cloudflare crypto format update",async()=>{
 const phrase="SenhaHistorica#123456";
 const salt=new Uint8Array(16);crypto.getRandomValues(salt);
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(phrase),{name:"PBKDF2"},false,["deriveBits"]);
 const first=new Uint8Array(await crypto.subtle.deriveBits({
  name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"
 },key,256));
 const domain=new TextEncoder().encode("portal-frete/tenant-password/v2/round-2");
 const salt2=new Uint8Array(salt.length+domain.length);salt2.set(salt);salt2.set(domain,salt.length);
 const secondKey=await crypto.subtle.importKey("raw",first,{name:"PBKDF2"},false,["deriveBits"]);
 const derived=new Uint8Array(await crypto.subtle.deriveBits({
  name:"PBKDF2",salt:salt2,iterations:100000,hash:"SHA-256"
 },secondKey,256));
 const b64=bytes=>Buffer.from(bytes).toString("base64url");
 const record={password_salt:b64(salt),password_hash:"pbkdf2-sha256-2x100k:"+b64(derived),iterations:100000};
 assert.equal(await passwordMatches(phrase,record),true);
 assert.equal(await passwordMatches("SenhaErrada#123",record),false);
});
test("tenant password verifier supports prior unversioned 100k hashes and safely rejects unsupported cost",async()=>{
 const salt=new Uint8Array(16);crypto.getRandomValues(salt);
 const value="SenhaLegada#123456";
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(value),{name:"PBKDF2"},false,["deriveBits"]);
 const hash=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256));
 const b64=bytes=>Buffer.from(bytes).toString("base64url");
 const row={password_salt:b64(salt),password_hash:b64(hash),iterations:100000};
 assert.equal(await passwordMatches(value,row),true);
 assert.equal(await passwordMatches("SenhaErrada#123",row),false);
 assert.equal(await passwordMatches(value,{...row,iterations:210000}),false);
});

test("credential readiness checks all D1 tables and required columns",async()=>{
 const env=environment();
 assert.deepEqual(await credentialSchemaStatus(env.TENANTS_DB),{ok:true,missing:[]});
 env.TENANTS_DB.sql.exec("DROP TABLE portal_tenant_sessions");
 assert.deepEqual(await credentialSchemaStatus(env.TENANTS_DB),{ok:false,missing:["sessoes"]});
 const response=await setTenantCredentials(request("/setup","PUT",{senha:password}),env,"OWNER","teste-01","USUARIO.TESTE");
 assert.equal(response.status,503);
 assert.match((await response.json()).error,/estrutura D1|Estrutura D1/);
 assert.equal(env.TENANTS_DB.sql.prepare("SELECT COUNT(*) AS n FROM portal_tenant_credentials").get().n,0);
});
test("credential reset remains atomic and invalidates existing tenant sessions",async()=>{
 const env=environment();
 await provision(env);
 const session=cookie(await login(env));
 assert.ok(session);
 const reset=await setTenantCredentials(request("/setup","PUT",{senha:"NovaSenhaForte#456"}),env,"OWNER","teste-01","USUARIO.TESTE");
 assert.equal(reset.status,200);
 assert.equal((await sessionController(request("/v1/session","GET",null,session),env)).status,401);
 assert.equal((await login(env,"teste-01",password)).status,401);
 assert.equal((await login(env,"teste-01","NovaSenhaForte#456")).status,200);
});

test("anonymous tenant catalog never lists customer transportadoras",async()=>{
 const env=environment();
 const response=await routeRequest(request("/v1/transportadoras/public"),env);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.deepEqual(data.transportadoras.map(x=>x.id),["nova-frota"]);
 assert.doesNotMatch(JSON.stringify(data),/teste-01|outra-empresa/i);
 const fallback=await (await routeRequest(request("/v1/transportadoras/public"),{})).json();
 assert.deepEqual(fallback.transportadoras.map(x=>x.id),["nova-frota"]);
 assert.equal((await routeRequest(request("/v1/transportadoras/public","POST",{}),env)).status,405);
});
test("one login form authenticates a tenant with password and creates a separate secure cookie",async()=>{
 const env=environment();await provision(env);
 assert.equal((await login(env,"inativa")).status,401);
 assert.equal((await login(env,"teste-01","wrong")).status,401);
 const response=await login(env);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.requiresStateSelection,false);
 assert.equal(body.session.transportadoraId,"teste-01");
 assert.equal(body.session.transportadoraNome,"teste-01");
 assert.deepEqual(body.session.modules,["bi","fretes"]);
 assert.equal(body.session.estado,"GERAL");
 assert.equal(body.session.tenantMode,true);
 const headers=response.headers.get("Set-Cookie")||"";
 assert.match(headers,/__Host-tenant_session=/);
 assert.match(headers,/HttpOnly/);
 assert.match(headers,/SameSite=Strict/);
 assert.match(headers,/__Host-portal_session=/);
 const token=cookie(response);
 const session=await sessionController(request("/v1/session","GET",null,token),env);
 assert.equal(session.status,200);
 assert.equal((await session.json()).session.transportadoraId,"teste-01");
});
test("tenant freights and BI are isolated by authenticated tenant on the existing API Worker",async()=>{
 const env=environment();await provision(env,"teste-01");await provision(env,"outra-empresa");
 const a=cookie(await login(env,"teste-01"));
 const b=cookie(await login(env,"outra-empresa"));
 const created=await routeRequest(request("/v1/tenant/fretes","POST",{
  origem:"Rio Verde - GO",destino:"Santos - SP",produto:"Soja",valorTon:250
 },a),env);
 assert.equal(created.status,201);
 const id=(await created.json()).frete.id;
 const dataA=await (await routeRequest(request("/v1/tenant/fretes","GET",null,a),env)).json();
 const dataB=await (await routeRequest(request("/v1/tenant/fretes","GET",null,b),env)).json();
 assert.equal(dataA.fretes.length,1);
 assert.equal(dataB.fretes.length,0);
 assert.equal((await routeRequest(request("/v1/tenant/fretes/"+id,"PATCH",{status:"finalizado"},b),env)).status,404);
 assert.equal((await routeRequest(request("/v1/tenant/fretes/"+id,"PATCH",{status:"finalizado"},a),env)).status,200);
 const biA=await (await routeRequest(request("/v1/tenant/bi","GET",null,a),env)).json();
 const biB=await (await routeRequest(request("/v1/tenant/bi","GET",null,b),env)).json();
 assert.deepEqual([biA.total,biA.finalizados],[1,1]);
 assert.deepEqual([biB.total,biB.finalizados],[0,0]);
});
test("inactive user or tenant revokes read access immediately on unified portal",async()=>{
 const env=environment();await provision(env);
 const token=cookie(await login(env));
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_users SET active=0 WHERE tenant_id='teste-01'").run();
 assert.equal((await sessionController(request("/v1/session","GET",null,token),env)).status,401);
 assert.equal((await routeRequest(request("/v1/tenant/fretes","GET",null,token),env)).status,401);
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_users SET active=1 WHERE tenant_id='teste-01'").run();
 assert.equal((await sessionController(request("/v1/session","GET",null,token),env)).status,200);
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenants SET status='inactive' WHERE id='teste-01'").run();
 assert.equal((await sessionController(request("/v1/session","GET",null,token),env)).status,401);
});
test("tenant cookies deny legacy routes but may read shared client logos",async()=>{
 const env=environment();env.PORTAL_KEY="test-portal-signing-key";await provision(env);
 const validTenant=cookie(await login(env));
 const legacy=await createSessionToken(env,{
  usuario:"LEGACYADMIN",perfil:"ADMINISTRADOR",transportadoraId:"nova-frota",estados:["GO"],estado:"GO",
  expiresAt:new Date(Date.now()+3600000).toISOString()
 });
 const mixed="__Host-portal_session="+legacy+"; __Host-tenant_session="+validTenant;
 for(const path of ["/v1/gateway","/v1/fleet/vehicles","/v1/monitor/state",
  "/v1/super-admin/me"]){
  const res=await routeRequest(request(path,"GET",null,mixed),env);
  assert.equal(res.status,403,path);
 }
 // The common client logo bucket is available for signed tenant GET/HEAD;
 // mutations remain blocked even when the legacy admin cookie also exists.
 env.CLIENT_LOGOS={
  get:async()=>({body:new Uint8Array([137,80,78,71]),
    writeHttpMetadata:headers=>headers.set("Content-Type","image/png"),
    httpEtag:'"shared-logo"'}),
  head:async()=>({writeHttpMetadata:headers=>headers.set("Content-Type","image/png"),
    httpEtag:'"shared-logo"'})
 };
 assert.equal((await routeRequest(request("/v1/client-logos/foo","GET",null,mixed),env)).status,200);
 assert.equal((await routeRequest(request("/v1/client-logos/foo","HEAD",null,mixed),env)).status,200);
 assert.equal((await routeRequest(request("/v1/client-logos/foo","PUT",null,mixed),env)).status,403);
 assert.equal((await routeRequest(request("/v1/client-logos/foo","DELETE",null,mixed),env)).status,403);
 const malformed="__Host-portal_session="+legacy+"; __Host-tenant_session=forged";
 assert.equal((await sessionController(request("/v1/session","GET",null,malformed),env)).status,401);
});
test("disabled module, restricted role, and CSRF attempts fail without touching another tenant",async()=>{
 const env=environment();await provision(env);
 const token=cookie(await login(env));
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_modules SET enabled=0 WHERE tenant_id='teste-01' AND module_key='fretes'").run();
 assert.equal((await routeRequest(request("/v1/tenant/fretes","GET",null,token),env)).status,403);
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_modules SET enabled=1 WHERE tenant_id='teste-01' AND module_key='fretes'").run();
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_users SET role='PISO' WHERE tenant_id='teste-01'").run();
 assert.equal((await routeRequest(request("/v1/tenant/fretes","GET",null,token),env)).status,403);
 assert.equal((await routeRequest(request("/v1/tenant/bi","GET",null,token),env)).status,403);
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenant_users SET role='COMERCIAL' WHERE tenant_id='teste-01'").run();
 for(const originValue of [undefined,"https://outside.example"]){
  const headers=originValue===undefined?{Origin:""}:{Origin:originValue};
  const result=await routeRequest(request("/v1/tenant/fretes","POST",{
   origem:"A",destino:"B",produto:"Soja",valorTon:100
  },token,headers),env);
  assert.equal(result.status,403);
 }
 assert.equal(env.TENANTS_DB.sql.prepare("SELECT COUNT(*) AS n FROM portal_tenant_freights").get().n,0);
});
test("tenant logo endpoint reads only the authenticated tenant's R2 object",async()=>{
 const env=environment();await provision(env);
 const token=cookie(await login(env)),bytes=new Uint8Array([137,80,78,71,13,10,26,10,0]);
 const logoKey="tenant/teste-01/logo/abc.png";
 env.TENANTS_DB.sql.prepare("UPDATE portal_tenants SET logo_key=? WHERE id=?").run(logoKey,"teste-01");
 env.TENANT_BRANDS.objects.set(logoKey,bytes);
 env.TENANT_BRANDS.objects.set("tenant/outra-empresa/logo/def.png",new Uint8Array([42]));
 const res=await routeRequest(request("/v1/tenant/logo","GET",null,token),env);
 assert.equal(res.status,200);
 assert.equal(res.headers.get("Content-Type"),"image/png");
 assert.deepEqual(new Uint8Array(await res.arrayBuffer()),bytes);
 assert.equal((await routeRequest(request("/v1/tenant/logo"),env)).status,401);
});
test("one logout revokes D1 tenant session and clears both login cookies",async()=>{
 const env=environment();await provision(env);
 const token=cookie(await login(env));
 const logout=await logoutController(request("/v1/logout","POST",{},token),env);
 assert.equal(logout.status,200);
 assert.match(logout.headers.get("Set-Cookie"),/Max-Age=0/);
 assert.equal((await sessionController(request("/v1/session","GET",null,token),env)).status,401);
});
test("tenant and Nova Frota share the same Home DOM and tenant map never reads legacy freights",()=>{
 const root=new URL("../../",import.meta.url);
 const home=readFileSync(new URL("pages/home.html",root),"utf8");
 const tenant=readFileSync(new URL("assets/js/tenant-workspace.js",root),"utf8");
 const map=readFileSync(new URL("assets/js/home-map.js",root),"utf8");
 const solic=readFileSync(new URL("assets/js/home-solicitacoes.js",root),"utf8");
 const prefs=readFileSync(new URL("assets/js/portal-preferences.js",root),"utf8");
 const advanced=readFileSync(new URL("assets/js/portal-preferences-advanced.js",root),"utf8");
 const ia=readFileSync(new URL("assets/js/nova-frota-ia.js",root),"utf8");
 for(const js of [tenant,map,solic,prefs,advanced,ia])assert.doesNotThrow(()=>new Script(js));
 assert.ok(home.indexOf('<div id="tenantWorkspace" hidden>')>home.indexOf('<div class="nf-home-layout">'));
 assert.equal(tenant.includes("pf-tenant-mode .nf-home-layout"),false);
 assert.ok(tenant.includes('document.querySelectorAll(".nf-tools a.nf-tool[data-feature]")'));
 assert.ok(tenant.includes('window.PortalAPI.call("home","read",{})'));
 assert.equal(tenant.includes('window.PortalAPI.tenantRequest'),false);
 assert.ok(map.includes("session.tenantMode===true"));
 assert.ok(map.includes('window.PortalAPI.call(key,"read",{})'));
 assert.ok(solic.includes("session.tenantMode===true"));
 assert.ok(prefs.includes("transportadoraId"));
 assert.ok(advanced.includes("transportadoraId"));
 assert.ok(ia.includes("session.tenantMode===true"));
 assert.ok(home.includes("nf-home-layout"));
 assert.ok(home.includes("homeBrazilMap"));
});
test("dedicated tenant login uses shared scripts, fixed company and no public selector",()=>{
 const root=new URL("../../",import.meta.url);
 const legacy=readFileSync(new URL("pages/login.html",root),"utf8");
 const page=readFileSync(new URL("pages/transportadora-teste/login.html",root),"utf8");
 const script=readFileSync(new URL("assets/js/tenant-login.js",root),"utf8");
 const auth=readFileSync(new URL("assets/js/auth.js",root),"utf8");
 assert.doesNotThrow(()=>new Script(script));
 assert.doesNotMatch(legacy,/id="tenantId"|loadTransportadoras|transportadorasPublicas/);
 assert.match(legacy,/PortalAPI\.login\(usuario, senha, "nova-frota"\)/);
 assert.match(page,/data-tenant-id="teste-01"/);
 assert.doesNotMatch(page,/<select|transportadorasPublicas/);
 assert.match(page,/\.\.\/\.\.\/assets\/js\/tenant-login\.js/);
 assert.match(script,/PortalAPI\.login\(usuario,senha,tenantId\)/);
 assert.ok(script.includes("session?.transportadoraId!==tenantId"));
 assert.match(auth,/pf:tenant-login-path/);
 assert.match(script,/location\.replace\("\.\/home\.html"\)/);
});
test("unified frontend assets keep same login/Home, hide legacy modules, and parse",()=>{
 const root=new URL("../../",import.meta.url);
 const api=readFileSync(new URL("assets/js/api.js",root),"utf8");
 const auth=readFileSync(new URL("assets/js/auth.js",root),"utf8");
 const login=readFileSync(new URL("pages/login.html",root),"utf8");
 const home=readFileSync(new URL("pages/home.html",root),"utf8");
 const workspace=readFileSync(new URL("assets/js/tenant-workspace.js",root),"utf8");
 assert.doesNotThrow(()=>new Script(api));
 assert.doesNotThrow(()=>new Script(auth));
 assert.doesNotThrow(()=>new Script(workspace));
 assert.doesNotMatch(login,/id="tenantId"|loadTransportadoras|transportadorasPublicas/);
 assert.match(login,/PortalAPI\.login\(usuario, senha, "nova-frota"\)/);
 assert.match(login,/session\?\.tenantMode===true/);
 assert.match(home,/tenantWorkspace/);
 assert.match(home,/tenant-workspace\.js/);
 assert.match(home,/portalfrete-super-admin-staging/);
 assert.match(workspace,/window\.PortalAPI\.call\("home","read",\{\}\)/);
 assert.match(auth,/window\.__PORTAL_TENANT_SESSION/);
});
