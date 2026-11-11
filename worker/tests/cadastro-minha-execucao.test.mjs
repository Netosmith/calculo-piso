import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const load=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("Central mantém quadro geral e filtra a carteira inferior pelo executor logado",()=>{
 const js=load("assets/js/cadastro-solicitacoes.js");
 const html=load("pages/execucao-cadastros.html");
 assert.match(html,/id="cadKanban"/);
 assert.match(html,/id="cadTickets"/);
 assert.match(html,/Meus cadastros em execução/);
 assert.match(js,/const STATUS_EM_EXECUCAO=new Set\(\["ANDAMENTO","AGUARDANDO APROVACAO","PENDENTE"\]\)/);
 assert.match(js,/responsavel===logado&&STATUS_EM_EXECUCAO\.has\(ticket\.status\)/);
 assert.match(js,/all\.filter\(x=>pertenceMinhaExecucao\(x,userId\)/);
 assert.match(js,/const base=all\.filter\(t=>/); // quadro geral não sofre filtro por executor
 assert.doesNotThrow(()=>new Script(js));
});
test("Carteira própria inclui somente processos ativos atribuídos ao usuário",()=>{
 const js=load("assets/js/cadastro-solicitacoes.js");
 const fn=js.match(/const STATUS_EM_EXECUCAO=new Set\([\s\S]*?\n}\n(?=function render\()/);
 assert.ok(fn,"Função de filtro não encontrada");
 const sandbox={};
 new Script(fn[0]+";globalThis.check=pertenceMinhaExecucao").runInNewContext(sandbox);
 const matches=sandbox.check;
 for(const status of ["ANDAMENTO","AGUARDANDO APROVACAO","PENDENTE"]){
  assert.equal(matches({status,executor:"LUZIANO"},"luziano"),true,status);
  assert.equal(matches({status,executor:"OUTRO"},"LUZIANO"),false,status);
 }
 for(const status of ["FILA","REPROVADO","APROVADO","RASCUNHO"])
  assert.equal(matches({status,executor:"LUZIANO"},"LUZIANO"),false,status);
 assert.equal(matches({status:"ANDAMENTO",executor:""},"LUZIANO"),false);
});
