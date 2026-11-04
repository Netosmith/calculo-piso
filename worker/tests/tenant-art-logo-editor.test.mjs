import test from "node:test";
import assert from "node:assert/strict";
import {normalizedArtThemes,validateArtThemeUpdate,readTenantArtThemes,writeTenantArtThemes} from "../src/services/tenant-art-themes.js";

const env=()=>{
 const store=new Map();
 return {store,TENANT_BRANDS:{
  get:async key=>store.has(key)?{text:async()=>store.get(key)}:null,
  put:async(key,value)=>store.set(key,String(value))
 },TENANTS_DB:{prepare:()=>({bind:id=>({
  first:async()=>id==="transvale-01"?{id}:null,run:async()=>({success:true})
 })})},SUPER_ADMIN_BRAND_WRITES:"enabled"};
};
test("logo position is independent per art model and compatible with legacy themes",()=>{
 const old={models:{}};
 for(const [key,value] of Object.entries(normalizedArtThemes(null).models))
  old.models[key]={primary:value.primary,accent:value.accent,surface:value.surface,watermark:value.watermark};
 assert.equal(validateArtThemeUpdate(old),true);
 const m=normalizedArtThemes(old).models;
 assert.equal(m.modelo3.logoTop,4);
 assert.equal(m.modelo4a.logoTop,8);
 assert.equal(m.modelo4a.logoHeight,128);
 assert.equal(validateArtThemeUpdate({models:m}),true);
 assert.equal(validateArtThemeUpdate({models:{...m,modelo3:{...m.modelo3,logoTop:400}}}),false);
 assert.equal(validateArtThemeUpdate({models:{...m,modelo3:{...m.modelo3,logoX:"10px"}}}),false);
});
test("private logo layouts survive R2 save and never cross tenants",async()=>{
 const e=env();
 const cfg=normalizedArtThemes(null);
 cfg.models.modelo3.logoTop=-18;
 cfg.models.modelo3.logoWidth=345;
 cfg.models.modelo4b.logoX=60;
 const request=new Request("https://example.test/artes",{method:"PUT",body:JSON.stringify({models:cfg.models})});
 assert.equal((await writeTenantArtThemes(request,e,"owner","transvale-01")).status,200);
 const data=await (await readTenantArtThemes(e,"transvale-01")).json();
 assert.equal(data.artes.models.modelo3.logoTop,-18);
 assert.equal(data.artes.models.modelo3.logoWidth,345);
 assert.equal(data.artes.models.modelo4b.logoX,60);
 assert.equal(data.artes.models.modelo4a.logoX,0);
 assert.equal(e.store.size,1);
 assert.equal((await readTenantArtThemes(e,"gnova")).status,404);
});
