import test from 'node:test';
import assert from 'node:assert/strict';
import {lotofacilController} from '../server/lotofacil.js';

const env={APPS_SCRIPT_URL:'https://script.google.com/macros/s/test/exec',PORTAL_KEY:'__TEST_ONLY__'};
const session={usuario:'ADMINISTRADOR_TESTE'};
const numbers=Array.from({length:15},(_,i)=>i+1);
const req=(url,method='GET',body)=>new Request('https://api.portalfrete.net.br'+url,{
 method,body:body?JSON.stringify(body):undefined
});
const url='/v1/games/lotofacil/combination';
const originalFetch=globalThis.fetch;

test('Recusa carteiras com dezenas repetidas, sem chamar o Apps Script',async()=>{
 const response=await lotofacilController(req(url,'POST',{
  requestId:'a'.repeat(32),mode:'simple',method:'aleatorio',
  groups:[{size:15,numbers}, {size:15,numbers}]
 }),env,session);
 assert.equal(response.status,400);
 const data=await response.json();assert.equal(data.ok,false);
});
test('Cria, recupera e confere pelo número sequencial via ponte protegida',async()=>{
 const seen=[];
 globalThis.fetch=async(_url,options)=>{
  const p=JSON.parse(options.body);seen.push(p);
  assert.equal(p.gatewayRequest,true);
  assert.equal(p.gatewayKey,'__TEST_ONLY__');
  assert.equal(p.action,'lotofacil_bridge');
  return new Response(JSON.stringify({ok:true,combination:{
   number:11,createdAt:'2026-11-06T16:00:00Z',
   mode:'simple',method:'aleatorio',user:session.usuario,
   groups:[{size:15,numbers}],cost:3.5,status:'GERADO'
  }}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try{
  const create=await lotofacilController(req(url,'POST',{
   requestId:'b'.repeat(32),mode:'simple',method:'aleatorio',
   groups:[{size:15,numbers}]
  }),env,session);
  assert.equal(create.status,200);
  assert.equal((await create.json()).combination.number,11);
  const read=await lotofacilController(req(url+'/11'),env,session);
  assert.equal(read.status,200);
  assert.equal((await read.json()).combination.groups.length,1);
  const check=await lotofacilController(req(url+'/11/check','POST',{draw:numbers}),env,session);
  assert.equal(check.status,200);
  assert.equal(seen.length,3);
  assert.equal(seen[0].params.op,'create');
  assert.equal(seen[0].params.user,session.usuario);
  assert.equal(seen[1].params.op,'get');
  assert.equal(seen[2].params.op,'check');
 }finally{globalThis.fetch=originalFetch;}
});
