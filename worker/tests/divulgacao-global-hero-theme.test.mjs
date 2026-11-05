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
  // Both absolute /assets paths and legacy ../assets paths resolve to the
  // same single repository asset. Art previews now use a canonical URL.
  assert.ok(file(path).includes("assets/img/divulgacao/hero-global.jpg"),
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

test("GNOVA-only artwork logo is raised and bounded in both Divulgação and Fretes",()=>{
 const route=file("assets/js/tenant-route.js");
 const loader=file("assets/js/tenant-page.js");
 const start=route.indexOf("function applyGnovaArtLogoLayout(){");
 const end=route.indexOf("function labelHeader(img)",start);
 assert.ok(start>0&&end>start,"Missing isolated GNOVA artwork layout");
 const rule=route.slice(start,end);
 assert.ok(rule.includes('tenant!=="teste-01"'),"No change for Nova Frota or other tenants");
 assert.ok(rule.includes('pf-gnova-art-layout'),"Styles must be scoped to GNOVA");
 for(const selector of ["img.m3Logo","img.nfM3Logo"])
  assert.ok(rule.includes(selector),"Missing Model 3 preview rule: "+selector);
 for(const geometry of ["top:4px!important","height:96px!important","object-fit:contain!important"])
  assert.ok(rule.includes(geometry),"Missing preserved Model 3 logo geometry: "+geometry);
 // Multi-art uses one layout resolver for all tenants, not a GNOVA-specific override.
 assert.ok(!rule.includes("img.multiArtLogo")&&!rule.includes("img.nfM4Logo"),
  "Legacy GNOVA multi-art rule must not override saved layout");
 assert.ok(route.includes("applyGnovaArtLogoLayout();"));
 assert.ok(loader.includes('tenant==="teste-01"'));
 assert.ok(loader.includes("tenant-route.js?v=visual-v10"));
 for(const page of ["divulgacao","fretes"]){
  const entry=file("pages/gnova/"+page+".html");
  assert.ok(entry.includes("tenant-page.js?v=visual-identity-v10"),page);
 }
 for(const uf of ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
                   "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]){
  const entry=file("pages/gnova/fretes-"+uf+".html");
  assert.ok(entry.includes("tenant-page.js?v=visual-identity-v10"),uf);
 }
 // Preview is used as the html2canvas source for both JPG exports.
 assert.ok(file("assets/js/divulgacao.js").includes("html2canvas(preview"));
 assert.ok(file("assets/js/fretes.js").includes("html2canvasLib(source"));
});
