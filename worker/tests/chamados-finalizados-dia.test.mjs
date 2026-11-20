import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const d1=read("worker/src/controllers/abertura-pedidos.js");
const script=read("docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs");

function googleDateHelpers(){
 const from=script.indexOf("function cmBrazilDate_(");
 const to=script.indexOf("function cmFilterRows_(",from);
 assert.ok(from>0&&to>from);
 const sandbox={
  cmRaw_:v=>String(v??""),
  Utilities:{formatDate(date,timezone,format){
   assert.equal(timezone,"America/Sao_Paulo");
   assert.equal(format,"yyyy-MM-dd");
   const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
    timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"
   }).formatToParts(date).map(x=>[x.type,x.value]));
   return [parts.year,parts.month,parts.day].join("-");
  }},
  cmRows_:()=>[],
  Number,Date,Object,Array
 };
 vm.runInNewContext(script.slice(from,to),sandbox);
 return sandbox;
}

test("A fila e a execução incluem FINALIZADO de hoje pelo evento, não por edição posterior",()=>{
 assert.ok(d1.includes('final_event.status=\\'FINALIZADO\\''));
 assert.ok(d1.includes("date(final_event.criado_em,'-3 hours')=date('now','-3 hours')"));
 assert.ok(d1.includes('status=\\'FINALIZADO\\' AND "+finalizedToday+'));
 assert.ok(d1.includes('status<>\\'FINALIZADO\\' OR "+finalizedToday+'));
 assert.ok(d1.includes('SELECT * FROM portal_pedidos_tickets WHERE tenant_id=?'));
 assert.ok(d1.includes('if(path==="/historico"&&req.method==="GET")'));
});

test("A virada do dia em Goiás mantém eventos de 20/11 visíveis até 23h59",()=>{
 const {cmBrazilDate_}=googleDateHelpers();
 // 20 de novembro, 23:59:59 em Goiás (-03:00)
 assert.equal(cmBrazilDate_("2026-11-21T02:59:59.000Z"),"2026-11-20");
 assert.equal(cmBrazilDate_("2026-11-21T03:00:00.000Z"),"2026-11-21");
 assert.equal(cmBrazilDate_("2026-11-21 00:30:00"),"2026-11-20");
 assert.equal(cmBrazilDate_("2026-11-20T21:00:00.000Z"),"2026-11-20");
});

test("Planilha usa o histórico de conclusão, mantém finalizados de hoje e arquiva dias anteriores",()=>{
 assert.ok(script.includes('var today=history?"":Utilities.formatDate(new Date(),"America/Sao_Paulo","yyyy-MM-dd")'));
 assert.ok(script.includes('var finished=history?null:cmFinishedDates_(ss,p.tenant)'));
 assert.ok(script.includes('if(item.STATUS==="FINALIZADO")'));
 assert.ok(script.includes('if(cmBrazilDate_(event?event.value:item.ATUALIZADO_EM)!==today)return false;'));
 assert.ok(!script.includes('item.STATUS==="FINALIZADO"||item.STATUS==="RASCUNHO"))return false'));
 assert.ok(script.includes('var CM_INDEX_={}'));
 assert.ok(script.includes('cmRows_(ss,name).forEach(function(row){lookup[String(row[key])]=row;})'));
});

test("Finalizado hoje não some se um comprovante alterar o chamado depois",()=>{
 const ctx=googleDateHelpers();
 const data=[
  {TRANSPORTADORA:"nova-frota",CHAMADO_ID:"abc",STATUS:"FINALIZADO",CRIADO_EM:"2026-11-20T22:00:00.000Z"},
  {TRANSPORTADORA:"nova-frota",CHAMADO_ID:"abc",STATUS:"ANDAMENTO",CRIADO_EM:"2026-11-21T16:00:00.000Z"},
  {TRANSPORTADORA:"nova-frota",CHAMADO_ID:"old",STATUS:"FINALIZADO",CRIADO_EM:"2026-11-19T22:00:00.000Z"},
  {TRANSPORTADORA:"transvale",CHAMADO_ID:"abc",STATUS:"FINALIZADO",CRIADO_EM:"2026-11-21T08:00:00.000Z"}
 ];
 ctx.cmRows_=()=>data;
 const finished=ctx.cmFinishedDates_({}, "nova-frota");
 assert.equal(ctx.cmBrazilDate_(finished.abc.value),"2026-11-20");
 assert.equal(ctx.cmBrazilDate_(finished.old.value),"2026-11-19");
 assert.equal(Object.keys(finished).length,2);
});
