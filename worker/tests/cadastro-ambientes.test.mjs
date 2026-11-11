import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {TENANT_MODULES} from "../src/config/tenant-modules.js";
import {tenantPublicSession} from "../src/controllers/tenant-unified.js";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("Super Admin gerencia separadamente os dois módulos",()=>{
 assert.ok(TENANT_MODULES.includes("cadastro-solicitacoes"));
 assert.ok(TENANT_MODULES.includes("execucao-cadastros"));
 const html=read("pages/super-admin.html");
 assert.ok(html.includes("['cadastro-solicitacoes','Solicitações de Cadastro"));
 assert.ok(html.includes("['execucao-cadastros','Execução de Cadastros"));
});
test("PISO mantém o cadastro pessoal e não ganha fila geral",()=>{
 const p={user_id:"PISO.TESTE",role:"PISO",tenant_id:"teste-01",tenant_name:"GNOVA"};
 const data=tenantPublicSession(p,["piso2","cadastro-solicitacoes","execucao-cadastros"]);
 assert.deepEqual(data.modules,["piso2","cadastro-solicitacoes"]);
 assert.match(read("worker/src/controllers/cadastro-solicitacoes.js"),/if\(String\(p\.role\|\|""\)\.toUpperCase\(\)==="PISO"\)return false/);
});
test("Solicitante e executor usam telas distintas, com script compartilhado sintaticamente válido",()=>{
 const a=read("pages/cadastro-solicitacoes.html"),b=read("pages/execucao-cadastros.html"),js=read("assets/js/cadastro-solicitacoes.js");
 assert.match(a,/data-cadastro-visao="solicitante"/);
 assert.match(b,/data-cadastro-visao="execucao"/);
 assert.match(a,/id="cadNovo"/);
 assert.doesNotMatch(b,/id="cadNovo"/);
 assert.doesNotMatch(a,/id="cadStatusForm"/);
 assert.match(b,/id="cadStatusForm"/);
 assert.match(b,/id="cadKanban"/);
 assert.match(js,/const resource=path!=="\/config"/);
 assert.doesNotThrow(()=>new Script(js));
 for(const tenant of ["gnova","transvale","modelo01","modelo02"]){
  const page=read("pages/"+tenant+"/execucao-cadastros.html");
  assert.match(page,/(data-shared-page="execucao-cadastros[.]html"|pages\/gnova\/execucao-cadastros[.]html)/);
 }
});
