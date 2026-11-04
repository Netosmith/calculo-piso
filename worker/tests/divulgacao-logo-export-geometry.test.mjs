import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const source=readFileSync(new URL("../../assets/js/divulgacao.js",import.meta.url),"utf8");
const page=readFileSync(new URL("../../pages/divulgacao.html",import.meta.url),"utf8");

test("Divulgacao script parses and is refreshed for clients",()=>{
 assert.doesNotThrow(()=>new Script(source));
 assert.match(page,/assets\/js\/divulgacao\.js\?v=17/);
});
test("JPG export freezes rendered logo geometry in cloned DOM for all art models",()=>{
 assert.match(source,/function prepareArtLogoExport\(preview\)/);
 assert.match(source,/getBoundingClientRect\(\)/);
 assert.match(source,/geometry\.left\+"px"/);
 assert.match(source,/geometry\.top\+"px"/);
 assert.match(source,/transform:"none"/);
 assert.match(source,/\[data-portal-export-logo="true"\] \.m3Logo/);
 assert.match(source,/\[data-portal-export-logo="true"\] \.multiArtLogo/);
 assert.equal((source.match(/onclone:logoExport\.onclone/g)||[]).length,2);
 assert.equal((source.match(/logoExport\.finish\(\)/g)||[]).length,2);
});
