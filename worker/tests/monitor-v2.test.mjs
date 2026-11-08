import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createSessionToken } from "../src/services/session.js";
import { monitorController } from "../src/controllers/monitor.js";

globalThis.crypto ??= webcrypto;
const base={PORTAL_KEY:"unit-test-secret"};
async function request(path, {role="ADMINISTRADOR",tenant="nova-frota",method="GET",body}={}) {
  const token=await createSessionToken(base,{usuario:"OPERADOR",perfil:role,transportadoraId:tenant,
    expiresAt:new Date(Date.now()+60000).toISOString()});
  return new Request("https://example.test"+path,{
    method,headers:{Cookie:"__Host-portal_session="+token,"Content-Type":"application/json"},
    body:body?JSON.stringify(body):undefined
  });
}
function fakeDB(records=[]) {
  return {
    records,
    prepare(sql) {
      const entry={sql,values:[]};records.push(entry);
      const statement={
        bind(...values){entry.values=values;return statement;},
        async all(){
          if(sql.includes("FROM monitor_positions"))return {results:[]};
          return {results:[]};
        },
        async first(){
          if(sql.includes("SELECT id FROM monitor_trips"))return {id:"trip"};
          if(sql.includes("FROM monitor_trips WHERE token_hash"))return null;
          return null;
        },
        async run(){return {meta:{changes:1}};}
      };
      return statement;
    },
    async batch(stmts){assert.ok(stmts.length===2||stmts.length===3);return stmts.map(()=>({meta:{changes:1}}));}
  };
}
test("tenant de outra transportadora nao pode ver viagens Nova Frota",async()=>{
  const db=fakeDB();
  const res=await monitorController(await request("/v1/monitor/trips",{tenant:"transvale-01"}),{...base,FLEET_DB:db});
  assert.equal(res.status,403);
  assert.equal(db.records.length,0);
});
test("perfil PISO permanece sem acesso ao monitoramento",async()=>{
  const db=fakeDB();
  const res=await monitorController(await request("/v1/monitor/trips",{role:"PISO"}),{...base,FLEET_DB:db});
  assert.equal(res.status,403);
});
test("nova viagem registra filial e expira link em sete dias",async()=>{
  const db=fakeDB();
  const start=Date.now();
  const res=await monitorController(await request("/v1/monitor/trips",{method:"POST",
    body:{plate:"ABC1D23",driver:"Motorista Teste",branch:"Rio Verde",origin:"GO",destination:"SP"}}),
    {...base,FLEET_DB:db});
  assert.equal(res.status,201);
  const data=await res.json();
  assert.equal(data.linkExpiresDays,7);
  assert.equal(data.trip.branch,"Rio Verde");
  assert.match(data.token,/^[0-9a-f]{64}$/);
  const diff=Date.parse(data.trip.linkExpiresAt)-start;
  assert.ok(diff>6.99*86400000&&diff<=7*86400000+1000);
  assert.ok(db.records.some(r=>r.sql.includes("INSERT INTO monitor_trip_extras")&&r.values[1]==="Rio Verde"));
  assert.ok(db.records.some(r=>r.sql.includes("INSERT INTO monitor_trip_proofs")&&r.values[0]===data.trip.id));
});
test("consulta de historico exige autorizacao e fornece array vazio",async()=>{
  const db=fakeDB();
  const id="12345678-1234-1234-1234-123456789abc";
  const res=await monitorController(await request("/v1/monitor/trips/"+id+"/positions"),{...base,FLEET_DB:db});
  assert.equal(res.status,200);
  assert.deepEqual((await res.json()).points,[]);
});
test("historico exige id valido",async()=>{
  const res=await monitorController(await request("/v1/monitor/trips/invalido/positions"),{...base,FLEET_DB:fakeDB()});
  assert.equal(res.status,400);
});
