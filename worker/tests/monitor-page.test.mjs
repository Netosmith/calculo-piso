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
