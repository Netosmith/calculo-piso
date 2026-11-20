import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {defaultProfileModules,modulesForProfile,profileAllowsModule,readProfileAccess,adminWriteProfileAccess} from "../src/services/profile-access.js";
import {SOLIC_MODULE_KEYS,SOLIC_DEFAULT_KEYS,readSolicUserAccess,effectiveSolicRole,assignSolicProfile,
 adminWriteSolicUserAccess} from "../src/services/solicitacoes-user-access.js";

const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
function mock(){
 const data=new Map();
 return {data,TENANT_BRANDS:{
  async get(key){return data.has(key)?{json:async()=>JSON.parse(data.get(key))}:null;},
  async put(key,value){data.set(key,value);}
 }};
}
test("Solicitações pode consultar/executar somente seus módulos individualmente permitidos",async()=>{
 const env=mock();
 assert.deepEqual(SOLIC_DEFAULT_KEYS,["solicitacao-pedidos","execucao-pedidos"]);
 assert.ok(SOLIC_MODULE_KEYS.includes("execucao-troca-notas"));
 const other=["solicitacao-pedidos","execucao-pedidos","cadastro-solicitacoes","execucao-cadastros",
   "solicitacao-troca-notas","execucao-troca-notas","bi","fretes"];
 assert.deepEqual(await modulesForProfile(env,"nova-frota","SOLICITACOES",other,false,"GEOVANNA"),
  ["solicitacao-pedidos","execucao-pedidos"]);
 assert.equal(await profileAllowsModule(env,"nova-frota","SOLICITACOES","execucao-cadastros",false,"GEOVANNA"),false);
 assert.equal(await profileAllowsModule(env,"nova-frota","ADMINISTRADOR","execucao-pedidos",false,"ADMIN"),false);
 assert.equal(await profileAllowsModule(env,"nova-frota","COMERCIAL","execucao-troca-notas",false,"USER"),false);
 assert.equal(await profileAllowsModule(env,"nova-frota","OPERACIONAL","cadastro-solicitacoes",false,"OPERADOR"),true);
 assert.ok(!defaultProfileModules("nova-frota","SOLICITACOES").includes("fretes"));
 await assignSolicProfile(env,"nova-frota","GEOVANNA",true,"OWNER");
 const data=await readSolicUserAccess(env,"nova-frota");
 assert.deepEqual(data.usuarios.GEOVANNA.modules,SOLIC_DEFAULT_KEYS);
 assert.equal(await effectiveSolicRole(env,"nova-frota","GEOVANNA","OPERACIONAL"),"SOLICITACOES");
 assert.equal(await effectiveSolicRole(env,"nova-frota","OUTRO","OPERACIONAL"),"OPERACIONAL");
 const resp=await adminWriteSolicUserAccess(new Request("https://api.portalfrete.net.br/v1/super-admin/transportadoras/nova-frota/solicitacoes-user-access",{
  method:"PUT",body:JSON.stringify({usuarios:{
   GEOVANNA:["solicitacao-pedidos","execucao-pedidos"],
   OUTRO:["cadastro-solicitacoes","execucao-cadastros"]
  }})
 }),env,"OWNER","nova-frota");
 assert.equal(resp.status,200);
 assert.deepEqual(await modulesForProfile(env,"nova-frota","SOLICITACOES",other,false,"OUTRO"),
   ["solicitacao-pedidos","cadastro-solicitacoes","execucao-cadastros"]);
 assert.equal(await profileAllowsModule(env,"nova-frota","SOLICITACOES","solicitacao-pedidos",false,"OUTRO"),false,
  "Pode acompanhar a fila comum sem poder criar novos chamados");
 assert.equal(await profileAllowsModule(env,"nova-frota","SOLICITACOES","execucao-pedidos",false,"OUTRO"),false);
 assert.equal(await profileAllowsModule(env,"nova-frota","SOLICITACOES","execucao-cadastros",false,"OUTRO"),true);
 // Ainda depende de o módulo estar ativo na transportadora.
 assert.deepEqual(await modulesForProfile(env,"nova-frota","SOLICITACOES",["cadastro-solicitacoes"],false,"OUTRO"),
  ["cadastro-solicitacoes"]);
});
test("Matriz global pode bloquear e não amplia módulos individuais",async()=>{
 const env=mock();
 await assignSolicProfile(env,"nova-frota","GEOVANNA",true,"OWNER");
 const current=await readProfileAccess(env,"nova-frota");
 const profiles={...current.profiles,SOLICITACOES:["solicitacao-pedidos","cadastro-solicitacoes"]};
 const resp=await adminWriteProfileAccess(new Request("https://api.portalfrete.net.br/v1/super-admin/transportadoras/nova-frota/profile-access",{
  method:"PUT",body:JSON.stringify({profiles})
 }),env,"OWNER","nova-frota");
 assert.equal(resp.status,200);
 assert.deepEqual(await modulesForProfile(env,"nova-frota","SOLICITACOES",["solicitacao-pedidos","execucao-pedidos"],false,"GEOVANNA"),
  ["solicitacao-pedidos"]);
});
test("Usuário retirado do perfil não recebe execução; payload malicioso rejeitado",async()=>{
 const env=mock();
 await assignSolicProfile(env,"nova-frota","GEOVANNA",true,"OWNER");
 await assignSolicProfile(env,"nova-frota","GEOVANNA",false,"OWNER");
 assert.equal(await effectiveSolicRole(env,"nova-frota","GEOVANNA","OPERACIONAL"),"OPERACIONAL");
 assert.equal(await profileAllowsModule(env,"nova-frota","OPERACIONAL","execucao-pedidos",false,"GEOVANNA"),false);
 const resp=await adminWriteSolicUserAccess(new Request("https://api.portalfrete.net.br",{
  method:"PUT",body:JSON.stringify({usuarios:{GEOVANNA:["bi","execucao-pedidos"]}})
 }),env,"OWNER","nova-frota");
 assert.equal(resp.status,400);
});
test("Interface de granularidade existe no Super Admin e usa os mesmos identificadores",()=>{
 const script=read("assets/js/super-admin-solicitacoes-users.js");
 const html=read("pages/super-admin.html");
 assert.doesNotThrow(()=>new Script(script));
 for(const key of SOLIC_MODULE_KEYS){
  assert.ok(script.includes(key),key);
  assert.ok(html.includes('data-solic-module="'+key+'"'),key);
 }
 assert.ok(html.includes('value="SOLICITACOES"'));
 assert.ok(html.includes('id="solicUsersSave"'));
 const endpoint=read("worker/src/controllers/super-admin.js");
 assert.ok(endpoint.includes("solicitacoes-user-access"));
 const write=read("worker/src/services/super-admin-tenant-write.js");
 assert.ok(write.includes("adminWriteSolicUserAccess"));
});
