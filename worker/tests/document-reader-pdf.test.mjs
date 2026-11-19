import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";

const original=readFileSync(new URL("../../assets/js/document-reader.js",import.meta.url),"utf8");
function replaceSection(source,start,end,replacement){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,"Trecho de teste não encontrado: "+start);
 return source.slice(0,a)+replacement+"\n"+source.slice(b);
}
function testEngine(){
 let src=original;
 src=replaceSection(src,"async function ensurePdf(){","function ensureCanvasSize(",
  "async function ensurePdf(){return window.__mockPdf;}");
 src=replaceSection(src,"async function renderPage(","// Documentos oficiais",
  "async function renderPage(){window.__rendered++;return {width:1600,height:2100};}");
 src=replaceSection(src,"function pdfSearchRegion(","function pdfRegions(",
  "function pdfSearchRegion(){window.__cropped++;return {width:1000,height:1000};}");
 src=replaceSection(src,"async function recognize(","async function imageOCR(",
  "async function recognize(){window.__recognized++;return {text:window.__mockOcrText,confidence:87};}");
 assert.match(src,/void authGate\(\);/);
 src=src.replace("void authGate();","window.__pdfOCRTest=pdfOCR;");
 const values=new Map();
 const document={getElementById(id){
  if(!values.has(id))values.set(id,{dataset:{},value:0,textContent:""});
  return values.get(id);
 }};
 const window={
  PortalOCRFields:{},__rendered:0,__cropped:0,__recognized:0,
  __mockOcrText:"CARTEIRA NACIONAL DE HABILITACAO\nNOME: PESSOA TESTE\nCPF: 529.982.247-25"
 };
 const ctx={document,window,console:{warn(){}},Uint8Array,Number,Math,Error,Promise};
 new Script(src).runInNewContext(ctx);
 return window;
}
test("PDF.js 6: sucesso na leitura não pode ser transformado em erro de pdf.destroy",async()=>{
 assert.doesNotMatch(original,/pdf\.destroy\s*\(/);
 assert.match(original,/typeof task\.destroy==="function"/);
 const engine=testEngine();
 let closed=0;
 engine.__mockPdf={getDocument:()=>({
  promise:Promise.resolve({numPages:1,getPage:async()=>({
   getTextContent:async()=>({items:[{str:"QR-CODE\nDocumento assinado pelo governo",transform:[1,0,0,1,30,500]}]}),
   getViewport:()=>({width:595,height:842}),cleanup(){}
  })}),
  destroy:async()=>{closed++}
 })};
 const result=await engine.__pdfOCRTest({name:"cnh-teste.pdf",arrayBuffer:async()=>new ArrayBuffer(8)});
 assert.match(result.text,/CARTEIRA NACIONAL DE HABILITACAO/);
 assert.equal(result.pages,1);
 assert.equal(engine.__cropped,3);
 assert.equal(engine.__recognized,3);
 assert.equal(closed,1);
});
test("CRLV híbrido: ler duas regiões OCR mesmo quando PDF já contém texto digital",async()=>{
 const engine=testEngine();
 let closed=0;
 engine.__mockOcrText="PLACA ABC1D23\nRENAVAM 01234567890";
 engine.__mockPdf={getDocument:()=>({
  promise:Promise.resolve({numPages:1,getPage:async()=>({
   getTextContent:async()=>({items:[{
    str:"CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO - DIGITAL\nRENAVAM\nCNH",
    transform:[1,0,0,1,30,500]
   }]}),getViewport:()=>({width:595,height:842}),cleanup(){}
  })}),destroy:async()=>{closed++}
 })};
 const result=await engine.__pdfOCRTest({name:"doc-crlv-teste.pdf",arrayBuffer:async()=>new ArrayBuffer(8)});
 assert.equal(result.pages,1);
 assert.equal(engine.__cropped,2);
 assert.equal(engine.__recognized,2);
 assert.equal(closed,1);
});
test("PDF de texto normal: preserva camada digital sem OCR desnecessário",async()=>{
 const engine=testEngine();
 let closed=0;
 engine.__mockPdf={getDocument:()=>({
  promise:Promise.resolve({numPages:1,getPage:async()=>({
   getTextContent:async()=>({items:[{str:"CONTRATO DIGITAL DE TESTE ".repeat(20),transform:[1,0,0,1,30,500]}]}),
   getViewport:()=>({width:595,height:842}),cleanup(){}
  })}),destroy:async()=>{closed++}
 })};
 const result=await engine.__pdfOCRTest({name:"outro.pdf",arrayBuffer:async()=>new ArrayBuffer(8)});
 assert.match(result.text,/CONTRATO DIGITAL/);
 assert.equal(engine.__recognized,0);
 assert.equal(closed,1);
});