import test from "node:test";
import assert from "node:assert/strict";
import {cadastroAdminRead,cadastroAdminSave} from "../src/controllers/cadastro-solicitacoes.js";
const url="https://script.google.com/macros/s/"+"A".repeat(40)+"/exec";
const folder="B".repeat(30);
const key="VeryLongTenantSpecificSecretKey12345";
function env(){
 const store=new Map();
 return {store,TENANT_BRANDS:{
  async get(name){return store.has(name)?{json:async()=>JSON.parse(store.get(name))}:null;},
  async put(name,body){store.set(name,body);}
 }};
}
function request(body){return new Request("https://api.portalfrete.net.br/v1/super-admin/transportadoras/nova-frota/cadastro-drive",{
 method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
});}
test("Configuração de Drive separa segredo da resposta pública",async()=>{
 const e=env(),p={url,pasta:folder,chave:key,executores:["LUZIANO","CADASTRO-01"]};
 const response=await cadastroAdminSave(request(p),e,"nova-frota");
 assert.equal(response.status,200);
 assert.equal(e.store.size,1);
 assert.equal([...e.store.keys()][0],"tenant/nova-frota/private/cadastro-drive-v1.json");
 const text=await response.text();assert.ok(!text.includes(key));assert.ok(!text.includes(url));
 const read=await cadastroAdminRead(e,"nova-frota");
 const body=await read.json();
 assert.equal(body.ok,true);assert.equal(body.configurado,true);assert.equal(body.executores,2);
 assert.equal(body.urlConfigurada,true);assert.ok(!JSON.stringify(body).includes(key));
 assert.ok(!JSON.stringify(body).includes(url));
});
test("Valida URL e rejeita executores repetidos",async()=>{
 const e=env();
 const invalid=await cadastroAdminSave(request({url:"https://outro-site.com",pasta:folder,chave:key,executores:[]}),e,"nova-frota");
 assert.equal(invalid.status,400);assert.equal(e.store.size,0);
 const duplicate=await cadastroAdminSave(request({url,pasta:folder,chave:key,executores:["TESTE","teste"]}),e,"nova-frota");
 assert.equal(duplicate.status,400);assert.equal(e.store.size,0);
});
test("Atualização da lista de executores não precisa expor novamente a chave",async()=>{
 const e=env();
 assert.equal((await cadastroAdminSave(request({url,pasta:folder,chave:key,executores:["UM"]}),e,"nova-frota")).status,200);
 assert.equal((await cadastroAdminSave(request({url:"",pasta:"",chave:"",executores:["DOIS"]}),e,"nova-frota")).status,200);
 const v=JSON.parse([...e.store.values()][0]);
 assert.equal(v.chave,key);assert.deepEqual(v.executores,["DOIS"]);
});
