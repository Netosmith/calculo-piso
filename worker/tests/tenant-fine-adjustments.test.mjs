import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const read=path=>readFileSync(resolve(root,path),"utf8");

test("legacy divulgacao models 1 and 2 are not offered to any company",()=>{
 const page=read("pages/divulgacao.html");
 assert.doesNotMatch(page,/data-template=["'](?:1|2)["']/);
 assert.match(page,/data-template=["']3["']/);
 for(const name of ["fretes","fretes2"]){
  const html=read("pages/"+name+".html");
  const js=read("assets/js/"+name+".js");
  assert.doesNotMatch(html,/id=["']nfModel[12]Btn["']/);
  assert.match(js,/return n === 4 \? 4 : 3;/);
 }
});

test("client logo file stays mounted until the upload is complete",()=>{
 const script=read("assets/js/cadastros.js");
 const start=script.indexOf("async function save(event)");
 const upload=script.indexOf("await applyClientLogoDraft(payload.cliente)",start);
 const close=script.indexOf("closeModal(true)",start);
 assert.ok(start>=0 && upload>start && close>upload);
 assert.doesNotMatch(script.slice(start,upload),/classList\.remove\("show"\)/);
});

test("Piso 1 and Piso 2 are independently configured and checked",()=>{
 const modules=read("worker/src/config/tenant-modules.js");
 const auth=read("assets/js/auth.js");
 const owner=read("pages/super-admin.html");
 const staging=read("worker/src/staging-page.js");
 assert.match(modules,/"piso", "piso2"/);
 assert.match(owner,/\['piso','Cálculo de Piso 1/);
 assert.match(owner,/\['piso2','Cálculo de Piso 2/);
 assert.match(staging,/\['piso2','Cálculo de Piso 2/);
 assert.doesNotMatch(auth,/mapped=\{piso2:"piso"\}/);
 assert.match(auth,/if\(!modules\.includes\(feature\)\)return false/);
 const home=read("pages/home.html");
 assert.match(home,/data-feature="piso"/);
 assert.match(home,/data-feature="piso2"/);
});

test("modified JS assets retain syntactically valid scripts",()=>{
 for(const path of ["assets/js/cadastros.js","assets/js/auth.js",
   "assets/js/fretes.js","assets/js/fretes2.js","assets/js/tenant-page.js"])
  assert.doesNotThrow(()=>new Script(read(path),{filename:path}),path);
});
