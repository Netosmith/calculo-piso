import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const d1=read("worker/src/controllers/abertura-pedidos.js");
const sheets=read("docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs");
const ui=read("assets/js/abertura-pedidos.js");

test("Todos os usuários autenticados da transportadora podem corrigir PENDENTE; rascunho permanece privado",()=>{
 assert.ok(d1.includes('const pendingEditor=!execView&&row.status==="PENDENTE"'));
 assert.ok(d1.includes("const collaborativePendingWrite=!execView"));
 assert.ok(d1.includes('(?:dados|enviar|anexos)'));
 assert.ok(d1.includes('(row.status==="RASCUNHO"&&!owner)'));
 assert.ok(d1.includes("(status='PENDENTE' OR solicitante_id=?)"));
 assert.ok(d1.includes("row.status==='PENDENTE'")||d1.includes('row.status==="PENDENTE"'));
 assert.ok(d1.includes('if(row.status==="RASCUNHO"&&!owner&&!p.ownerSupport)'));
 assert.ok(d1.includes('const id=match[1],action=match[2]||"",row=await ticket(db,p,id)'));
});
test("Reenvio devolve o protocolo original à FILA, libera executor e audita quem corrigiu",()=>{
 assert.ok(d1.includes("SET status='FILA',executor_id=NULL,motivo=''"));
 assert.ok(d1.includes('"Pendência corrigida por "+p.user+'));
 assert.ok(sheets.includes('ticket.STATUS="FILA";ticket.EXECUTOR="";ticket.MOTIVO=""'));
 assert.ok(sheets.includes('"Pendência corrigida por "+user+'));
 assert.ok(sheets.includes('cmHist_(ss,p,ticket,ticket.STATUS,ticket.STATUS==="PENDENTE"'));
 assert.ok(!sheets.includes('if(ctx.view==="execucao"||!owner||["RASCUNHO","PENDENTE"].indexOf(ticket.STATUS)<0)'));
});
test("Anexos, chat e dados podem ser corrigidos pela equipe somente em PENDENTE",()=>{
 assert.ok(sheets.includes('(ctx.view==="solicitante"&&ticket.STATUS==="PENDENTE")'));
 assert.ok(sheets.includes('(ticket.STATUS==="PENDENTE"||(owner&&ticket.STATUS==="RASCUNHO"))'));
 assert.ok(sheets.includes('!admin&&!owner&&!isMine&&!(ctx.view==="solicitante"&&ticket.STATUS==="PENDENTE")'));
 assert.ok(d1.includes('const pendingEditor=!execView&&row.status==="PENDENTE"'));
 assert.ok(d1.includes('(row.status==="RASCUNHO"&&!owner)||execView'));
});
test("Solicitações e Execução exibem botão e direcionam à edição completa sem exigir autoria",()=>{
 assert.doesNotThrow(()=>new Script(ui));
 assert.ok(ui.includes('const allowCorrection=data.consultaPublica!==true&&row.status==="PENDENTE"'));
 assert.ok(ui.includes('window.location.assign(next.href)'));
 assert.ok(ui.includes('deepLink.searchParams.get("corrigir")'));
 for(const page of ["pages/solicitacao-pedidos.html","pages/execucao-pedidos.html"]){
  const html=read(page);
  assert.ok(html.includes('id="tnPendingCorrection"'));
  assert.ok(html.includes('id="tnPendingEdit"'));
 }
});
