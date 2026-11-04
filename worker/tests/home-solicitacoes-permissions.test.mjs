import test from "node:test";
import assert from "node:assert/strict";
import {canRunGatewayAction,hasFeature} from "../src/services/permissions.js";
import {callTenantAppScript} from "../src/services/tenant-integration.js";

const profiles=["ADMINISTRADOR","GOADM","OPERACIONAL","COMERCIAL","PISO","GO","MT","PR","BA","SP","MG","SC","TO","MA","PA","ESTADIAS_ADMIN","ESTADIAS_EDITOR","ESTADIAS_CONSULTA"];
test("Every recognized profile can create Home requests but cannot read the administrative app",()=>{
 for(const perfil of profiles){
  const session={perfil};
  assert.equal(canRunGatewayAction(session,"administrativo","create",{resource:"solicitacoes"}),perfil!=="PISO",perfil);
  const isAdmin=["GOADM","ADMINISTRADOR"].includes(perfil);
  assert.equal(hasFeature(session,"administrativo"),isAdmin,perfil);
  assert.equal(canRunGatewayAction(session,"administrativo","read",{resource:"solicitacoes"}),isAdmin,perfil);
  assert.equal(canRunGatewayAction(session,"administrativo","create",{resource:"cheques"}),isAdmin,perfil);
 }
 assert.equal(canRunGatewayAction({perfil:"FALSO"},"administrativo","create",{resource:"solicitacoes"}),false);
});
test("Tenant module switch blocks requests before any integration when disabled",async()=>{
 for(const role of ["PISO","OPERACIONAL","GOADM","ADMINISTRADOR"]){
  const principal={tenant_id:"teste-01",user_id:"TESTE",role};
  const request={module:"administrativo",action:"create",params:{resource:"solicitacoes",observacao:"Teste"}};
  const env={TENANT_BRANDS:{async get(){return null;}}};
  assert.equal((await callTenantAppScript(env,principal,["bi"],request)).status,403,role);
  assert.equal((await callTenantAppScript(env,principal,["administrativo"],request)).status,role==="PISO"?403:503,role);
  assert.equal((await callTenantAppScript(env,principal,["administrativo"],{
    module:"administrativo",action:"read",params:{resource:"solicitacoes"}
  })).status,["GOADM","ADMINISTRADOR"].includes(role)?503:403,role);
 }
});
