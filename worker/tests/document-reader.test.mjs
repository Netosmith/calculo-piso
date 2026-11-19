import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const source=read("assets/js/document-reader-fields.js");
function parser(){
 const module={exports:{}};
 runInNewContext(source,{module,window:undefined});
 return module.exports;
}
test("CNH: campos sugeridos sem confundir validade com nascimento",()=>{
 const api=parser();
 const text="CARTEIRA NACIONAL DE HABILITACAO\nNOME: MARIA DE SOUZA\nCPF: 529.982.247-25\nCATEGORIA: AB\nVALIDADE: 21/11/2029";
 const x=api.extract(text);
 assert.equal(x.tipo,"cnh");
 assert.equal(x.campos.nome,"MARIA DE SOUZA");
 assert.equal(x.campos.cpf,"529.982.247-25");
 assert.equal(x.campos.categoria,"AB");
 assert.equal(x.campos.validade,"21/11/2029");
 assert.equal(x.campos.nascimento,"");
 assert.equal(x.campos.primeiraHabilitacao,"");
 assert.equal(api.validCPF("111.111.111-11"),false);
});
test("CRLV: placa Mercosul, chassi e RENAVAM sem falso CPF",()=>{
 const x=parser().extract("CRLV\nRENAVAM: 01234567890\nPLACA: ABC1D23\nCHASSI: 9BWZZZ377VT004251\nANO FABRICACAO: 2021/2022\nPROPRIETARIO: JOAO TESTE");
 assert.equal(x.tipo,"veiculo");
 assert.equal(x.campos.placa,"ABC1D23");
 assert.equal(x.campos.renavam,"01234567890");
 assert.equal(x.campos.chassi,"9BWZZZ377VT004251");
 assert.equal(x.campos.anoFabricacao,"2021");
 assert.equal(x.campos.anoModelo,"2022");
 assert.equal(x.campos.cpfCnpj,"");
});
test("Comprovante: CEP, logradouro e número sem inventar titular ausente",()=>{
 const x=parser().extract("FATURA DE ENERGIA\nCONSUMIDOR: JOSE SILVA\nENDERECO: RUA DAS FLORES, 125 - CENTRO\nCEP: 75901-120\nBAIRRO: CENTRO\nUF: GO");
 assert.equal(x.tipo,"endereco");
 assert.equal(x.campos.titular,"JOSE SILVA");
 assert.equal(x.campos.numero,"125");
 assert.equal(x.campos.cep,"75901-120");
 assert.equal(x.campos.uf,"GO");
});
test("Página e arquivo: sem dados persistidos, com OCR apenas em memória",()=>{
 const ui=read("pages/leitura-documentos.html");
 const engine=read("assets/js/document-reader.js");
 for(const name of ["ocrFile","ocrType","ocrStart","ocrPreviewImage","ocrPreviewPdf","ocrFieldsGrid","ocrRawText","ocrCopyJson","ocrDownloadJson"])
  assert.ok(ui.includes('id="'+name+'"'),name);
 assert.ok(engine.includes("tesseract.js@6.0.1"));
 assert.ok(engine.includes("pdfjs-dist@6.5.438"));
 assert.ok(engine.includes("MAX_BYTES=15*1024*1024,MAX_PAGES=8"));
 assert.ok(engine.includes('canAccessFeature("leitura-documentos")'));
 assert.ok(!/\blocalStorage\b|\bsessionStorage\b/.test(engine));
 assert.ok(!/fetch\s*\(/.test(engine),"Não transmitir documentos em uma API");
 assert.ok(engine.includes('new Blob([JSON.stringify(data,null,2)]'));
 assert.doesNotThrow(()=>new Script(engine));
 assert.doesNotThrow(()=>new Script(source));
});
test("Registro no Super Admin e rota privada dos tenants",()=>{
 const home=read("pages/home.html");
 const admin=read("pages/super-admin.html");
 const registry=read("worker/src/config/tenant-modules.js");
 const nova=read("worker/src/services/nova-frota-modules.js");
 const auth=read("assets/js/auth.js");
 const tenant=read("assets/js/tenant-page.js");
 const name="leitura-documentos";
 for(const [source,label] of [[home,"Home"],[admin,"Super Admin"],[registry,"tenants"],[nova,"Nova Frota"],[auth,"auth"],[tenant,"tenant-page"]])
  assert.ok(source.includes(name),label);
 assert.ok(home.includes('data-feature="'+name+'"'));
 assert.ok(auth.includes('"leitura-documentos.html":"leitura-documentos"'));
 for(const slug of ["gnova","transvale","modelo01"]){
  const shell=read("pages/"+slug+"/leitura-documentos.html");
  assert.ok(shell.includes('data-shared-page="leitura-documentos.html"'));
 }
});

test("CNH em colunas: campos extraídos do texto OCR vão ao rótulo correto",()=>{
 const x=parser().extract([
  "CARTEIRA NACIONAL DE HABILITACAO",
  "2e1NOME E SOBRENOME                              1º HABILITAÇÃO",
  "[ MARIA DE SOUZA ALMEIDA PEREIRA   ) [ 29/08/2022 )",
  "3 DATA, LOCAL E UF DE NASCIMENTO",
  "| 25/10/1998, CIDADE, BA )",
  "43 CAIA MISSÃO 46 VALIDADE",
  "| 17/07/2026 ) [ 15/05/2036 |-| D",
  "4 OS IDENTIDADE / ORG EMISSOR E UF",
  "| 8765432 MTE BA )",
  "aa 5 Nº REGISTRO 9 CAT ESB",
  "| 529.982.247-25 ) [ 01234567890 | | E )"
 ].join("\n"),"cnh");
 assert.equal(x.campos.nome,"MARIA DE SOUZA ALMEIDA PEREIRA");
 assert.equal(x.campos.rg,"8765432 MTE BA");
 assert.equal(x.campos.registro,"01234567890");
 assert.equal(x.campos.categoria,"E");
 assert.equal(x.campos.primeiraHabilitacao,"29/08/2022");
 assert.equal(x.campos.validade,"15/05/2036");
 assert.equal(x.campos.nascimento,"25/10/1998");
 assert.equal(x.avisos.length,0);
});
test("CNH sem categoria visível não interpreta 'de' como categoria DE",()=>{
 const x=parser().extract([
  "CARTEIRA NACIONAL DE HABILITACAO",
  "NOME: MARIA DE SOUZA",
  "CAT ESB",
  "de",
  "Nº REGISTRO",
  "12345678901"
 ].join("\n"),"cnh");
 assert.equal(x.campos.categoria,"");
 assert.equal(x.campos.registro,"12345678901");
});
