import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
import {sanitizeSharedClients} from "../src/services/shared-client-catalog.js";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const read=path=>readFileSync(resolve(root,path),"utf8");

test("shared client names do not reveal Nova Frota contact or commercial records",()=>{
 const values=sanitizeSharedClients({data:{rows:[
  {cliente:" Agro ABC ",ordem:2,ativo:"SIM",cnpj:"123",telefone:"0000",
   faturamento:"R$ 99.000",contato:"Privado",contrato:"Não compartilhar"},
  {Cliente:"BOM CLIENTE",Ordem:1,Ativo:"SIM",endereco:"Privado"},
  {cliente:"Cliente removido",ativo:"NÃO"},
  {cliente:"AGRO ABC",ordem:2,ativo:"SIM"}
 ]}});
 assert.deepEqual(values.map(v=>v.cliente),["BOM CLIENTE","AGRO ABC"]);
 assert.deepEqual(Object.keys(values[0]).sort(),["ativo","cliente","id","ordem"]);
 assert.equal(values.some(v=>JSON.stringify(v).includes("Privado")),false);
 assert.equal(values.some(v=>JSON.stringify(v).includes("faturamento")),false);
});
test("shared clients reject control characters, inactive names and oversized values",()=>{
 const input=[
  {cliente:"A".repeat(141)},{cliente:"<img>",ativo:"SIM"},
  {cliente:"INATIVO",ativo:"FALSE"},
  {cliente:" Ativo  Modelo ",ativo:"SIM"}
 ];
 const result=sanitizeSharedClients({data:input});
 assert.deepEqual(result.map(v=>v.cliente),["ATIVO MODELO"]);
});
test("read-only shared branding leaves legacy APIs isolated and owners in control",()=>{
 const router=read("worker/src/router.js");
 assert.ok(router.includes('["GET","HEAD"].includes(request.method)'));
 assert.ok(router.includes("!sharedLogoRead"));
 const api=read("worker/src/controllers/tenant-unified.js");
 assert.ok(api.includes('/v1/tenant/catalogo/clientes'));
 const logo=read("worker/src/controllers/client-logos.js");
 assert.ok(logo.includes("return errorResponse(\"Armazenamento não provisionado"));
 const cad=read("assets/js/cadastros.js");
 assert.ok(cad.includes("sharedClientsView()"));
 assert.ok(cad.includes("Catálogo compartilhado: edição disponível"));
});
test("tenant Controle uses local generated CSS, not Tailwind Play CDN",()=>{
 const loader=read("assets/js/tenant-page.js");
 assert.ok(loader.includes('page==="controle.html"||page==="ordem.html"'));
 assert.ok(loader.includes('controle-tailwind.generated.css?v=1'));
 assert.ok(loader.includes('script[src*="cdn.tailwindcss.com"]'));
 const css=read("assets/css/controle-tailwind.generated.css");
 assert.ok(css.includes(".grid{"));
 assert.ok(css.includes(".rounded-xl{"));
 assert.ok(css.length>8000);
 assert.ok(loader.includes('page==="controle.html"||page==="ordem.html"'));
 const order=read("assets/css/ordem-tailwind.generated.css");
 assert.ok(order.includes(".flex{"));
 assert.ok(order.length>10000);
 assert.ok(loader.includes('ordem-tailwind.generated.css?v=1'));
});


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
