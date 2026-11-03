import test from "node:test";
import assert from "node:assert/strict";
import {superAdminController} from "../src/controllers/super-admin.js";

const owner={usuario:"OWNER",perfil:"ADMINISTRADOR",transportadoraId:"nova-frota"};
const request=new Request("https://api.portalfrete.net.br/v1/super-admin/me",{
  headers:{Cookie:"__Host-portal_session=legacy-test"}
});
function env(overrides={}){
 return {SUPER_ADMIN_USER:"OWNER",SESSIONS:{async get(){return owner;}},...overrides};
}
test("capabilities are derived from backend configuration and writes remain disabled",async()=>{
 const response=await superAdminController(request,env());
 assert.equal(response.status,200);
 const body=await response.json();
 assert.deepEqual(body.capabilities,{
   tenantCatalog:false,legacyUserRead:false,tenantWrite:false,membershipWrite:false,brandWrite:false,userWrite:false
 });
 const ready=await superAdminController(request,env({TENANTS_DB:{prepare(){return {first:async()=>null};}},SUPER_ADMIN_LEGACY_USERS_READ:"enabled"}));
 assert.deepEqual((await ready.json()).capabilities,{
   tenantCatalog:true,legacyUserRead:true,tenantWrite:false,membershipWrite:false,brandWrite:false,userWrite:false
 });
});
test("capabilities never exposed to a non-owner",async()=>{
 const response=await superAdminController(request,env({SUPER_ADMIN_USER:"OTHER"}));
 assert.equal(response.status,403);
 assert.equal((await response.json()).capabilities,undefined);
});

test("unmigrated D1 binding is never reported ready",async()=>{
 const response=await superAdminController(request,env({
  TENANTS_DB:{prepare(){throw new Error("no such table: portal_tenants");}},
  SUPER_ADMIN_TENANT_WRITES:"enabled",
  SUPER_ADMIN_SUBJECT:"subject",
  SUPER_ADMIN_OIDC:{issuer:"https://example.test"}
 }));
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.capabilities.tenantCatalog,false);
 assert.equal(body.capabilities.tenantWrite,false);
});
