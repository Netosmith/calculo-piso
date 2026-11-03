// Browser smoke for the shared HTML loader. No real login or Sheets data.
import {createRequire} from "node:module";
import {spawn} from "node:child_process";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {existsSync} from "node:fs";
import assert from "node:assert/strict";

const require=createRequire(import.meta.url);
const {chromium}=require("/tmp/portal-browser/node_modules/playwright-core");
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const port=19733;
const origin="http://127.0.0.1:"+port;
const chrome=["/usr/bin/google-chrome","/usr/bin/google-chrome-stable",
 "/usr/bin/chromium"].find(existsSync);
if(!chrome)throw new Error("Chrome/Chromium unavailable in runner");
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1"],{
 cwd:root,stdio:"ignore"
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
try{
 for(let i=0;i<25;i++){
  try{const response=await fetch(origin+"/pages/transportadora-teste/fretes.html");
   if(response.ok)break;
  }catch(_){}
  if(i===24)throw new Error("Local server did not start");
  await sleep(150);
 }
 browser=await chromium.launch({headless:true,executablePath:chrome,args:["--no-sandbox"]});
 const context=await browser.newContext({locale:"pt-BR"});
 const page=await context.newPage();
 const messages=[];
 page.on("pageerror",err=>messages.push(err?.message||"pageerror"));
 page.on("console",msg=>{if(msg.type()==="error")messages.push(msg.text().slice(0,180));});
 await page.route("https://api.portalfrete.net.br/**",async route=>{
  const req=route.request(),url=new URL(req.url());
  const headers={
   "access-control-allow-origin":origin,
   "access-control-allow-credentials":"true",
   "access-control-allow-methods":"GET,POST,OPTIONS",
   "access-control-allow-headers":"Content-Type, Authorization, Accept",
   "content-type":"application/json"
  };
  if(req.method()==="OPTIONS"){
   await route.fulfill({status:204,headers,body:""});return;
  }
  if(url.pathname==="/v1/session"||url.pathname==="/v1/tenant/me"){
   await route.fulfill({status:200,headers,body:JSON.stringify({ok:true,session:{
    usuario:"TESTE",nome:"TESTE",perfil:"ADMINISTRADOR",
    estado:"GERAL",estados:["GERAL"],tenantMode:true,
    transportadoraId:"teste-01",transportadoraNome:"NOVA FROTA ADMIN",
    modules:["fretes","fretes2","bi","cadastros","divulgacao","controle"]
   }})});return;
  }
  if(url.pathname==="/v1/tenant/catalogo/clientes"){
   await route.fulfill({status:200,headers,body:JSON.stringify({
    ok:true,clientes:[{id:"global:CLIENTE MODELO",cliente:"CLIENTE MODELO",ativo:"SIM",ordem:1}]
   })});return;
  }
  if(url.pathname==="/v1/tenant/artes"){
   const model={primary:"#bb1122",accent:"#181818",surface:"#eeeeee",watermark:8};
   await route.fulfill({status:200,headers,body:JSON.stringify({ok:true,
    artes:{version:1,models:{modelo3:model,modelo4a:model,modelo4b:model,modelo4c:model}}
   })});return;
  }
  if(url.pathname==="/v1/tenant/logo"){
   await route.fulfill({status:404,headers,body:JSON.stringify({ok:false,error:"No logo"})});return;
  }
  await route.fulfill({status:200,headers,
   body:JSON.stringify({ok:true,data:{ok:true,data:[]}})});
 });
 for(const domain of ["fonts.googleapis.com","fonts.gstatic.com","cdn.jsdelivr.net",
  "cdnjs.cloudflare.com","html2canvas.hertzen.com","unpkg.com"]){
  await page.route("https://"+domain+"/**",r=>r.abort());
 }
 await page.goto(origin+"/pages/transportadora-teste/fretes.html",{waitUntil:"domcontentloaded"});
 try{
  await page.waitForFunction(()=>Boolean(document.querySelector("a.burger")) &&
   !document.body.textContent.includes("Validando sessão da transportadora"),null,{timeout:12000});
 }catch(error){
  const pageState=await page.evaluate(()=>({
   href:location.href,title:document.title,stage:document.body?.textContent?.slice(0,800),
   scripts:[...document.querySelectorAll("script[src]")].slice(0,8).map(x=>x.src),
   tenantExpected:window.__PORTAL_TENANT_EXPECTED,
   sessionTenant:window.__PORTAL_TENANT_SESSION?.transportadoraId
  }));
  console.error("TENANT BROWSER FAILURE",JSON.stringify({pageState,messages:messages.slice(-18)}));
  throw error;
 }
 await page.waitForFunction(()=>{
  const link=document.querySelector("a.burger");
  return link?.getAttribute("href")==="/pages/transportadora-teste/home.html";
 },null,{timeout:10000});
 const state=await page.evaluate(()=>({
  url:location.pathname,tenant:window.__PORTAL_TENANT_EXPECTED,
  expected:window.__PORTAL_TENANT_SESSION?.transportadoraId,
  hasFretes:!!document.querySelector(".topbar"),
  badText:document.body.textContent.includes("Não foi possível abrir o aplicativo"),
  home:document.querySelector("a.burger")?.getAttribute("href")
 }));
 assert.equal(state.url,"/pages/transportadora-teste/fretes.html");
 assert.equal(state.tenant,"teste-01");
 assert.equal(state.expected,"teste-01");
 assert.equal(state.hasFretes,true);
 assert.equal(state.badText,false);
 assert.equal(state.home,"/pages/transportadora-teste/home.html");
 console.log("CHROME TENANT PAGE SMOKE OK",JSON.stringify(state));
 await page.locator("#btnNew").click();
 try{
  await page.waitForFunction(()=>{
   const values=[...document.querySelectorAll("#mCliente option")]
     .map(x=>x.value).filter(Boolean);
   return values.includes("CLIENTE MODELO");
  },null,{timeout:10000});
 }catch(error){
  const debug=await page.evaluate(()=>({
   clienteOptions:[...document.querySelectorAll("#mCliente option")].map(x=>x.value),
   sync:document.querySelector("#syncStatus")?.textContent,
   tenant:window.__PORTAL_TENANT_SESSION?.transportadoraId,
   portalApi:typeof window.PortalAPI?.tenantRequest,
   popup:document.querySelector("#nfModal")?.className,
   isModalOpen:document.querySelector("#mRegional")?.offsetParent!==null
  }));
  console.error("SHARED CLIENT CATALOG DIAGNOSTIC",JSON.stringify({debug,messages:messages.slice(-20)}));
  throw error;
 }
 const freightForm=await page.evaluate(()=>({
  regionais:[...document.querySelectorAll("#mRegional option")].map(x=>x.value).filter(Boolean),
  filiais:[...document.querySelectorAll("#mFilial option")].map(x=>x.value).filter(Boolean),
  clientes:[...document.querySelectorAll("#mCliente option")].map(x=>x.value).filter(Boolean),
  contatos:[...document.querySelectorAll("#mContato option")].map(x=>x.value).filter(Boolean),
  headerName:document.querySelector(".topbar .brand .pf-company-name")?.textContent,
  headerLogoVisible:[...document.querySelectorAll(".topbar .brand img")].some(img=>
   img.getClientRects().length>0 && getComputedStyle(img).visibility!=="hidden")
 }));
 for(const key of ["regionais","filiais","contatos"])
  assert.deepEqual(freightForm[key],[],"Empty tenant Sheets must not inherit "+key);
 assert.deepEqual(freightForm.clientes,["CLIENTE MODELO"],
  "The only client option should come from the approved shared catalog");
 assert.equal(freightForm.headerName,"NOVA FROTA ADMIN");
 assert.equal(freightForm.headerLogoVisible,false);
 console.log("FRETES EMPTY SHEETS AND NAME-ONLY HEADER OK");

 await page.goto(origin+"/pages/transportadora-teste/home.html",{waitUntil:"domcontentloaded"});
 try{
  await page.waitForFunction(()=>
   document.documentElement.getAttribute("data-pf-tenant-boot")===null &&
   document.querySelector(".nf-brand .pf-company-name")?.textContent==="NOVA FROTA ADMIN" &&
   document.getElementById("homeSub")?.textContent?.includes("NOVA FROTA ADMIN"),null,{timeout:20000});
 }catch(error){
  const debug=await page.evaluate(()=>({
   url:location.href,title:document.title,
   waiting:document.documentElement.getAttribute("data-pf-tenant-boot"),
   markup:document.body?.textContent?.slice(0,400),
   header:document.querySelector(".nf-brand")?.outerHTML?.slice(0,500),
   homeSub:document.getElementById("homeSub")?.textContent,
   session:window.__PORTAL_TENANT_SESSION?.transportadoraId,
   scripts:document.querySelectorAll("script[src]").length
  }));
  console.error("TENANT HOME DIAGNOSTIC",JSON.stringify({debug,messages:messages.slice(-15)}));
  throw error;
 }
 const homeState=await page.evaluate(()=>({
  path:location.pathname,loading:document.documentElement.hasAttribute("data-pf-tenant-boot"),
  brand:document.querySelector(".nf-brand .pf-company-name")?.textContent,
  logoVisible:[...document.querySelectorAll(".nf-brand img")].some(img=>
   img.getClientRects().length>0 && getComputedStyle(img).visibility!=="hidden"),
  sessionCompany:window.__PORTAL_TENANT_SESSION?.transportadoraNome,
  cards:[...document.querySelectorAll(".nf-tools a.nf-tool[data-feature]")]
    .filter(x=>getComputedStyle(x).display!=="none").map(x=>x.dataset.feature)
 }));
 assert.equal(homeState.path,"/pages/transportadora-teste/home.html");
 assert.equal(homeState.loading,false);
 assert.equal(homeState.brand,"NOVA FROTA ADMIN");
 assert.equal(homeState.logoVisible,false);
 assert.equal(homeState.sessionCompany,"NOVA FROTA ADMIN");
 console.log("HOME TENANT NO-GHOST AND NAME-ONLY HEADER OK",JSON.stringify(homeState));
 const colors=await page.evaluate(()=>{
  const label=document.querySelector(".nf-brand .pf-company-name");
  document.documentElement.dataset.nfTheme="claro";
  const light=getComputedStyle(label).color;
  document.documentElement.dataset.nfTheme="escuro";
  const dark=getComputedStyle(label).color;
  return {light,dark};
 });
 assert.equal(colors.light,"rgb(16, 45, 84)");
 assert.equal(colors.dark,"rgb(255, 255, 255)");
 console.log("HOME HEADER THEME COLORS OK",JSON.stringify(colors));

 await page.goto(origin+"/pages/transportadora-teste/controle.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>
  !!document.getElementById("gridFiliais") &&
  document.documentElement.getAttribute("data-pf-tenant-boot")===null &&
  !!document.getElementById("pfTenantControleCss"),null,{timeout:24000});
 const control=await page.evaluate(()=>({
  url:location.pathname,
  cssLoaded:!!document.getElementById("pfTenantControleCss")?.sheet,
  grid:getComputedStyle(document.querySelector("#view-dashboard .grid")).display,
  controlMenu:!!document.getElementById("nfGlobalShell"),
  company:document.querySelector(".nf-global-nav-standalone-brand .pf-company-name")?.textContent,
  companyColor:document.querySelector(".nf-global-nav-standalone-brand .pf-company-name")?
    getComputedStyle(document.querySelector(".nf-global-nav-standalone-brand .pf-company-name")).color:null,
  noTailwindPlay:!document.querySelector('script[src*="cdn.tailwindcss.com"]')
 }));
 assert.equal(control.url,"/pages/transportadora-teste/controle.html");
 assert.equal(control.cssLoaded,true,"Local Tailwind CSS must load");
 assert.equal(control.grid,"grid");
 assert.equal(control.company,"NOVA FROTA ADMIN");
 assert.equal(control.companyColor,"rgb(255, 255, 255)");
 assert.equal(control.noTailwindPlay,true);
 console.log("CONTROLE SELF HOSTED CSS AND TITLE OK",JSON.stringify(control));

 await page.goto(origin+"/pages/transportadora-teste/ordem.html",{waitUntil:"domcontentloaded"});
 try{
  await page.waitForFunction(()=>
   document.documentElement.getAttribute("data-pf-tenant-boot")===null &&
   !!document.querySelector("#pfTenantOrdemCss"),null,{timeout:12000});
 }catch(error){
  const debug=await page.evaluate(()=>({
   href:location.href,boot:document.documentElement.getAttribute("data-pf-tenant-boot"),
   title:document.title,body:document.body?.textContent?.slice(0,500),
   stylesheet:!!document.querySelector("#pfTenantOrdemCss"),
   scripts:[...document.querySelectorAll("script[src]")].slice(0,12).map(x=>x.src),
   tenant:window.__PORTAL_TENANT_SESSION?.transportadoraId
  }));
  console.error("ORDEM TENANT DIAGNOSTIC",JSON.stringify({debug,messages:messages.slice(-18)}));
  throw error;
 }
 const order=await page.evaluate(()=>({
  path:location.pathname,
  localStyles:!!document.querySelector("#pfTenantOrdemCss")?.sheet,
  layout:document.querySelector("main")?getComputedStyle(document.querySelector("main")).display:"",
  noTailwindPlay:!document.querySelector('script[src*="cdn.tailwindcss.com"]'),
  company:document.querySelector(".nf-global-nav-standalone-brand .pf-company-name")?.textContent
 }));
 assert.equal(order.path,"/pages/transportadora-teste/ordem.html");
 assert.equal(order.localStyles,true);
 assert.equal(order.layout,"flex");
 assert.equal(order.noTailwindPlay,true);
 assert.equal(order.company,"NOVA FROTA ADMIN");
 console.log("ORDEM SELF HOSTED CSS AND BRANDING OK",JSON.stringify(order));

 await page.goto(origin+"/pages/transportadora-teste/divulgacao.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Boolean(document.querySelector(".templatePreview3")) &&
  Boolean(document.getElementById("pfTenantArtTheme")) &&
  document.querySelector(".m3HeroImg")?.complete &&
  document.querySelector(".m3HeroImg")?.naturalWidth>0,null,{timeout:20000});
 await page.evaluate(async()=>{await window.portalTenantArtThemeReady;});
 const art=await page.evaluate(()=>{
  const root=document.querySelector(".templatePreview3");
  const pick=selector=>{
   const element=document.querySelector(selector);
   return element?{bg:getComputedStyle(element).backgroundColor,
    text:getComputedStyle(element).color}:null;
  };
  return {
   theme:getComputedStyle(root).getPropertyValue("--pf-art-primary").trim(),
   logoFreeHero:document.querySelector(".m3HeroImg")?.currentSrc,
   heroWidth:document.querySelector(".m3HeroImg")?.naturalWidth,
   origin:pick(".m3RouteLabel"),
   value:pick(".m3PriceCard"),
   valueTitle:pick(".m3PriceLabel"),
   footer:pick(".m3Footer"),
   whatsapp:pick(".m3WhatsappIcon"),
   headline:pick(".m3Headline>span"),
   headlineAccent:pick(".m3Headline>strong"),
   surface:pick(".m3Content"),
   multi:pick(".multiArt.count-2 .multiArtPrice"),
   model4Configured:document.getElementById("pfTenantArtTheme")?.textContent
    .includes("body.pf-tenant-site .multiArt.count-2{--pf-art-primary:#bb1122;--pf-art-accent:#181818")
  };
 });
 assert.equal(art.theme,"#bb1122");
 assert.ok(art.logoFreeHero?.endsWith("/assets/img/divulgacao/hero-global.jpg"));
 assert.equal(art.heroWidth,1264);
 for(const selector of ["origin","valueTitle","footer","headline"])
  assert.equal(art[selector]?.bg==="rgb(187, 17, 34)"||art[selector]?.text==="rgb(187, 17, 34)",true,
   "Model 3 primary color not applied to "+selector);
 for(const selector of ["value","whatsapp","headlineAccent"])
  assert.equal(art[selector]?.bg==="rgb(24, 24, 24)"||art[selector]?.text==="rgb(24, 24, 24)",true,
   "Model 3/4 accent color not applied to "+selector);
 assert.equal(art.surface?.bg,"rgb(238, 238, 238)");
 assert.equal(art.model4Configured,true,"Model 4 palette must be ready even if the user has not opened its editor yet");
 if(art.multi){
  assert.equal(art.multi.bg==="rgb(24, 24, 24)"||
   art.multi.text==="rgb(24, 24, 24)",true,"Model 4 accent color");
 }
 console.log("GLOBAL ART HERO AND COMPLETE TENANT MODEL 3/4 PALETTE OK",JSON.stringify(art));



 if(messages.length)console.log("Non-fatal browser diagnostics:",messages.slice(0,6));
}finally{
 if(browser)await browser.close();
 server.kill("SIGTERM");
}
