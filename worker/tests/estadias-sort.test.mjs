import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=p=>fs.readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const js=read("assets/js/estadias.js");
const html=read("pages/estadias.html");
const slice=(start,end)=>{
 const a=js.indexOf(start),b=js.indexOf(end,a);
 assert.ok(a>=0&&b>a,"Trecho não encontrado: "+start);
 return js.slice(a,b);
};
const source=[
 slice("function txt(","function money("),
 slice("function parseDateValue(","function hoursBetween("),
 'let filtrados=[],paginaAtual=1,colunaOrdenada="",direcaoOrdenacao="asc";',
 slice("const CAMPOS_ORDENACAO=","function aplicarFiltros(){"),
 'return {valorOrdenacao,compararEstadias,ordenarFiltrados,alternarOrdenacao,atualizarIndicadoresOrdenacao,setRows:rows=>filtrados=rows,getRows:()=>filtrados,getPage:()=>paginaAtual};'
].join("\n");
function setup(canEdit=true){
 const buttons=["status","cliente","cte","nf","placa","origem","destino",
   "dataHoraChegada","dataHoraSaida","horasPagar","valorTotal","valorPago","responsavel"]
 .map(key=>{
   const th={attrs:{},setAttribute(k,v){this.attrs[k]=v}};
   const indicator={textContent:"↕"};
   return {dataset:{sort:key,title:key},attrs:{},th,indicator,
     closest:()=>th,querySelector:()=>indicator,
     setAttribute(k,v){this.attrs[k]=v},disabled:false};
 });
 const document={querySelectorAll:()=>buttons};
 const api=new Function("document","canWrite","renderTable","renderPagination",
  source)(document,()=>canEdit,()=>{},()=>{});
 return {...api,buttons};
}
const row=(fields={})=>({status:"AGUARDANDO",cliente:"",cte:"",nf:"",
 placa:"",origem:"",destino:"",dataHoraChegada:"",dataHoraSaida:"",
 horasPagar:0,valorTotal:0,valorPago:0,responsavel:"",...fields});

test("Sintaxe, cabeçalhos e cache",()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 for(const key of ["status","cliente","cte","nf","placa","origem","destino",
  "dataHoraChegada","dataHoraSaida","horasPagar","valorTotal","valorPago","responsavel"]){
  assert.match(html,new RegExp('class="sortHeader" data-sort="'+key+'"'));
 }
 assert.match(html,/aria-sort="none"/);
 assert.match(html,/<th>Ações<\/th>/);
 assert.match(html,/estadias\.js\?v=20261125-sort-v1/);
 assert.match(js,/ordenarFiltrados\(\);paginaAtual=1;renderTudo\(\)/);
});
test("Cliente, origem, destino e responsável em ordem alfabética com acentos",()=>{
 const a=setup();
 a.setRows([row({cliente:"Zé"}),row({cliente:"Água Fria"}),row({cliente:"Brasília"})]);
 a.alternarOrdenacao("cliente");
 assert.deepEqual(a.getRows().map(x=>x.cliente),["Água Fria","Brasília","Zé"]);
 a.alternarOrdenacao("cliente");
 assert.deepEqual(a.getRows().map(x=>x.cliente),["Zé","Brasília","Água Fria"]);
});
test("CTe e NF usam ordem natural: 9, 10, 100",()=>{
 const a=setup();
 a.setRows([row({cte:"100"}),row({cte:"10"}),row({cte:"9"})]);
 a.alternarOrdenacao("cte");
 assert.deepEqual(a.getRows().map(x=>x.cte),["9","10","100"]);
});
test("Chegada e saída são datas reais, inclusive dd/mm/aaaa",()=>{
 const a=setup();
 a.setRows([row({dataHoraChegada:"19/11/2026, 12:15:00"}),
            row({dataHoraChegada:"03/11/2026, 15:06:00"}),
            row({dataHoraChegada:"2026-11-16T12:00:00"})]);
 a.alternarOrdenacao("dataHoraChegada");
 assert.equal(a.getRows()[0].dataHoraChegada,"03/11/2026, 15:06:00");
 assert.equal(a.getRows()[1].dataHoraChegada,"2026-11-16T12:00:00");
});
test("Horas e moeda são números, não texto",()=>{
 const a=setup();
 a.setRows([row({horasPagar:100,valorTotal:1200}),
            row({horasPagar:9,valorTotal:90}),
            row({horasPagar:25,valorTotal:250})]);
 a.alternarOrdenacao("horasPagar");
 assert.deepEqual(a.getRows().map(x=>x.horasPagar),[9,25,100]);
 a.alternarOrdenacao("valorTotal");
 assert.deepEqual(a.getRows().map(x=>x.valorTotal),[90,250,1200]);
});
test("Vazios por último, ordem estável, sem modificar os registros",()=>{
 const a=setup();
 const items=[row({cliente:"",id:"a"}),row({cliente:"LDC",id:"b"}),
  row({cliente:"LDC",id:"c"})];
 a.setRows(items);
 a.alternarOrdenacao("cliente");
 assert.deepEqual(a.getRows().map(x=>x.id),["b","c","a"]);
 a.alternarOrdenacao("cliente");
 assert.equal(a.getRows()[2].id,"a");
 assert.equal(items[0].cliente,"");
});
test("Ordenação opera em todo o conjunto e reseta a página ao mudar coluna",()=>{
 const a=setup();
 const records=Array.from({length:190},(_,i)=>row({cte:String(190-i)}));
 a.setRows(records);
 a.alternarOrdenacao("cte");
 assert.equal(a.getRows().length,190);
 assert.equal(a.getRows()[0].cte,"1");
 assert.equal(a.getRows()[189].cte,"190");
 assert.equal(a.getPage(),1);
});
test("Perfil somente leitura não ordena por Valor oculto",()=>{
 const a=setup(false);
 a.setRows([row({valorTotal:200}),row({valorTotal:10})]);
 a.alternarOrdenacao("valorTotal");
 assert.deepEqual(a.getRows().map(x=>x.valorTotal),[200,10]);
 a.atualizarIndicadoresOrdenacao();
 assert.equal(a.buttons.find(x=>x.dataset.sort==="valorTotal").disabled,true);
 assert.equal(a.buttons.find(x=>x.dataset.sort==="cliente").disabled,false);
});
test("Indicadores mostram a direção clicada e aria-sort correto",()=>{
 const a=setup();
 a.setRows([row({cliente:"B"}),row({cliente:"A"})]);
 a.alternarOrdenacao("cliente");
 const btn=a.buttons.find(x=>x.dataset.sort==="cliente");
 assert.equal(btn.th.attrs["aria-sort"],"ascending");
 assert.equal(btn.indicator.textContent,"↑");
 a.alternarOrdenacao("cliente");
 assert.equal(btn.th.attrs["aria-sort"],"descending");
 assert.equal(btn.indicator.textContent,"↓");
});
