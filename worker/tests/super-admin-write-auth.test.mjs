import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {superAdminController} from "../src/controllers/super-admin.js";

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
