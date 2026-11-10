import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync(new URL("../../assets/js/driver-freights-publisher.js",import.meta.url),"utf8");
function harness({promptAnswer="",confirmation=true,path="/pages/fretes.html"}={}){
  const requests=[],prompts=[],confirmations=[];
  const window={
    __PORTAL_TENANT_SESSION:undefined,
    __PORTAL_TENANT_EXPECTED:undefined,
    prompt(message,initial){
      prompts.push({message,initial});
      return typeof promptAnswer==="function"?promptAnswer(message):promptAnswer;
    }
  };
  const context={
    window,location:{pathname:path},
    confirm(message){confirmations.push(message);return confirmation;},
    fetch:async (url,init)=>{
      requests.push({url,init});
      return {ok:true,json:async()=>url.includes("/manage?")?
        {ok:true,published:[]}:{ok:true,published:true}};
    },
    Set,Array,Object,String,Error,console
  };
  runInNewContext(source,context,{filename:"driver-freights-publisher.js"});
  return {app:window.NFDriverFreights,requests,prompts,confirmations};
}
const row={
  id:"F-001",status:"LIBERADO",origem:"RIO VERDE-GO",destino:"SANTOS-SP",
  produto:"SOJA",volume:"200 t",valorMotorista:"R$ 240/t",
  coleta:"FAZENDA BOA VISTA",descarga:"ARMAZÉM PORTUÁRIO",
  e5:"S",e6:"N",e7:"S",e4:"N",e9:"S",
  valorEmpresa:"R$ 320/t",cliente:"CLIENTE INTERNO",obs:"SEGREDO"
};
function requestBody(h){return JSON.parse(h.requests.find(r=>r.init.method==="POST").init.body)}
test("frete totalmente preenchido publica sem pedir origem, destino ou produto novamente",async()=>{
  const h=harness();
  assert.equal(await h.app.toggle(row,"fretes",{whatsappEmbarcador:"(64) 99988-7766"}),true);
  assert.equal(h.prompts.length,0);
  assert.equal(h.confirmations.length,1);
  const body=requestBody(h);
  assert.equal(body.origem,row.origem);
  assert.equal(body.destino,row.destino);
  assert.equal(body.produto,row.produto);
  assert.equal(body.coleta,row.coleta);
  assert.equal(body.descarga,row.descarga);
  assert.equal(body.e5,"S");
  assert.equal(body.e6,"N");
  assert.equal(body.e7,"S");
  assert.equal(body.valorMotorista,row.valorMotorista);
  assert.equal(body.whatsappEmbarcador,"5564999887766");
  assert.equal(body.cliente,undefined);
  assert.equal(body.valorEmpresa,undefined);
  assert.equal(body.obs,undefined);
  assert.match(h.confirmations[0],/Local de coleta: FAZENDA BOA VISTA/);
  assert.match(h.confirmations[0],/Local de descarga: ARMAZÉM PORTUÁRIO/);
  assert.match(h.confirmations[0],/5E: S.*6E: N.*7E: S/);
});
test("aceita cabeçalhos alternativos devolvidos pelo Google Sheets, em qualquer capitalização",async()=>{
  const h=harness();
  const sourceRow={
    id:"F-002",STATUS:"LIBERADO",ORIGEM:"JATAÍ-GO",DESTINO:"CUIABÁ-MT",
    PRODUTO:"MILHO",COLETA:"SILO 3",DESCARGA:"ARMAZÉM A",
    "Cadência":"50 t","Valor Motorista":"R$ 270/t"
  };
  assert.equal(await h.app.toggle(sourceRow,"fretes2",{whatsappEmbarcador:"5564999887766"}),true);
  assert.equal(h.prompts.length,0);
  const body=requestBody(h);
  assert.equal(body.origem,"JATAÍ-GO");
  assert.equal(body.destino,"CUIABÁ-MT");
  assert.equal(body.produto,"MILHO");
  assert.equal(body.volume,"50 t");
  assert.equal(body.coleta,"SILO 3");
  assert.equal(body.descarga,"ARMAZÉM A");
  assert.equal(body.e5,"");
  assert.equal(body.e9,"");
  assert.equal(body.valorMotorista,"R$ 270/t");
  assert.equal(body.whatsappEmbarcador,"5564999887766");
});
test("quando um campo realmente falta, informa qual é e permite completar só a divulgação",async()=>{
  const h=harness({promptAnswer:"SORGO"});
  assert.equal(await h.app.toggle({...row,produto:""},"fretes",{whatsappEmbarcador:"5564999887766"}),true);
  assert.equal(h.prompts.length,1);
  assert.match(h.prompts[0].message,/PRODUTO/);
  assert.equal(requestBody(h).produto,"SORGO");
});
test("cancelar um preenchimento ausente não publica frete nem consulta dados internos",async()=>{
  const h=harness({promptAnswer:null});
  assert.equal(await h.app.toggle({...row,origem:""},"fretes",{whatsappEmbarcador:"5564999887766"}),false);
  assert.equal(h.requests.length,0);
  assert.equal(h.prompts.length,1);
});
test("coleta e descarga ausentes são solicitadas somente para a divulgação",async()=>{
  const h=harness({promptAnswer:(message)=>message.includes("COLETA")?"SILO FAZENDA 1":"INDÚSTRIA A"});
  assert.equal(await h.app.toggle({...row,coleta:"",descarga:""},"fretes",
    {whatsappEmbarcador:"5564999887766"}),true);
  assert.equal(h.prompts.length,2);
  assert.match(h.prompts[0].message,/LOCAL DE COLETA/);
  assert.match(h.prompts[1].message,/LOCAL DE DESCARGA/);
  assert.equal(requestBody(h).coleta,"SILO FAZENDA 1");
  assert.equal(requestBody(h).descarga,"INDÚSTRIA A");
});
test("solicita WhatsApp ausente e exige telefone brasileiro válido",async()=>{
  const h=harness({promptAnswer:"(64) 99988-7766"});
  assert.equal(await h.app.toggle(row,"fretes"),true);
  assert.equal(h.prompts.length,1);
  assert.match(h.prompts[0].message,/WHATSAPP DO EMBARCADOR/);
  assert.equal(requestBody(h).whatsappEmbarcador,"5564999887766");
  const wrong=harness({promptAnswer:"12345"});
  await assert.rejects(wrong.app.toggle(row,"fretes"),/válido/);
  assert.equal(wrong.requests.length,0);
});
test("não publica itens sem status LIBERADO, e não ativa controles em empresas terceiras",async()=>{
  const h=harness();
  await assert.rejects(h.app.toggle({...row,status:"SUSPENSO"},"fretes",{whatsappEmbarcador:"5564999887766"}),/LIBERADOS/);
  const tenant=harness({path:"/pages/gnova/fretes.html"});
  assert.equal(tenant.app.enabled("fretes"),false);
});
test("ao alterar um anúncio e apagar dados obrigatórios, ele é retirado da lista pública",async()=>{
  const h=harness();
  assert.equal(await h.app.toggle(row,"fretes",{whatsappEmbarcador:"(64) 99988-7766"}),true);
  await h.app.afterSave({...row,produto:""},"fretes",{whatsappEmbarcador:"5564999887766"});
  assert.equal(h.requests.filter(r=>r.init.method==="DELETE").length,1);
  assert.equal(h.app.isPublished(row,"fretes"),false);
});
test("o controle em Fretes GO e MT usa a mesma leitura dos campos, com versão de cache atualizada",()=>{
  const root=new URL("../../",import.meta.url);
  for(const module of ["fretes","fretes2"]){
    const script=readFileSync(new URL("assets/js/"+module+".js",root),"utf8");
    const html=readFileSync(new URL("pages/"+module+".html",root),"utf8");
    assert.match(script,/NFDriverFreights\.toggle\(applyPisoSN\(\[row\]\)\[0\],freightModule,\{whatsappEmbarcador:/);
    assert.match(script,/NFDriverFreights\.afterSave\(applyPisoSN\(\[nextRow\]\)\[0\],freightModule/);
    assert.match(html,/driver-freights-publisher\.js\?v=5/);
  }
});
