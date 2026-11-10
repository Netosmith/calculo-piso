import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
function read(path){return readFileSync(new URL("../../"+path,import.meta.url),"utf8");}
test("HOME solicita senha antes de abrir três cards, sem expor PIN no JS",()=>{
  const home=read("pages/home.html");
  const source=read("assets/js/module-pin.js");
  new Script(source);
  assert.match(home,/data-feature="funcionarios"[^>]*href="\.\/funcionarios\.html"/);
  assert.match(home,/data-feature="custo-filial"[^>]*href="\.\/custo-filial\.html"/);
  assert.match(home,/data-feature="custo-frota"[^>]*href="\.\/custo-frota-pesada\.html"/);
  assert.match(home,/PortalModulePin\?\.bindHomeCards\(\)/);
  assert.match(source,/\/v1\/module-pin/);
  assert.match(source,/credentials:"include"/);
  assert.doesNotMatch(source,/5522|PIN_HASH/);
});
test("todos os submódulos de Funcionários e Cálculo Frota exigem PIN em acesso direto",()=>{
  for(const page of ["funcionarios.html","funcionarios-cadastro.html","funcionarios-lancamentos.html",
    "funcionarios-tabela.html","funcionarios-comissoes.html"]){
    const html=read("pages/"+page);
    assert.match(html,/module-pin\.js\?v=1/);
    assert.match(html,/PortalModulePin\.guardPage\("funcionarios"\)/);
  }
  const html=read("pages/custo-frota-pesada.html");
  assert.match(html,/PortalModulePin\.guardPage\("custo-frota"\)/);
  assert.match(html,/module-pin\.js\?v=1/);
});
test("Custo Filial valida no servidor antes de carregar módulo, sem PIN hardcoded",()=>{
  const html=read("pages/custo-filial.html");
  assert.match(html,/PortalModulePin\.unlock\("custo-filial",pin\)/);
  assert.match(html,/PortalModulePin\.unlocked\("custo-filial"\)/);
  assert.match(html,/id="cfProtectedContent" hidden/);
  assert.doesNotMatch(html,/PIN_HASH=/);
});

test("Super Admin exige PIN na HOME, URL direta e WebView do aplicativo",()=>{
  const home=read("pages/home.html");
  const panel=read("pages/super-admin.html");
  const script=read("assets/js/module-pin.js");
  assert.match(home,/id="superAdminHomeCard"/);
  assert.match(script,/a#superAdminHomeCard/);
  assert.match(script,/guardPage/);
  assert.match(panel,/PortalModulePin\.guardPage\("super-admin"\)/);
  assert.match(panel,/PortalModulePin\.unlocked\('super-admin'\)/);
  assert.doesNotMatch(panel,/5522/);
  const mobile=read("mobile/portal-frete/src/routes.js");
  assert.match(mobile,/"super-admin"/);
});
