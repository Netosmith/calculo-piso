import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const source=read("assets/js/document-reader-ahk.js");
function exporter(){
 const module={exports:{}};
 runInNewContext(source,{module});
 return module.exports;
}
test("AutoHotkey v2: exporta CRLV com campo Cavalo-S e preserva acentos",()=>{
 const x=exporter().fromDocument({
  tipoDocumento:"veiculo",nomeArquivo:"exemplo-crlv.pdf",
  campos:{
   placa:"ABC1D23",renavam:"01234567890",chassi:"9BWZZZ377VT004251",
   especieTipo:"TRAÇÃO CAMINHÃO TRATOR",tipoVeiculoSistema:"Cavalo-S",
   proprietario:"TRANSPORTADORA EXEMPLO LTDA"
  }
 });
 assert.equal(x.charCodeAt(0),0xFEFF);
 assert.match(x,/FORMATO=PORTAL_FRETE_OCR_V1/);
 assert.match(x,/ESPECIE_TIPO_CRLV=TRAÇÃO CAMINHÃO TRATOR/);
 assert.match(x,/TIPO_VEICULO_SISTEMA=Cavalo-S/);
 assert.match(x,/PLACA=ABC1D23/);
 assert.match(x,/RENAVAM=01234567890/);
 assert.match(x,/CONFERENCIA_OBRIGATORIA=SIM/);
 assert.doesNotMatch(x,/TEXTO_RECONHECIDO/);
});
test("AutoHotkey v2: exporta CNH e endereço com chaves ASCII estáveis",()=>{
 const api=exporter();
 const cnh=api.fromDocument({
  tipoDocumento:"cnh",nomeArquivo:"exemplo-cnh.pdf",
  campos:{nome:"MOTORISTA EXEMPLO",registro:"01234567890",categoria:"E"}
 });
 assert.match(cnh,/NOME_COMPLETO=MOTORISTA EXEMPLO/);
 assert.match(cnh,/REGISTRO_CNH=01234567890/);
 assert.match(cnh,/CATEGORIA_CNH=E/);
 const address=api.fromDocument({
  tipoDocumento:"endereco",nomeArquivo:"comprovante.pdf",
  campos:{logradouro:"Rua das Flores",numero:"123",cidade:"Rio Verde",uf:"GO"}
 });
 assert.match(address,/LOGRADOURO=Rua das Flores/);
 assert.match(address,/NUMERO=123/);
 assert.match(address,/CIDADE=Rio Verde/);
});
test("AutoHotkey v2: neutraliza quebras de linha em valores e rejeita documentos inválidos",()=>{
 const api=exporter();
 const result=api.fromDocument({
  tipoDocumento:"veiculo",nomeArquivo:"arquivo.pdf",
  campos:{placa:"ABC1D23\nSENHA=INJETADO"}
 });
 assert.match(result,/PLACA=ABC1D23 SENHA=INJETADO/);
 assert.doesNotMatch(result,/\r\nSENHA=INJETADO/);
 assert.throws(()=>api.fromDocument({tipoDocumento:"estranho",campos:{}}));
});
test("Tela conecta exportador sem envio a servidor ou execução remota",()=>{
 const html=read("pages/leitura-documentos.html");
 const js=read("assets/js/document-reader.js");
 const ahk=read("docs/ocr-autohotkey-v2-exemplo.ahk");
 assert.ok(html.includes('id="ocrExportAHK"'));
 assert.ok(html.includes("document-reader-ahk.js?v=20261119-ahk-1"));
 assert.ok(js.includes('$("ocrExportAHK").addEventListener("click",exportAutoHotkey)'));
 assert.ok(js.includes('window.PortalOCRAutoHotkey.fromDocument(data)'));
 assert.ok(!source.includes("fetch("));
 assert.ok(!ahk.includes("ControlSetText("));
 assert.ok(ahk.includes("FileRead(caminho, \"UTF-8\")"));
 assert.doesNotThrow(()=>new Script(source));
});
