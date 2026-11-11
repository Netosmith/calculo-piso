import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("A numeração é sequencial por empresa e atômica no banco",()=>{
 const sql=read("worker/migrations/super-admin/0005_cadastro_numero_curto.sql");
 assert.match(sql,/ALTER TABLE portal_cadastro_tickets ADD COLUMN numero_curto INTEGER/);
 assert.match(sql,/ROW_NUMBER\(\) OVER\(PARTITION BY tenant_id ORDER BY criado_em, id\)/);
 assert.match(sql,/ON portal_cadastro_tickets\(tenant_id,numero_curto\)/);
 assert.match(sql,/CREATE TRIGGER IF NOT EXISTS trg_cadastro_numero_por_empresa/);
 assert.match(sql,/ON CONFLICT\(tenant_id\)/);
 const backend=read("worker/src/controllers/cadastro-solicitacoes.js");
 assert.match(backend,/numeroCurto:Number\(r\.numero_curto\)\|\|null/);
 assert.match(backend,/SELECT numero_curto FROM portal_cadastro_tickets WHERE id=\? AND tenant_id=\?/);
 assert.match(backend,/numeroCurto:allocated\.numero_curto/);
 assert.match(backend,/numeroCurto:row\.numero_curto/);
 const workflow=read(".github/workflows/deploy-portal-hotfix.yml");
 assert.match(workflow,/SELECT numero_curto FROM portal_cadastro_tickets LIMIT 0/);
 assert.match(workflow,/0005_cadastro_numero_curto[.]sql/);
});

test("Número #00001 e placa principal aparecem nas duas telas",()=>{
 const js=read("assets/js/cadastro-solicitacoes.js");
 assert.match(js,/function numeroCadastro\(item\)/);
 assert.match(js,/padStart\(5,"0"\)/);
 assert.match(js,/function placaPrincipal\(placas\)/);
 assert.match(js,/el\("strong",placaPrincipal\(ticket\.placas\),"cad-card-plate"\)/);
 assert.match(js,/el\("span",numeroCadastro\(ticket\),"cad-short-number"\)/);
 assert.match(js,/el\("strong",placaPrincipal\(c\.placas\),"cad-list-plate"\)/);
 assert.match(js,/Protocolo interno:/);
 assert.doesNotThrow(()=>new Script(js));
 for(const page of ["cadastro-solicitacoes","execucao-cadastros"]){
  assert.match(read("pages/"+page+".html"),/cadastro-solicitacoes[.]js[?]v=7-cards-compactos/);
 }
});
