import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const text=path=>readFileSync(resolve(root,path),"utf8");

test("uploaded brand-free hero is checked-in as one shared WebP for all companies",()=>{
 const binary=readFileSync(resolve(root,"assets/img/divulgacao/hero-default.webp"));
 assert.ok(binary.byteLength>=20000);
 assert.equal(binary.toString("ascii",0,4),"RIFF");
 assert.equal(binary.toString("ascii",8,12),"WEBP");
 for(const path of ["pages/divulgacao.html","pages/fretes.html","pages/fretes2.html",
   "assets/js/divulgacao.js"]){
  const file=text(path);
  assert.ok(file.includes("../assets/img/divulgacao/hero-default.webp?v=1"),path);
  assert.equal(file.includes("../assets/img/hero.jpg"),false,path);
 }
});
test("Modelo 3 uses one shared theme for every graphic block",()=>{
 const stylesheet=text("assets/css/divulgacao-modelo3-theme.css");
 for(const cls of ["m3Headline","m3RouteLabel","m3Pin","m3Arrow","m3PriceCard",
   "m3WhatsappIcon","m3ContactLine","m3Footer","m3Content"]){
  assert.ok(stylesheet.includes(cls),"missing "+cls);
 }
 for(const key of ["--pf-art-primary","--pf-art-accent","--pf-art-surface",
   "--pf-art-on-primary","--pf-art-on-accent"]){
  assert.ok(stylesheet.includes(key));
 }
 assert.ok(stylesheet.includes("linear-gradient(104deg"));
 for(const path of ["pages/divulgacao.html","pages/fretes.html","pages/fretes2.html"]){
  assert.ok(text(path).includes('href="../assets/css/divulgacao-modelo3-theme.css?v=1"'));
 }
});
test("private theme no longer flattens Modelo 3 price gradient and exports wait for palette",()=>{
 const script=text("assets/js/tenant-route.js");
 assert.equal(script.includes('[data-template-preview="3"] .m3PriceCard'),false);
 assert.ok(script.includes("readableText(primary)"));
 assert.ok(script.includes("window.portalTenantArtThemeReady=loadArtThemes()"));
 for(const file of ["assets/js/divulgacao.js","assets/js/fretes.js","assets/js/fretes2.js"]){
  assert.ok(text(file).includes("await Promise.resolve(window.portalTenantArtThemeReady)"));
 }
});
