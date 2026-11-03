import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const file=p=>readFileSync(resolve(root,p),"utf8");
const hero=resolve(root,"assets/img/divulgacao/hero-global.jpg");
const pages=["pages/divulgacao.html","assets/js/divulgacao.js","pages/fretes.html","pages/fretes2.html"];

test("a single logo-free JPG is used by Nova Frota and tenant art templates",()=>{
 const bytes=readFileSync(hero);
 assert.ok(bytes.byteLength>500000,"Use the original full-resolution uploaded photo");
 assert.equal(bytes[0],0xff);
 assert.equal(bytes[1],0xd8);
 for(const path of pages){
  assert.ok(file(path).includes("../assets/img/divulgacao/hero-global.jpg"),
   "Missing new shared hero: "+path);
  assert.equal(file(path).includes("../assets/img/hero.jpg"),false,
   "No old branded hero may remain in an art template: "+path);
 }
 // Preserve the original app site hero, which has independent use outside artworks.
 assert.ok(file("assets/css/app.css").includes("hero.jpg"));
});
test("Model 3 fixed green and blue segments are uniformly driven by theme vars",()=>{
 const css=file("assets/css/divulgacao.css");
 const scope=css.slice(css.indexOf("MODELO 3 | Marca única"));
 const mapped=[
  ".m3Headline>span",".m3Headline>strong",".m3RouteLabel",
  ".m3Arrow",".m3MetaIcon",".m3PriceCard",".m3PriceLabel",
  ".m3WhatsappIcon",".m3ContactLine:not(:empty)::before",
  ".m3Footer",".m3Footer::after",".m3Content"
 ];
 for(const selector of mapped)assert.ok(scope.includes(selector),selector);
 for(const variable of ["--pf-art-primary","--pf-art-accent","--pf-art-surface"])
  assert.ok(scope.includes("var("+variable+")"),variable);
 const freight=file("assets/css/arte-fretes-paleta.css");
 for(const selector of [".nfM3RouteLabel",".nfM3PriceCard",".nfM3Footer",
  ".nfM3WhatsappIcon",".nfM4Num",".nfM4Price"]){
  assert.ok(freight.includes(selector),selector);
 }
 for(const path of ["pages/fretes.html","pages/fretes2.html"])
  assert.ok(file(path).includes("arte-fretes-paleta.css?v=1"),path);
});
test("export waits for palette and uses actual rendered surface, not fixed JPG background",()=>{
 const route=file("assets/js/tenant-route.js");
 const divulgacao=file("assets/js/divulgacao.js");
 assert.ok(route.includes("window.portalTenantArtThemeReady=loadArtThemes()"));
 assert.equal(route.includes("background:var(--pf-art-accent)!important"),false);
 assert.ok(divulgacao.includes("await window.portalTenantArtThemeReady"));
 assert.ok(divulgacao.includes("backgroundColor: getComputedStyle(preview).backgroundColor"));
 for(const path of ["assets/js/fretes.js","assets/js/fretes2.js"]){
  const script=file(path);
  assert.ok(script.includes("await window.portalTenantArtThemeReady"),path);
  assert.ok(script.includes("backgroundColor: getComputedStyle(source).backgroundColor"));
 }
});
