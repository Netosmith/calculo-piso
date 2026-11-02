import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {writeTenantCatalog} from "../src/services/super-admin-tenant-write.js";

const base="https://api.portalfrete.net.br/v1/super-admin/transportadoras";
function database(){
 const sql=new DatabaseSync(":memory:");
 sql.exec("PRAGMA foreign_keys=ON");
 sql.exec(readFileSync(new URL("../migrations/0001_tenants.sql",import.meta.url),"utf8"));
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
