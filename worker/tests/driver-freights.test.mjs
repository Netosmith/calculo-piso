import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {driverFreightsController} from "../src/controllers/driver-freights.js";
import {routeRequest} from "../src/router.js";
import {createSessionToken} from "../src/services/session.js";

globalThis.crypto??=webcrypto;
const envBase={PORTAL_KEY:"test-driver-public-feed-secret"};
const offer={
  source:"fretes",sourceId:"frete-go-0001",status:"LIBERADO",
  origem:"RIO VERDE-GO",destino:"SANTOS-SP",produto:"MILHO",
  valorMotorista:"R$ 290,00/t",volume:"150 t",
  whatsappEmbarcador:"5564999887766",
  cliente:"SEGREDO COMERCIAL",valorEmpresa:"R$ 400,00/t",
  obs:"DADO INTERNO DE RISCO"
};
function mockDB(offers=[]){
 const calls=[];
 return {
  calls,
  prepare(sql){
    const call={sql,params:[]};calls.push(call);
    const stmt={
      bind(...params){call.params=params;return stmt;},
      async all(){
        if(sql.includes("SELECT source,source_id AS sourceId"))
          return {results:offers};
        if(sql.includes("SELECT source_id AS sourceId"))
          return {results:offers.map(o=>({sourceId:o.sourceId,publishedAt:o.publishedAt,expiresAt:o.expiresAt}))};
        return {results:[]};
      },
      async run(){return {meta:{changes:1}};}
    };
    return stmt;
  }
 };
}
async function session(role="ADMINISTRADOR",tenant="nova-frota"){
 return createSessionToken(envBase,{usuario:"OPERADOR_TESTE",perfil:role,
  estado:"GO",transportadoraId:tenant,expiresAt:new Date(Date.now()+60000).toISOString()});
}
async function request(path,{method="GET",body,role="ADMINISTRADOR",tenant="nova-frota",
  origin="https://portalfrete.net.br",authenticated=true}={}){
 const headers={"Origin":origin,"Content-Type":"application/json"};
 if(authenticated)headers.Cookie="__Host-portal_session="+await session(role,tenant);
 return new Request("https://api.portalfrete.net.br"+path,{method,headers,
  body:body?JSON.stringify(body):undefined});
}
test("catálogo público somente retorna oferta selecionada, jamais o registro operacional completo",async()=>{
 const db=mockDB([{source:"fretes",sourceId:"id1",origem:"RIO VERDE-GO",
  destino:"SANTOS-SP",produto:"MILHO",volume:"150 t",valorMotorista:"R$ 290/t",
  whatsappEmbarcador:"5564999887766",
  publishedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}]);
 const response=await driverFreightsController(await request("/v1/driver-freights",{authenticated:false}),{
  ...envBase,FLEET_DB:db
 });
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.fretes.length,1);
 assert.equal(data.fretes[0].origem,"RIO VERDE-GO");
 assert.equal(data.fretes[0].whatsappEmbarcador,"5564999887766");
 assert.ok(db.calls.some(c=>c.sql.includes("expires_at>?")));
 assert.ok(db.calls.every(c=>!c.sql.includes("valor_empresa")&&!c.sql.includes("cliente")));
});
test("publicação é opt-in, com campos permitidos e expiração de 72 horas",async()=>{
 const db=mockDB();
 const response=await driverFreightsController(await request("/v1/driver-freights/publish",{
  method:"POST",body:offer}),{...envBase,FLEET_DB:db});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.published,true);
 const stmt=db.calls.find(x=>x.sql.includes("INSERT INTO driver_public_freights"));
 assert.ok(stmt);
 assert.ok(stmt.params.includes(offer.origem));
 assert.ok(stmt.params.includes(offer.valorMotorista));
 assert.ok(stmt.params.includes(offer.whatsappEmbarcador));
 assert.ok(!stmt.params.includes(offer.cliente));
 assert.ok(!stmt.params.includes(offer.valorEmpresa));
 assert.ok(!stmt.params.includes(offer.obs));
 assert.ok(stmt.sql.includes("whatsapp_embarcador"));
 assert.ok(Math.abs(Date.parse(result.expiresAt)-Date.now()-72*3600000)<5000);
});
test("não publica sem status LIBERADO ou sem origem/destino/produto",async()=>{
 for(const row of [
  {...offer,status:"SUSPENSO"},
  {...offer,status:"FINALIZANDO"},
  {...offer,status:""},
  {...offer,origem:""},
  {...offer,produto:""},
  {...offer,whatsappEmbarcador:""},
  {...offer,whatsappEmbarcador:"11111"},
  {...offer,whatsappEmbarcador:"https://evil.test"},
  {...offer,valorMotorista:"<script>alert(1)</script>"}
 ]){
  const db=mockDB();
  const response=await driverFreightsController(await request("/v1/driver-freights/publish",{method:"POST",body:row}),
   {...envBase,FLEET_DB:db});
  assert.equal(response.status,400,JSON.stringify(row));
  assert.equal(db.calls.length,0);
 }
});
test("perfil PISO e outro tenant não publicam nem listam gerenciamento",async()=>{
 for(const options of [{role:"PISO"},{tenant:"gnova"}]){
  const db=mockDB();
  const req=await request("/v1/driver-freights/publish",{method:"POST",body:offer,...options});
  const res=await driverFreightsController(req,{...envBase,FLEET_DB:db});
  assert.equal(res.status,403);
  assert.equal(db.calls.length,0);
 }
 const db=mockDB();
 const res=await driverFreightsController(await request("/v1/driver-freights/manage?source=fretes",{role:"PISO"}),{...envBase,FLEET_DB:db});
 assert.equal(res.status,403);
});
test("edição pública exige origem oficial; cancelamento é autorizado e usa mesma fonte",async()=>{
 const db=mockDB();
 const bad=await driverFreightsController(await request("/v1/driver-freights/publish",{
  method:"POST",body:offer,origin:"https://evil.example"
 }),{...envBase,FLEET_DB:db});
 assert.equal(bad.status,403);
 const allowed=await driverFreightsController(await request("/v1/driver-freights/publish",{
  method:"DELETE",body:{source:"fretes",sourceId:"frete-go-0001"}
 }),{...envBase,FLEET_DB:db});
 assert.equal(allowed.status,200);
 assert.ok(db.calls.some(x=>x.sql.includes("DELETE FROM driver_public_freights")));
});
test("router não entrega módulos internos através da rota de consulta pública",async()=>{
 const db=mockDB();
 const response=await routeRequest(await request("/v1/driver-freights",{authenticated:false}),
   {...envBase,FLEET_DB:db});
 assert.equal(response.status,200);
 const res=await routeRequest(await request("/v1/driver-freights/manage?source=fretes",{
   authenticated:false
 }),{...envBase,FLEET_DB:db});
 assert.equal(res.status,401);
});
