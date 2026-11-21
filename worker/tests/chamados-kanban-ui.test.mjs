import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const js=fs.readFileSync(new URL("../../assets/js/abertura-pedidos.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../../assets/css/abertura-pedidos.css",import.meta.url),"utf8");
const execution=fs.readFileSync(new URL("../../pages/execucao-pedidos.html",import.meta.url),"utf8");
const requester=fs.readFileSync(new URL("../../pages/solicitacao-pedidos.html",import.meta.url),"utf8");
const script=fs.readFileSync(new URL("../../docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs",import.meta.url),"utf8");

function policy({view="execucao",user="PAGAMENTOS",authorized=true,busy=false,correct=true}={}){
 const begin=js.indexOf("function canMoveTicket(");
 const end=js.indexOf("function markDropTargets(",begin);
 assert.ok(begin>=0&&end>begin);
 const factory=new Function("execution","executor","user","actionBusy","moveBusy","canCorrectPending",
  js.slice(begin,end)+";return canMoveTicket;");
 return factory(view==="execucao",authorized,user,busy,false,correct);
}
const ticket=(status,executor="PAGAMENTOS")=>({id:"123",tipoSolicitacao:"PAGAMENTO",status,executor});

test("JavaScript da Central carrega sem erros de sintaxe",()=>{
 assert.doesNotThrow(()=>new Function(js));
});
test("fila só pode ser assumida por executor autorizado",()=>{
 const can=policy();
 assert.equal(can(ticket("FILA",""),"ANDAMENTO"),true);
 assert.equal(can(ticket("FILA",""),"FINALIZADO"),false);
 assert.equal(policy({authorized:false})(ticket("FILA",""),"ANDAMENTO"),false);
});
test("etapas não saltam o responsável nem a correção",()=>{
 const can=policy();
 assert.equal(can(ticket("ANDAMENTO"),"PENDENTE"),true);
 assert.equal(can(ticket("ANDAMENTO"),"FINALIZADO"),true);
 assert.equal(can(ticket("PENDENTE"),"ANDAMENTO"),true);
 assert.equal(can(ticket("PENDENTE"),"FILA"),true);
 assert.equal(can(ticket("ANDAMENTO","OUTRO"),"FINALIZADO"),false);
 assert.equal(can(ticket("FINALIZADO"),"ANDAMENTO"),false);
 assert.equal(policy({busy:true})(ticket("FILA",""),"ANDAMENTO"),false);
});
test("solicitante só pode encaminhar uma pendência para correção",()=>{
 const can=policy({view:"solicitante"});
 assert.equal(can(ticket("PENDENTE"),"FILA"),true);
 assert.equal(can(ticket("FILA"),"ANDAMENTO"),false);
 assert.equal(can(ticket("ANDAMENTO"),"FINALIZADO"),false);
 assert.equal(policy({view:"solicitante",correct:false})(ticket("PENDENTE"),"FILA"),false);
});
test("confirmar motivos e números antes de mover",()=>{
 assert.match(js,/target==="PENDENTE"&&reason\.length<8/);
 assert.match(js,/target==="FINALIZADO"&&kindOf\(ticket\)==="PEDIDO"&&!system/);
 assert.match(js,/await request\("\/"\+ticket\.id\+command,"POST",payload\)/);
 assert.match(js,/const detail=await request\("\/"\+row\.id\)/);
 assert.match(js,/await resume\(detail\.chamado,detail\)/);
});
test("indicadores, fluxos, filtros, acessibilidade e cache de telas",()=>{
 for(const id of ["tnOpsOverview","tnBoard","tnMine","tnFilter","tnTypeFilter","tnStatusForm","tnPendingEdit","pedProofSend"]){
  assert.ok(execution.includes('id="'+id+'"'),"faltando "+id);
 }
 assert.match(css,/tn-drop-valid/);
 assert.match(css,/tn-move-dialog/);
 assert.match(js,/lastBoardRefresh=Date\.now\(\)/);
 assert.match(js,/if\(lane\.signature!==signature\)/);
 assert.match(execution,/20261121-exec-kanban-v3/);
 assert.match(requester,/20261121-exec-kanban-v3/);
});
test("resumo do Kanban Sheets carrega detalhes somente sob demanda",()=>{
 const first=script.indexOf("function cmBoardTicket_(");
 const last=script.indexOf("function cmTicket_(",first);
 assert.ok(first>=0&&last>first);
 const board=script.slice(first,last);
 assert.doesNotMatch(board,/AGENCIA_PAGAMENTO|CPF_CNPJ_PAGAMENTO|PIX_PAGAMENTO/);
 assert.match(script,/ctx\.view==="execucao"\?cmBoardTicket_\(ss,x\):cmTicketForAudience_\(ss,p,x\)/);
 assert.match(script,/var object=null,owner=ticket\.SOLICITANTE===user/);
});
