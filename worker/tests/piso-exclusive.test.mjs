import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {canRunGatewayAction,hasFeature,MODULE_ACTIONS} from "../src/services/permissions.js";
import {callTenantAppScript} from "../src/services/tenant-integration.js";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("PISO denies all operational modules even when tenant grants them",async()=>{
 const session={perfil:"PISO"};
 for(const [moduleName,actions] of Object.entries(MODULE_ACTIONS)){
  for(const actionName of actions){
   const permitted=moduleName==="piso2" && ["read","calculate"].includes(actionName);
   assert.equal(canRunGatewayAction(session,moduleName,actionName,{resource:"solicitacoes"}),permitted,moduleName+"/"+actionName);
  }
 }
 assert.equal(hasFeature(session,"administrativo"),false);
 for(const moduleName of ["piso","fretes","home","administrativo","bi","piso2"]){
  const response=await callTenantAppScript({TENANT_BRANDS:{async get(){return null;}}},
    {tenant_id:"teste-01",user_id:"PISO.TESTE",role:"PISO"},
    ["piso","piso2","fretes","administrativo","bi"],
    {module:moduleName,action:"read",params:{resource:"solicitacoes"}});
  assert.equal(response.status,moduleName==="piso2"?503:403,moduleName);
 }
});

test("PISO Home hides operational data and shows only ANTT and its own cadastros",()=>{
 const html=read("pages/home.html"),auth=read("assets/js/auth.js");
 const requests=read("assets/js/home-solicitacoes-access.js");
 const tenant=read("assets/js/tenant-workspace.js");
 assert.match(html,/<body class="pf-home-pending">/);
 for(const selector of [".nf-stats",".nf-home-side",".nf-solic-wrap"]){
  assert.ok(html.includes("body.nf-profile-piso "+selector),selector);
 }
 assert.ok(html.includes('body.nf-profile-piso .nf-tools > *'));
 assert.ok(html.includes('body.nf-profile-piso.pf-piso2-allowed .nf-tools > [data-feature="piso2"]'));
 assert.ok(html.includes("Cálculo de Piso 2 (ANTT) e Solicitações de Cadastro"));
 assert.ok(html.includes('data-feature="cadastro-solicitacoes"'));
 assert.ok(auth.includes('if(feature==="cadastro-solicitacoes")return isAuthedHome()'));
 assert.ok(auth.includes('if(profile==="PISO")return isAuthedHome() && feature==="piso2"'));
 assert.ok(auth.includes('if(role==="PISO")return feature==="home" ||'));
 assert.ok(requests.includes('toUpperCase()==="PISO")return false'));
 assert.ok(tenant.includes("Acesso exclusivo ao Cálculo de Piso 2 (ANTT)"));
 assert.doesNotThrow(()=>new Script(auth));
 assert.doesNotThrow(()=>new Script(requests));
 assert.doesNotThrow(()=>new Script(tenant));
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
  assert.doesNotThrow(()=>new Script(match[1]));
 }
});

test("Calculators and support screens use updated PISO permission controls",()=>{
 for(const name of ["calculo-antt","calculo-piso","chamados"]){
  assert.match(read("pages/"+name+".html"),/auth[.]js[?]v=/);
 }
 assert.ok(read("worker/src/controllers/tenant-unified.js").includes("Perfil PISO restrito ao Calculo de Piso 2."));
});

test("PISO session never reveals other enabled tenant modules",async()=>{
 const {tenantPublicSession}=await import("../src/controllers/tenant-unified.js");
 const principal={tenant_id:"teste-01",tenant_name:"Teste",user_id:"PISO.TESTE",role:"PISO"};
 const grants=["piso","bi","fretes","administrativo","piso2"];
 assert.deepEqual(tenantPublicSession(principal,grants).modules,["piso2"]);
 assert.deepEqual(tenantPublicSession({...principal,role:"OPERACIONAL"},grants).modules,grants);
});
test("PISO page restriction uses signed session and hides preferences",()=>{
 const auth=read("assets/js/auth.js"),home=read("pages/home.html");
 assert.match(auth,/function enforcePisoPageScope\(session\)/);
 assert.ok(auth.includes('["login.html","home.html","calculo-antt.html","cadastro-solicitacoes.html"]'));
 assert.ok(auth.includes('if(getProfile()!=="PISO")shell.appendChild(settings)'));
 assert.ok(home.includes('body.nf-profile-piso #nfPrefsOpen'));
 assert.match(home,/auth[.]js[?]v=/);
});
