import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createSessionToken } from "../src/services/session.js";
import { monitorController } from "../src/controllers/monitor.js";

globalThis.crypto ??= webcrypto;
const id="12345678-1234-1234-1234-123456789abc";
const secret={PORTAL_KEY:"monitor-documents-test-secret"};
async function req({tenant="nova-frota",role="OPERACIONAL",method="PUT",body={nf:"000123456",cte:"35261112345678000123570010000123451000012345"},path="/v1/monitor/trips/"+id+"/documents"}={}){
  const session=await createSessionToken(secret,{usuario:"OPERADOR",perfil:role,
    transportadoraId:tenant,expiresAt:new Date(Date.now()+60000).toISOString()});
  return new Request("https://example.test"+path,{
    method,headers:{"Cookie":"__Host-portal_session="+session,"Content-Type":"application/json"},
    body:method==="PUT"?JSON.stringify(body):undefined
  });
}
function db({started=true,active=1,nf="",cte="",exists=true,results=[]}={}){
  const calls=[];
  return {
    calls,
    prepare(sql){
      const call={sql,values:[]};calls.push(call);
      const statement={
        bind(...values){call.values=values;return statement;},
        async first(){
          if(sql.startsWith("SELECT id,active,last_position_at FROM monitor_trips"))
            return exists?{id,active,last_position_at:started?"2026-11-08T23:00:00.000Z":null}:null;
          if(sql.includes("SELECT created_at FROM monitor_proof_audit"))
            return started?{created_at:"2026-11-08T23:00:00.000Z"}:null;
          if(sql.startsWith("SELECT nf,cte FROM monitor_trip_documents"))return {nf,cte};
          return null;
        },
        async all(){return {results};},
        async run(){return {meta:{changes:1}};}
      };
      return statement;
    },
    async batch(statements){assert.equal(statements.length,2);return statements.map(()=>({meta:{changes:1}}));}
  };
}
test("incluir NF e CT-e numa viagem iniciada persiste com auditoria",async()=>{
  const database=db();
  const response=await monitorController(await req(),{...secret,FLEET_DB:database});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.nf,"000123456");
  assert.equal(data.cte,"35261112345678000123570010000123451000012345");
  assert.ok(database.calls.some(x=>x.sql.includes("INSERT INTO monitor_trip_documents (")&&x.values[1]==="000123456"));
  assert.ok(database.calls.some(x=>x.sql.includes("monitor_trip_documents_audit")&&x.values[0]===id));
  assert.equal(database.calls.some(x=>x.sql.includes("UPDATE monitor_trips SET active=0")),false);
});
test("edicao bloqueada antes do inicio e apos encerramento",async()=>{
  const notStarted=db({started:false});
  const pending=await monitorController(await req(),{...secret,FLEET_DB:notStarted});
  assert.equal(pending.status,409);
  assert.ok(!notStarted.calls.some(x=>x.sql.includes("INSERT INTO monitor_trip_documents")));
  const ended=db({active:0});
  assert.equal((await monitorController(await req(),{...secret,FLEET_DB:ended})).status,409);
});
test("dados fiscais aceitam zero a esquerda e validam comprimento",async()=>{
  const database=db();
  const missing=await monitorController(await req({body:{nf:123,cte:"1"}}),{...secret,FLEET_DB:database});
  assert.equal(missing.status,400);
  const huge=await monitorController(await req({body:{nf:"1".repeat(201),cte:"456"}}),{...secret,FLEET_DB:database});
  assert.equal(huge.status,400);
  const controls=await monitorController(await req({body:{nf:"123\n456",cte:"456"}}),{...secret,FLEET_DB:database});
  assert.equal(controls.status,400);
});
test("outras transportadoras e perfil PISO nao editam documentos",async()=>{
  const database=db();
  assert.equal((await monitorController(await req({tenant:"gnova"}),{...secret,FLEET_DB:database})).status,403);
  assert.equal((await monitorController(await req({role:"PISO"}),{...secret,FLEET_DB:database})).status,403);
  assert.equal(database.calls.length,0);
});
test("listagem do monitoramento inclui os campos fiscais por viagem",async()=>{
  const database=db({results:[{
    id,plate:"ABC1D23",driver:"TESTE",branch:"Rio Verde",origin:"GO",destination:"SP",
    active:1,nf:"000001",cte:"000002",documents_updated_at:"2026-11-08T23:30:00Z",
    started_at:"2026-11-08T22:00:00Z"
  }]});
  const response=await monitorController(await req({method:"GET",path:"/v1/monitor/trips"}),{...secret,FLEET_DB:database});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.trips[0].nf,"000001");
  assert.equal(data.trips[0].cte,"000002");
  assert.equal(data.trips[0].startedAt,"2026-11-08T22:00:00Z");
  assert.ok(database.calls.some(x=>x.sql.includes("LEFT JOIN monitor_trip_documents d")));
});
