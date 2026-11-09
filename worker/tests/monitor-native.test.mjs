import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
import {monitorController} from "../src/controllers/monitor.js";
import {createSessionToken} from "../src/services/session.js";

globalThis.crypto??=webcrypto;
const id="12345678-1234-1234-1234-123456789abc";
const token="a".repeat(64);
const fixId="01234567-1234-1234-1234-123456789abc";
const base={PORTAL_KEY:"native-monitor-tests"};
const now=new Date().toISOString();
const validTrip={id,active:1,proof_required:1,selfie_key:"private/selfie.jpg",
  gps_consent_at:now,gps_finished_at:null,plate:"ABC1D23"};
function data(overrides={}){
  return {token,fixId,platform:"android",latitude:-17.8,longitude:-50.92,
    accuracy:13,capturedAt:new Date(Date.now()-30000).toISOString(),...overrides};
}
function mockDB(trip=validTrip){
  const calls=[],batches=[];
  return {
    calls,batches,
    prepare(sql){
      const call={sql,params:[]};calls.push(call);
      const stmt={
        bind(...params){call.params=params;return stmt;},
        async first(){
          if(sql.includes("FROM monitor_trips t LEFT JOIN monitor_trip_proofs"))
            return trip;
          if(sql.includes("SELECT id FROM monitor_trips WHERE"))return {id};
          return null;
        },
        async all(){return {results:[]};},
        async run(){return {meta:{changes:1}};}
      };
      return stmt;
    },
    async batch(stmts){batches.push(stmts);return [{meta:{changes:1}},{meta:{changes:1}}];}
  };
}
const req=(path,body,method="POST")=>new Request("https://api.portalfrete.net.br"+path,{
  method,headers:{"Content-Type":"application/json"},
  body:method==="POST"?JSON.stringify(body):undefined
});
const endpoint="/v1/monitor/mobile/position";
test("GPS nativo aceita posição com instante de coleta e chave idempotente apenas de viagem iniciada",async()=>{
  const db=mockDB();
  const response=await monitorController(req(endpoint,data()),{...base,FLEET_DB:db});
  assert.equal(response.status,200);
  const json=await response.json();
  assert.equal(json.accepted,true);
  assert.equal(db.batches.length,1);
  assert.ok(db.calls.some(x=>x.sql.includes("INSERT OR IGNORE INTO monitor_native_positions")));
  const received=db.calls.find(x=>x.sql.includes("INSERT OR IGNORE INTO monitor_native_positions"));
  assert.equal(received.params[0],fixId);
  assert.equal(received.params[1],id);
  assert.ok(Number.isFinite(Date.parse(received.params[5])));
  assert.equal(received.params[7],"android");
  const updated=db.calls.find(x=>x.sql.includes("UPDATE monitor_trips SET lat="));
  assert.ok(updated.sql.includes("last_position_at<?"),"Posição atrasada não pode substituir última mais nova");
});
test("sem aceite/selfie, viagem encerrada ou GPS concluído nunca recebe posição",async()=>{
  for(const trip of [
    {...validTrip,gps_consent_at:null},
    {...validTrip,selfie_key:null},
    {...validTrip,active:0},
    {...validTrip,gps_finished_at:now}
  ]){
    const db=mockDB(trip);
    const res=await monitorController(req(endpoint,data()),{...base,FLEET_DB:db});
    assert.equal(res.status,409);
    assert.equal(db.batches.length,0);
  }
});
test("identificadores, timestamps falsos e coordenadas inválidas não gravam nada",async()=>{
  for(const fix of [
    {fixId:"../admin"},{capturedAt:new Date(Date.now()-4*86400000).toISOString()},
    {capturedAt:new Date(Date.now()+300000).toISOString()},
    {accuracy:-1},{latitude:91},{longitude:Infinity},{platform:"browser"},{latitude:"1"}
  ]){
    const db=mockDB();
    const res=await monitorController(req(endpoint,data(fix)),{...base,FLEET_DB:db});
    assert.equal(res.status,400,JSON.stringify(fix));
    assert.equal(db.batches.length,0);
  }
});
test("histórico da Central inclui posições do navegador e do aplicativo",async()=>{
  const db=mockDB();
  const session=await createSessionToken(base,{
    usuario:"OPERADOR",perfil:"ADMINISTRADOR",transportadoraId:"nova-frota",
    expiresAt:new Date(Date.now()+60000).toISOString()
  });
  const request=new Request("https://api.portalfrete.net.br/v1/monitor/trips/"+id+"/positions",{
    headers:{Cookie:"__Host-portal_session="+session}
  });
  const res=await monitorController(request,{...base,FLEET_DB:db});
  assert.equal(res.status,200);
  assert.ok(db.calls.some(x=>x.sql.includes("UNION ALL")&&x.sql.includes("monitor_native_positions")));
});
test("backup do Super Admin inclui e exclui posições nativas de maneira auditável",()=>{
  const src=readFileSync(new URL("../src/controllers/super-admin-monitor-delete.js",import.meta.url),"utf8");
  assert.match(src,/SELECT id,lat,lng,accuracy,captured_at,received_at,platform FROM monitor_native_positions/);
  assert.match(src,/DELETE FROM monitor_native_positions WHERE trip_id=/);
  assert.match(src,/snapshot\.positions\.length\+snapshot\.nativePositions\.length/);
  const sql=readFileSync(new URL("../migrations/0012_monitor_native_positions.sql",import.meta.url),"utf8");
  assert.match(sql,/id TEXT PRIMARY KEY/);
  assert.match(sql,/ON DELETE CASCADE/);
});
