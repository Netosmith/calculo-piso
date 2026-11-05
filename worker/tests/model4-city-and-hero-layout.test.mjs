import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("Model 4 city uses natural word boundaries and prevents orphan letters in both freight modules",()=>{
 for(const name of ["fretes","fretes2"]){
  const js=read("assets/js/"+name+".js"),html=read("pages/"+name+".html");
  assert.doesNotThrow(()=>new Script(js));
  assert.ok(js.includes('const singleWord=isCity && !/\\s/.test(text)'));
  assert.match(js,/target\.style\.whiteSpace=singleWord\|\|lines===1\?"nowrap":"normal"/);
  assert.match(js,/target\.style\.overflowWrap="normal"/);
  assert.match(js,/target\.style\.wordBreak="normal"/);
  assert.match(js,/target\.scrollWidth>target\.clientWidth\+1/);
  assert.match(html,/\.nfM4Canvas\.count-3 \.nfM4City\{height:76px/);
  assert.match(html,/\.nfM4Canvas\.count-4 \.nfM4City\{height:62px/);
  assert.match(html,/overflow-wrap:normal;/);
 }
});

test("Model 4 has no tenant-specific size cap, same as TRANSVALE",()=>{
 for(const name of ["fretes","fretes2"]){
  const html=read("pages/"+name+".html");
  assert.match(html,/\.nfM4HeroImg\{[^}]*object-fit:cover/);
  assert.doesNotMatch(html,/body\.pf-tenant-site \.nfM4Hero img\.nfM4Logo\{max-width:440px/);
 }
 const css=read("assets/css/divulgacao.css");
 assert.doesNotMatch(css,/body\.pf-tenant-site \.multiArtHero img\.multiArtLogo\{max-width:440px/);
 const admin=read("pages/super-admin.html");
 assert.match(admin,/\['logoWidth','Largura',100,1500,5,'px'\]/);
 assert.match(admin,/\['logoHeight','Altura da área',35,1500,5,'px'\]/);
 assert.match(admin,/id="artResetMulti"/);
});
test("Tall logos remain visible at the top of Models 4A, 4B and 4C",()=>{
 const preview=read("assets/js/super-admin-real-preview.js");
 const route=read("assets/js/tenant-route.js");
 const css=read("assets/css/divulgacao.css");
 assert.match(preview,/objectPosition:"center top"/);
 assert.match(route,/object-position:center top!important/);
 assert.match(css,/\.multiArtLogo\{[^}]*object-position:center top/);
 for(const name of ["fretes","fretes2"]){
  assert.match(read("pages/"+name+".html"),/\.nfM4Logo\{[^}]*object-position:center top/);
 }
});

test("GNOVA and TRANSVALE use identical saved geometry without clamping",()=>{
 const route=read("assets/js/tenant-route.js");
 const preview=read("assets/js/super-admin-real-preview.js");
 assert.match(route,/const logoWidth=savedWidth/);
 assert.match(route,/const logoHeight=savedHeight/);
 assert.match(route,/const logoTop=clampInt\(value\.logoTop/);
 assert.match(route,/const logoX=clampInt\(value\.logoX/);
 assert.match(preview,/const w=savedWidth/);
 assert.match(preview,/const h=savedHeight/);
 assert.doesNotMatch(route,/Math\.min\(savedWidth,440\)|Math\.min\(savedHeight,125\)/);
 assert.doesNotMatch(preview,/Math\.min\(savedWidth,440\)|Math\.min\(savedHeight,125\)/);
 for(const script of ["fretes","fretes2","divulgacao"])
  assert.match(read("assets/js/"+script+".js"),/objectPosition:getComputedStyle\(image\)\.objectPosition/);
});
