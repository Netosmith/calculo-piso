import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";
import {readTenantIntegration} from "../src/services/tenant-integration.js";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const UFS=["GO","MT","SP","MS","BA","PR","SC","RO","TO","MA","AC","AL","AP","AM","CE","DF","ES","MG","PA","PB","PE","PI","RJ","RN","RS","RR","SE"];

test("each optional freight base has a private route and module grant",()=>{
 const reg=read("worker/src/config/tenant-modules.js");
 const panelSource=read("worker/src/staging-page.js");
 const encoded=panelSource.match(/export const stagingPage = (".*");/s)?.[1];
 assert.ok(encoded,"Staging generated snapshot missing");
 const panel=JSON.parse(encoded);
 const loader=read("assets/js/tenant-page.js");
 const generator=read("scripts/criar-transportadora-modelo.mjs");
 for(const uf of UFS){
  const shell=read("pages/transportadora-teste/fretes-"+uf+".html");
  assert.ok(shell.includes('data-tenant-id="teste-01"'),uf);
  assert.ok(shell.includes('data-freight-base="'+uf+'"'),uf);
  assert.ok(shell.includes('data-shared-page="fretes.html"'),uf);
  assert.ok(reg.includes('"fretes-'+uf.toLowerCase()+'"'),uf);
  assert.ok(panel.includes("...FREIGHT_UFS.map"),uf);
  assert.ok(panel.includes('"' + uf + '"'),uf);
  assert.ok(generator.includes('"fretes-'+uf+'"'),uf);
 }
 assert.ok(!panel.includes("['fretes2'"),"Legacy Fretes2 must not be offered to tenant admins");
 assert.ok(panel.includes("Fretes Operacional (unificado)"));
 assert.match(loader,/const baseAlias=/);
 assert.match(loader,/session\.modules\.includes\(key\)/);
 assert.match(loader,/PORTAL_BASE_MODULE=key/);
});

test("dedicated bases never fall back to the mixed legacy Sheets integration",async()=>{
 const seen=[];
 const env={TENANT_BRANDS:{get:async key=>{
  seen.push(key);
  if(key==="tenant/teste-01/private/apps-script-v1.json")
   return {json:async()=>({scriptUrl:"https://script.google.com/macros/s/"+"a".repeat(40)+"/exec",
    spreadsheetId:"a".repeat(30),gatewayKey:"k".repeat(30),estado:"GO",enabled:true})};
  return null;
 }}};
 const result=await readTenantIntegration(env,"teste-01","SP");
 assert.equal(result,null);
 assert.deepEqual(seen,["tenant/teste-01/private/base-sp-apps-script-v1.json"]);
});

test("all 27 dedicated integrations have distinct tenant-private R2 keys",async()=>{
 const keys=[];
 const env={TENANT_BRANDS:{get:async key=>{keys.push(key);return null;}}};
 for(const uf of UFS){
  assert.equal(await readTenantIntegration(env,"teste-01",uf),null,uf);
 }
 assert.deepEqual(keys,UFS.map(uf=>
  "tenant/teste-01/private/base-"+uf.toLowerCase()+"-apps-script-v1.json"));
 assert.equal(new Set(keys).size,27);
});

test("Home and BI group by geographic origin independently of accounting source",()=>{
 const home=read("assets/js/home-map.js");
 const bi=read("assets/js/bi.js");
 const map=read("assets/js/bi-map.js");
 const cadastro=read("assets/js/cadastros.js");
 assert.match(home,/STATE\.regionalUfs/);
 assert.match(home,/const explicit = extractUf\(row\.ufOrigem\)/);
 assert.match(home,/window\.__PORTAL_TENANT_SESSION\?\.tenantMode===true/);
 const baseArray=bi.match(/const TENANT_BASES=(\[[^\]]+\]);/);
 assert.ok(baseArray,"BI missing tenant base array");
 assert.deepEqual(JSON.parse(baseArray[1]),UFS);
 assert.match(bi,/picker\.multiple=true/);
 assert.match(bi,/TODAS AS BASES/);
 assert.match(bi,/\.\.\.TENANT_BASES\.filter/);
 assert.match(map,/PORTAL_REGION_UFS/);
 assert.match(cadastro,/Estado da regional \(UF\)/);
 assert.match(cadastro,/tenantRequest\("\/regionais\/ufs"/);
});

test("super-admin has private base integration controls and legacy module stays separate",()=>{
 const owner=read("worker/src/staging-panel.js");
 const server=read("worker/src/services/tenant-integration.js");
 const router=read("worker/src/controllers/super-admin.js");
 const save=read("worker/src/services/super-admin-tenant-write.js");
 assert.match(owner,/id="integrationBase"/);
 for(const uf of UFS){
  assert.ok(owner.includes("<option>"+uf+"</option>"),"Missing Super Admin base option "+uf);
 }
 assert.match(read("assets/js/tenant-route.js"),/fretes-DF\.html/);
 assert.match(read("assets/js/tenant-route.js"),/fretes-RR\.html/);
 assert.match(owner,/baseIntegrationPath/);
 assert.match(server,/private\/base-/);
 assert.match(server,/readTenantIntegration\(env,principal\.tenant_id,base\)/);
 assert.match(server,/module:base\?"fretes":module/);
 assert.match(router,/const baseRoute=/);
 assert.match(save,/const baseIntegration=/);
});

test("Home does not collapse identical IDs from different base spreadsheets",()=>{
 const workspace=read("assets/js/tenant-workspace.js");
 assert.match(workspace,/const recordKey=source\+"::"\+id/);
 assert.match(workspace,/seen\.has\(recordKey\)/);
 assert.match(workspace,/seen\.add\(recordKey\)/);
});

test("new frontend scripts compile in Chromium-compatible JavaScript",()=>{
 for(const file of ["assets/js/home-map.js","assets/js/bi.js",
  "assets/js/bi-map.js","assets/js/tenant-workspace.js",
  "assets/js/tenant-page.js","assets/js/fretes.js","assets/js/fretes2.js",
  "assets/js/cadastros.js"]){
  assert.doesNotThrow(()=>new Script(read(file),{filename:file}),file);
 }
});
