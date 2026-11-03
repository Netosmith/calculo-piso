import test from "node:test";
import assert from "node:assert/strict";
import {normalizedArtThemes,validateArtThemeUpdate,readTenantArtThemes,writeTenantArtThemes} from "../src/services/tenant-art-themes.js";

const configured={
 models:{
  modelo3:{primary:"#D01227",accent:"#181818",surface:"#F4F4F4",watermark:8},
  modelo4a:{primary:"#D01227",accent:"#202020",surface:"#FFFFFF",watermark:5},
  modelo4b:{primary:"#AB1426",accent:"#111111",surface:"#F7F7F7",watermark:10},
  modelo4c:{primary:"#A70F20",accent:"#292929",surface:"#EEEEEE",watermark:14}
 }
};
function environment(){
 const storage=new Map(),audit=[];
 return {TENANT_BRANDS:{
  async put(k,v){storage.set(k,String(v));},
  async get(k){const value=storage.get(k);return value?{text:async()=>value}:null;}
 },TENANTS_DB:{
  prepare(sql){return {bind(...params){return{
   async first(){return params[0]==="teste-01"?{id:"teste-01"}:null;},
   async run(){audit.push({sql,params});return{success:true};}
  };}};}
 },SUPER_ADMIN_BRAND_WRITES:"enabled",storage,audit};
}
function request(data){
 return new Request("https://admin.example/v1/super-admin/transportadoras/teste-01/artes",{
  method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)
 });
}
test("model palette must cover all four layouts and use safe colors only",()=>{
 assert.equal(validateArtThemeUpdate(configured),true);
 assert.equal(validateArtThemeUpdate({models:{modelo3:configured.models.modelo3}}),false);
 assert.equal(validateArtThemeUpdate({models:{...configured.models,evil:configured.models.modelo3}}),false);
 assert.equal(validateArtThemeUpdate({models:{...configured.models,modelo3:{
  ...configured.models.modelo3,accent:"red;url(//evil.test)"
 }}}),false);
 assert.equal(validateArtThemeUpdate({models:{...configured.models,modelo3:{
  ...configured.models.modelo3,watermark:50
 }}}),false);
 const clean=normalizedArtThemes(configured);
 assert.equal(clean.models.modelo3.primary,"#d01227");
 assert.equal(Object.keys(clean.models).length,4);
});
test("private R2 visual themes persist and are isolated without touching customer/Sheet data",async()=>{
 const env=environment();
 const initial=await readTenantArtThemes(env,"teste-01");
 assert.equal((await initial.json()).configured,false);
 let resp=await writeTenantArtThemes(request(configured),env,"CLOUDFLARE_OWNER","teste-01");
 assert.equal(resp.status,200);
 const result=await (await readTenantArtThemes(env,"teste-01")).json();
 assert.equal(result.configured,true);
 assert.equal(result.artes.models.modelo4c.watermark,14);
 assert.equal(env.storage.size,1);
 const key=[...env.storage.keys()][0];
 assert.equal(key,"tenant/teste-01/visual/arts-v1.json");
 assert.equal(JSON.stringify(result).includes("gatewayKey"),false);
 assert.equal(env.audit.length,1);
 assert.equal(env.audit[0].params[2],"teste-01");
 assert.equal((await readTenantArtThemes(env,"nova-frota")).status,400);
 assert.equal((await readTenantArtThemes(env,"outra-empresa")).status,404);
});
test("invalid write never modifies stored visual profile",async()=>{
 const env=environment();
 const response=await writeTenantArtThemes(request({models:{}}),env,"OWNER","teste-01");
 assert.equal(response.status,400);
 assert.equal(env.storage.size,0);
 env.SUPER_ADMIN_BRAND_WRITES="disabled";
 assert.equal((await writeTenantArtThemes(request(configured),env,"OWNER","teste-01")).status,405);
});
