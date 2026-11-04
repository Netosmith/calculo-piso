import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {canRunGatewayAction,hasFeature,MODULE_ACTIONS} from "../src/services/permissions.js";
import {callTenantAppScript} from "../src/services/tenant-integration.js";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

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

test("PISO Home displays only ANTT Piso 2 after the server authorizes the session",()=>{
 const html=read("pages/home.html"),auth=read("assets/js/auth.js"),
  requests=read("assets/js/home-solicitacoes-access.js"),
  tenant=read("assets/js/tenant-workspace.js"),
  assistant=read("assets/js/nova-frota-ia.js");
 assert.match(html,/<body class="pf-home-pending">/);
 assert.match(html,/body\\.nf-profile-piso \\.nf-home-layout/);
 assert.match(html,/body\\.nf-profile-piso \\.nf-stats/);
 assert.match(html,/body\\.nf-profile-piso \\.nf-home-side/);
 assert.match(html,/body\\.nf-profile-piso \\.nf-solic-wrap/);
 assert.match(html,/body\\.nf-profile-piso \\.nf-tools > \\*/);
 assert.match(html,/body\\.nf-profile-piso\\.pf-piso2-allowed \\.nf-tools > \\[data-feature="piso2"\\]/);
 assert.match(html,/Acesso exclusivo ao Cálculo de Piso 2 \\(ANTT\\)/);
 assert.match(auth,/if\\(profile==="PISO"\\)return isAuthedHome\\(\\) && feature==="piso2"/);
 assert.match(requests,/toUpperCase\\(\\)==="PISO"\\)return false/);
 assert.match(tenant,/Acesso exclusivo ao Cálculo de Piso 2 \\(ANTT\\)/);
 assert.match(assistant,/String\\(session\\.perfil\\|\\|""\\)\\.trim\\(\\)\\.toUpperCase\\(\\)==="PISO"/);
 assert.match(read("worker/src/controllers/ia.js"),/Perfil PISO autorizado apenas no Calculo de Piso 2/);
 assert.doesNotThrow(()=>new Script(auth));
 assert.doesNotThrow(()=>new Script(requests));
 assert.doesNotThrow(()=>new Script(tenant));
 const inline=[...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
 for(const match of inline)assert.doesNotThrow(()=>new Script(match[1]));
});
test("Public calculator and Chamados screens load updated PISO permission rules",()=>{
 for(const name of ["calculo-antt","calculo-piso","chamados"]){
  assert.match(read("pages/"+name+".html"),/auth[.]js[?]v=27/);
 }
 assert.match(read("worker/src/controllers/tenant-unified.js"),/Perfil PISO restrito ao Calculo de Piso 2/);
});
