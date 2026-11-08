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
  assert.match(html,/id="stop"/);
  assert.match(html,/\/v1\/monitor\/gps-event/);
  assert.match(html,/\/v1\/monitor\/receipt/);
});

test("conclusao normal do GPS exige aprovacao documental e suspensao voluntaria distinta",()=>{
  const html=assertScriptsCompile(driver);
  assert.match(html,/id="stop"[^>]*>Concluir compartilhamento do GPS/);
  assert.match(html,/id="pauseGps"[^>]*>Suspender minha localização por privacidade/);
  assert.match(html,/receipt==="approved"/);
  assert.match(html,/action:"finished"/);
  assert.match(html,/action:"stopped"/);
  assert.match(html,/setInterval\(\(\)=>\{if\(!document.hidden\)updateReview\(\);\},30000\)/);
});
