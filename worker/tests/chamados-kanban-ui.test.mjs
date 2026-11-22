import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const js=read("assets/js/abertura-pedidos.js");
const css=read("assets/css/abertura-pedidos.css");
const execution=read("pages/execucao-pedidos.html");
const requester=read("pages/solicitacao-pedidos.html");
const gs=read("docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs");
const d1=read("worker/src/controllers/abertura-pedidos.js");
const gateway=read("worker/src/services/chamados-sheets.js");

function policy({view="execucao",authorized=true,busy=false,correct=true}={}){
 const begin=js.indexOf("function canMoveTicket(");
 const end=js.indexOf("function markDropTargets(",begin);
 assert.ok(begin>=0&&end>begin);
 const factory=new Function("execution","executor","actionBusy","moveBusy","canCorrectPending","STATES","transferIncomplete",
  js.slice(begin,end)+";return canMoveTicket;");
 return factory(view==="execucao",authorized,busy,false,correct,
  [["FILA"],["ANDAMENTO"],["PENDENTE"],["FINALIZADO"]],
  row=>Boolean(row.transferenciaAnexos&&row.transferenciaAnexos.estado!=="PRONTO"));
}
const ticket=(status,executor="PAGAMENTOS",motivo="")=>
 ({id:"123",tipoSolicitacao:"PAGAMENTO",status,executor,motivo});

test("scripts carregam sem erros de sintaxe",()=>{
 assert.doesNotThrow(()=>new Function(js));
 assert.doesNotThrow(()=>new Function(gs));
});
test("executor move livremente entre quaisquer etapas distintas",()=>{
 const can=policy();
 for(const from of ["FILA","ANDAMENTO","PENDENTE","FINALIZADO"]){
  for(const to of ["FILA","ANDAMENTO","PENDENTE","FINALIZADO"]){
   assert.equal(can(ticket(from,"OUTRO"),to),from!==to,from+" → "+to);
  }
 }
 assert.equal(policy({authorized:false})(ticket("FILA"),"FINALIZADO"),false);
 assert.equal(policy({busy:true})(ticket("FILA"),"FINALIZADO"),false);
 assert.equal(can(ticket("RASCUNHO"),"PENDENTE"),false);
 assert.equal(can({...ticket("FILA"),transferenciaAnexos:{estado:"ENVIANDO",total:2,enviados:1}},"ANDAMENTO"),false);
});
test("solicitante só devolve pendência via formulário de correção",()=>{
 const can=policy({view:"solicitante"});
 assert.equal(can(ticket("PENDENTE"),"FILA"),true);
 assert.equal(can(ticket("FINALIZADO"),"FILA"),false);
 assert.equal(can(ticket("FILA"),"FINALIZADO"),false);
 assert.equal(policy({view:"solicitante",correct:false})(ticket("PENDENTE"),"FILA"),false);
 assert.match(js,/await resume\(detail\.chamado,detail\)/);
});
test("só PENDENTE sem motivo salvo abre janela; outros destinos são diretos",()=>{
 const start=js.indexOf("async function planMove(");
 const end=js.indexOf("function ensureBoard(",start);
 const section=js.slice(start,end);
 assert.match(section,/if\(target==="PENDENTE"\)/);
 assert.match(section,/const reason=savedPendingReason\(row\)/);
 assert.match(section,/if\(reason\)\{void executeMove\(row,target,reason\);return;\}/);
 assert.match(section,/dialog\.showModal\(\)/);
 assert.match(section,/void executeMove\(row,target\)/);
 assert.match(js,/request\("\/"\+ticket\.id\+"\/mover","POST"/);
 assert.doesNotMatch(section,/numeroPedidoSistema\.required/);
});
test("motivo digitado no detalhe é usado sem segunda solicitação",()=>{
 assert.match(js,/selected\?\.id===row\?\.id/);
 assert.match(js,/current\.length>=8\?current:stored\.length>=8\?stored:""/);
 assert.match(js,/if\(reason\.length>=8\)return void executeMove\(selected,target,reason\)/);
 assert.match(js,/Motivo já registrado/);
 assert.match(js,/f\.elements\.motivo\.value\.trim\(\)/);
});
test("motivo ou número podem ser salvos sem trocar a etapa",()=>{
 assert.match(js,/async function saveReasonInsideCard\(ticket,reason,systemNumber/);
 assert.match(js,/requestMoveCompatible\(ticket,ticket\.status,reason\.trim\(\),systemNumber\.trim\(\)\)/);
 assert.match(js,/return void saveReasonInsideCard\(selected,reason,systemNumber\)/);
 assert.match(d1,/if\(next===row\.status\)/);
 assert.match(d1,/OBSERVACAO/);
 assert.match(gs,/if\(next===ticket\.STATUS\)/);
 assert.match(gs,/cmHist_\(ss,p,ticket,"OBSERVACAO"/);
});
test("Worker valida tenant, tipo e origem para evitar movimentos concorrentes",()=>{
 assert.match(d1,/if\(action==="mover"&&req\.method==="POST"\)/);
 assert.match(d1,/kinds\.includes\(effectiveKind\(row\)\)/);
 assert.match(d1,/if\(previous!==row\.status\)/);
 assert.match(d1,/AND status=\? AND excluido_em=''/);
 assert.match(d1,/hist\(db,p,id,next,log\)/);
 assert.match(d1,/executor_id=\?/);
 assert.match(d1,/if\(next==="PENDENTE"&&reason\.length<8\)/);
});
test("Apps Script suporta o mesmo fluxo e mantém logs",()=>{
 assert.match(gs,/if\(op==="mover"\)/);
 assert.match(gs,/if\(previous!==ticket\.STATUS\)/);
 assert.match(gs,/cmHist_\(ss,p,ticket,next,"Movimentado de "/);
 assert.match(gs,/ticket\.EXECUTOR=next==="FILA"\?"":user/);
 assert.match(gs,/out\.motivo=cmRaw_\(main\.MOTIVO\)/);
 assert.match(gateway,/"mover":"mover"/);
});
test("Apps Script antigo não perde observações e informa limites da versão",()=>{
 assert.match(js,/function missingMoveOperation\(error\)/);
 assert.match(js,/async function requestMoveCompatible\(/);
 assert.match(js,/request\("\/"\+ticket\.id\+"\/situacao","POST"/);
 assert.match(js,/request\("\/"\+ticket\.id\+"\/assumir","POST"/);
 assert.match(js,/throw requireUpdatedScript\(\)/);
 assert.match(js,/async function checkMoveCapabilities\(\)/);
 assert.match(js,/if\(execution\)void checkMoveCapabilities\(\)/);
 assert.match(gs,/if\(op==="capabilities"\)/);
 assert.match(gateway,/if\(path==="capacidades"&&request.method==="GET"\)/);
 assert.match(d1,/if\(path==="\/capacidades"&&req.method==="GET"\)/);
});
test("painéis conservam histórico, detalhes e sincronização",()=>{
 for(const id of ["tnOpsOverview","tnBoard","tnMine","tnFilter","tnTypeFilter","tnStatusForm","tnPendingEdit","pedProofSend"]){
  assert.ok(execution.includes('id="'+id+'"'),"faltando "+id);
 }
 assert.match(execution,/<option value="FILA">FILA<\/option>/);
 assert.match(css,/tn-drop-valid/);
 assert.match(css,/tn-move-dialog/);
 assert.match(execution,/20261121-corrige-sheets-v8/);
 assert.match(requester,/20261121-corrige-sheets-v8/);
 assert.match(js,/if\(lane\.signature!==signature\)/);
});
