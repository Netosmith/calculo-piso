import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {superAdminController} from "../src/controllers/super-admin.js";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

const pair=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...pair.publicKey.export({format:"jwk"}),kid:"test-key",alg:"RS256",use:"sig"};
const issuer="https://identity.test.example";
const subject="owner-immutable-subject";
const owner={usuario:"OWNER",transportadoraId:"nova-frota",perfil:"ADMINISTRADOR"};
const url="https://api.portalfrete.net.br/v1/super-admin/authorize";
const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
function token(claimOverrides={}){
 const now=Math.floor(Date.now()/1000);
 const claims={iss:issuer,aud:"portal-super",sub:subject,iat:now,nbf:now-2,exp:now+180,amr:["pwd","mfa"],...claimOverrides};
 const input=encode({alg:"RS256",typ:"JWT",kid:jwk.kid})+"."+encode(claims);
 return input+"."+sign("RSA-SHA256",Buffer.from(input),pair.privateKey).toString("base64url");
}
function env(session=owner){
 return {
  SUPER_ADMIN_USER:"OWNER",SUPER_ADMIN_SUBJECT:subject,
  SUPER_ADMIN_TENANT_WRITES:"enabled",TENANTS_DB:{},
  SUPER_ADMIN_OIDC:{
   issuer,audience:"portal-super",subject,
   jwksUrl:issuer+"/keys",
   mfaPolicy:{acceptedAmr:["mfa"]}
  },
  SESSIONS:{async get(){return session;}}
 };
}
function req(jwt,withCookie=true){
 return new Request(url,{method:"POST",headers:{
  ...(withCookie?{Cookie:"__Host-portal_session=legacy-test"}:{}),
  ...(jwt?{Authorization:"Bearer "+jwt}:{})
 }});
}
async function withJwks(callback){
 const original=globalThis.fetch;
 globalThis.fetch=async ()=>new Response(JSON.stringify({keys:[jwk]}),{status:200});
 try{return await callback();}finally{globalThis.fetch=original;}
}
test("OIDC signature, immutable subject and MFA authorize privileged session",()=>withJwks(async()=>{
 const response=await superAdminController(req(token()),env());
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,elevated:true,tenantWrite:true,membershipWrite:false,brandWrite:false});
}));
test("password-only token does not authorize writes",()=>withJwks(async()=>{
 assert.equal((await superAdminController(req(token({amr:["pwd"]})),env())).status,403);
}));
test("wrong immutable subject is denied",()=>withJwks(async()=>{
 assert.equal((await superAdminController(req(token({sub:"attacker"})),env())).status,403);
}));
test("expired and wrong-issuer tokens are denied",()=>withJwks(async()=>{
 const now=Math.floor(Date.now()/1000);
 assert.equal((await superAdminController(req(token({iat:now-200,exp:now-1})),env())).status,403);
 assert.equal((await superAdminController(req(token({iss:"https://malicious.example"})),env())).status,403);
}));
test("non-owner legacy session is denied even with valid OIDC token",()=>withJwks(async()=>{
 assert.equal((await superAdminController(req(token()),env({...owner,usuario:"OTHER"}))).status,403);
}));
test("missing legacy cookie or token is denied",()=>withJwks(async()=>{
 assert.equal((await superAdminController(req(token(),false),env())).status,401);
 assert.equal((await superAdminController(req(null),env())).status,403);
}));

test("Cloudflare JSON secret format for OIDC provider works",()=>withJwks(async()=>{
 const config=env();
 config.SUPER_ADMIN_OIDC=JSON.stringify(config.SUPER_ADMIN_OIDC);
 const response=await superAdminController(req(token()),config);
 assert.equal(response.status,200);
}));
test("malformed OIDC secret fails closed",async()=>{
 const config=env();
 config.SUPER_ADMIN_OIDC="{bad-json";
 assert.equal((await superAdminController(req(token()),config)).status,403);
});

function tenantDb(){
 const sql=new DatabaseSync(":memory:");
 sql.exec("PRAGMA foreign_keys=ON");
 sql.exec(readFileSync(new URL("../migrations/super-admin/0001_tenants.sql",import.meta.url),"utf8"));
 return {
  sql,
  prepare(query){
   const stmt=sql.prepare(query);
   return {bind(...args){return {first:async()=>stmt.get(...args),
    all:async()=>({results:stmt.all(...args)}),statement:stmt,args};}};
  },
  async batch(commands){
   sql.exec("BEGIN");
   try{
    const out=commands.map(command=>command.statement.run(...command.args));
    sql.exec("COMMIT");return out;
   }catch(error){sql.exec("ROLLBACK");throw error;}
  }
 };
}
function verifiedWrite(path,method,jwt,body,contentType="application/json"){
 return new Request("https://api.portalfrete.net.br/v1/super-admin"+path,{
  method,
  headers:{"Cookie":"__Host-portal_session=legacy-test",
   "Authorization":"Bearer "+jwt,"Content-Type":contentType},
  body:contentType==="application/json"?JSON.stringify(body):body
 });
}
test("end-to-end: verified MFA creates an audited inactive tenant",()=>withJwks(async()=>{
 const db=tenantDb(),cfg={...env(),TENANTS_DB:db};
 const good=verifiedWrite("/transportadoras","POST",token(),{id:"tenant-integracao",name:"Empresa Integração"});
 const response=await superAdminController(good,cfg);
 assert.equal(response.status,201);
 const record=db.sql.prepare("SELECT status FROM portal_tenants WHERE id='tenant-integracao'").get();
 assert.equal(record.status,"inactive");
 const audit=db.sql.prepare("SELECT actor_id FROM portal_tenant_audit").get();
 assert.equal(audit.actor_id,subject);
 const bad=verifiedWrite("/transportadoras","POST",token({sub:"attacker"}),{id:"tenant-invasor",name:"Invasor"});
 assert.equal((await superAdminController(bad,cfg)).status,403);
 assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM portal_tenants").get().n,1);
}));
test("end-to-end: owner JWT controls membership staging, never creates passwords",()=>withJwks(async()=>{
 const db=tenantDb(),cfg={...env(),TENANTS_DB:db,SUPER_ADMIN_MEMBERSHIP_WRITES:"enabled"};
 const creation=verifiedWrite("/transportadoras","POST",token(),{id:"tenant-a",name:"Empresa A"});
 assert.equal((await superAdminController(creation,cfg)).status,201);
 const membership=verifiedWrite("/transportadoras/tenant-a/usuarios","POST",token(),{usuario:"usuario.a",perfil:"COMERCIAL"});
 assert.equal((await superAdminController(membership,cfg)).status,201);
 const saved=db.sql.prepare("SELECT user_id,role,active FROM portal_tenant_users").get();
 assert.deepEqual({...saved},{user_id:"USUARIO.A",role:"COMERCIAL",active:0});
 const denied=verifiedWrite("/transportadoras/tenant-a/usuarios","POST",token({amr:["pwd"]}),{usuario:"USUARIO.B",perfil:"PISO"});
 assert.equal((await superAdminController(denied,cfg)).status,403);
 assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM portal_tenant_users").get().n,1);
}));
test("end-to-end: verified MFA stores tenant logo in isolated private R2",()=>withJwks(async()=>{
 const db=tenantDb(),objects=new Map(),cfg={
  ...env(),TENANTS_DB:db,SUPER_ADMIN_BRAND_WRITES:"enabled",
  TENANT_BRANDS:{
   async put(key,bytes){objects.set(key,new Uint8Array(bytes));},
   async delete(key){objects.delete(key);}
  }
 };
 assert.equal((await superAdminController(verifiedWrite("/transportadoras","POST",token(),{id:"tenant-a",name:"Empresa A"}),cfg)).status,201);
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
 const response=await superAdminController(verifiedWrite("/transportadoras/tenant-a/logo","PUT",token(),png,"image/png"),cfg);
 assert.equal(response.status,200);
 assert.equal(objects.size,1);
 assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM portal_tenant_audit WHERE action='brand.logo.update'").get().n,1);
}));
