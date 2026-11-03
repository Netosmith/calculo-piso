import test from "node:test";
import assert from "node:assert/strict";
import {Script} from "node:vm";
import {stagingPanelHtml} from "../src/staging-panel.js";

test("owner panel includes private tenant integration settings and valid inline script",()=>{
 const html=stagingPanelHtml();
 for(const id of ["integrationPanel","integrationSheetId","integrationUrl",
  "integrationKey","integrationUf","integrationGenerate","integrationEnabled","integrationSave"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,"inline owner script");
 assert.doesNotThrow(()=>new Script(match[1]));
 assert.ok(match[1].includes("async function loadIntegration"));
 assert.ok(match[1].includes("sessionStorage.getItem(SELECTED_KEY)"));
 assert.ok(match[1].includes("rememberSelectedCompany(company.id)"));
 assert.ok(match[1].includes("selectedFromThisBrowser())||companies[0]"));
 assert.ok(match[1].includes("loadBrand();loadIntegration();"));
 assert.ok(match[1].includes("scriptUrlConfigured"));
 assert.ok(match[1].includes("Chave salva com segurança"));
 assert.ok(match[1].includes("gravação não pôde ser confirmada")||
   match[1].includes("A gravação não pôde ser confirmada"));
 assert.ok(match[1].includes("async function setTenantPassword"));
 assert.doesNotMatch(html,/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,}\/exec/);
});
