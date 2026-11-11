import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {CADASTRO_CHECKLIST} from "../src/controllers/cadastro-solicitacoes.js";
const load=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("As duas páginas mostram apenas a navegação global, com cabeçalho compacto",()=>{
 for(const name of ["cadastro-solicitacoes","execucao-cadastros"]){
  const html=load("pages/"+name+".html");
  assert.doesNotMatch(html,/<header class="cad-topbar">/);
  assert.match(html,/cadastro-solicitacoes[.]css[?]v=7-cards-compactos/);
  for(const id of ["cadProgressBar","cadProgressTrack","cadChecklist","cadAnexos","cadHistorico","cadPreviewDialog"])
   assert.ok(html.includes('id="'+id+'"'),id+" / "+name);
 }
 const css=load("assets/css/cadastro-solicitacoes.css");
 assert.match(css,/\.cad-hero\{min-height:0/);
 assert.match(css,/\.cad-kanban\{grid-template-columns:repeat\(6,/);
});

test("Quadro por status, prévia de documentos e progresso dos cards não expõem Drive publicamente",()=>{
 const js=load("assets/js/cadastro-solicitacoes.js");
 for(const status of ["FILA","ANDAMENTO","AGUARDANDO APROVACAO","PENDENTE","REPROVADO","APROVADO"]){
  assert.ok(js.includes('"'+status+'"'),status);
 }
 for(const mark of ["cadPreviewDialog","fetchPrivateDoc","cadChecklistCount","cadProgressBar","cadDetailStatus"]){
  assert.ok(js.includes(mark),mark);
 }
 assert.match(js,/credentials:"include"/);
 assert.match(js,/URL\.revokeObjectURL/);
 assert.doesNotMatch(js,/setSharing\s*\(/);
 assert.doesNotThrow(()=>new Script(js));
});

test("Checklist tem 9 conferências registradas por tenant e executor, sem aprovação prematura",()=>{
 assert.equal(CADASTRO_CHECKLIST.length,9);
 assert.equal(new Set(CADASTRO_CHECKLIST.map(x=>x[0])).size,9);
 for(const key of ["criminal","cnh","documentos","biometria","referencia1","referencia2","referencia3","telefone_proprietario","telefone_motorista"])
  assert.ok(CADASTRO_CHECKLIST.some(x=>x[0]===key),key);
 const sql=load("worker/migrations/super-admin/0004_cadastro_checklist.sql");
 assert.match(sql,/CREATE TABLE IF NOT EXISTS portal_cadastro_checklist/);
 assert.match(sql,/PRIMARY KEY\(tenant_id,ticket_id,item_key\)/);
 const backend=load("worker/src/controllers/cadastro-solicitacoes.js");
 assert.match(backend,/row\.executor_id!==p\.user/);
 assert.match(backend,/if\(b\.status==="APROVADO"\)/);
 assert.match(backend,/Conclua os nove itens do checklist antes de aprovar/);
 assert.match(backend,/INSERT INTO portal_cadastro_history/);
 assert.match(backend,/cc\.tenant_id=portal_cadastro_tickets\.tenant_id/);
 const workflow=load(".github/workflows/deploy-portal-hotfix.yml");
 assert.match(workflow,/run: \|\s+npx wrangler d1 execute portal-super-admin-tenants-staging --remote --file=migrations\/super-admin\/0003_cadastro_solicitacoes\.sql\s+npx wrangler d1 execute portal-super-admin-tenants-staging --remote --file=migrations\/super-admin\/0004_cadastro_checklist\.sql/);
});

test("Ambos os ambientes substituem indicadores duplicados pelo quadro de seis situações",()=>{
 for(const name of ["cadastro-solicitacoes","execucao-cadastros"]){
  const html=load("pages/"+name+".html");
  assert.doesNotMatch(html,/class="cad-summary"/);
  assert.match(html,/id="cadKanban"/);
  assert.doesNotMatch(html,/id="cadFila"|id="cadAndamento"|id="cadPendente"|id="cadAprovados"/);
 }
 const js=load("assets/js/cadastro-solicitacoes.js");
 assert.doesNotMatch(js,/applyCounts/);
 assert.match(js,/if\(!\$\("cadKanban"\)\)return/);
 assert.match(js,/cad-lane-ticket-bottom/);
 assert.doesNotThrow(()=>new Script(js));
});
