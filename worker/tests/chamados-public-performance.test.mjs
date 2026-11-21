import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {modulesForProfile,profileAllowsModule} from "../src/services/profile-access.js";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const env={TENANT_BRANDS:{async get(){return null;}}};

test("quadro público para perfis, mas execução continua reservada",async()=>{
 const enabled=["piso2","solicitacao-pedidos","execucao-pedidos","bi"];
 for(const role of ["PISO","GOADM","COMERCIAL","OPERACIONAL","ADMINISTRADOR"]){
  const modules=await modulesForProfile(env,"nova-frota",role,enabled,false,"TESTE");
  assert.ok(modules.includes("solicitacao-pedidos"),role);
  assert.ok(!modules.includes("execucao-pedidos"),role);
  assert.equal(await profileAllowsModule(env,"nova-frota",role,"execucao-pedidos",false,"TESTE"),false);
 }
});
test("D1 mostra status públicos da mesma empresa e protege rascunhos e privados",()=>{
 const c=read("worker/src/controllers/abertura-pedidos.js");
 assert.ok(c.includes("flags.publico=flags.solicitar"));
 assert.ok(c.includes("solicitacoesHabilitadas:flags.publico"));
 assert.ok(c.includes("(status<>'RASCUNHO' OR solicitante_id=?)"));
 assert.ok(c.includes('if(!privateAccess)return success({chamado:publicTicket(row),anexos:[],mensagens:[],historico:[]'));
 assert.ok(c.includes("const publicTicket=row=>"));
 const slice=c.slice(c.indexOf("const publicTicket=row=>"),c.indexOf("const hist=(db"));
 assert.ok(!slice.includes("cpfCnpjPagamento"));
 assert.ok(!slice.includes("bancoPagamento"));
 assert.ok(!slice.includes("pixPagamento"));
 assert.ok(c.includes('if(row.status==="RASCUNHO"&&!owner&&!p.ownerSupport)'));
 assert.ok(c.includes('const cond=["tenant_id=?"]'));
 assert.ok(c.includes('if(execView&&!p.ownerSupport)'));
});
test("Google Sheets libera consultas sem trava e só permite dados privados ao responsável",()=>{
 const gs=read("docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs");
 assert.ok(gs.includes('var readOnly=["health","list","historico","get","download"]'));
 assert.ok(gs.includes('var lock=readOnly?null:LockService.getScriptLock()'));
 assert.ok(gs.includes('if(!readOnly)SpreadsheetApp.flush()'));
 assert.ok(gs.includes('}finally{if(lock)lock.releaseLock();}'));
 assert.ok(gs.includes('return admin||owner||ticket.STATUS!=="RASCUNHO"'));
 assert.ok(gs.includes('if(!canReadPrivate)return {chamado:cmPublicTicket_(ticket),anexos:[],mensagens:[]'));
 assert.ok(gs.includes('if(!admin&&!owner&&!isMine&&!(ctx.view==="solicitante"&&ticket.STATUS==="PENDENTE")'));
 assert.ok(gs.includes('if(!canReadPrivate)return {chamado:cmPublicTicket_(ticket)'));
 assert.ok(gs.includes('ctx.view!=="execucao"&&item.STATUS==="RASCUNHO"&&item.SOLICITANTE!==ctx.user'));
 assert.ok(gs.includes('if(op==="list")return {chamados:rows.slice(0,500).map(function(x){')); 
 assert.ok(gs.includes('ctx.view==="execucao"?cmBoardTicket_(ss,x):cmTicketForAudience_(ss,p,x)'));
 assert.ok(gs.includes('var direct=data.enviarAgora===true'));
});
test("protocolo priorizado e UI não aguarda o histórico para renderizar a fila",()=>{
 const client=read("assets/js/abertura-pedidos.js");
 const controller=read("worker/src/controllers/abertura-pedidos.js");
 const sheets=read("worker/src/services/chamados-sheets.js");
 assert.doesNotThrow(()=>new Script(client));
 assert.ok(client.includes('enviarAgora:direct'));
 assert.ok(client.includes('result.chamado.status==="FILA"'));
 assert.ok(!client.includes('await Promise.all([refresh(),fetchHistoric(true)])'));
 assert.ok(client.includes('startAutoRefresh();'));
 assert.ok(client.includes('window.setInterval(()=>'));
 assert.ok(client.includes('},30000);'));
 assert.ok(client.includes('function ensureBoard(){'));
 assert.ok(client.includes('if(lane.signature!==signature)'));
 assert.ok(client.includes('hideDialog("tnFormDialog");'));
 assert.ok(client.includes('if($("tnNew"))$("tnNew").disabled=true;'));
 assert.ok(client.includes('showDialog("tnFormDialog");'));
 assert.ok(client.includes('window.addEventListener("beforeunload"'));
 const solicitation=read("pages/solicitacao-pedidos.html");
 const execution=read("pages/execucao-pedidos.html");
 for(const html of [solicitation,execution]){
  assert.match(html,/<details class="cad-panel pedidos-history-panel" id="pedidosHistoric">/);
  assert.ok(html.includes('id="tnAutoStatus"'));
  assert.ok(html.includes("Consultar histórico"));
 }
 assert.ok(client.includes('boardSerial++;mineSignature="";render();lastBoardRefresh=Date.now()'));
 assert.ok(client.includes('showDialog("tnDetailDialog")'));
 assert.ok(client.includes('const preview=chamados.find(row=>row.id===id)'));
 assert.ok(client.includes('actionBusy=true;detailSerial++'));
 assert.ok(client.includes('$("tnAssumir").hidden=!(execution&&executor&&preview?.status==="FILA")'));
 assert.ok(sheets.includes('enviarAgora:raw?.enviarAgora===true'));
 assert.ok(controller.includes('const direct=b.enviarAgora===true'));
});
