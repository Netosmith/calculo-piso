import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("Cards compactos apresentam somente cinco dados essenciais",()=>{
 const js=read("assets/js/cadastro-solicitacoes.js");
 const css=read("assets/css/cadastro-solicitacoes.css");
 for(const mark of ["cad-short-number","cad-card-product","cad-card-plate","cad-card-executor","cad-card-date"]){
  assert.ok(js.includes(mark),mark);
 }
 assert.match(js,/meta[.]append[(]el[(]"span",numeroCadastro[(]ticket[)]/);
 assert.match(js,/placaPrincipal[(]ticket[.]placas[)]/);
 assert.match(js,/produtoCadastro[(]ticket[)]/);
 assert.match(js,/dataCompacta[(]ticket[.]criadoEm[)]/);
 assert.doesNotMatch(js,/smallProgress[(]ticket[.]conferidos[)]/);
 assert.match(css,/\.cad-lane-ticket-bottom/);
 assert.match(css,/max-height:min[(]74vh,900px[)]/);
 assert.doesNotThrow(()=>new Script(js));
});

test("Produto obrigatório em novos cadastros e editável pelo executor responsável",()=>{
 const requester=read("pages/cadastro-solicitacoes.html");
 const execution=read("pages/execucao-cadastros.html");
 const server=read("worker/src/controllers/cadastro-solicitacoes.js");
 const migration=read("worker/migrations/super-admin/0006_cadastro_produto.sql");
 assert.match(requester,/required name="produto"/);
 assert.match(execution,/id="cadProdutoForm"/);
 assert.match(server,/produto:r[.]produto[|][|]""/);
 assert.match(server,/const ownerDraft=view==="solicitante"&&isOwner&&row[.]status==="RASCUNHO"/);
 assert.match(server,/row[.]executor_id===p[.]user/);
 assert.match(server,/history[(]db,p,id,row[.]status,row[.]etapa,"Produto:/);
 assert.match(migration,/ALTER TABLE portal_cadastro_tickets ADD COLUMN produto/);
 const wf=read(".github/workflows/deploy-portal-hotfix.yml");
 assert.match(wf,/0006_cadastro_produto[.]sql/);
 for(const name of ["cadastro-solicitacoes","execucao-cadastros"]){
  const html=read("pages/"+name+".html");
  assert.match(html,/cadastro-solicitacoes[.]css[?]v=8-quadro-unico/);
  assert.match(html,/cadastro-solicitacoes[.]js[?]v=9-minha-execucao/);
 }
});
