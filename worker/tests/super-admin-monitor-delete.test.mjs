import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createSessionToken} from "../src/services/session.js";
import {superAdminController} from "../src/controllers/super-admin.js";

globalThis.crypto??=webcrypto;
const id="12345678-1234-1234-1234-123456789abc";
const base="/v1/super-admin/monitor/viagens";
const data={tripIds:[id],confirmation:"EXCLUIR",backupAcknowledged:true,
  reason:"Exclusão autorizada pela gestão do monitoramento"};
const baseEnv={PORTAL_KEY:"unit-test-super-admin-secret",SUPER_ADMIN_USER:"PROPRIETARIO",
  SUPER_ADMIN_OWNER_PORTAL_WRITES:"enabled"};

async function request(path,{usuario="PROPRIETARIO",tenant="nova-frota",
  role="ADMINISTRADOR",method="GET",body,headers={}}={}){
  const token=await createSessionToken(baseEnv,{
    usuario,perfil:role,transportadoraId:tenant,expiresAt:new Date(Date.now()+60000).toISOString()
  });
  return new Request("https://api.portalfrete.net.br"+path,{
    method,headers:{
      Cookie:"__Host-portal_session="+token,
      "Content-Type":"application/json","Origin":"https://portalfrete.net.br",
      "X-Portal-Super-Admin-Action":"owner-panel",...headers
    },
    body:body?JSON.stringify(body):undefined
  });
}
function fakeDb({found=true,withProofs=true}={}){
  const calls=[],batches=[];
  const trip={id,plate:"ABC1D23",driver:"Motorista de Teste",origin:"GO",destination:"SP",
    created_by:"TESTE",created_at:"2026-11-08T12:00:00Z",updated_at:"2026-11-08T14:00:00Z",
    active:1,token_expires_at:"2026-11-15T12:00:00Z",lat:-17.8,lng:-50.9,
    accuracy:10,last_position_at:"2026-11-08T14:00:00Z"};
  return {
    calls,batches,
    prepare(sql){
      const call={sql,values:[]};calls.push(call);
      const st={
        bind(...values){call.values=values;return st;},
        async first(){
          if(sql.includes("FROM monitor_trips WHERE id=?"))return found?trip:null;
          if(sql.includes("FROM monitor_trip_extras"))return {branch:"RIO VERDE"};
          if(sql.includes("FROM monitor_trip_proofs"))return withProofs?{
            trip_id:id,selfie_key:"live/selfie",receipt_key:"live/receipt",
            selfie_mime:"image/jpeg",receipt_mime:"application/pdf"
          }:null;
          if(sql.includes("FROM monitor_trip_documents WHERE"))return {nf:"00001",cte:"00002"};
          return null;
        },
        async all(){
          if(sql.includes("FROM monitor_trips t"))return {results:[trip]};
          if(sql.includes("FROM monitor_positions"))return {results:[].concat(Number(call.values[1])===0?
            [{id:1,lat:-17.8,lng:-50.9,accuracy:10,recorded_at:"2026-11-08T14:00:00Z"}]:[])};
          return {results:[]};
        },
        async run(){return {meta:{changes:1}};}
      };
      return st;
    },
    async batch(stmts){batches.push(stmts);return stmts.map(()=>({meta:{changes:1}}));}
  };
}
function fakeStorage({missingOriginal=false}={}){
  const uploads=new Map(),deleted=[];
  return {
    uploads,deleted,
    async get(key){
      if(missingOriginal)return null;
      if(key==="live/selfie"||key==="live/receipt")return {body:new Uint8Array([1,2,3])};
      const obj=uploads.get(key);return obj?{body:obj.bytes}:null;
    },
    async put(key,body,metadata){uploads.set(key,{bytes:body,metadata});return {key};},
    async delete(key){deleted.push(key);}
  };
}
test("somente super-admin proprietario pode listar, nem outro administrador nem outra tenant",async()=>{
  const db=fakeDb(),env={...baseEnv,FLEET_DB:db};
  const ok=await superAdminController(await request(base),env);
  assert.equal(ok.status,200);
  const data=await ok.json();
  assert.equal(data.trips[0].plate,"ABC1D23");
  const denied=await superAdminController(await request(base,{usuario:"ADMINISTRADOR"}),env);
  assert.equal(denied.status,403);
  const otherTenant=await superAdminController(await request(base,{tenant:"gnova"}),env);
  assert.equal(otherTenant.status,403);
});
test("confirmacao, origem e habilitacao de escrita obrigatorias antes de excluir",async()=>{
  const db=fakeDb(),r2=fakeStorage(),env={...baseEnv,FLEET_DB:db,FLEET_FILES:r2};
  const wrong=await superAdminController(await request(base+"/excluir",{method:"POST",body:{...data,confirmation:"OK"}}),env);
  assert.equal(wrong.status,400);
  const wrongOrigin=await superAdminController(await request(base+"/excluir",{method:"POST",body:data,
    headers:{"Origin":"https://example.org"}}),env);
  assert.equal(wrongOrigin.status,403);
  const noWrite=await superAdminController(await request(base+"/excluir",{method:"POST",body:data}),{
    ...env,SUPER_ADMIN_OWNER_PORTAL_WRITES:"disabled"
  });
  assert.equal(noWrite.status,403);
  assert.equal(db.batches.length,0);
  assert.equal(r2.uploads.size,0);
});
test("viagem real ativa pode ser excluida pelo owner, com copia privada dos dados, evidencias e auditoria",async()=>{
  const db=fakeDb(),r2=fakeStorage();
  const response=await superAdminController(await request(base+"/excluir",{method:"POST",body:data}),
    {...baseEnv,FLEET_DB:db,FLEET_FILES:r2});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.partial,false);
  assert.equal(result.deleted.length,1);
  assert.equal(result.deleted[0].id,id);
  assert.equal(result.deleted[0].positionsCount,1);
  assert.equal(db.batches.length,1);
  const sql=db.calls.map(x=>x.sql);
  assert.ok(sql.some(x=>x.includes("INSERT INTO monitor_trip_deletion_audit")));
  assert.ok(sql.some(x=>x.includes("DELETE FROM monitor_trips WHERE id=?")));
  assert.ok(sql.some(x=>x.includes("DELETE FROM monitor_positions WHERE trip_id=?")));
  assert.ok(sql.some(x=>x.includes("DELETE FROM monitor_proof_audit WHERE trip_id=?")));
  assert.equal(r2.uploads.size,3); // selfie, comprovante e backup JSON
  assert.deepEqual(r2.deleted,["live/selfie","live/receipt"]);
  const blob=r2.uploads.get(result.deleted[0].backupKey).bytes;
  const snapshot=JSON.parse(blob);
  assert.equal(snapshot.trip.plate,"ABC1D23");
  assert.equal(snapshot.document.nf,"00001");
  assert.equal(snapshot.positions.length,1);
  assert.ok(snapshot.files.selfie.backupKey);
  assert.equal(snapshot.trip.token_hash,undefined);
});
test("sem backup ou comprovante original, nao apagar nenhum registro",async()=>{
  const db=fakeDb(),r2=fakeStorage({missingOriginal:true});
  const response=await superAdminController(await request(base+"/excluir",{method:"POST",body:data}),
    {...baseEnv,FLEET_DB:db,FLEET_FILES:r2});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.partial,true);
  assert.equal(result.deleted.length,0);
  assert.equal(db.batches.length,0);
  const noBucket=await superAdminController(await request(base+"/excluir",{method:"POST",body:data}),
    {...baseEnv,FLEET_DB:db});
  assert.equal(noBucket.status,503);
});
test("nao permite lote acima do limite ou ids duplicados",async()=>{
  const db=fakeDb(),r2=fakeStorage(),env={...baseEnv,FLEET_DB:db,FLEET_FILES:r2};
  const repeated=await superAdminController(await request(base+"/excluir",{
    method:"POST",body:{...data,tripIds:[id,id]}
  }),env);
  assert.equal(repeated.status,400);
  assert.equal(db.batches.length,0);
});
