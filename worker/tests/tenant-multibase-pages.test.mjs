import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const BASES=["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

test("all 27 state base pages are GNOVA-only lightweight authorized aliases",()=>{
 const loader=read("assets/js/tenant-page.js");
 for(const uf of BASES){
  const page=read("pages/transportadora-teste/fretes-"+uf+".html");
  assert.match(page,/data-tenant-id="teste-01"/);
  assert.ok(page.includes('data-freight-base="'+uf+'"'));
  assert.ok(page.includes('data-shared-page="'+"fretes.html"+'"'));
  assert.ok(page.length<1000);
 }
 assert.match(loader,/session\.modules\.includes\(key\)/);
 assert.match(loader,/window\.PORTAL_BASE_MODULE=key/);
 assert.doesNotThrow(()=>new Script(loader));
});

test("base modules, owner switches and gateway permissions agree",()=>{
 const modules=read("worker/src/config/tenant-modules.js");
 const owner=read("pages/super-admin.html");
 const worker=read("worker/src/services/permissions.js");
 for(const uf of BASES){
  const module="fretes-"+uf.toLowerCase();
  assert.ok(modules.includes('"'+module+'"'),module);
  assert.ok(owner.includes("...FREIGHT_UFS.map"),module);
 }
 assert.match(worker,/MODULE_ACTIONS/);
 assert.match(worker,/fretes-/);
});

test("base Sheets are selected server-side and never by an untrusted browser URL",()=>{
 const api=read("worker/src/services/tenant-integration.js");
 const owner=read("worker/src/services/super-admin-tenant-write.js");
 assert.match(api,/base-.*apps-script-v1\.json/);
 assert.match(api,/readTenantIntegration\(env,principal\.tenant_id,base\)/);
 assert.match(api,/config\.estado!==base/);
 assert.match(owner,/bases/);
 assert.match(owner,/adminWriteTenantIntegration/);
});

test("only new companies receive a regional UF selector and multibase cards",()=>{
 const cad=read("assets/js/cadastros.js");
 const home=read("assets/js/tenant-workspace.js");
 const map=read("assets/js/home-map.js");
 assert.match(cad,/configureTenantRegionalFields/);
 assert.match(cad,/tenantMode!==true\)return/);
 assert.match(home,/renderBaseCards/);
 assert.match(home,/tenantMode/);
 assert.match(map,/regionalUfs/);
});

test("BI origin-state mapping and accounting base are independent for tenants",()=>{
 const bi=read("assets/js/bi.js");
 assert.match(bi,/tenantOriginUf/);
 assert.match(bi,/tenantRegionalUfCatalog/);
 assert.match(bi,/refreshTenantRegionalUfCatalog/);
 assert.ok(bi.includes("if(tenant)row.origemDados=sources[index]"));
 const cad=read("assets/js/cadastros.js");
 assert.match(cad,/BASES_OPERACIONAIS=\["GERAL"/);
});

test("Home only counts base modules assigned to a regional",()=>{
 const homeMap=read("assets/js/home-map.js");
 const workspace=read("assets/js/tenant-workspace.js");
 const cad=read("assets/js/cadastros.js");
 assert.match(homeMap,/assigned\.has\(accountingBase\(key\)\)/);
 assert.match(homeMap,/STATE\.regionalUfs\[key\]\?\.base/);
 assert.match(homeMap,/dispatchSummary\(STATE\.rows\.map/);
 assert.match(workspace,/selectedBases/);
 assert.match(workspace,/activeFreightModules/);
 assert.match(workspace,/totalPorta/);
 assert.match(workspace,/totalTransito/);
 assert.match(homeMap,/failedBaseSources/);
 assert.match(workspace,/failedBases/);
 // Partial data is now flagged in the short KPI footer, not in the main number.
 assert.ok(workspace.includes("base(s) indisponíveis"));
 assert.match(workspace,/failedLabels/);
 assert.match(cad,/BASES_OPERACIONAIS=\["GERAL",\.\.\.REGIONAL_UFS\]/);
});


test("Fretes Operacional is unified and MT never reuses the legacy Fretes2",()=>{
 const panel=read("pages/super-admin.html");
 const loader=read("assets/js/tenant-page.js");
 const model=read("scripts/criar-transportadora-modelo.mjs");
 assert.match(panel,/Fretes Operacional \(unificado\)/);
 assert.match(panel,/FREIGHT_UFS\.map/);
 assert.ok(!panel.includes("['fretes2'"));
 assert.ok(loader.includes('page!=="fretes.html"'));
 assert.ok(model.includes('"fretes","fretes-GO"'));
 assert.ok(!model.includes('"fretes","fretes2"'));
});
