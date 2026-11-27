import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {webcrypto} from "node:crypto";
import {createSessionToken} from "../src/services/session.js";
import {monitorSpotController} from "../src/controllers/monitor-spot.js";

globalThis.crypto ??= webcrypto;
const envBase={PORTAL_KEY:"unit-test-secret"};
async function req(path,{method="GET",body,role="ADMINISTRADOR",tenant="nova-frota",auth=false}={}){
 const headers={"Content-Type":"application/json"};
 if(auth){
  const jwt=await createSessionToken(envBase,{usuario:"GESTOR",perfil:role,
   transportadoraId:tenant,expiresAt:new Date(Date.now()+60000).toISOString()});
  headers.Cookie="__Host-portal_session="+jwt;
 }
 return new Request("https://api.portalfrete.net.br"+path,{
  method,headers,body:body?JSON.stringify(body):undefined
 });
}
function fakeDB(){
 const rows=new Map(),statements=[];
 return {rows,statements,prepare(sql){
  const entry={sql,binds:[]};statements.push(entry);
  const stmt={
   bind(...args){entry.binds=args;return stmt},
   async first(){
    const a=entry.binds;
    if(sql.includes("WHERE token_hash=?"))return [...rows.values()].find(r=>r.token_hash===a[0])||null;
    return null;
   },
   async all(){
    if(sql.includes("FROM monitor_spot_requests ORDER BY"))
     return {results:[...rows.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,300)};
    return {results:[]};
   },
   async run(){
    const a=entry.binds;
    if(sql.startsWith("INSERT INTO monitor_spot_requests")){
     const [id,token_hash,referencia,placa,motorista,cliente,descarga,nf,cte,observacoes,created_by,created_at,expires_at]=a;
     rows.set(id,{id,token_hash,referencia,placa,motorista,cliente,descarga,nf,cte,
      observacoes,created_by,created_at,expires_at,lat:null,lng:null,accuracy:null,
      captured_at:null,revoked_at:null});
     return {meta:{changes:1}};
    }
    if(sql.startsWith("UPDATE monitor_spot_requests SET lat")){
     const [lat,lng,accuracy,time,hash,now]=a;
     const row=[...rows.values()].find(r=>r.token_hash===hash);
     if(!row||row.captured_at||row.revoked_at||row.expires_at<=now)return {meta:{changes:0}};
     Object.assign(row,{lat,lng,accuracy,captured_at:time});
     return {meta:{changes:1}};
    }
    if(sql.startsWith("DELETE FROM monitor_spot_requests WHERE id")){
     return {meta:{changes:rows.delete(a[0])?1:0}};
    }
    return {meta:{changes:0}};
   }
  };
  return stmt;
 }};
}
const endpoint="/v1/monitor/spot";
async function create(db,overrides={}){
 const response=await monitorSpotController(await req(endpoint+"/requests",{
  auth:true,method:"POST",body:{referencia:"Descarga soja Rio Verde",
   placa:"ABC1D23",cliente:"Cliente Privado",descarga:"Armazém GO",nf:"777",cte:"333",...overrides}
 }),{...envBase,FLEET_DB:db});
 assert.equal(response.status,201);
 return response.json();
}
test("Gera link de uso único, token apenas como hash e validade de 48h",async()=>{
 const db=fakeDB(),data=await create(db);
 assert.match(data.token,/^[a-f0-9]{64}$/);
 assert.equal(data.validHours,48);
 assert.equal(db.rows.size,1);
 const stored=[...db.rows.values()][0];
 assert.notEqual(stored.token_hash,data.token);
 assert.match(stored.token_hash,/^[a-f0-9]{64}$/);
 assert.equal(stored.placa,"ABC1D23");
 assert.equal(stored.cliente,"Cliente Privado");
 const delta=Date.parse(stored.expires_at)-Date.parse(stored.created_at);
 assert.equal(delta,48*3600000);
});
test("Consulta pública nunca devolve cliente, NF, placa ou coordenadas",async()=>{
 const db=fakeDB(),data=await create(db);
 const preview=await monitorSpotController(await req(endpoint+"/preview",{
  method:"POST",body:{token:data.token}
 }),{...envBase,FLEET_DB:db});
 assert.equal(preview.status,200);
 const json=await preview.json();
 assert.equal(json.status,"AGUARDANDO");
 for(const key of ["cliente","placa","nf","cte","lat","lng","descarga"])
  assert.equal(Object.hasOwn(json,key),false);
});
test("Ponto sem autorização ou com coordenada inválida é recusado",async()=>{
 const db=fakeDB(),data=await create(db);
 for(const body of [
  {token:data.token,latitude:-17.5,longitude:-50.9,accuracy:20},
  {token:data.token,consent:true,purpose:"ponto-descarga-v1",
   latitude:155,longitude:-50.9,accuracy:20},
  {token:data.token,consent:true,purpose:"viagem",
   latitude:-17.5,longitude:-50.9,accuracy:20}
 ]){
  const result=await monitorSpotController(await req(endpoint+"/submit",{
   method:"POST",body}),{...envBase,FLEET_DB:db});
  assert.equal(result.status,400);
 }
 assert.equal([...db.rows.values()][0].captured_at,null);
});
test("Um único ponto após consentimento, sem iniciar viagem ou salvar foto",async()=>{
 const db=fakeDB(),data=await create(db);
 const body={token:data.token,consent:true,purpose:"ponto-descarga-v1",
  latitude:-17.8012,longitude:-50.9234,accuracy:13.5};
 const first=await monitorSpotController(await req(endpoint+"/submit",{
  method:"POST",body}),{...envBase,FLEET_DB:db});
 assert.equal(first.status,200);
 const answer=await first.json();
 assert.equal(answer.received,true);
 assert.equal(answer.googleMaps,"https://www.google.com/maps?q=-17.8012,-50.9234");
 const second=await monitorSpotController(await req(endpoint+"/submit",{
  method:"POST",body:{...body,latitude:-16.9}}),{...envBase,FLEET_DB:db});
 assert.equal(second.status,409);
 assert.equal([...db.rows.values()][0].lat,-17.8012);
 const list=await monitorSpotController(await req(endpoint+"/requests",{auth:true}),{...envBase,FLEET_DB:db});
 const record=(await list.json()).requests[0];
 assert.equal(record.status,"RECEBIDO");
 assert.equal(record.googleMaps,answer.googleMaps);
 assert.equal(record.nf,"777");
 assert.equal(record.cte,"333");
});
test("Link vencido impede GPS; exclusão apaga dados e invalida o link",async()=>{
 const db=fakeDB(),data=await create(db);
 const record=[...db.rows.values()][0];
 record.expires_at=new Date(Date.now()-3600000).toISOString();
 const body={token:data.token,consent:true,purpose:"ponto-descarga-v1",
  latitude:-17,longitude:-50,accuracy:20};
 const expired=await monitorSpotController(await req(endpoint+"/submit",{
  method:"POST",body}),{...envBase,FLEET_DB:db});
 assert.equal(expired.status,410);
 record.expires_at=new Date(Date.now()+3600000).toISOString();
 const del=await monitorSpotController(await req(endpoint+"/requests/"+record.id,{
  auth:true,method:"DELETE"}),{...envBase,FLEET_DB:db});
 assert.equal(del.status,200);
 assert.equal(db.rows.size,0);
 const dead=await monitorSpotController(await req(endpoint+"/preview",{
  method:"POST",body:{token:data.token}}),{...envBase,FLEET_DB:db});
 assert.equal(dead.status,404);
});
test("Criação e listagem restritas ao monitoramento Nova Frota",async()=>{
 const db=fakeDB();
 for(const opts of [{auth:false},{auth:true,tenant:"transvale-01"},{auth:true,role:"PISO"}]){
  const res=await monitorSpotController(await req(endpoint+"/requests",opts),{...envBase,FLEET_DB:db});
  assert.ok([401,403].includes(res.status));
 }
 assert.equal(db.rows.size,0);
});
test("Página pública só solicita localização com interação e não acompanha movimento",()=>{
 const page=readFileSync(new URL("../../pages/validacao.html",import.meta.url),"utf8");
 const scripts=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length);
 for(const match of scripts)new Script(match[1]);
 assert.match(page,/button\.onclick=async/);
 assert.match(page,/navigator\.geolocation\.getCurrentPosition/);
 assert.doesNotMatch(page,/watchPosition|capture="|getUserMedia|INICIAR VIAGEM/i);
 assert.match(page,/consent:true,purpose:"ponto-descarga-v1"/);
 assert.match(page,/Não há rastreamento contínuo/i);
});
test("Central tem gerador, mapa e Google Maps separados do rastreamento",()=>{
 const page=readFileSync(new URL("../../pages/monitoramento.html",import.meta.url),"utf8");
 assert.match(page,/id="spotForm"/);
 assert.match(page,/id="spotList"/);
 assert.match(page,/id="spotMapDetails"/);
 assert.match(page,/id="spotLinkValue"/);
 assert.match(page,/localizacao-pontual\.html/);
 assert.match(page,/function syncSpotMarkers\(\)/);
 assert.match(page,/function focusSpot\(id\)/);
 assert.match(page,/google\.com\/maps\?q=/);
 const matches=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 for(const m of matches)if(m[1].trim())new Script(m[1]);
});
test("Router autoriza apenas preview/submit públicos e preserva módulo na gestão",()=>{
 const router=readFileSync(new URL("../src/router.js",import.meta.url),"utf8");
 assert.match(router,/const publicSpot=path==="\/v1\/monitor\/spot\/preview"/);
 assert.match(router,/if\(publicSpot\)return monitorSpotController\(request,env\)/);
 assert.match(router,/if \(path\.startsWith\("\/v1\/monitor\/spot\/"\)\) return monitorSpotController/);
 assert.match(router,/path\.startsWith\("\/v1\/monitor\/"\)&&!monitorPublic\.has\(path\)/);
});
