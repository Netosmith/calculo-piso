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
 if(messages.length)console.log("Non-fatal browser diagnostics:",messages.slice(0,6));
}finally{
 if(browser)await browser.close();
 server.kill("SIGTERM");
}
