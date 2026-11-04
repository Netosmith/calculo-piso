import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const read=path=>readFileSync(resolve(root,path),"utf8");

test("both printable freight lists load the signed tenant logo, never Nova Frota for tenants",()=>{
 for(const name of ["fretes","fretes2"]){
  const js=read("assets/js/"+name+".js");
  assert.match(js,/async function logoImpressaoDaTransportadora/);
  assert.match(js,/\/v1\/tenant\/logo/);
  assert.match(js,/reader\.readAsDataURL\(blob\)/);
  assert.match(js,/new URL\("\.\.\/assets\/img\/logo-novafrota\.png", document\.baseURI\)/);
  assert.match(js,/const brand=await logoImpressaoDaTransportadora\(\)/);
  assert.match(js,/win\.print\(\)/);
  assert.doesNotThrow(()=>new Script(js));
 }
});

test("offline order shares original layout but uses isolated company details and signed logo",()=>{
 const html=read("pages/ordem.html");
 const gnova=read("pages/transportadora-teste/ordem.html");
 assert.match(html,/const EMPRESAS_NOVA_FROTA_POR_ESTADO/);
 assert.match(html,/window\.PORTAL_ORDEM_CONFIG\?\.EMPRESAS_POR_ESTADO/);
 assert.match(html,/window\.__PORTAL_TENANT_SESSION\.transportadoraNome/);
 assert.match(html,/\/v1\/tenant\/logo/);
 assert.match(html,/ordemLogoSrc \?/);
 assert.match(gnova,/data-tenant-id="teste-01"/);
 assert.match(gnova,/data-shared-page="ordem.html"/);
 assert.match(gnova,/tenant-page[.]js[?]v=/);
 assert.doesNotMatch(gnova,/21\.984\.393/);
 assert.doesNotMatch(gnova,/novafrotalogistica\.com\.br/);
 assert.match(html,/function imprimirDuasVias/);
 assert.match(html,/function imprimirUmaVia/);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 for(const script of scripts)assert.doesNotThrow(()=>new Script(script));
});

test("new transportadoras get their own clean empty order preset",()=>{
 const generator=read("scripts/criar-transportadora-modelo.mjs");
 assert.match(generator,/if\(name==="ordem"\)/);
 assert.match(generator,/Never copy those records/);
 assert.match(generator,/cnpj:"", ie:"", endereco:"", email:""/);
});
