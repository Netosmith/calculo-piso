import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("Controle empresarial remove a marca no rodapé da prévia sem apagar os totais operacionais",()=>{
 const loader=read("assets/js/tenant-page.js");
 const begin=loader.indexOf(" function stripTenantControleFooter(root){");
 const finish=loader.indexOf(" async function renderShared(html)",begin);
 assert.ok(begin>=0&&finish>begin,"Função de proteção do rodapé não encontrada");
 const helper=loader.slice(begin,finish);
 for(const page of ["controle.html","home.html"]){
  const items=[
   {text:"2 veículos registrados",removed:false,remove(){this.removed=true;}},
   {text:"Total embarcado 80 t",removed:false,remove(){this.removed=true;}},
   {text:"NOVA FROTA TRANSPORTES E LOGISTICA",removed:false,remove(){this.removed=true;}}
  ];
  const root={querySelector(selector){
   assert.equal(selector,"#positionCapture .position-footer");
   return {children:items};
  }};
  new Script(helper+";stripTenantControleFooter(root)").runInNewContext({page,root,Array});
  assert.equal(items[0].removed,false,"Quantidade de veículos deve permanecer");
  assert.equal(items[1].removed,false,"Total embarcado deve permanecer");
  assert.equal(items[2].removed,page==="controle.html","Rodapé empresarial deve ser removido");
 }
 assert.ok(loader.includes("stripTenantControleFooter(parsed)"),"Remoção deve ocorrer antes de mostrar a prévia");
 assert.ok(loader.includes("stripTenantControleFooter(document)"),"Remoção deve ser repetida após scripts");
 for(const tenant of ["gnova","transvale","modelo01"]){
  const html=read("pages/"+tenant+"/controle.html");
  assert.ok(html.includes("tenant-page.js?v=20261109-controle-footer-fix"),
   "Versão antiga do loader em "+tenant);
 }
 assert.ok(read("pages/controle.html").includes("CONTROLE DE EMBARQUE LOGISTICO"),
  "Página original Nova Frota não deve ser alterada");
});
