import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,createContext} from "node:vm";

const source=readFileSync(new URL("../../pages/monitorar-motorista.html",import.meta.url),"utf8");
const scripts=[...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,1);
const driverCode=new Script(scripts[0][1],{filename:"monitorar-motorista.html"});
const token="a".repeat(64);
const accepted={
  id:"test-trip",plate:"ABC1D23",driver:"MOTORISTA TESTE",origin:"GO",destination:"SP",
  active:true,selfieRequired:true,selfieStatus:"pending",receiptStatus:"missing",
  gpsConsentAt:"2026-11-08T22:00:00Z",gpsFinishedAt:null,lastPosition:null
};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function openDriver(info={}){
  const trip={...accepted,...info};
  const selectors=new Map(),events=new Map(),documentEvents=new Map(),watchers=[],cleared=[],timers=[],requests=[],intervals=[];
  const node=selector=>{
    if(!selectors.has(selector))selectors.set(selector,{
      checked:false,disabled:false,hidden:false,files:[],value:"",textContent:"",
      className:"",setAttribute(){},scrollIntoView(){},focus(){}
    });
    return selectors.get(selector);
  };
  const doc={hidden:false,querySelector:node,addEventListener:(name,handler)=>documentEvents.set(name,handler)};
  const geo={
    watchPosition(onSuccess,onError,options){
      watchers.push({onSuccess,onError,options});
      return watchers.length;
    },
    clearWatch(id){cleared.push(id)},
    getCurrentPosition(onSuccess,onError){geo.lastProbe={onSuccess,onError}}
  };
  const env={
    document:doc,navigator:{geolocation:geo},location:{hash:"#"+token},
    window:{addEventListener:(name,handler)=>events.set(name,handler)},
    fetch:async(url,options={})=>{
      const pathname=new URL(url).pathname;
      requests.push({pathname,body:JSON.parse(options.body||"{}")});
      if(pathname.endsWith("/driver"))return new Response(JSON.stringify({ok:true,trip}));
      if(pathname.endsWith("/position"))return new Response(JSON.stringify({ok:true,receivedAt:new Date().toISOString()}));
      if(pathname.endsWith("/consent"))return new Response(JSON.stringify({ok:true,consentAt:new Date().toISOString()}));
      throw Error("Unexpected request: "+pathname);
    },
    URL,Response,Date,console,
    setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length;},
    setTimeout:(fn,ms)=>{const t={fn,ms,cleared:false};timers.push(t);return t;},
    clearTimeout:t=>{if(t)t.cleared=true;},
    confirm:()=>true
  };
  driverCode.runInContext(createContext(env));
  return {trip,doc,node,geo,watchers,cleared,events,documentEvents,timers,requests,intervals};
}
test("após atualizar link com termo aceito, acompanhamento retoma automaticamente sem clicar",async()=>{
  const d=openDriver();await tick();
  assert.equal(d.watchers.length,1);
  assert.equal(d.node("#start").hidden,true);
  assert.equal(d.node("#trackingActive").hidden,false);
  assert.match(d.node("#status").textContent,/retomada automaticamente/i);
  assert.equal(d.requests.filter(x=>x.pathname.endsWith("/consent")).length,0);
});
test("viagem sem aceite, encerrada ou finalizada nunca retoma sozinha",async()=>{
  for(const status of [
    {gpsConsentAt:null},{active:false},{gpsFinishedAt:"2026-11-09T00:00:00Z"},
    {selfieStatus:"missing",selfieRequired:true}
  ]){
    const d=openDriver(status);await tick();
    assert.equal(d.watchers.length,0,JSON.stringify(status));
  }
});
test("erro temporário de GPS agenda recuperação sem novo aceite",async()=>{
  const d=openDriver();await tick();
  d.watchers[0].onError({code:2,message:"Posição indisponível"});
  assert.equal(d.cleared.length,1);
  const retry=d.timers.find(x=>!x.cleared);
  assert.ok(retry);
  assert.ok(retry.ms>=5000);
  retry.fn();await tick();
  assert.equal(d.watchers.length,2);
  assert.equal(d.requests.filter(x=>x.pathname.endsWith("/consent")).length,0);
});
test("permissão revogada não provoca tentativas infinitas e permite retomada manual",async()=>{
  const d=openDriver();await tick();
  d.watchers[0].onError({code:1,message:"Permissão negada"});
  assert.equal(d.node("#trackingActive").hidden,true);
  assert.match(d.node("#status").textContent,/permissão de localização bloqueada/i);
  assert.equal(d.timers.filter(x=>!x.cleared).length,0);
  d.events.get("online")();
  assert.equal(d.watchers.length,1);
  await d.node("#start").onclick();
  assert.equal(d.watchers.length,2);
});
test("pagehide seguido de pageshow em cache de navegador revalida e reinicia",async()=>{
  const d=openDriver();await tick();
  d.events.get("pagehide")();
  assert.equal(d.cleared.length,1);
  d.events.get("pageshow")({persisted:true});await tick();
  assert.equal(d.watchers.length,2);
});
test("visibilidade restaurada e conexão de volta tentam recuperar observador parado",async()=>{
  const d=openDriver();await tick();
  d.doc.hidden=true;
  d.watchers[0].onError({code:2,message:"Temporarily unavailable"});
  d.doc.hidden=false;
  d.events.get("online")();
  assert.equal(d.watchers.length,2);
});
test("central emite atenção e sem sinal quando viagem já começou sem posição",()=>{
  const source=readFileSync(new URL("../../pages/monitoramento.html",import.meta.url),"utf8");
  assert.match(source,/const started=Date\.parse\(t\.startedAt\)/);
  assert.match(source,/if\(age>FIFTEEN\)return "lost"/);
  assert.match(source,/if\(age>FIVE\)return "warn"/);
});
