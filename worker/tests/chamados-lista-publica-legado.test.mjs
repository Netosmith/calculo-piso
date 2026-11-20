import test from "node:test";
import assert from "node:assert/strict";
import {sheetsGateway} from "../src/services/chamados-sheets.js";

const uuid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenant="nova-frota",user="GOIAS",sheetId="11bdFewENA_lUZ2pwIb295RmlubnW_cvVYRZKbo1vWa4";
const conf={url:"https://script.google.com/macros/s/mock/exec",chave:"server-key",pasta:"private-folder"};
const principal={id:tenant,user,role:"OPERACIONAL",ownerSupport:false};
const flags={solicitar:true,executar:false};
const a=(extra={})=>({id:uuid,protocolo:"00002",numero:2,tipoSolicitacao:"PAGAMENTO",
 status:"PENDENTE",solicitante:"TESTE",nomeSolicitante:"TESTE",executor:"PAGAMENTOS",
 criadoEm:"2026-11-20 14:00:00",atualizadoEm:"2026-11-20 15:00:00",enviadoEm:"2026-11-20 14:00:00",
 dadosEspecificos:{numeroCte:"1233",cpfCnpjPagamento:"12345678901",pixPagamento:"segredo"},
 motivo:"Corrigir conta bancária",...extra});
async function withScript(handler,run){
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  const payload=JSON.parse(opts.body);
  assert.equal(payload.tenant,tenant);
  assert.equal(payload.sheetId,sheetId);
  const result=await handler(payload);
  return new Response(JSON.stringify({ok:true,...result}),{status:200,headers:{"Content-Type":"application/json"}});
 };
 try{return await run();}
 finally{globalThis.fetch=previous;}
}
const url=(path="")=>"https://portalfrete.net.br/v1/abertura-pedidos"+path+"?visao=solicitante";
const go=async(path="")=>{
 const res=await sheetsGateway(new Request(url(path)),principal,"solicitante",flags,false,[],conf,{sheetId,mode:"sheets"},x=>x);
 assert.equal(res.status,200);
 return res.json();
};

test("GOIAS OPERACIONAL enxerga a pendência #00002 de TESTE mesmo com filtro legado por autor",async()=>{
 const result=await withScript(payload=>{
  assert.equal(payload.action,"chamados.list");
  // Super Admin aqui é estritamente um escopo de leitura interno gerado pelo Worker.
  assert.equal(payload.context.superAdmin,true);
  assert.equal(payload.context.sharedMonitor,true);
  assert.equal(payload.context.user,user);
  return {chamados:[
   a(),
   a({id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",numero:3,status:"FILA",executor:""}),
   a({id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",numero:4,status:"RASCUNHO"}),
   a({id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",numero:5,status:"RASCUNHO",solicitante:user}),
   a({id:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",numero:6,status:"ANDAMENTO"})
  ]};
 },()=>go());
 assert.equal(result.empresa,tenant);
 assert.equal(result.visibilidade,"transportadora");
 assert.deepEqual(result.chamados.map(x=>x.numero),[2,3,5,6]);
 const pending=result.chamados[0];
 assert.equal(pending.status,"PENDENTE");
 assert.equal(pending.dadosEspecificos.pixPagamento,undefined);
 assert.equal(pending.motivo,"");
 assert.equal(pending.numeroCte,undefined);
});

test("GOIAS pode abrir detalhes do PENDENTE, mas não recebe dados privados de ANDAMENTO",async()=>{
 const pending=await withScript(payload=>{
  assert.equal(payload.action,"chamados.get");
  assert.equal(payload.ticketId,uuid);
  assert.equal(payload.context.superAdmin,true);
  assert.equal(payload.context.sharedMonitor,false);
  return {chamado:a(),anexos:[{id:"doc1"}],mensagens:[{texto:"Corrigir pagamento"}],historico:[]};
 },()=>go("/"+uuid));
 assert.equal(pending.chamado.status,"PENDENTE");
 assert.equal(pending.chamado.dadosEspecificos.pixPagamento,"segredo");
 assert.equal(pending.anexos.length,1);
 const andamento=await withScript(()=>({
  chamado:a({status:"ANDAMENTO"}),anexos:[{id:"doc1"}],
  mensagens:[{texto:"Dado privado"}],historico:[{descricao:"interno"}]
 }),()=>go("/"+uuid));
 assert.equal(andamento.chamado.status,"ANDAMENTO");
 assert.deepEqual(andamento.chamado.dadosEspecificos,{});
 assert.deepEqual(andamento.anexos,[]);
 assert.deepEqual(andamento.mensagens,[]);
 assert.deepEqual(andamento.historico,[]);
 assert.equal(andamento.consultaPublica,true);
});

test("Comando de edição não recebe elevação interna de Super Admin",async()=>{
 await withScript(payload=>{
  assert.equal(payload.action,"chamados.updateDraft");
  assert.equal(payload.context.superAdmin,false);
  assert.equal(payload.context.user,user);
  assert.equal(payload.context.sharedMonitor,undefined);
  return {atualizado:true};
 },async()=>{
  const req=new Request(url("/"+uuid+"/dados"),{method:"POST",body:JSON.stringify({tipoSolicitacao:"PAGAMENTO",dadosEspecificos:{}})});
  const res=await sheetsGateway(req,principal,"solicitante",flags,false,[],conf,{sheetId,mode:"sheets"},x=>x);
  assert.equal(res.status,200);
 });
});
