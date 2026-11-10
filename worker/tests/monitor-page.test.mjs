import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const page=new URL("../../pages/monitoramento.html",import.meta.url);
const driver=new URL("../../pages/monitorar-motorista.html",import.meta.url);
function assertScriptsCompile(url) {
  const html=readFileSync(url,"utf8");
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length,"Pagina sem scripts");
  for(const script of scripts)if(script[1].trim())new Script(script[1],{filename:url.pathname});
  return html;
}
test("central monitoramento possui Javascript valido e filtros",()=>{
  const html=assertScriptsCompile(page);
  for(const id of ["kActive","kLive","kWarn","kLost","kWait","search","filterBranch",
    "filterStatus","tripList","map","details","historySummary","morePositions","newTrip"])
    assert.ok(html.includes('id="'+id+'"'),"Elemento faltando: "+id);
  assert.match(html,/requireFeatureAuth\("monitoramento"\)/);
  assert.match(html,/\/v1\/monitor\/trips/);
});
test("pagina compartilhada com motorista tem Javascript valido e autorizacao",()=>{
  const html=assertScriptsCompile(driver);
  assert.match(html,/navigator\.geolocation\.watchPosition/);
  assert.match(html,/location\.hash/);
});

test("comprovante usa apenas botoes de camera e biblioteca na pagina",()=>{
  const html=assertScriptsCompile(driver);
  assert.match(html,/id="receiptCamera"[^>]*capture="environment"/);
  assert.match(html,/id="receiptFile"[^>]*accept="image\/\*"/);
  assert.match(html,/TIRAR FOTO/);
  assert.match(html,/BIBLIOTECA/);
  assert.doesNotMatch(html,/ESCOLHER ARQUIVO/);
  assert.match(html,/id="finishButton"/);
  assert.match(html,/\/v1\/monitor\/gps-event/);
  assert.match(html,/\/v1\/monitor\/receipt/);
});

test("Central não permite encerrar sem comprovante aprovado em viagens antigas",()=>{
  const html=assertScriptsCompile(page);
  assert.match(html,/const docsOk=t.receiptStatus==="approved"&&/);
  assert.match(html,/Aguardando comprovante aprovado/);
  assert.match(html,/Interromper o GPS não encerra a viagem/);
});
test("motorista tem quatro etapas, aceite do termo e finalizacao depois da descarga",()=>{
  const html=assertScriptsCompile(driver);
  for(const id of ["stageSelfie","stageGps","stageReceipt","stageFinish","gpsConsent","travelTerm",
    "start","trackingActive","receiptBox","finishBox","finishButton"])
    assert.ok(html.includes('id="'+id+'"'),"Ausente: "+id);
  assert.match(html,/INICIAR VIAGEM/);
  assert.match(html,/A viagem será monitorada até a finalização, por comprovante anexado\./);
  assert.match(html,/>FINALIZAR VIAGEM<\/button>/);
  assert.match(html,/RETOMAR VIAGEM/);
  assert.match(html,/action:"finished"/);
  assert.match(html,/\/v1\/monitor\/consent/);
  assert.match(html,/receipt==="approved"/);
  assert.doesNotMatch(html,/id="pauseGps"/);
  assert.doesNotMatch(html,/id="stop"/);
  assert.match(html,/setInterval\(\(\)=>\{if\(!document.hidden\)updateReview\(\);\},30000\)/);
});

test("central libera editar NF e CT-e apos iniciar viagem, sem pedir no cadastro inicial",()=>{
  const html=assertScriptsCompile(page);
  for(const id of ["fiscalEditor","fiscalForm","fiscalNf","fiscalCte","saveFiscal","cancelFiscal"])
    assert.ok(html.includes('id="'+id+'"'),"Campo nao encontrado: "+id);
  assert.match(html,/Editar viagem · NF \/ CT-e/);
  assert.match(html,/\/v1\/monitor\/trips\/.*\/documents/);
  assert.match(html,/t\.startedAt\|\|t\.lastPosition/);
  const createForm=html.split('<form id="newTrip">')[1]?.split('</form>')[0];
  assert.ok(createForm);
  assert.doesNotMatch(createForm,/name="nf"|name="cte"/);
});

test("Central alerta se GPS é interrompido antes do comprovante aprovado",()=>{
  const html=assertScriptsCompile(page);
  assert.match(html,/const pendingStop=active\.filter/);
  assert.match(html,/GPS interrompido e descarga pendente/);
  assert.match(html,/Descarga pendente/);
  assert.match(html,/t.receiptStatus!=="approved"/);
});
