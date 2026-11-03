import test from "node:test";
import assert from "node:assert/strict";
import {validScriptUrl,readTenantIntegration,adminReadTenantIntegration,
 adminWriteTenantIntegration,callTenantAppScript} from "../src/services/tenant-integration.js";

const url="https://script.google.com/macros/s/"+"A".repeat(75)+"/exec";
const sheet="1"+"S".repeat(43);
const gatewayKey="separate-test-tenant-portal-key-00000001";
function environment(){
 const objects=new Map(),events=[];
 const db={
  prepare(sql){
   return{bind(...args){return{
     async first(){return args[0]==="teste-01"?{id:"teste-01"}:null;},
     async run(){events.push({sql,params:args});return{success:true};}
   };}};
  }
 };
 return {TENANT_BRANDS:{
   async get(k){const data=objects.get(k);return data?{json:async()=>JSON.parse(data)}:null;},
   async put(k,value){objects.set(k,value);}
  },TENANTS_DB:db,events,objects};
}
const config={scriptUrl:url,spreadsheetId:sheet,gatewayKey,estado:"GO",enabled:false};
function request(body){return new Request("https://admin.example/v1/super-admin/transportadoras/teste-01/integracao",
 {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}
test("Apps Script source is allowlisted against SSRF and URL embedding",()=>{
 assert.equal(validScriptUrl(url),true);
 for(const invalid of ["http://script.google.com/macros/s/ABC/exec",
  "https://script.google.com.evil.example/macros/s/ABC/exec",
  "https://script.google.com/macros/s/ABC/exec?redirect=https://evil.test",
  "https://localhost/macros/s/AKfycbx/exec","https://script.google.com/macros/s/invalid/exec"]){
   assert.equal(validScriptUrl(invalid),false,invalid);
 }
});
test("owner can save private tenant configuration, read summary without secret, and enable after review",async()=>{
 const env=environment();
 const direct=await adminWriteTenantIntegration(request({...config,enabled:true}),env,"OWNER","teste-01");
 assert.equal(direct.status,409);
 let response=await adminWriteTenantIntegration(request(config),env,"OWNER","teste-01");
 assert.equal(response.status,200);
 const read=await adminReadTenantIntegration(env,"teste-01");
 const data=await read.json();
 assert.equal(data.integracao.configured,true);
 assert.equal(data.integracao.enabled,false);
 assert.equal(data.integracao.spreadsheetId,sheet);
 assert.equal(JSON.stringify(data).includes(url),false);
 assert.equal(JSON.stringify(data).includes(gatewayKey),false);
 const invalid=await adminWriteTenantIntegration(request({...config,scriptUrl:"https://evil.test"}),env,"OWNER","teste-01");
 assert.equal(invalid.status,400);
 const enabled=await adminWriteTenantIntegration(request({enabled:true,spreadsheetId:sheet,estado:"GO"}),env,"OWNER","teste-01");
 assert.equal(enabled.status,200);
 assert.equal((await readTenantIntegration(env,"teste-01")).enabled,true);
 assert.equal(env.events.length,2);
 assert.equal((await adminReadTenantIntegration(env,"nova-frota")).status,400);
});
test("tenant gateway rejects foreign, disabled and unauthorized modules before remote call",async()=>{
 const env=environment();
 assert.equal((await callTenantAppScript(env,
  {tenant_id:"teste-01",user_id:"USUARIO.TESTE",role:"OPERACIONAL"},["fretes"],
  {module:"cadastros",action:"read",params:{}})).status,403);
 assert.equal((await callTenantAppScript(env,
  {tenant_id:"teste-01",user_id:"USUARIO.TESTE",role:"OPERACIONAL"},["fretes"],
  {module:"fretes",action:"read",params:{}})).status,503);
 await adminWriteTenantIntegration(request(config),env,"OWNER","teste-01");
 assert.equal((await callTenantAppScript(env,
  {tenant_id:"teste-01",user_id:"USUARIO.TESTE",role:"OPERACIONAL"},["fretes"],
  {module:"fretes",action:"read",params:{}})).status,503);
 assert.equal((await callTenantAppScript(env,
  {tenant_id:"outra-empresa",user_id:"USUARIO.TESTE",role:"OPERACIONAL"},["fretes"],
  {module:"fretes",action:"read",params:{}})).status,503);
});
test("enabled tenant gateway posts ONLY to its own Apps Script endpoint with own gateway key",async()=>{
 const env=environment();
 await adminWriteTenantIntegration(request(config),env,"OWNER","teste-01");
 await adminWriteTenantIntegration(request({enabled:true,spreadsheetId:sheet,estado:"GO"}),env,"OWNER","teste-01");
 const previous=globalThis.fetch,observed=[];
 globalThis.fetch=async(requestUrl,options)=>{
   observed.push({url:requestUrl,payload:JSON.parse(options.body)});
   return new Response(JSON.stringify({ok:true,data:{rows:[]}}),{status:200,headers:{"Content-Type":"application/json"}});
 };
 try{
  const r=await callTenantAppScript(env,{tenant_id:"teste-01",user_id:"USUARIO.TESTE",role:"OPERACIONAL"},
   ["fretes"],{module:"fretes",action:"read",params:{resource:"fretes"}});
  const data=await r.json();
  assert.equal(r.status,200);
  assert.equal(data.ok,true);
  assert.equal(observed.length,1);
  assert.equal(observed[0].url,url);
  assert.equal(observed[0].payload.gatewayKey,gatewayKey);
  assert.equal(observed[0].payload.params.auth.usuario,"USUARIO.TESTE");
  assert.equal(observed[0].payload.params.auth.estado,"GO");
  assert.equal(JSON.stringify(data).includes(gatewayKey),false);
 }finally{globalThis.fetch=previous;}
});
