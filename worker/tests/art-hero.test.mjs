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
 assert.match(page,/art-hero[.]js[?]v=2/);
 assert.match(fretes,/art-hero[.]js[?]v=2/);
 assert.match(css,/\.m3Hero\{[\s\S]*?hero-global[.]jpg[?]v=2/);
 assert.match(fretes,/\.nfM3Hero\{[\s\S]*?hero-global[.]jpg[?]v=2/);
 assert.match(fretes,/\.nfM4Hero\{[^}]*hero-global[.]jpg[?]v=2/);
 assert.ok(shared.includes('const HERO="/assets/img/divulgacao/hero-global.jpg?v=2"'));
 assert.ok(load("assets/js/divulgacao.js").includes("await window.PortalArtHero.ready(preview)"));
 assert.doesNotThrow(()=>new Script(shared));
});

test("Both art exporters wait for real hero loading before html2canvas",()=>{
 const divulgacao=load("assets/js/divulgacao.js");
 const fretes=load("assets/js/fretes.js");
 assert.match(divulgacao,/await window[.]PortalArtHero[.]ready\(preview\)/);
 assert.match(fretes,/await window[.]PortalArtHero[.]ready\(source\)/);
 assert.match(divulgacao,/A imagem hero não carregou/);
 assert.match(fretes,/A imagem hero não carregou no MOD 03/);
 assert.match(fretes,/A imagem hero não carregou no MOD 04/);
 assert.doesNotThrow(()=>new Script(divulgacao));
 assert.doesNotThrow(()=>new Script(fretes));
});
