import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const source=readFileSync(new URL("../../assets/js/divulgacao.js",import.meta.url),"utf8");
const page=readFileSync(new URL("../../pages/divulgacao.html",import.meta.url),"utf8");
test("JPG renderer loads fresh script",()=>{
 assert.doesNotThrow(()=>new Script(source));
 assert.match(page,/assets\/js\/divulgacao\.js\?v=18/);
});
test("preview logo is hidden in html2canvas clone and composited at real geometry",()=>{
 assert.match(source,/function prepareArtLogoExport\(preview\)/);
 assert.match(source,/getBoundingClientRect\(\)/);
 assert.match(source,/visibility","hidden","important"/);
 assert.match(source,/ctx\.drawImage\(image,/);
 assert.match(source,/ctx\.rect\(area\.x,area\.y,area\.w,area\.h\)/);
 assert.equal((source.match(/onclone:logoExport\.onclone/g)||[]).length,2);
 assert.equal((source.match(/logoExport\.draw\(canvas\)/g)||[]).length,2);
 assert.equal((source.match(/logoExport\.finish\(\)/g)||[]).length,2);
});
test("Fretes JPG and clipboard both use the shared fixed logo composition",()=>{
 for(const p of ["fretes","fretes2"]){
  const script=readFileSync(new URL("../../assets/js/"+p+".js",import.meta.url),"utf8");
  const html=readFileSync(new URL("../../pages/"+p+".html",import.meta.url),"utf8");
  assert.doesNotThrow(()=>new Script(script));
  assert.match(html,new RegExp("assets/js/"+p+"\\.js\\?v="+(p==="fretes"?"37":"32")));
  assert.match(script,/function prepareLogoCanvasExport\(source\)/);
  assert.match(script,/ctx\.drawImage\(img,/);
  assert.equal((script.match(/onclone:logoExport\.onclone/g)||[]).length,2);
  assert.equal((script.match(/logoExport\.draw\(canvas\)/g)||[]).length,2);
 }
});
