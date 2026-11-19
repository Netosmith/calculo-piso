import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
class ElementMock{
 constructor(tag="div"){
  this.tag=tag;this.children=[];this.dataset={};this.style={};
  this.hidden=false;this.disabled=false;this.value="";this.textContent="";
  this.className="";this.classList={add(){},remove(){},toggle(){}};
 }
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 setAttribute(){}
 removeAttribute(){}
 addEventListener(){}
 scrollIntoView(){}
 querySelector(){return new ElementMock();}
 querySelectorAll(){return [];}
 getContext(){return {drawImage(){}};}
 remove(){}
}
function harness(){
 let script=read("assets/js/document-reader.js");
 const replace=(a,b,value)=>{
  const i=script.indexOf(a),j=script.indexOf(b,i);
  assert.ok(i>=0&&j>i,a);
  script=script.slice(0,i)+value+"\n"+script.slice(j);
 };
 replace("async function imageOCR(f){","async function ensurePdf(){",
  'async function imageOCR(f){return {text:"CARTEIRA NACIONAL DE HABILITACAO\\nNOME: "+f.name.toUpperCase()+"\\nCPF: 529.982.247-25",pages:1,confidences:[90]};}');
 replace("async function pdfOCR(f){","async function terminateWorker(){",
  'async function pdfOCR(f){return {text:"CARTEIRA NACIONAL DE HABILITACAO\\nNOME: "+f.name.toUpperCase()+"\\nCPF: 529.982.247-25",pages:1,confidences:[90]};}');
 assert.match(script,/void authGate\(\);/);
 script=script.replace("void authGate();",
  "window.__readerTest={selectFiles,analyze,removeEntry,activate,payload,selectedPayload,getActive,entries:()=>entries};");
 const nodes=new Map();
 const document={
  getElementById(id){
   if(!nodes.has(id))nodes.set(id,new ElementMock());
   return nodes.get(id);
  },
  createElement(tag){return new ElementMock(tag);},
  body:new ElementMock(),head:new ElementMock()
 };
 const m={exports:{}};
 runInNewContext(read("assets/js/document-reader-fields.js"),{module:m});
 const window={PortalOCRFields:m.exports};
 document.getElementById("ocrType").value="auto";
 runInNewContext(script,{
  document,window,Number,Math,Error,Promise,Array,Uint8Array,
  Date,Object,String,console:{warn(){},error(){}},
  URL:{createObjectURL:()=> "blob:mock",revokeObjectURL(){}},
  navigator:{clipboard:{writeText:async()=>{}}},setTimeout(){}
 });
 return {api:window.__readerTest,document};
}
function mockFile(n){
 return {
  name:"documento"+n+".pdf",size:100,lastModified:n,
  slice(){return {arrayBuffer:async()=>Uint8Array.from([0x25,0x50,0x44,0x46,0,0,0,0]).buffer};},
  arrayBuffer:async()=>new ArrayBuffer(8)
 };
}
test("Até 10 arquivos; 11º é recusado sem apagar os anteriores",async()=>{
 const {api}=harness();
 await api.selectFiles(Array.from({length:11},(_,i)=>mockFile(i+1)));
 assert.equal(api.entries().length,10);
 const first=api.entries()[0].id;
 await api.selectFiles([mockFile(1)]);
 assert.equal(api.entries().length,10);
 assert.equal(api.entries()[0].id,first);
});
test("Leitura sequencial mantém campos independentes e permite remoção",async()=>{
 const {api}=harness();
 await api.selectFiles(Array.from({length:5},(_,i)=>mockFile(i+1)));
 await api.analyze();
 const output=api.payload();
 assert.equal(output.schema,"portal-frete.document-reader.batch.v2");
 assert.equal(output.totalDocumentos,5);
 assert.equal(new Set(output.documentos.map(x=>x.nomeArquivo)).size,5);
 const fifth=api.entries()[4];
 api.activate(fifth.id);
 assert.equal(api.selectedPayload().documento.nomeArquivo,"documento5.pdf");
 api.removeEntry(api.entries()[2].id);
 assert.equal(api.entries().length,4);
 assert.equal(api.payload().totalDocumentos,4);
});
test("Extrator CNH: usar MRZ para recuperar datas e sinalizar nome abreviado",()=>{
 const mod={exports:{}};
 runInNewContext(read("assets/js/document-reader-fields.js"),{module:mod});
 const raw=[
  "CARTEIRA NACIONAL DE HABILITACAO",
  "DOC IDENTIDADE / ORG EMISSOR UF",
  "7654321 SSP GO",
  "CPF 529.982.247-25",
  "N REGISTRO",
  "01234567890",
  "CAT HAB",
  "E",
  "I<BRA012345678<393<<<<<<<<<<<<",
  "9502149M3605152BRA<<<<<<<<<<<0",
  "RENATO<<CESAR<DE<SOUZA"
 ].join("\n");
 const data=mod.exports.extract(raw);
 assert.equal(data.tipo,"cnh");
 assert.equal(data.campos.nascimento,"14/02/1995");
 assert.equal(data.campos.validade,"15/05/2036");
 assert.equal(data.campos.registro,"01234567890");
 assert.equal(data.campos.categoria,"E");
 assert.ok(data.campos.nome);
 assert.ok(data.avisos.length>0);
 assert.notEqual(data.campos.rg.toLowerCase(),"assinado");
});
