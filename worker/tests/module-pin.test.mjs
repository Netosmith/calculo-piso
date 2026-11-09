import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createSessionToken} from "../src/services/session.js";
import {modulePinController} from "../src/controllers/module-pin.js";
import {hasModulePin,canUsePinModule} from "../src/services/module-pin.js";
import {employeesController} from "../src/controllers/employees.js";
import {fleetController} from "../src/controllers/fleet.js";
import {portalGatewayController} from "../src/controllers/portal-gateway.js";

globalThis.crypto??=webcrypto;
const API="https://api.portalfrete.net.br";
const pass=String.fromCharCode(53,53,50,50);
const secret={PORTAL_KEY:"test-module-pin-secret"};
function kv(){
  const values=new Map();
  return {
    async get(key){return values.get(key)||null;},
    async put(key,value){values.set(key,value);},
    async delete(key){values.delete(key);}
  };
}
async function session({role="ADMINISTRADOR",tenant="nova-frota",user="LUZIANO"}={}){
  return createSessionToken(secret,{usuario:user,perfil:role,transportadoraId:tenant,
    estado:"GO",expiresAt:new Date(Date.now()+60000).toISOString()});
}
function request(path,token,{method="GET",body,cookie="",origin="https://portalfrete.net.br"}={}){
  return new Request(API+path,{method,
    headers:{"Cookie":"__Host-portal_session="+token+(cookie?"; "+cookie:""),
      "Origin":origin,"Content-Type":"application/json"},
    body:body?JSON.stringify(body):undefined});
}
async function authorize(module,token,env,code=pass){
  return modulePinController(request("/v1/module-pin/unlock",token,{
    method:"POST",body:{module,pin:code}
  }),env);
}
test("PIN é exclusivo de módulos Nova Frota e respeita permissões",async()=>{
  assert.equal(canUsePinModule({usuario:"A",perfil:"ADMINISTRADOR",transportadoraId:"nova-frota"},"funcionarios"),true);
  assert.equal(canUsePinModule({usuario:"A",perfil:"COMERCIAL",transportadoraId:"nova-frota"},"funcionarios"),false);
  assert.equal(canUsePinModule({usuario:"A",perfil:"COMERCIAL",transportadoraId:"nova-frota"},"custo-frota"),true);
  assert.equal(canUsePinModule({usuario:"A",perfil:"ADMINISTRADOR",transportadoraId:"gnova"},"custo-filial"),false);
  const tok=await session({tenant:"gnova"}),env={...secret,SESSIONS:kv()};
  assert.equal((await authorize("funcionarios",tok,env)).status,403);
  const piso=await session({role:"PISO"});
  assert.equal((await authorize("custo-frota",piso,env)).status,403);
});
test("PIN errado não gera cookie; acerto libera cada card por cookie HttpOnly",async()=>{
  const tok=await session(),env={...secret,SESSIONS:kv()};
  const first=await authorize("funcionarios",tok,env,"0000");
  assert.equal(first.status,403);
  assert.equal(first.headers.has("Set-Cookie"),false);
  const yes=await authorize("funcionarios",tok,env);
  assert.equal(yes.status,200);
  const cookie=yes.headers.get("Set-Cookie");
  assert.match(cookie,/HttpOnly/);
  assert.match(cookie,/SameSite=Strict/);
  assert.match(cookie,/Max-Age=1800/);
  const raw=cookie.split(";")[0];
  const statusReq=request("/v1/module-pin/status?module=funcionarios",tok,{cookie:raw});
  const status=await modulePinController(statusReq,env);
  assert.equal((await status.json()).unlocked,true);
  assert.equal(await hasModulePin(statusReq,env,"funcionarios"),true);
  assert.equal(await hasModulePin(statusReq,env,"custo-frota"),false);
  const newToken=await session({user:"OUTRO"});
  assert.equal(await hasModulePin(request("/v1/module-pin/status?module=funcionarios",newToken,{cookie:raw}),env,"funcionarios"),false);
});
test("limite de tentativas e origem obrigatória",async()=>{
  const tok=await session(),env={...secret,SESSIONS:kv()};
  const badOrigin=await modulePinController(request("/v1/module-pin/unlock",tok,{
    method:"POST",origin:"https://evil.example",body:{module:"funcionarios",pin:pass}
  }),env);
  assert.equal(badOrigin.status,403);
  for(let i=0;i<4;i++){
    assert.equal((await authorize("funcionarios",tok,env,"0000")).status,403);
  }
  assert.equal((await authorize("funcionarios",tok,env,"0000")).status,429);
  assert.equal((await authorize("funcionarios",tok,env)).status,429);
});
test("dados de Funcionários, Cálculo Frota e Custo Filial exigem PIN também via API",async()=>{
  const tok=await session(),env={...secret,SESSIONS:kv()};
  const employees=await employeesController(request("/v1/funcionarios",tok),env);
  assert.equal(employees.status,403);
  const fleet=await fleetController(request("/v1/fleet/records",tok),env);
  assert.equal(fleet.status,403);
  const cost=await portalGatewayController(request("/v1/gateway",tok,{
    method:"POST",body:{module:"custo-filial",action:"read",params:{resource:"all"}}
  }),env);
  assert.equal(cost.status,403);
  const unlocked=await authorize("funcionarios",tok,env);
  const granted=request("/v1/funcionarios",tok,{cookie:unlocked.headers.get("Set-Cookie").split(";")[0]});
  const withGrant=await employeesController(granted,env);
  assert.notEqual(withGrant.status,403);
});
