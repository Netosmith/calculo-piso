import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {writeTenantCatalog} from "../src/services/super-admin-tenant-write.js";
import {superAdminController} from "../src/controllers/super-admin.js";
import {readTenantLogo} from "../src/services/super-admin-brand.js";

const base="https://api.portalfrete.net.br/v1/super-admin/transportadoras";
function database(){
 const sql=new DatabaseSync(":memory:");
 sql.exec("PRAGMA foreign_keys=ON");
 sql.exec(readFileSync(new URL("../migrations/super-admin/0001_tenants.sql",import.meta.url),"utf8"));
 return {
  sql,
  prepare(query){
   const stmt=sql.prepare(query);
   return {bind(...args){
    return {
     first:async()=>stmt.get(...args),
     all:async()=>({results:stmt.all(...args)}),
     run:async()=>stmt.run(...args),
     statement:stmt,args
    };
   }};
  },
  async batch(statements){
   sql.exec("BEGIN");
   try {
    const out=statements.map(s=>s.statement.run(...s.args));
    sql.exec("COMMIT");
    return out;
   } catch(error){sql.exec("ROLLBACK");throw error;}
  }
 };
}
const request=(path,method,body)=>new Request(base+path,{
 method,headers:{"Content-Type":"application/json"},
 body:body===undefined?undefined:JSON.stringify(body)
});
const env=db=>({TENANTS_DB:db,SUPER_ADMIN_TENANT_WRITES:"enabled"});
const call=(db,path,method,body,overrides={})=>
 writeTenantCatalog(request(path,method,body),{...env(db),...overrides},"verified-oidc-sub");
function count(db,table){
 return db.sql.prepare("SELECT COUNT(*) AS n FROM "+table).get().n;
}

test("tenant writes are disabled unless opted in",async()=>{
 const db=database();
 const response=await call(db,"","POST",{id:"transportadora-a",name:"Transportadora A"},{SUPER_ADMIN_TENANT_WRITES:"disabled"});
 assert.equal(response.status,405);
 assert.equal(count(db,"portal_tenants"),0);
});

test("creates a tenant inactive and records audit transaction",async()=>{
 const db=database();
 const response=await call(db,"","POST",{id:"transportadora-a",name:"Transportadora A"});
 assert.equal(response.status,201);
 assert.deepEqual((await response.json()).transportadora,{
  id:"transportadora-a",name:"Transportadora A",active:false,modules:[]
 });
 const saved=db.sql.prepare("SELECT * FROM portal_tenants WHERE id=?").get("transportadora-a");
 assert.equal(saved.status,"inactive");
 const audit=db.sql.prepare("SELECT * FROM portal_tenant_audit").get();
 assert.equal(audit.actor_id,"verified-oidc-sub");
 assert.equal(audit.tenant_id,"transportadora-a");
 assert.equal(audit.action,"tenant.create");
 assert.equal(count(db,"portal_tenant_audit"),1);
});

test("rejects duplicate tenant without creating another audit",async()=>{
 const db=database();
 await call(db,"","POST",{id:"transportadora-a",name:"A nome"});
 const res=await call(db,"","POST",{id:"transportadora-a",name:"Outro nome"});
 assert.equal(res.status,409);
 assert.equal(count(db,"portal_tenant_audit"),1);
});

test("updates only the target tenant and audits changes",async()=>{
 const db=database();
 await call(db,"","POST",{id:"transportadora-a",name:"Transportadora A"});
 await call(db,"","POST",{id:"transportadora-b",name:"Transportadora B"});
 const res=await call(db,"/transportadora-a","PATCH",{name:"Novo Nome",status:"active"});
 assert.equal(res.status,200);
 assert.equal(db.sql.prepare("SELECT status FROM portal_tenants WHERE id='transportadora-a'").get().status,"active");
 assert.equal(db.sql.prepare("SELECT status FROM portal_tenants WHERE id='transportadora-b'").get().status,"inactive");
 assert.equal(count(db,"portal_tenant_audit"),3);
});

test("configures only allowlisted modules and rolls back invalid changes",async()=>{
 const db=database();
 await call(db,"","POST",{id:"transportadora-a",name:"Transportadora A"});
 const ok=await call(db,"/transportadora-a/modules","PUT",{modules:["piso","fretes","bi"]});
 assert.equal(ok.status,200);
 const before=db.sql.prepare("SELECT module_key FROM portal_tenant_modules ORDER BY module_key").all().map(r=>r.module_key);
 assert.deepEqual(before,["bi","fretes","piso"]);
 for(const modules of [["piso","piso"],["unlisted"],"piso"]){
  const failed=await call(db,"/transportadora-a/modules","PUT",{modules});
  assert.equal(failed.status,400);
 }
 assert.equal(count(db,"portal_tenant_modules"),3);
 const audit=db.sql.prepare("SELECT action FROM portal_tenant_audit ORDER BY created_at,id").all();
 assert.equal(audit.filter(x=>x.action==="modules.update").length,1);
});

test("never writes to legacy Nova Frota or accepts extra fields",async()=>{
 const db=database();
 assert.equal((await call(db,"","POST",{id:"nova-frota",name:"Nova Frota"})).status,400);
 assert.equal((await call(db,"/nova-frota","PATCH",{status:"inactive"})).status,404);
 assert.equal((await call(db,"","POST",{id:"tenant-z",name:"Tenant Z",role:"owner"})).status,400);
 assert.equal(count(db,"portal_tenants"),0);
 assert.equal(count(db,"portal_tenant_audit"),0);
});

test("rejects malformed requests and missing D1 binding",async()=>{
 const db=database();
 assert.equal((await writeTenantCatalog(request("","POST",{id:"tenant-b",name:"Tenant B"}),{SUPER_ADMIN_TENANT_WRITES:"enabled"},"owner")).status,503);
 assert.equal((await call(db,"","POST",{id:"BAD_ID",name:"Valid Name"})).status,400);
 assert.equal((await call(db,"","POST",{id:"tenant-b",name:"x"})).status,400);
 assert.equal(count(db,"portal_tenants"),0);
});

test("audit history is tenant-scoped and requires owner session",async()=>{
 const db=database();
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 await call(db,"","POST",{id:"tenant-b",name:"Tenant B"});
 await call(db,"/tenant-a","PATCH",{status:"active"});
 const urlA=base+"/tenant-a/auditoria";
 const req=new Request(urlA,{headers:{Cookie:"__Host-portal_session=test-legacy"}});
 const owner={usuario:"OWNER",transportadoraId:"nova-frota",perfil:"ADMINISTRADOR"};
 const adminEnv={SUPER_ADMIN_USER:"OWNER",TENANTS_DB:db,
  SESSIONS:{async get(){return owner;}}};
 const response=await superAdminController(req,adminEnv);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.eventos.length,2);
 assert.ok(body.eventos.every(event=>["tenant.create","tenant.update"].includes(event.acao)));
 const otherTenant=await superAdminController(
  new Request(base+"/tenant-b/auditoria",{headers:{Cookie:"__Host-portal_session=test-legacy"}}),adminEnv);
 assert.equal((await otherTenant.json()).eventos.length,1);
 const denied=await superAdminController(req,{
  ...adminEnv,SUPER_ADMIN_USER:"ANOTHER"
 });
 assert.equal(denied.status,403);
});

test("membership creation is disabled by default independently of tenant writes",async()=>{
 const db=database();
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 const result=await call(db,"/tenant-a/usuarios","POST",{usuario:"MOTORISTA1",perfil:"OPERACIONAL"});
 assert.equal(result.status,405);
 assert.equal(count(db,"portal_tenant_users"),0);
});

test("owner can stage an inactive tenant membership without credentials",async()=>{
 const db=database();
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 const res=await call(db,"/tenant-a/usuarios","POST",{usuario:" usuario.novo ",perfil:"COMERCIAL"},{SUPER_ADMIN_MEMBERSHIP_WRITES:"enabled"});
 assert.equal(res.status,201);
 const body=await res.json();
 assert.deepEqual(body.usuario,{id:"USUARIO.NOVO",perfil:"COMERCIAL",ativo:false});
 assert.equal(Object.hasOwn(body.usuario,"senha"),false);
 const record=db.sql.prepare("SELECT user_id,role,active FROM portal_tenant_users").get();
 assert.deepEqual({...record},{user_id:"USUARIO.NOVO",role:"COMERCIAL",active:0});
 const audit=db.sql.prepare("SELECT action,detail_json FROM portal_tenant_audit WHERE action='membership.create'").get();
 assert.equal(JSON.parse(audit.detail_json).usuario,"USUARIO.NOVO");
});

test("membership role/status edits are strictly tenant scoped and audited",async()=>{
 const db=database();
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 await call(db,"","POST",{id:"tenant-b",name:"Tenant B"});
 const opts={SUPER_ADMIN_MEMBERSHIP_WRITES:"enabled"};
 for(const tenant of ["tenant-a","tenant-b"])
  assert.equal((await call(db,"/"+tenant+"/usuarios","POST",{usuario:"USUARIO1",perfil:"PISO"},opts)).status,201);
 const changed=await call(db,"/tenant-a/usuarios/USUARIO1","PATCH",{perfil:"GOADM",ativo:true},opts);
 assert.equal(changed.status,200);
 const rows=db.sql.prepare("SELECT tenant_id,role,active FROM portal_tenant_users WHERE user_id='USUARIO1' ORDER BY tenant_id").all();
 assert.deepEqual(rows.map(row=>({...row})),[
  {tenant_id:"tenant-a",role:"GOADM",active:1},
  {tenant_id:"tenant-b",role:"PISO",active:0}
 ]);
 assert.equal(count(db,"portal_tenant_audit"),5);
});

test("membership routes refuse Nova Frota, unknown tenant, and invalid data",async()=>{
 const db=database();
 const opts={SUPER_ADMIN_MEMBERSHIP_WRITES:"enabled"};
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 assert.equal((await call(db,"/nova-frota/usuarios","POST",{usuario:"USER1",perfil:"PISO"},opts)).status,400);
 assert.equal((await call(db,"/tenant-b/usuarios","POST",{usuario:"USER1",perfil:"PISO"},opts)).status,404);
 for(const payload of [
   {usuario:"abc",perfil:"SUPER_ADMIN"},{usuario:"abc",perfil:"PISO",Senha:"plain"},
   {usuario:"a",perfil:"PISO"}, {usuario:"bad user",perfil:"PISO"}
 ]) {
  assert.equal((await call(db,"/tenant-a/usuarios","POST",payload,opts)).status,400);
 }
 assert.equal(count(db,"portal_tenant_users"),0);
 assert.equal(count(db,"portal_tenant_audit"),1);
});

test("duplicate memberships and invalid mutations never modify the catalog",async()=>{
 const db=database(),opts={SUPER_ADMIN_MEMBERSHIP_WRITES:"enabled"};
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 assert.equal((await call(db,"/tenant-a/usuarios","POST",{usuario:"USER1",perfil:"MT"},opts)).status,201);
 assert.equal((await call(db,"/tenant-a/usuarios","POST",{usuario:"USER1",perfil:"PR"},opts)).status,409);
 for(const body of [{ativo:"SIM"},{perfil:"SUPER_ADMIN"},{}, {perfil:"PR",Senha:"secret"}]) {
  assert.equal((await call(db,"/tenant-a/usuarios/USER1","PATCH",body,opts)).status,400);
 }
 assert.equal((await call(db,"/tenant-a/usuarios/NONEXIST","PATCH",{ativo:false},opts)).status,404);
 assert.equal(count(db,"portal_tenant_audit"),2);
});

function memoryBucket(){
 const objects=new Map();
 return {
  objects,
  async put(key,bytes,options){objects.set(key,{bytes:new Uint8Array(bytes),mime:options?.httpMetadata?.contentType});},
  async get(key){
   const object=objects.get(key);
   return object?{body:new Response(object.bytes).body,httpMetadata:{contentType:object.mime}}:null;
  },
  async delete(key){objects.delete(key);}
 };
}
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
function brandRequest(tenant,bytes,mime="image/png"){
 return new Request(base+"/"+tenant+"/logo",{method:"PUT",headers:{"Content-Type":mime},body:bytes});
}
test("brand upload is independently disabled without R2 opt-in",async()=>{
 const db=database(),bucket=memoryBucket();
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 const r=await writeTenantCatalog(brandRequest("tenant-a",png),{
  ...env(db),TENANT_BRANDS:bucket
 },"owner");
 assert.equal(r.status,405);
 assert.equal(bucket.objects.size,0);
});
test("stores private tenant logos and audit without modifying another tenant",async()=>{
 const db=database(),bucket=memoryBucket();
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 await call(db,"","POST",{id:"tenant-b",name:"Tenant B"});
 const config={...env(db),TENANT_BRANDS:bucket,SUPER_ADMIN_BRAND_WRITES:"enabled"};
 const write=await writeTenantCatalog(brandRequest("tenant-a",png),config,"owner");
 assert.equal(write.status,200);
 const saved=db.sql.prepare("SELECT logo_key FROM portal_tenants WHERE id=?").get("tenant-a");
 assert.match(saved.logo_key,/^tenant\/tenant-a\/logo\/[0-9a-f-]+\.png$/);
 assert.equal(db.sql.prepare("SELECT logo_key FROM portal_tenants WHERE id='tenant-b'").get().logo_key,null);
 assert.equal(bucket.objects.size,1);
 const read=await readTenantLogo(config,"tenant-a");
 assert.equal(read.status,200);
 assert.equal(read.headers.get("Content-Type"),"image/png");
 assert.equal(read.headers.get("Cache-Control"),"private, no-store");
 assert.deepEqual(new Uint8Array(await read.arrayBuffer()),png);
 assert.equal((await readTenantLogo(config,"tenant-b")).status,404);
 assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM portal_tenant_audit WHERE action='brand.logo.update'").get().n,1);
});
test("brand uploads reject mismatched MIME, unsafe legacy tenant and oversized data",async()=>{
 const db=database(),bucket=memoryBucket();
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 const config={...env(db),TENANT_BRANDS:bucket,SUPER_ADMIN_BRAND_WRITES:"enabled"};
 assert.equal((await writeTenantCatalog(brandRequest("tenant-a",png,"image/jpeg"),config,"owner")).status,415);
 assert.equal((await writeTenantCatalog(brandRequest("tenant-a",png,"image/svg+xml"),config,"owner")).status,415);
 assert.equal((await writeTenantCatalog(brandRequest("nova-frota",png),config,"owner")).status,400);
 assert.equal((await writeTenantCatalog(brandRequest("tenant-a",new Uint8Array(2097153)),config,"owner")).status,413);
 assert.equal(bucket.objects.size,0);
});
test("brand replacement cleans up the previous private object",async()=>{
 const db=database(),bucket=memoryBucket();
 await call(db,"","POST",{id:"tenant-a",name:"Tenant A"});
 const config={...env(db),TENANT_BRANDS:bucket,SUPER_ADMIN_BRAND_WRITES:"enabled"};
 assert.equal((await writeTenantCatalog(brandRequest("tenant-a",png),config,"owner")).status,200);
 const old=db.sql.prepare("SELECT logo_key FROM portal_tenants WHERE id='tenant-a'").get().logo_key;
 assert.equal((await writeTenantCatalog(brandRequest("tenant-a",png),config,"owner")).status,200);
 const newer=db.sql.prepare("SELECT logo_key FROM portal_tenants WHERE id='tenant-a'").get().logo_key;
 assert.notEqual(old,newer);
 assert.equal(bucket.objects.has(old),false);
 assert.equal(bucket.objects.has(newer),true);
});
