import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {
 PROFILE_ROLES,defaultProfileModules,readProfileAccess,
 modulesForProfile,profileAllowsModule,adminWriteProfileAccess
} from "../src/services/profile-access.js";
import {canRunGatewayAction} from "../src/services/permissions.js";

function env(){
 const map=new Map();
 return {TENANT_BRANDS:{
  async get(key){return map.has(key)?{json:async()=>JSON.parse(map.get(key))}:null;},
  async put(key,value){map.set(key,value);}
 },map};
}
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("Cinco perfis configuráveis; SUPER-ADMIN nunca é cadastro comum",()=>{
 assert.deepEqual(PROFILE_ROLES,["ADMINISTRADOR","COMERCIAL","OPERACIONAL","GOADM","PISO"]);
 assert.deepEqual(defaultProfileModules("nova-frota","PISO"),["piso2"]);
 assert.deepEqual(defaultProfileModules("nova-frota","GOADM"),["administrativo"]);
 const op=defaultProfileModules("nova-frota","OPERACIONAL");
 for(const key of ["piso","piso2","fretes","fretes2","fretes-go","fretes-mt","ordem",
   "controle","divulgacao","estadias","monitoramento","embarques","chamados",
   "cadastro-solicitacoes","solicitacao-pedidos","solicitacao-troca-notas"])
  assert.ok(op.includes(key),key);
 for(const key of ["bi","cadastros","administrativo","funcionarios","execucao-cadastros","execucao-pedidos"])
  assert.ok(!op.includes(key),key);
 const com=defaultProfileModules("nova-frota","COMERCIAL");
 assert.ok(!com.includes("cadastros"));
 assert.ok(!com.includes("funcionarios"));
 assert.ok(com.includes("bi"));
 assert.ok(com.includes("piso2"));
 const adm=defaultProfileModules("nova-frota","ADMINISTRADOR");
 assert.ok(adm.includes("cadastros"));
 assert.ok(adm.includes("funcionarios"));
 assert.ok(adm.includes("administrativo"));
 assert.ok(!defaultProfileModules("transvale-01","ADMINISTRADOR").includes("fretes2"));
});

test("Salvar na R2 por empresa, preservando bloqueios imutáveis",async()=>{
 const storage=env();
 const before=await readProfileAccess(storage,"nova-frota");
 assert.equal(before.configured,false);
 const all={
  ...before.profiles,
  PISO:["piso","bi","piso2","administrativo"],
  COMERCIAL:["cadastros","funcionarios","piso2","bi"],
  OPERACIONAL:["piso2","fretes-go","monitoramento"],
  GOADM:["administrativo","ordem"],
  ADMINISTRADOR:[]
 };
 const request=new Request("https://api.portalfrete.net.br/v1/super-admin/transportadoras/nova-frota/profile-access",{
  method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({profiles:all})
 });
 const response=await adminWriteProfileAccess(request,storage,"LUZIANO","nova-frota");
 assert.equal(response.status,200);
 const state=await readProfileAccess(storage,"nova-frota");
 assert.equal(state.configured,true);
 assert.deepEqual(state.profiles.PISO,["piso2"]);
 assert.deepEqual(state.profiles.COMERCIAL,["piso2","bi"]);
 assert.ok(state.profiles.ADMINISTRADOR.includes("cadastros"));
 assert.equal(await profileAllowsModule(storage,"nova-frota","GOADM","ordem"),true);
 assert.equal(await profileAllowsModule(storage,"nova-frota","OPERACIONAL","bi"),false);
 assert.deepEqual(await modulesForProfile(storage,"nova-frota","OPERACIONAL",
   ["piso2","fretes-go","fretes-mt","bi"]),["piso2","fretes-go"]);
 assert.deepEqual(await modulesForProfile(storage,"nova-frota","PISO",
   ["piso2","piso","cadastros"]),["piso2"]);
 assert.deepEqual(await modulesForProfile(storage,"nova-frota","ADMINISTRADOR",
   ["piso2","cadastros"]),["piso2","cadastros"]);
});

test("API recusa ação de módulo que o perfil não tem, mesmo pelo link direto",()=>{
 assert.equal(canRunGatewayAction({perfil:"OPERACIONAL",allowedModules:["fretes","piso2"]},"bi","read"),false);
 assert.equal(canRunGatewayAction({perfil:"OPERACIONAL",allowedModules:["bi"]},"bi","read"),true);
 assert.equal(canRunGatewayAction({perfil:"OPERACIONAL",allowedModules:["estadias"]},"estadias","read"),true);
 assert.equal(canRunGatewayAction({perfil:"OPERACIONAL",allowedModules:["estadias"]},"estadias","update"),false);
 assert.equal(canRunGatewayAction({perfil:"GOADM",allowedModules:["administrativo"]},"fretes","read"),false);
 assert.equal(canRunGatewayAction({perfil:"GOADM",allowedModules:["administrativo"]},"administrativo","read"),true);
 assert.equal(canRunGatewayAction({perfil:"PISO",allowedModules:["piso2","bi"]},"bi","read"),false);
});

test("Interface apresenta a aba e o carregador protege links e PISO",()=>{
 const panel=read("pages/super-admin.html");
 const ui=read("assets/js/super-admin-profile-access.js");
 const guard=read("assets/js/tenant-page.js");
 const auth=read("assets/js/auth.js");
 assert.ok(panel.includes('data-tab="profiles"'));
 assert.ok(panel.includes('id="profileModuleGrid"'));
 assert.ok(panel.includes('id="saveProfileAccess"'));
 assert.ok(panel.includes('super-admin-profile-access.js?v='));
 assert.ok(ui.includes("/profile-access"));
 assert.ok(guard.includes("routeFeature"));
 assert.ok(guard.includes("session.modules.includes(routeFeature)"));
 assert.ok(auth.includes('if(feature==="super-admin")return false'));
 assert.doesNotThrow(()=>new Script(ui));
});
