import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {Script} from "node:vm";

const read=p=>fs.readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const ui=read("assets/js/abertura-pedidos.js");
const worker=read("worker/src/controllers/abertura-pedidos.js");
const gateway=read("worker/src/services/chamados-sheets.js");
const gas=read("docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs");
const solicitation=read("pages/solicitacao-pedidos.html");
const execution=read("pages/execucao-pedidos.html");

test("frontend suporta PDFs até 20 MB e partes de 2 MB",()=>{
 assert.doesNotThrow(()=>new Script(ui));
 assert.match(ui,/const MAX_FILE=20\*1024\*1024/);
 assert.match(ui,/const SINGLE_UPLOAD_LIMIT=6\*1024\*1024/);
 assert.match(ui,/const CHUNK_BYTES=2\*1024\*1024/);
 assert.match(ui,/file\.slice\(i\*CHUNK_BYTES/);
 assert.match(ui,/request\("\/"\+id\+"\/anexos\/parte","POST"/);
 assert.match(ui,/request\("\/"\+id\+"\/anexos\/fechar","POST"/);
 assert.match(ui,/item\.sentParts=i\+1/);
 assert.match(ui,/anexosGrandes===true/);
});
test("não abre solicitação com arquivo grande quando integração é antiga",()=>{
 assert.match(ui,/if\(item\.file\.size>SINGLE_UPLOAD_LIMIT&&!largeFilesCapable\)/);
 assert.match(ui,/if\(!largeFilesCapable\)/);
 assert.match(ui,/checkUploadCapabilities/);
 assert.match(solicitation,/até 20 MB por arquivo/);
});
test("backend valida tamanho, sessão, etapa e limites de partes",()=>{
 assert.match(worker,/const LARGE_FILE=20\*1024\*1024/);
 assert.match(worker,/if\(action==="anexos\/parte"\)/);
 // Verificar endpoints por presença literal em ambos.
 assert.match(worker,/\["anexos\/parte","anexos\/fechar"\]/);
 assert.match(worker,/if\(!allowed\)return err\("Anexo não autorizado nesta etapa\.",403\)/);
 assert.match(worker,/parts!==Math\.ceil\(size\/CHUNK_BYTES\)/);
 assert.match(worker,/saved\.bytes!==size/);
 assert.match(worker,/db\.prepare\("INSERT INTO portal_pedidos_docs/);
 assert.match(gateway,/"anexos\/parte":"uploadChunk"/);
 assert.match(gateway,/"anexos\/fechar":"finalizeChunks"/);
 assert.match(gateway,/data\.size>LARGE_FILE/);
});
test("Apps Script monta arquivo único e conserva privado o Drive",()=>{
 assert.doesNotThrow(()=>new Script(gas));
 assert.match(gas,/var PORTAL_LARGE_FILE_MAX_=20\*1024\*1024/);
 assert.match(gas,/var PORTAL_CHUNK_BYTES_=2\*1024\*1024/);
 assert.match(gas,/function portalChunkUpload_\(/);
 assert.match(gas,/function portalChunkFinish_\(/);
 assert.match(gas,/for\(var i=0;i<total;i\+\+\)/);
 assert.match(gas,/folder\.createFile\(Utilities\.newBlob\(bytes,mime,name\)\)/);
 assert.match(gas,/dir\.setTrashed\(true\)/);
 assert.match(gas,/PORTAL_UPLOAD_ID:/);
 assert.match(gas,/if\(op==="uploadChunk"\|\|op==="finalizeChunks"\)/);
});
test("download de documentos grandes reconstitui o PDF em partes",()=>{
 assert.match(ui,/Number\(doc\.bytes\|\|0\)>SINGLE_UPLOAD_LIMIT/);
 assert.match(ui,/new Blob\(blobs,\{type:doc\.mime\|\|"application\/pdf"\}\)/);
 assert.match(worker,/action==="anexos\/"\+match\[3\]\+"\/parte\/"\+match\[4\]/);
 assert.match(gateway,/action="downloadChunk"/);
 assert.match(gas,/function portalChunkRead_\(/);
 assert.match(gas,/Utilities\.base64Encode\(cut\)/);
});
test("novo cache no navegador e aviso de protocolo corrigido",()=>{
 assert.match(solicitation,/20261122-pdf-20mb-v1/);
 assert.match(execution,/20261122-pdf-20mb-v1/);
 assert.doesNotMatch(ui,/Enviando solicitação\.\.\. Aguardando confirmação do protocolo/);
 assert.match(ui,/Registrando protocolo e validando os dados/);
});
