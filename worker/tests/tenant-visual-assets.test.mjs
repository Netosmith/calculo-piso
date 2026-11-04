import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {readTenantVisual,writeTenantVisual,TENANT_VISUAL_SLOTS}
 from "../src/services/tenant-visual-assets.js";
const load=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
function mock(){
 const objects=new Map(),events=[],rows=new Map([
  ["teste-01",{id:"teste-01",logo_key:"tenant/teste-01/logo/old.png"}],
  ["outra-empresa",{id:"outra-empresa",logo_key:null}]
 ]);
 objects.set("tenant/teste-01/logo/old.png",{
  bytes:new Uint8Array([137,80,78,71,13,10,26,10,1]),
  mime:"image/png"
 });
 const env={SUPER_ADMIN_BRAND_WRITES:"enabled",TENANT_BRANDS:{
  async put(key,bytes,options){objects.set(key,{bytes:new Uint8Array(bytes),mime:options.httpMetadata.contentType});},
  async get(key){
   const result=objects.get(key);return result?{
    body:result.bytes,httpMetadata:{contentType:result.mime}
   }:null;
  }
 },TENANTS_DB:{
  prepare(sql){
   return {bind(...args){return{
    first:async()=>rows.get(args[0])||null,
    run:async()=>{events.push({sql,args});return {success:true};}
   };}};
  }
 }};
 return {env,objects,events,rows};
}
const png=new Uint8Array([137,80,78,71,13,10,26,10,10]);
const jpeg=new Uint8Array([255,216,255,224,0,1,1]);
const webp=new Uint8Array([82,73,70,70,1,0,0,0,87,69,66,80,2]);
const put=(env,tenant,slot,bytes,mime)=>writeTenantVisual(
 new Request("https://example.org/visual/"+slot,{method:"PUT",
 headers:{"Content-Type":mime},body:bytes}),env,"LUZIANO",tenant,slot);
test("Brand slots store independent private R2 assets for each company",async()=>{
 const {env,objects,events,rows}=mock();
 assert.deepEqual(TENANT_VISUAL_SLOTS,["logo-dark","logo-light","hero-art","hero-home"]);
 for(const [slot,file,mime] of [
  ["logo-light",png,"image/png"],
  ["hero-art",jpeg,"image/jpeg"],
  ["hero-home",webp,"image/webp"]
 ])assert.equal((await put(env,"teste-01",slot,file,mime)).status,200,slot);
 assert.equal(objects.size,4,"existing Logo 1 and 3 new slots");
 assert.equal(rows.get("teste-01").logo_key,"tenant/teste-01/logo/old.png",
  "previous dark logo key must not be modified");
 for(const slot of ["logo-light","hero-art","hero-home"]){
  const response=await readTenantVisual(env,"teste-01",slot);
  assert.equal(response.status,200);
  assert.equal(response.headers.get("Cache-Control"),"private, no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff");
  assert.equal((await readTenantVisual(env,"outra-empresa",slot)).status,404);
 }
 assert.equal((await readTenantVisual(env,"teste-01","logo-dark")).status,200);
 assert.equal(events.length,3);
 assert.ok(events.every(e=>e.args[1]==="LUZIANO"&&e.args[2]==="teste-01"));
});
test("Security: no Nova Frota modification, no invalid MIME, oversized assets or path traversal",async()=>{
 const {env,objects}=mock(),before=objects.size;
 assert.equal((await put(env,"nova-frota","hero-art",png,"image/png")).status,400);
 assert.equal((await put(env,"teste-01","../../users",png,"image/png")).status,400);
 assert.equal((await put(env,"evil/tenant","hero-home",png,"image/png")).status,400);
 assert.equal((await put(env,"teste-01","hero-home",png,"image/svg+xml")).status,415);
 assert.equal((await put(env,"teste-01","hero-home",png,"image/jpeg")).status,415);
 assert.equal((await put(env,"teste-01","logo-light",new Uint8Array(2097153),"image/png")).status,413);
 env.SUPER_ADMIN_BRAND_WRITES="disabled";
 assert.equal((await put(env,"teste-01","hero-home",jpeg,"image/jpeg")).status,405);
 assert.equal(objects.size,before);
});
test("Art previews and tenant Home use separate sources with fallback, current Logo 1 untouched",()=>{
 const route=load("assets/js/tenant-route.js"),art=load("assets/js/art-hero.js"),
   page=load("pages/home.html"),admin=load("pages/super-admin.html"),
   owner=load("worker/src/controllers/tenant-unified.js"),
   write=load("worker/src/services/super-admin-tenant-write.js");
 for(const slot of ["logo-light","hero-art","hero-home"]){
  assert.ok(admin.includes('data-visual-save="'+slot+'"'));
  assert.ok(admin.includes('data-visual-preview="'+slot+'"'));
  assert.ok(admin.includes('data-visual-file="'+slot+'"'));
  assert.ok(route.includes('"'+slot+'"'));
 }
 assert.ok(admin.includes('id="brandFile"'));
 assert.ok(admin.includes('id="uploadLogo"'));
 assert.ok(route.includes('.nf-dashboard > .nf-bg-image'));
 assert.ok(route.includes(".multiArtHeroImg"));
 assert.ok(route.includes("pf-home-light-logo"));
 assert.ok(art.includes("window.portalTenantVisualReady"));
 assert.ok(art.includes("setSource"));
 assert.ok(owner.includes("readTenantVisual(env,principal.tenant_id,visual[1])"));
 assert.ok(write.includes("writeTenantVisual(request,env,actor,visual[1],visual[2])"));
 assert.match(page,/\.nf-bg-image\{/);
 assert.doesNotThrow(()=>new Script(route));
 assert.doesNotThrow(()=>new Script(art));
 const scripts=[...admin.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length);
 for(const match of scripts)assert.doesNotThrow(()=>new Script(match[1]));
});
