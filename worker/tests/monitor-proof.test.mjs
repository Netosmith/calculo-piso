import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { monitorDriverUpload, monitorManagerProof } from "../src/controllers/monitor-proof.js";
import { monitorController } from "../src/controllers/monitor.js";
import { createSessionToken } from "../src/services/session.js";

globalThis.crypto??=webcrypto;
const id="12345678-1234-1234-1234-123456789abc",token="a".repeat(64),secret="test-monitor-proof";
const photo=Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1]);
function db({trip={id,active:1,proof_required:1,selfie_status:"missing",selfie_key:null,receipt_status:"missing",receipt_key:null},
  proof=null}={}){
  const calls=[];
  return {
    calls,
    prepare(sql){
      const item={sql,values:[]};calls.push(item);
      const stmt={
        bind(...values){item.values=values;return stmt;},
        async first(){
          if(sql.includes("WHERE t.token_hash="))return trip;
          if(sql.includes("FROM monitor_trip_proofs WHERE trip_id="))return proof;
          return null;
        },
        async all(){return {results:[]};},
        async run(){return {meta:{changes:1}};}
      };
      return stmt;
    },
    async batch(stmts){return stmts.map(()=>({meta:{changes:1}}));}
  };
}
function bucket(){
  const objects=new Map();
  return {objects,async put(key,bytes,opt){objects.set(key,{bytes,opt});return {key};},
    async get(key){const x=objects.get(key);return x?{body:x.bytes}:null;},
    async delete(key){objects.delete(key);}
  };
}
function binaryRequest(kind,bytes=photo,mime="image/jpeg",value=token){
  return new Request("https://api.portalfrete.net.br/v1/monitor/"+kind,{
    method:"POST",headers:{"Content-Type":mime,"X-Monitor-Token":value},
    body:bytes
  });
}
async function managerReq(route,{role="OPERACIONAL",tenant="nova-frota",body}={}){
  const session=await createSessionToken({PORTAL_KEY:secret},{
    usuario:"OPERADOR",perfil:role,transportadoraId:tenant,
    expiresAt:new Date(Date.now()+100000).toISOString()
  });
  return new Request("https://example.test"+route,{
    method:body?"POST":"GET",
    headers:{"Cookie":"__Host-portal_session="+session,"Content-Type":"application/json"},
    body:body?JSON.stringify(body):undefined
  });
}
test("selfie upload saves privately to R2 with pending manual review",async()=>{
  const storage=bucket(),database=db();
  const r=await monitorDriverUpload(binaryRequest("selfie"),{FLEET_DB:database,FLEET_FILES:storage},"selfie");
  assert.equal(r.status,200);
  const data=await r.json();assert.equal(data.status,"pending");
  assert.equal(storage.objects.size,1);
  const [key]=storage.objects.keys();
  assert.match(key,/^monitor\/nova-frota\//);
  assert.equal(storage.objects.get(key).opt.httpMetadata.cacheControl,"private, no-store");
  assert.ok(database.calls.some(x=>x.sql.includes("INSERT INTO monitor_trip_proofs")));
  assert.ok(database.calls.some(x=>x.sql.includes("monitor_proof_audit")));
});
test("selfie upload rejects invalid token and false image signature",async()=>{
  const storage=bucket(),database=db({trip:null});
  const invalid=await monitorDriverUpload(binaryRequest("selfie",photo,"image/jpeg","b".repeat(64)),
    {FLEET_DB:database,FLEET_FILES:storage},"selfie");
  assert.equal(invalid.status,404);
  const fake=await monitorDriverUpload(binaryRequest("selfie",new Uint8Array([1,2,3]),"image/jpeg"),
    {FLEET_DB:db(),FLEET_FILES:storage},"selfie");
  assert.equal(fake.status,415);
  assert.equal(storage.objects.size,0);
});
test("receipts accept PDFs and are rejected before selfie on new trips",async()=>{
  const blocked=await monitorDriverUpload(binaryRequest("receipt",new TextEncoder().encode("%PDF-1.5"),"application/pdf"),
    {FLEET_DB:db(),FLEET_FILES:bucket()},"receipt");
  assert.equal(blocked.status,409);
  const storage=bucket();
  const allowed=await monitorDriverUpload(binaryRequest("receipt",new TextEncoder().encode("%PDF-1.5"),"application/pdf"),
    {FLEET_DB:db({trip:{id,active:1,proof_required:1,selfie_key:"old/selfie",receipt_status:"missing",receipt_key:null}}),FLEET_FILES:storage},"receipt");
  assert.equal(allowed.status,200);
  assert.equal(storage.objects.size,1);
});
test("document reviews require operational or administrator role",async()=>{
  const proof={trip_id:id,selfie_key:"monitor/nova-frota/test/selfie",selfie_status:"pending"};
  const storage=bucket(),database=db({proof});
  const commercial=await monitorManagerProof(await managerReq("/dummy",{role:"COMERCIAL"}),{FLEET_DB:database,FLEET_FILES:storage},id,"selfie","download",{perfil:"COMERCIAL"});
  assert.equal(commercial.status,403);
  const rejection=await monitorManagerProof(new Request("https://example.test",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({decision:"rejected",note:"Imagem sem nitidez"})}),{FLEET_DB:database,FLEET_FILES:storage},id,"selfie","review",{perfil:"OPERACIONAL",usuario:"OPERADOR"});
  assert.equal(rejection.status,200);
  assert.ok(database.calls.some(x=>x.sql.includes("monitor_proof_audit")&&x.values.includes("Imagem sem nitidez")));
});
test("new trips refuse GPS without a submitted selfie",async()=>{
  const database=db();
  const response=await monitorController(new Request("https://api.portalfrete.net.br/v1/monitor/position",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token,latitude:-17.8,longitude:-50.9,accuracy:8})
  }),{FLEET_DB:database});
  assert.equal(response.status,409);
  assert.match((await response.json()).error,/selfie/i);
});
test("pending documents block operational completion while old journeys remain compatible",async()=>{
  const database=db({proof:{proof_required:1,selfie_status:"pending",receipt_status:"pending"}});
  const req=await managerReq("/v1/monitor/trips/"+id+"/stop",{body:{}});
  // managerReq with empty body supplies GET; explicitly POST for stop.
  const stop=new Request(req.url,{method:"POST",headers:req.headers,body:"{}"});
  const result=await monitorController(stop,{FLEET_DB:database,PORTAL_KEY:secret});
  assert.equal(result.status,409);
  const other=await managerReq("/v1/monitor/trips",{tenant:"gnova"});
  const denied=await monitorController(other,{FLEET_DB:database,PORTAL_KEY:secret});
  assert.equal(denied.status,403);
});

test("interrupcao voluntaria de GPS gera alerta auditavel sem encerrar a viagem",async()=>{
  const database=db({trip:{id,active:1,proof_required:1,selfie_status:"pending",selfie_key:"foto",receipt_status:"missing",last_position_at:"2026-11-08T20:10:00.000Z"}});
  const response=await monitorController(new Request("https://api.portalfrete.net.br/v1/monitor/gps-event",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token,action:"stopped"})
  }),{FLEET_DB:database});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.recorded,true);
  assert.equal(data.tripActive,true);
  assert.equal(data.receiptRequired,true);
  assert.ok(database.calls.some(x=>x.sql.includes("INSERT INTO monitor_proof_audit")&&x.values[0]===id));
  assert.equal(database.calls.some(x=>x.sql.includes("UPDATE monitor_trips SET active=0")),false);
});
test("evento GPS rejeita link invalido e acoes desconhecidas",async()=>{
  const database=db({trip:null});
  const denied=await monitorController(new Request("https://api.portalfrete.net.br/v1/monitor/gps-event",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token,action:"stopped"})
  }),{FLEET_DB:database});
  assert.equal(denied.status,404);
  const badAction=await monitorController(new Request("https://api.portalfrete.net.br/v1/monitor/gps-event",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token,action:"stop-trip"})
  }),{FLEET_DB:database});
  assert.equal(badAction.status,400);
});

test("conclusao normal do GPS exige selfie e comprovante aprovados no servidor",async()=>{
  const pendingDb=db({trip:{id,active:1,proof_required:1,selfie_status:"approved",receipt_status:"pending"}});
  const makeReq=()=>new Request("https://api.portalfrete.net.br/v1/monitor/gps-event",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token,action:"finished"})
  });
  const pending=await monitorController(makeReq(),{FLEET_DB:pendingDb});
  assert.equal(pending.status,409);
  assert.match((await pending.json()).error,/aprova/i);
  assert.equal(pendingDb.calls.some(x=>x.sql.includes("INSERT INTO monitor_proof_audit")),false);
  const approvedDb=db({trip:{id,active:1,proof_required:1,selfie_status:"approved",receipt_status:"approved"}});
  const approved=await monitorController(makeReq(),{FLEET_DB:approvedDb});
  assert.equal(approved.status,200);
  assert.equal((await approved.json()).documentsApproved,true);
  assert.ok(approvedDb.calls.some(x=>x.sql.includes("'finished'")&&x.values[0]===id));
  assert.equal(approvedDb.calls.some(x=>x.sql.includes("UPDATE monitor_trips SET active=0")),false);
});
