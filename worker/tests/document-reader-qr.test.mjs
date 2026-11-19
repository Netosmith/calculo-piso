import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const qrJs=read("assets/js/document-reader-qr.js");

function parser(window,document){
 const module={exports:{}};
 runInNewContext(qrJs,{module,window,document});
 return module.exports;
}
test("QR em CRLV de texto simples preenche apenas campos vazios, sem validar origem",()=>{
 const api=parser();
 const code=api.interpret("PLACA=ABC1D23\nRENAVAM=01234567890\nCHASSI=9BWZZZ377VT004251");
 assert.equal(code.detectado,true);
 assert.equal(code.tipoConteudo,"dados_estruturados");
 assert.equal(code.documentoSugerido,"veiculo");
 assert.equal(code.validadoOficialmente,false);
 const result={tipo:"veiculo",campos:{placa:"",renavam:"98765432101",chassi:""},avisos:[]};
 api.merge(result,code);
 assert.equal(result.campos.placa,"ABC1D23");
 assert.equal(result.campos.chassi,"9BWZZZ377VT004251");
 assert.equal(result.campos.renavam,"98765432101");
 assert.deepEqual(code.camposDivergentes,["renavam"]);
 assert.ok(result.avisos.length);
 const exported=api.safeExport(code);
 assert.equal(exported.validadoOficialmente,false);
 assert.equal(Object.hasOwn(exported,"camposQR"),false);
});
test("QR Senatran protegido, links e textos livres não criam dados cadastrais",()=>{
 const api=parser();
 const opaque=api.interpret("\u0000\u0001\u0002"+"Xz$VIO=".repeat(50));
 assert.equal(opaque.tipoConteudo,"protegido_ou_binario");
 assert.equal(opaque.documentoSugerido,null);
 assert.deepEqual(Object.keys(opaque.camposQR),[]);
 const url=api.interpret("https://verificacao.exemplo.invalid/?chave=xyz");
 assert.equal(url.tipoConteudo,"url");
 assert.equal(url.validadoOficialmente,false);
 const free=api.interpret("observação livre, placa ABC1D23");
 assert.deepEqual(Object.keys(free.camposQR),[]);
 assert.deepEqual(Object.keys(api.structured("{invalid.json}").fields),[]);
});
test("BarcodeDetector lê QR em memória sem bibliotecas externas",async()=>{
 const detector={
  async getSupportedFormats(){return ["qr_code"];}
 };
 class MockDetector{
  async detect(){return [{format:"qr_code",rawValue:"PLACA=ABC1D23\nRENAVAM=01234567890"}];}
 }
 MockDetector.getSupportedFormats=detector.getSupportedFormats;
 const api=parser({BarcodeDetector:MockDetector});
 const found=await api.scanCanvas({width:1000,height:1000},"veiculo");
 assert.equal(found.metodo,"BarcodeDetector");
 assert.equal(found.camposQR.placa,"ABC1D23");
 assert.equal(found.validadoOficialmente,false);
});
test("Fallback jsQR processa canvas localmente sem usar URLs do documento",async()=>{
 const imageData={data:new Uint8ClampedArray(64*64*4),width:64,height:64};
 const document={
  createElement(){
   return {width:0,height:0,getContext(){
    return {drawImage(){},getImageData(){return imageData;}};
   }};
  }
 };
 const api=parser({jsQR:()=>({data:"PLACA=ABC1D23"})},document);
 const found=await api.scanCanvas({width:500,height:300},"veiculo");
 assert.equal(found.metodo,"jsQR");
 assert.equal(found.camposQR.placa,"ABC1D23");
 assert.match(read("assets/js/document-reader-qr.js"),/jsqr@1\.4\.0/);
});
test("OCR e QR entram na mesma fila, sem envio remoto e com status separado",()=>{
 const reader=read("assets/js/document-reader.js");
 const html=read("pages/leitura-documentos.html");
 assert.ok(html.includes('id="ocrQrPanel"'));
 assert.ok(html.includes('id="ocrQrBadge"'));
 assert.ok(html.includes("document-reader-qr.js?v=20261119-qr-1"));
 assert.match(reader,/async function tryReadQRCode/);
 assert.ok(reader.includes("entry.qr=result.qr||null"));
 assert.ok(reader.includes("qrApi?.safeExport?.(entry.qr)"));
 assert.ok(!/fetch\s*\(/.test(qrJs));
 assert.ok(!/location\.(?:href|assign|replace)/.test(qrJs));
 assert.doesNotThrow(()=>new Script(qrJs));
 assert.doesNotThrow(()=>new Script(reader));
});