import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {canRunGatewayAction,hasFeature,MODULE_ACTIONS} from "../src/services/permissions.js";
import {callTenantAppScript} from "../src/services/tenant-integration.js";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("PISO denies all operational modules even when tenant grants them",async()=>{
 const session={perfil:"PISO"};
 for(const [moduleName,actions] of Object.entries(MODULE_ACTIONS)){
  for(const actionName of actions){
   const permitted=moduleName==="piso2" && ["read","calculate"].includes(actionName);
   assert.equal(canRunGatewayAction(session,moduleName,actionName,{resource:"solicitacoes"}),permitted,moduleName+"/"+actionName);
  }
 }
 assert.equal(hasFeature(session,"administrativo"),false);
 for(const moduleName of ["piso","fretes","home","administrativo","bi","piso2"]){
  const response=await callTenantAppScript({TENANT_BRANDS:{async get(){return null;}}},
    {tenant_id:"teste-01",user_id:"PISO.TESTE",role:"PISO"},
    ["piso","piso2","fretes","administrativo","bi"],
    {module:moduleName,action:"read",params:{resource:"solicitacoes"}});
  assert.equal(response.status,moduleName==="piso2"?503:403,moduleName);
 }
});

test("PISO Home hides stats, freights, map, requests and every card except ANTT",()=>{
 const html=read("pages/home.html"),auth=read("assets/js/auth.js");
 const requests=read("assets/js/home-solicitacoes-access.js");
 const tenant=read("assets/js/tenant-workspace.js");
 const assistant=read("assets/js/nova-frota-ia.js");
 assert.match(html,/<body class="pf-home-pending">/);
 for(const selector of [".nf-stats",".nf-home-side",".nf-solic-wrap"]){
  assert.ok(html.includes("body.nf-profile-piso "+selector),selector);
 }
 assert.ok(html.includes('body.nf-profile-piso .nf-tools > *'));
 assert.ok(html.includes('body.nf-profile-piso.pf-piso2-allowed .nf-tools > [data-feature="piso2"]'));
 assert.ok(html.includes("Acesso exclusivo ao Cálculo de Piso 2 (ANTT)"));
 assert.ok(auth.includes('if(profile==="PISO")return isAuthedHome() && feature==="piso2"'));
 assert.ok(auth.includes('if(role==="PISO")return feature==="home" ||'));
 assert.ok(requests.includes('toUpperCase()==="PISO")return false'));
 assert.ok(tenant.includes("Acesso exclusivo ao Cálculo de Piso 2 (ANTT)"));
 assert.ok(assistant.includes('toUpperCase()==="PISO")return;'));
 assert.ok(read("worker/src/controllers/ia.js").includes("Perfil PISO autorizado apenas no Calculo de Piso 2."));
 assert.doesNotThrow(()=>new Script(auth));
 assert.doesNotThrow(()=>new Script(requests));
 assert.doesNotThrow(()=>new Script(tenant));
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
  assert.doesNotThrow(()=>new Script(match[1]));
 }
});

test("Calculators and support screens use updated PISO permission controls",()=>{
 for(const name of ["calculo-antt","calculo-piso","chamados"]){
  assert.ok(read("pages/"+name+".html").includes("auth.js?v=27"));
 }
 assert.ok(read("worker/src/controllers/tenant-unified.js").includes("Perfil PISO restrito ao Calculo de Piso 2."));
});
