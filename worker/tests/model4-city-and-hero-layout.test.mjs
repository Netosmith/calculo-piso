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

test("Model 4 hero bounds the logo and preserves photo proportions",()=>{
 for(const name of ["fretes","fretes2"]){
  const html=read("pages/"+name+".html");
  assert.match(html,/\.nfM4HeroImg\{[^}]*object-fit:cover;object-position:center 55%;opacity:\.60/);
  assert.match(html,/body\.pf-tenant-site \.nfM4Hero img\.nfM4Logo\{max-width:440px!important;max-height:125px!important/);
 }
 const styles=read("assets/css/divulgacao.css");
 assert.match(styles,/\.multiArtHeroImg\{[^}]*object-fit:cover;object-position:center 55%;opacity:\.60/);
 assert.match(styles,/body\.pf-tenant-site \.multiArtHero img\.multiArtLogo\{max-width:440px!important;max-height:125px!important/);
 const admin=read("pages/super-admin.html");
 assert.match(admin,/\['logoWidth','Largura',100,1500,5,'px'\]/);
 assert.match(admin,/\['logoHeight','Altura da área',35,1500,5,'px'\]/);
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

test("Models 4A/B/C use the same 440x125 hero geometry in admin and exports",()=>{
 const route=read("assets/js/tenant-route.js");
 const preview=read("assets/js/super-admin-real-preview.js");
 assert.match(route,/logoWidth=isM3\?savedWidth:Math\.min\(savedWidth,440\)/);
 assert.match(route,/logoHeight=isM3\?savedHeight:Math\.min\(savedHeight,125\)/);
 assert.match(preview,/w=m3\?savedWidth:Math\.min\(savedWidth,440\)/);
 assert.match(preview,/h=m3\?savedHeight:Math\.min\(savedHeight,125\)/);
 assert.match(route,/logoTop=isM3\?savedTop:Math\.max\(0,Math\.min\(140-logoHeight,savedTop\)\)/);
 assert.match(preview,/top=m3\?savedTop:Math\.max\(0,Math\.min\(140-h,savedTop\)\)/);
 assert.doesNotMatch(route,/body\.pf-tenant-site\.pf-gnova-art-layout img\.nfM4Logo\{/);
 for(const script of ["fretes","fretes2","divulgacao"]){
  const code=read("assets/js/"+script+".js");
  assert.match(code,/objectPosition:getComputedStyle\(image\)\.objectPosition/);
 }
});
