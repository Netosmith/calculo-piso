import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {Script} from "node:vm";
const load=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("Art hero asset exists; only Divulgação Modelo 3 and Fretes use corrected canonical URL",()=>{
 const hero="assets/img/divulgacao/hero-global.jpg";
 assert.ok(existsSync(new URL("../../"+hero,import.meta.url)));
 const page=load("pages/divulgacao.html");
 const fretes=load("pages/fretes.html");
 const css=load("assets/css/divulgacao.css");
 const shared=load("assets/js/art-hero.js");
 assert.match(page,/class="m3HeroImg" src="\/assets\/img\/divulgacao\/hero-global[.]jpg[?]v=2"/);
 assert.match(fretes,/class="nfM3HeroImg" src="\/assets\/img\/divulgacao\/hero-global[.]jpg[?]v=2"/);
 assert.match(fretes,/class="nfM4HeroImg" src="\/assets\/img\/divulgacao\/hero-global[.]jpg[?]v=2"/);
 const fretes2=load("pages/fretes2.html");
 assert.match(fretes2,/class="nfM3HeroImg" src="\/assets\/img\/divulgacao\/hero-global[.]jpg[?]v=2"/);
 assert.match(fretes2,/class="nfM4HeroImg" src="\/assets\/img\/divulgacao\/hero-global[.]jpg[?]v=2"/);
 assert.match(fretes2,/art-hero[.]js[?]v=2/);
 assert.match(page,/art-hero[.]js[?]v=2/);
 assert.match(fretes,/art-hero[.]js[?]v=2/);
 // The hero is a single <img> with 72% opacity. A duplicate CSS
 // background makes the opacity ineffective and harms text readability.
 for(const [source,key] of [[css,"m3Hero"],[fretes,"nfM3Hero"],[fretes,"nfM4Hero"],[fretes2,"nfM3Hero"],[fretes2,"nfM4Hero"]]){
  const rule=source.match(new RegExp("\\."+key+"\\{([^}]*)\\}"));
  assert.ok(rule,key+" must have a hero rule");
  assert.doesNotMatch(rule[1],/background[^;]*url\\(/,key+" must not duplicate hero image in CSS");
 }
 assert.match(page,/divulgacao[.]css[?]v=14/);
 assert.match(load("pages/super-admin.html"),/divulgacao[.]css[?]v=14/);
 assert.ok(shared.includes('const HERO="/assets/img/divulgacao/hero-global.jpg?v=2"'));
 assert.ok(load("assets/js/divulgacao.js").includes("await window.PortalArtHero.ready(preview)"));
 assert.doesNotThrow(()=>new Script(shared));
});

test("Both art exporters wait for real hero loading before html2canvas",()=>{
 const divulgacao=load("assets/js/divulgacao.js");
 const fretes=load("assets/js/fretes.js");
 assert.match(divulgacao,/await window[.]PortalArtHero[.]ready\(preview\)/);
 assert.match(fretes,/await window[.]PortalArtHero[.]ready\(source\)/);
 const fretes2=load("assets/js/fretes2.js");
 assert.match(fretes2,/await window[.]PortalArtHero[.]ready\(source\)/);
 assert.match(divulgacao,/A imagem hero não carregou/);
 assert.match(fretes,/A imagem hero não carregou no MOD 03/);
 assert.match(fretes,/A imagem hero não carregou no MOD 04/);
 assert.doesNotThrow(()=>new Script(divulgacao));
 assert.doesNotThrow(()=>new Script(fretes));
 assert.doesNotThrow(()=>new Script(fretes2));
});

test("Modelo 3 and both Fretes bases match the subdued 4A/4B/4C hero treatment",()=>{
 const css=load("assets/css/divulgacao.css");
 const multiImage=css.match(/\\.multiArtHeroImg\\{([^}]*)\\}/);
 const multiWash=css.match(/\\.multiArtHeroWash\\{([^}]*)\\}/);
 assert.ok(multiImage?.[1]?.includes("opacity:.72"));
 const correctWash=multiWash?.[1]?.match(/background:([^;}]*)/)?.[1];
 assert.ok(correctWash?.includes("rgba(255,255,255,.98)"));
 // Existing multi-freight design from Divulgação remains the source of truth.
 for(const [source,img,overlay] of [
  [css,"m3HeroImg","m3HeroWash"],
  [load("pages/fretes.html"),"nfM3HeroImg","nfM3HeroWash"],
  [load("pages/fretes.html"),"nfM4HeroImg","nfM4HeroWash"],
  [load("pages/fretes2.html"),"nfM3HeroImg","nfM3HeroWash"],
  [load("pages/fretes2.html"),"nfM4HeroImg","nfM4HeroWash"]
 ]){
  const picture=source.match(new RegExp("\\."+img+"\\{([^}]*)\\}"));
  const wash=source.match(new RegExp("\\."+overlay+"\\{([^}]*)\\}"));
  assert.ok(picture?.[1]?.includes("opacity:.72"),img);
  assert.equal(wash?.[1]?.match(/background:([^;}]*)/)?.[1]?.trim(),
   correctWash.trim(),overlay+" matches Divulgação multi-frete overlay");
 }
});
