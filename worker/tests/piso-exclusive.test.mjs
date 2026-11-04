import test from "node:test";
import assert from "node:assert/strict";
import {canRunGatewayAction,hasFeature,MODULE_ACTIONS} from "../src/services/permissions.js";
import {callTenantAppScript} from "../src/services/tenant-integration.js";

test("PISO cannot access any operational module, even if a tenant enables it",async()=>{
 const session={perfil:"PISO"};
 for(const [moduleName,actions] of Object.entries(MODULE_ACTIONS)){
  for(const actionName of actions){
   const permitted=moduleName==="piso2"&&["read","calculate"].includes(actionName);
   assert.equal(canRunGatewayAction(session,moduleName,actionName,{resource:"solicitacoes"}),permitted,moduleName+"/"+actionName);
  }
 }
 assert.equal(hasFeature(session,"administrativo"),false);
 for(const moduleName of ["piso","fretes","home","administrativo","bi","piso2"]){
  const r=await callTenantAppScript({TENANT_BRANDS:{async get(){return null;}}},
    {tenant_id:"teste-01",user_id:"PISO.TESTE",role:"PISO"},
    ["piso","piso2","fretes","administrativo","bi"],
    {module:moduleName,action:"read",params:{resource:"solicitacoes"}});
  assert.equal(r.status,moduleName==="piso2"?503:403,moduleName);
 }
});
