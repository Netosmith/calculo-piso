import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FEATURE_META,EMPLOYEE_HOME_BRIDGE,parseEmployeeSessionMessage,validEmployeeHomeUrl} from "../src/employee-access.js";

const nova="https://portalfrete.net.br/pages/home.html";
const gnova="https://portalfrete.net.br/pages/gnova/home.html";
const packet=(options={})=>JSON.stringify({
  type:"portal-employee-v1",verified:true,usuario:"MARIA",nome:"MARIA TESTE",
  perfil:"OPERACIONAL",tenantMode:false,transportadoraId:"nova-frota",
  modules:[{feature:"fretes",page:"fretes"},{feature:"bi",page:"bi"},
    {feature:"administrativo",page:"administrativo"},{feature:"piso2",page:"calculo-antt"}],
  metrics:{fretesAtivos:12,veiculos:25,solicitacoes:3},...options
});
test("aceita somente snapshot da HOME oficial com sessão verificada",()=>{
  assert.equal(validEmployeeHomeUrl(nova),true);
  assert.equal(validEmployeeHomeUrl(gnova,"gnova"),true);
  assert.equal(validEmployeeHomeUrl(gnova),false);
  assert.equal(validEmployeeHomeUrl("https://portalfrete.net.br.evil.test/pages/home.html"),false);
  const parsed=parseEmployeeSessionMessage(packet(),"",nova);
  assert.deepEqual(parsed.modules.map(x=>x.key),["fretes","bi","piso2","administrativo"]);
  assert.equal(parsed.metrics.fretesAtivos,12);
  assert.equal(parsed.usuario,"MARIA");
});
test("nega dados sem prova de login, origem, empresa ou rota correta",()=>{
  assert.equal(parseEmployeeSessionMessage(packet({verified:false}),"",nova),null);
  assert.equal(parseEmployeeSessionMessage(packet(),"","https://evil.example/pages/home.html"),null);
  assert.equal(parseEmployeeSessionMessage(packet(),"",gnova),null);
  assert.equal(parseEmployeeSessionMessage(packet({transportadoraId:"gnova"}),"",nova),null);
  assert.equal(parseEmployeeSessionMessage(packet({tenantMode:true}),"",nova),null);
  assert.equal(parseEmployeeSessionMessage('{"notJson":',"",nova),null);
});
test("PISO mostra apenas Piso ANTT e nenhum indicador operacional",()=>{
  const parsed=parseEmployeeSessionMessage(packet({perfil:"PISO"}),"",nova);
  assert.deepEqual(parsed.modules.map(x=>x.key),["piso2"]);
  assert.deepEqual(parsed.metrics,{fretesAtivos:null,veiculos:null,solicitacoes:null});
});
test("tenant separado só recebe os módulos presentes na HOME permitida",()=>{
  const data=packet({tenantMode:true,transportadoraId:"gnova",
    modules:[{feature:"fretes",page:"fretes"},{feature:"bi",page:"bi"},
      {feature:"monitoramento",page:"monitoramento"},{feature:"fretes2",page:"fretes2"}]});
  const parsed=parseEmployeeSessionMessage(data,"gnova",gnova);
  assert.deepEqual(parsed.modules.map(x=>x.key),["fretes","bi"]);
  assert.equal(parseEmployeeSessionMessage(data,"gnova",nova),null);
});
test("rejeita atalhos forjados e não cria módulo por perfil",()=>{
  const parsed=parseEmployeeSessionMessage(packet({modules:[
    {feature:"fretes",page:"super-admin"},
    {feature:"super-admin",page:"super-admin"},
    {feature:"administrativo",page:"administrativo"},
    {feature:"outro",page:"outro"}
  ]}),"",nova);
  assert.deepEqual(parsed.modules.map(x=>x.key),["administrativo"]);
  assert.equal(FEATURE_META.piso2.page,"calculo-antt");
});
test("ponte consulta canAccessFeature só após sessão assinada e nunca lê senhas",()=>{
  assert.match(EMPLOYEE_HOME_BRIDGE,/portalAuthReady/);
  assert.match(EMPLOYEE_HOME_BRIDGE,/canAccessFeature/);
  assert.match(EMPLOYEE_HOME_BRIDGE,/ReactNativeWebView\.postMessage/);
  assert.doesNotMatch(EMPLOYEE_HOME_BRIDGE,/senha|password|localStorage|Cookie/);
  const app=readFileSync(new URL("../App.js",import.meta.url),"utf8");
  const dashboard=readFileSync(new URL("../src/EmployeeDashboard.js",import.meta.url),"utf8");
  assert.match(app,/parseEmployeeSessionMessage/);
  assert.match(app,/onMessage=\{onPortalMessage\}/);
  assert.match(app,/employee\.modules\.some/);
  assert.doesNotMatch(app,/const MODULES=\[/);
  assert.match(dashboard,/assets\/img\/logo-novafrota\.png/);
  assert.doesNotMatch(dashboard,/Fretes ativos.{0,80}128/);
});
