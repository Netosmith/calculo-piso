import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const pages=[
 "home","fretes","fretes2","bi","divulgacao","share-clientes",
 "controle","administrativo","cadastros","estadias","fretes-mercado",
 "embarques","chamados","patrimonio-br","relatorio","custo-filial",
 "custo-frota-pesada","monitoramento","calculo-piso","calculo-antt",
 "calculo-antt2","ordem"
];

test("tenant-specific URL aliases keep ONE common original HTML per module",()=>{
 for(const page of pages){
  const html=read("pages/transportadora-teste/"+page+".html");
  assert.match(html,/data-tenant-id="teste-01"/);
  assert.ok(html.includes('data-shared-page="'+page+'.html"'));
  assert.ok(html.includes('/assets/js/tenant-page.js'));
  assert.ok(html.length<(page==="ordem"?3000:1000),"No copied/duplicated shared HTML: "+page);
  assert.ok(read("pages/"+page+".html").length>0);
 }
});

test("tenant loader validates signed session before fetching shared HTML or using any asset",()=>{
 const loader=read("assets/js/tenant-page.js");
 assert.ok(loader.indexOf('get("https://api.portalfrete.net.br/v1/session"')<
  loader.indexOf('get("/pages/"+page'));
 assert.ok(loader.includes("session.transportadoraId!==tenant"));
 assert.ok(loader.includes("session?.tenantMode!==true"));
 assert.ok(loader.includes('window.__PORTAL_TENANT_EXPECTED=tenant'));
 assert.ok(!loader.includes("PORTAL_GATEWAY_KEY"));
 assert.ok(!loader.includes("PORTAL_SPREADSHEET_ID"));
});

test("tenant login stays in its own folder after successful and existing-session logins",()=>{
 const login=read("assets/js/tenant-login.js");
 assert.equal((login.match(/location\.replace\("\.\/home\.html"\)/g)||[]).length,2);
 assert.equal(login.includes('location.replace("../home.html")'),false);
});

test("tenant auth denies legacy module pages and preserves tenant-specific links",()=>{
 const auth=read("assets/js/auth.js");
 assert.ok(auth.includes('if(!/^\\/pages\\/'));
 assert.ok(auth.includes('window.__PORTAL_TENANT_EXPECTED'));
 assert.ok(auth.includes('window.portalTenantHref?.("home.html")'));
 const home=read("assets/js/tenant-workspace.js");
 assert.ok(home.includes('window.PortalAPI.call("home","read",{})'));
 assert.equal(home.includes('tenantRequest("/fretes")'),false);
 const map=read("assets/js/home-map.js");
 assert.ok(map.includes('window.PortalAPI.call(key,"read",{})'));
 assert.equal(map.includes('tenantRequest("/fretes")'),false);
});

test("tenant gateway selects private Sheets integration instead of public browser asset URLs",()=>{
 const api=read("assets/js/api.js");
 const gateway=read("worker/src/services/tenant-integration.js");
 assert.ok(api.includes('"/v1/tenant/gateway"'));
 assert.ok(gateway.includes('APPS_SCRIPT_URL:config.scriptUrl'));
 assert.ok(gateway.includes('PORTAL_KEY:config.gatewayKey'));
 assert.ok(gateway.includes('module==="home" && action==="read"'));
});

test("shared tenant loader uses mobile-safe DOM replacement and replays module startup",()=>{
 const loader=read("assets/js/tenant-page.js");
 assert.equal(loader.includes("document.open()"),false);
 assert.equal(loader.includes("document.write("),false);
 assert.ok(loader.includes("new DOMParser().parseFromString(html"));
 assert.ok(loader.includes("document.documentElement.innerHTML="));
 assert.ok(loader.includes("document.createElement(\"script\")"));
 assert.ok(loader.includes("cloned.async=false"));
 assert.ok(loader.includes("document.dispatchEvent(new Event(\"DOMContentLoaded\""));
 assert.ok(loader.includes("session.transportadoraId!==tenant"));
 for(const page of pages){
  const alias=read("pages/transportadora-teste/"+page+".html");
  assert.ok(alias.includes('/assets/js/tenant-page.js?v=8'));
 }
});

test("shared page loader and tenant link/brand scripts compile in browser JavaScript",()=>{
 for(const path of ["assets/js/tenant-page.js","assets/js/tenant-route.js",
  "assets/js/tenant-login.js","assets/js/tenant-workspace.js"]){
  assert.doesNotThrow(()=>new Script(read(path),{filename:path}),path);
 }
});

test("tenant Home stays hidden until authenticated company rendering completes",()=>{
 const loader=read("assets/js/tenant-page.js");
 const brand=read("assets/js/tenant-route.js");
 const workspace=read("assets/js/tenant-workspace.js");
 assert.ok(loader.includes('document.documentElement.setAttribute("data-pf-tenant-boot","1")'));
 assert.ok(loader.includes('body{visibility:hidden!important}'));
 assert.ok(loader.includes('document.documentElement.removeAttribute("data-pf-tenant-boot")'));
 assert.ok(loader.includes("await window.portalAuthReady"));
 assert.ok(brand.includes("const companyName=String(window.__PORTAL_TENANT_SESSION?.transportadoraNome"));
 assert.ok(brand.includes("img.hidden=true;img.style.display=\"none\";"));
 assert.ok(brand.includes('img.nfM3Logo,img.nfM4Logo,img.m3Logo,img.multiArtLogo'));
 assert.ok(workspace.includes('set("homeSub","Visão geral da operação | "+session.transportadoraNome'));
 assert.equal(workspace.includes("tenantLogoUrl"),false);
});
test("Fretes and Fretes MT never prefill transportadora directories from GitHub",()=>{
 const go=read("assets/js/fretes.js");
 const mt=read("assets/js/fretes2.js");
 assert.ok(go.includes("let DIRECTORY = emptyDirectory()"));
 assert.ok(go.includes("DIRECTORY = novosCadastros"));
 assert.ok(go.includes("DIRECTORY = emptyDirectory()"));
 for(const js of [go,mt]){
  assert.ok(js.includes("FILIAIS_CONTATOS_ARTE = Object.freeze({})"));
  assert.equal(js.includes("5564999794586"),false);
  assert.equal(js.includes('MINEIROS: [{ nome:'),false);
 }
 assert.equal(go.includes('regionais: ["GOIAS"'),false);
 assert.ok(mt.includes("window.__PORTAL_TENANT_SESSION?.tenantMode===true"));
 const div=read("assets/js/divulgacao.js");
 assert.ok(div.includes("if(isTenant)void carregarFiliaisTenant()"));
 assert.ok(div.includes("isTenant ? [] : (FILIAIS_CONTATOS[key] || [])"));
});
