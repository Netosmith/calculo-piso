import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {webcrypto} from "node:crypto";
import {createSessionToken} from "../src/services/session.js";
import {superAdminController} from "../src/controllers/super-admin.js";
globalThis.crypto??=webcrypto;
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
test("Official page has tenant cards and four real artwork previews",()=>{
 const page=read("pages/super-admin.html");
 const preview=read("assets/js/super-admin-real-preview.js");
 for(const id of ["galleryPanel","companyCount","companySearch","companyDetail",
  "artes","artThemePanel","artModelGrid","artSave","artStatus"])
  assert.ok(page.includes('id="'+id+'"'),"Missing "+id);
 for(const key of ["modelo3","modelo4a","modelo4b","modelo4c"])
  assert.ok(page.includes(key),"Missing model "+key);
 assert.match(page,/super-admin-real-preview[.]js[?]v=/);
 assert.match(page,/divulgacao[.]css[?]v=/);
 assert.match(page,/X-Portal-Super-Admin-Action/);
 assert.match(page,/const API_BASE = 'https:\/\/api[.]portalfrete[.]net[.]br'/);
 assert.ok(preview.includes('querySelector(".templatePreview3")'));
 for(const className of ["multiArtFrete","multiArtRoute","multiArtPrice","multiArtContacts","multiArtFooter"])
  assert.ok(preview.includes(className),"Missing production artwork structure "+className);
 assert.doesNotThrow(()=>new Script(preview,{filename:"super-admin-real-preview.js"}));
 const browser=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(browser);
 assert.doesNotThrow(()=>new Script(browser,{filename:"super-admin.html"}));
});
async function req(user="LUZIANO",tenant="nova-frota",origin="https://portalfrete.net.br",marker="owner-panel"){
 const env={PORTAL_KEY:"super-admin-owner-auth-test",SUPER_ADMIN_USER:"LUZIANO",
  SUPER_ADMIN_OWNER_PORTAL_WRITES:"enabled",SUPER_ADMIN_TENANT_WRITES:"enabled"};
 const token=await createSessionToken(env,{usuario:user,transportadoraId:tenant,
  expiresAt:new Date(Date.now()+60000).toISOString()});
 const headers={Cookie:"__Host-portal_session="+token,
  Origin:origin,"X-Portal-Super-Admin-Action":marker,"Content-Type":"application/json"};
 return {env,request:new Request("https://api.portalfrete.net.br/v1/super-admin/authorize",{method:"POST",headers,body:"{}"})};
}
test("Production owner write requires signed owner session and explicit trusted browser origin",async()=>{
 const ok=await req();
 assert.equal((await superAdminController(ok.request,ok.env)).status,200);
 for(const args of [
  ["OUTRO","nova-frota","https://portalfrete.net.br","owner-panel"],
  ["LUZIANO","teste-01","https://portalfrete.net.br","owner-panel"],
  ["LUZIANO","nova-frota","https://example.test","owner-panel"],
  ["LUZIANO","nova-frota","https://portalfrete.net.br","wrong"]
 ]){
  const item=await req(...args);
  assert.equal((await superAdminController(item.request,item.env)).status,403,args.join(" | "));
 }
 const noOptIn=await req();delete noOptIn.env.SUPER_ADMIN_OWNER_PORTAL_WRITES;
 assert.equal((await superAdminController(noOptIn.request,noOptIn.env)).status,403);
});
