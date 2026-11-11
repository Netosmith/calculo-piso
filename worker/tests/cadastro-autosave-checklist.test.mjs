import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("Checklist salva individualmente e atualiza o contador sem recarregar o modal",()=>{
 const js=read("assets/js/cadastro-solicitacoes.js");
 assert.match(js,/function updateChecklistCount\(\)/);
 assert.match(js,/rows\.filter\(row=>row\.dataset\.checkState==="OK"\)/);
 assert.match(js,/aria-valuenow/);
 assert.match(js,/const previous=line\.dataset\.checkState,next=options\.value/);
 assert.match(js,/paintCheckRow\(line,leading,result,next\);\s*updateChecklistCount\(\);\s*options\.disabled=true/);
 assert.match(js,/api\("\/"\+ticketId\+"\/checklist","POST",\{item:check\.key,estado:next\}\)/);
 assert.match(js,/options\.value=previous;\s*updateChecklistCount\(\);/);
 assert.match(js,/appendCheckHistory\(checkLabel,next\)/);
 assert.doesNotMatch(js,/checklistBusy/);
 const onChange=js.slice(js.indexOf("options.onchange=async()=>{"),js.indexOf("\n    };",js.indexOf("options.onchange=async()=>{")));
 assert.doesNotMatch(onChange,/await refresh\(\)|await openDetail\(/);
 assert.doesNotThrow(()=>new Script(js));
});

test("As duas visões mostram indicação de autosave e preservam manualidade da situação/etapa",()=>{
 for(const page of ["cadastro-solicitacoes","execucao-cadastros"]){
  const html=read("pages/"+page+".html");
  assert.match(html,/id="cadChecklistSaveStatus"[^>]*aria-live="polite"/);
  assert.match(html,/cadastro-solicitacoes[.]js[?]v=10-autosave-checklist/);
 }
 const exec=read("pages/execucao-cadastros.html");
 assert.match(exec,/>Atualizar situação e etapa<\/button>/);
 assert.match(exec,/id="cadStatusForm"/);
 const backend=read("worker/src/controllers/cadastro-solicitacoes.js");
 assert.match(backend,/if\(action==="checklist"&&method==="POST"\)/);
 assert.match(backend,/db\.batch\(\[/);
});
