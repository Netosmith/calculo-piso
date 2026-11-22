import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {Script} from "node:vm";

const read=path=>fs.readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const ui=read("assets/js/abertura-pedidos.js");
const d1=read("worker/src/controllers/abertura-pedidos.js");
const sheets=read("docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs");
const gateway=read("worker/src/services/chamados-sheets.js");
const requester=read("pages/solicitacao-pedidos.html");
const execution=read("pages/execucao-pedidos.html");

test("A interface confirma FILA antes dos anexos, sem bloquear novas solicitações",()=>{
 assert.doesNotThrow(()=>new Script(ui));
 assert.match(ui,/anexosPrevistos:direct\?documents\.length:0/);
 assert.match(ui,/const result=await request\("","POST",\{\.\.\.payload,enviarAgora:direct/);
 const submit=ui.slice(ui.indexOf("async function submitForm("),ui.indexOf("async function fileBlob("));
 const create=submit.indexOf('if(result.chamado.status==="FILA")');
 const queue=submit.indexOf('uploadJobs.set(fresh.id,');
 const start=submit.indexOf('void runUploadJob(fresh.id)');
 assert.ok(create>=0&&queue>create&&start>queue);
 assert.match(submit,/draft="";revisionPending=false/);
 assert.match(ui,/const uploadJobs=new Map\(\)/);
 assert.match(ui,/!busy&&!uploadJobs\.size/);
 assert.match(ui,/function updateUploadProgress\(/);
 assert.match(ui,/void refresh\(\)\.catch/);
});
test("A FILA antecipada exige verificação de capacidade, com fallback seguro",()=>{
 assert.match(ui,/let immediateQueueCapable=false/);
 assert.match(ui,/async function checkUploadCapabilities\(/);
 assert.match(ui,/immediateQueueCapable=support\.anexosEmFila===true/);
 assert.match(ui,/const direct=documents\.length===0&&formKind!=="CTE_COMPLEMENTAR"\|\|/);
 assert.match(ui,/immediateQueueCapable/);
 assert.match(d1,/anexosEmFila:true/);
 assert.match(gateway,/anexosEmFila:result\.anexosEmFila===true/);
 assert.match(sheets,/anexosEmFila:true/);
});
test("Backend grava a transferência, aceita anexar na FILA e valida conclusão",()=>{
 assert.match(d1,/ANEXOS_ENVIO/);
 assert.match(d1,/ANEXOS_PRONTOS/);
 assert.match(d1,/ANEXOS_FALHA/);
 assert.match(d1,/await uploadStatesForBoard\(db,p,rows\)/);
 assert.match(d1,/const isQueueUpload=!execView&&owner&&row\.status==="FILA"/);
 assert.match(d1,/\["anexos\/concluir","anexos\/falha"\]/);
 assert.match(d1,/if\(actual<transfer\.total\)/);
 assert.match(d1,/if\(transfer&&transfer\.estado!=="PRONTO"\)/);
 assert.match(d1,/expected>0\)statements\.push/);
 assert.match(sheets,/function cmUploadState_\(/);
 assert.match(sheets,/var queueUpload=ctx\.view==="solicitante"&&owner&&ticket\.STATUS==="FILA"/);
 assert.match(sheets,/if\(op==="concluirUpload"\|\|op==="falhaUpload"\)/);
 assert.match(sheets,/if\(docs\.length<transfer\.total\)/);
 assert.match(gateway,/"anexos\/concluir":"concluirUpload"/);
});
test("Pedido CT-e exige liberação antes de aceitar documentos concluídos",()=>{
 assert.match(ui,/formKind==="CTE_COMPLEMENTAR"&&!draft&&!documents\.some\(x=>x\.slot==="liberacao"\)/);
 assert.match(d1,/if\(effectiveKind\(row\)==="CTE_COMPLEMENTAR"\)/);
 assert.match(sheets,/if\(ticket\.TIPO==="CTE_COMPLEMENTAR"&&!docs\.some/);
});
test("O card comunica envio parcial e permite retomar",()=>{
 assert.match(ui,/tn-upload-progress/);
 assert.match(ui,/Enviando anexos/);
 assert.match(ui,/async function runUploadJob\(/);
 assert.match(ui,/async function extraDocument\(/);
 assert.match(ui,/tnUploadRetry/);
 assert.match(requester,/id="tnUploadDetailStatus"/);
 assert.match(requester,/id="tnUploadRetry"/);
 assert.match(execution,/id="tnUploadDetailStatus"/);
});
test("Decode seguro do estado da transferência",()=>{
 const begin=d1.indexOf("function decodeUploadState(");
 const end=d1.indexOf("async function uploadState(",begin);
 assert.ok(begin>=0&&end>begin);
 const decode=new Function(d1.slice(begin,end)+"return decodeUploadState;")();
 assert.deepEqual(decode({status:"ANEXOS_ENVIO",descricao:"4:2",criado_em:"X"}),{
  estado:"ENVIANDO",total:4,enviados:2,atualizadoEm:"X"});
 assert.equal(decode({status:"FINALIZADO",descricao:"4:4"}),null);
 assert.equal(decode({status:"ANEXOS_ENVIO",descricao:"999:3"}),null);
 assert.equal(decode({status:"ANEXOS_ENVIO",descricao:"4:7"}).enviados,4);
});
