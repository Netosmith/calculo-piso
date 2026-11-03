import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {stagingPanelHtml} from "../../worker/src/staging-panel.js";
const require=createRequire(import.meta.url);
const {chromium}=require("/tmp/portal-browser/node_modules/playwright-core");

const chrome=["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"];
const {existsSync}=await import("node:fs");
const executablePath=chrome.find(existsSync);
if(!executablePath)throw Error("Chromium unavailable");
const browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox"]});
const origin="http://127.0.0.1:19444";
const schemes={
  version:1,models:Object.fromEntries(
   ["modelo3","modelo4a","modelo4b","modelo4c"].map(model=>
    [model,{primary:"#113c70",accent:"#08a968",surface:"#f4f8fb",watermark:8}])
  )
};
let saved=null,putCount=0;
try{
 const context=await browser.newContext();
 const page=await context.newPage();
 const errors=[];page.on("pageerror",err=>errors.push(err.message));
 await page.route("**/*",async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  const json=value=>({status:200,contentType:"application/json",body:JSON.stringify(value)});
  if(path==="/super-admin"){
   await route.fulfill({status:200,contentType:"text/html",body:stagingPanelHtml()});return;
  }
  if(path==="/v1/super-admin/me"){
   await route.fulfill(json({superAdmin:true,capabilities:{
    tenantCatalog:true,tenantWrite:true,membershipWrite:true,
    brandWrite:true,credentialWrite:true,legacyUserRead:false
   }}));return;
  }
  if(path==="/v1/super-admin/transportadoras"){
   await route.fulfill(json({transportadoras:[
    {id:"nova-frota",name:"Nova Frota Logística e Transportes",active:true,modules:["fretes"]},
    {id:"teste-01",name:"GNOVA TRANSPORTES",active:true,modules:["fretes","bi","divulgacao"]}
   ]}));return;
  }
  if(path.endsWith("/usuarios")){await route.fulfill(json({usuarios:[],origem:"d1"}));return;}
  if(path.endsWith("/auditoria")){await route.fulfill(json({eventos:[]}));return;}
  if(path.endsWith("/integracao")){await route.fulfill(json({integracao:{
   configured:false,enabled:false,scriptUrlConfigured:false,gatewayKeyConfigured:false
  }}));return;}
  if(path.endsWith("/logo")){
   if(path.includes("teste-01")){
    const img=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLz7wAAAABJRU5ErkJggg==","base64");
    await route.fulfill({status:200,contentType:"image/png",body:img});return;
   }
   await route.fulfill({status:404,body:"Not found"});return;
  }
  if(path.endsWith("/artes")){
   if(route.request().method()==="PUT"){
    putCount++;saved=JSON.parse(route.request().postData());
   }
   await route.fulfill(json({tenantId:"teste-01",configured:!!saved,artes:saved||schemes}));return;
  }
  await route.fulfill({status:404,body:"Not found"});
 });
 await page.goto(origin+"/super-admin",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelectorAll(".company-card").length===2);
 assert.equal(await page.locator("#companyDetail").isVisible(),false);
 assert.equal(await page.locator(".company-card").count(),2);
 await page.getByRole("button",{name:/Abrir GNOVA TRANSPORTES/}).click();
 await page.waitForFunction(()=>document.querySelector("#companyDetail")?.hidden===false);
 assert.equal(await page.locator("#companyName").textContent(),"GNOVA TRANSPORTES");
 await page.locator('[data-tab="brand"]').click();
 await page.waitForFunction(()=>document.querySelectorAll(".art-model").length===4);
 await page.locator('[data-art-model="modelo3"][data-art-field="primary"]').fill("#b91c1c");
 await page.locator('[data-art-model="modelo4c"][data-art-field="accent"]').fill("#202020");
 await page.locator("#artSave").click();
 await page.waitForFunction(()=>document.querySelector("#artStatus")?.textContent.includes("Quatro modelos salvos"));
 assert.equal(putCount,1);
 assert.equal(saved.models.modelo3.primary,"#b91c1c");
 assert.equal(saved.models.modelo4c.accent,"#202020");
 assert.equal(await page.locator('#tenantLogo').isVisible(),true);
 await page.locator("#galleryBack").click();
 assert.equal(await page.locator("#companyDetail").isVisible(),false);
 assert.equal(await page.locator(".company-card").count(),2);
 assert.deepEqual(errors,[]);
 console.log("OWNER GALLERY CHROMIUM OK: 2 logos/cards, four models saved and dashboard returned");
}finally{
 await browser.close();
}
