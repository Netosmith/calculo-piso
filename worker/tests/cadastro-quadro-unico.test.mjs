import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
test("Solicitante tem somente quadro de seis colunas, com filtros no cabeçalho",()=>{
 const html=read("pages/cadastro-solicitacoes.html");
 assert.match(html,/id="cadKanban"/);
 assert.doesNotMatch(html,/<section class="cad-panel">/);
 assert.doesNotMatch(html,/id="cadTickets"|id="cadListaTitulo"/);
 for(const id of ["cadFiltro","cadBusca","cadAtualizar","cadRascunhosBtn","cadRascunhosLista"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 for(const status of ["FILA","ANDAMENTO","AGUARDANDO APROVACAO","PENDENTE","REPROVADO","APROVADO"])
  assert.ok(html.includes('value="'+status+'"'),status);
});
test("Rascunhos continuam acessíveis; execução mantém seu painel separado",()=>{
 const js=read("assets/js/cadastro-solicitacoes.js");
 const execution=read("pages/execucao-cadastros.html");
 assert.match(js,/function renderDrafts\(\)/);
 assert.match(js,/t\.status==="RASCUNHO"&&matchesCadastro/);
 assert.match(js,/button\.onclick=\(\)=>resume\(item\)/);
 assert.match(js,/if\(!\$\("cadTickets"\)\)return/);
 assert.match(js,/draftTrayOpen=!draftTrayOpen/);
 assert.match(execution,/id="cadTickets"/);
 assert.match(execution,/id="cadListaTitulo"/);
 assert.match(execution,/Meus cadastros em execução/);
 assert.doesNotThrow(()=>new Script(js));
});
