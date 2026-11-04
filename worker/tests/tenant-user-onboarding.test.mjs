import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {tenantUsersController} from "../src/services/tenant-user-management.js";
import {authenticateTenant,passwordMatches} from "../src/services/tenant-auth.js";
import {writeTenantMembership} from "../src/services/super-admin-membership-write.js";
import {setTenantCredentials} from "../src/services/super-admin-tenant-credentials.js";

function db(){
 const sql=new DatabaseSync(":memory:");
 sql.exec("PRAGMA foreign_keys=ON");
 for(const file of ["0001_tenants.sql","0002_tenant_portal.sql"])
  sql.exec(readFileSync(new URL("../migrations/super-admin/"+file,import.meta.url),"utf8"));
 for(const tenant of ["teste-01","outra-empresa"])
  sql.prepare("INSERT INTO portal_tenants(id,name,status) VALUES (?,?,?)").run(tenant,tenant,"active");
 const adapter={
  prepare(query){
    const stmt=sql.prepare(query);
    return {
      first:async()=>stmt.get(),
      all:async()=>({results:stmt.all()}),
      bind(...args){
        return {
          first:async()=>stmt.get(...args),
          all:async()=>({results:stmt.all(...args)}),
          run:async()=>stmt.run(...args),
          statement:stmt,args
        };
      }
    };
  },
  async batch(statements){sql.exec("BEGIN");try{
    const out=statements.map(s=>s.statement.run(...s.args));
    sql.exec("COMMIT");return out;
   }catch(e){sql.exec("ROLLBACK");throw e;}}
 };
 return {sql,adapter};
}
const principal={tenant_id:"teste-01",user_id:"ADMIN-TESTE",role:"ADMINISTRADOR"};
function req(method,body,path="/v1/tenant/usuarios"){
 return new Request("https://api.portalfrete.net.br"+path,{
  method,headers:{"Content-Type":"application/json"},
  body:body?JSON.stringify(body):undefined
 });
}
async function call(database,method,body,path="/v1/tenant/usuarios",profile=principal,modules=["cadastros"]){
 return tenantUsersController(req(method,body,path),{TENANTS_DB:database.adapter},profile,modules,path);
}
test("GNOVA Cadastros creates ANDERSON in D1 and the actual login accepts his password",async()=>{
 const d=db(),pw="Senha-de-teste-validada-2026";
 const payload={usuario:"anderson",perfil:"OPERACIONAL",senha:pw,ativo:true};
 const result=await call(d,"POST",payload);
 assert.equal(result.status,201);
 const response=await result.json();
 assert.equal(response.usuario.Usuario,"ANDERSON");
 assert.equal(response.usuario.Acesso,"PRONTO");
 const member=d.sql.prepare("SELECT user_id,role,active FROM portal_tenant_users WHERE tenant_id='teste-01'").get();
 assert.deepEqual({...member},{user_id:"ANDERSON",role:"OPERACIONAL",active:1});
 const credential=d.sql.prepare("SELECT password_hash,password_salt,iterations FROM portal_tenant_credentials WHERE tenant_id='teste-01' AND user_id='ANDERSON'").get();
 assert.ok(credential.password_hash.startsWith("pbkdf2-sha256-100k:"));
 assert.equal(await passwordMatches(pw,credential),true);
 assert.equal((await authenticateTenant(d.adapter,"teste-01","ANDERSON",pw)).ok,true);
 assert.equal((await authenticateTenant(d.adapter,"outra-empresa","ANDERSON",pw)).ok,false);
 assert.equal((await authenticateTenant(d.adapter,"teste-01","ANDERSON","senha-errada")).ok,false);
 const listado=await call(d,"GET");
 assert.equal(listado.status,200);
 const listing=await listado.json();
 assert.equal(listing.usuarios[0].Acesso,"PRONTO");
 assert.equal(JSON.stringify(listing).includes(pw),false);
 const audit=d.sql.prepare("SELECT detail_json FROM portal_tenant_audit").get().detail_json;
 assert.equal(audit.includes(pw),false);
 assert.equal((await call(d,"POST",payload)).status,409);
});
test("Tenant users are read/write isolated and require ADMINISTRADOR plus Cadastros module",async()=>{
 const d=db();
 const request={usuario:"ANDERSON",perfil:"PISO",senha:"Senha-segura-2026!",ativo:true};
 for(const role of ["PISO","GOADM","COMERCIAL","OPERACIONAL"]){
  const auth={...principal,role};
  assert.equal((await call(d,"POST",request,undefined,auth)).status,403,role);
  assert.equal((await call(d,"GET",undefined,undefined,auth)).status,403,role);
 }
 assert.equal((await call(d,"POST",request,undefined,principal,["bi"])).status,403);
 assert.equal(d.sql.prepare("SELECT count(*) AS n FROM portal_tenant_users").get().n,0);
 assert.equal((await call(d,"POST",{...request,senha:"curta"})).status,400);
 assert.equal((await call(d,"POST",{...request,perfil:"SUPER_ADMIN"})).status,400);
 assert.equal((await call(d,"POST",{...request,tenant_id:"outra-empresa"})).status,400);
});
test("Passwordless old membership cannot be activated without a password, but can be repaired",async()=>{
 const d=db();
 d.sql.prepare("INSERT INTO portal_tenant_users(tenant_id,user_id,role,active) VALUES ('teste-01','ANDERSON','OPERACIONAL',0)").run();
 const path="/v1/tenant/usuarios/ANDERSON";
 assert.equal((await call(d,"PATCH",{ativo:true},path)).status,409);
 assert.equal(d.sql.prepare("SELECT active FROM portal_tenant_users WHERE user_id='ANDERSON'").get().active,0);
 const password="Senha-para-ANDERSON-2026";
 assert.equal((await call(d,"PATCH",{ativo:true,senha:password},path)).status,200);
 assert.equal((await authenticateTenant(d.adapter,"teste-01","ANDERSON",password)).ok,true);
 assert.equal((await call(d,"PATCH",{ativo:false},path)).status,200);
 assert.equal((await authenticateTenant(d.adapter,"teste-01","ANDERSON",password)).ok,false);
});
test("Super Admin can repair an existing inactive membership in one password step",async()=>{
 const d=db();
 d.sql.prepare("INSERT INTO portal_tenant_users(tenant_id,user_id,role,active) VALUES ('teste-01','ANDERSON','OPERACIONAL',0)").run();
 const env={TENANTS_DB:d.adapter,SUPER_ADMIN_CREDENTIAL_WRITES:"enabled",SUPER_ADMIN_MEMBERSHIP_WRITES:"enabled"};
 const path="https://api.portalfrete.net.br/v1/super-admin/transportadoras/teste-01/usuarios/ANDERSON/credenciais";
 const res=await setTenantCredentials(new Request(path,{method:"PUT",body:JSON.stringify({senha:"Senha-via-super-admin-2026",ativar:true})}),env,"OWNER","teste-01","ANDERSON");
 assert.equal(res.status,200);
 assert.equal(d.sql.prepare("SELECT active FROM portal_tenant_users WHERE user_id='ANDERSON'").get().active,1);
 assert.equal((await authenticateTenant(d.adapter,"teste-01","ANDERSON","Senha-via-super-admin-2026")).ok,true);
});
test("Cadastros tenant UI routes user creation and edits to D1, leaving Nova Frota legacy intact",()=>{
 const source=readFileSync(new URL("../../assets/js/cadastros.js",import.meta.url),"utf8");
 assert.match(source,/resource==="usuarios"/);
 assert.match(source,/window[.]PortalAPI[.]tenantRequest\(base/);
 assert.match(source,/method:"POST",body:\{usuario,perfil:payload.Perfil,senha:payload.Senha,ativo:/);
 assert.match(source,/method:"PATCH",body/);
 assert.match(source,/configureTenantUserFields\(\)/);
 assert.match(source,/window[.]PortalAPI[.]call\("cadastros",actionMap\[operation\]/);
});
