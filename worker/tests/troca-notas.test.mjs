import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const load=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("Troca de Notas possui módulos separados e inativos até liberação por empresa",()=>{
 const mods=load("worker/src/config/tenant-modules.js");
 const controller=load("worker/src/controllers/troca-notas.js");
 const admin=load("pages/super-admin.html");
 assert.match(mods,/solicitacao-troca-notas/);
 assert.match(mods,/execucao-troca-notas/);
 assert.match(admin,/Solicitação de Troca de Notas/);
 assert.match(admin,/Execução de Troca de Notas/);
 assert.match(controller,/enabled=1 AND module_key IN \('solicitacao-troca-notas','execucao-troca-notas'\)/);
 assert.match(controller,/private\/optional-modules-v1[.]json/);
 assert.match(controller,/if\(execView&&!executor\)return err/);
 assert.match(controller,/if\(!execView&&!flags\.solicitar\)return err/);
});

test("Chamados e anexos são isolados por transportadora, executor e solicitante",()=>{
 const c=load("worker/src/controllers/troca-notas.js");
 const sql=load("worker/migrations/super-admin/0007_troca_notas.sql");
 for(const table of ["portal_troca_tickets","portal_troca_docs","portal_troca_messages","portal_troca_history"])
  assert.match(sql,new RegExp("CREATE TABLE IF NOT EXISTS "+table));
 assert.match(sql,/ON portal_troca_tickets\(tenant_id,numero\)/);
 assert.match(sql,/CREATE TRIGGER IF NOT EXISTS trg_troca_numero/);
 assert.match(c,/WHERE tenant_id=\? AND solicitante_id=\?/);
 assert.match(c,/WHERE tenant_id=\? AND status<>'RASCUNHO'/);
 assert.match(c,/if\(execView\?!executor:!owner\)return err/);
 assert.match(c,/if\(!isFinal&&\(!owner\|\|!/);
 assert.match(c,/if\(isFinal&&\(!execView\|\|row\.executor_id!==p\.user/);
 assert.match(c,/row\.executor_id!==p\.user\)return err\("Apenas o executor responsável/);
});

test("NF trocada é obrigatória para concluir e pendência exige motivo",()=>{
 const c=load("worker/src/controllers/troca-notas.js");
 assert.match(c,/const REQUIRED=\["nota_origem","laudo","ticket_pesagem","ordem"\]/);
 assert.match(c,/REQUIRED\.filter\(x=>!have\.has\(x\)\)/);
 assert.match(c,/if\(status==="PENDENTE"&&motivo\.length<8\)/);
 assert.match(c,/if\(status==="TROCADA"\)\{/);
 assert.match(c,/slot='nf_trocada'/);
 assert.match(c,/if\(!Number\(nf\?\.total\)\)return err/);
 assert.match(c,/status IN \('ANDAMENTO','PENDENTE'\)/);
 const gs=load("docs/CADASTRO_DRIVE_APPS_SCRIPT.gs");
 for(const slot of ["nota_origem","laudo","ticket_pesagem","ordem","nf_trocada"])
  assert.ok(gs.includes('"'+slot+'"'),slot);
 assert.doesNotMatch(gs,/setSharing\s*\(/);
});

test("Clientes e filiais são selecionados exclusivamente a partir de cadastros existentes",()=>{
 const c=load("worker/src/controllers/troca-notas.js");
 assert.match(c,/sharedClientNamesController\(env\)/);
 assert.match(c,/readTenantIntegration\(env,tenantId\)/);
 assert.match(c,/resource:"filiais",operation:"list"/);
 assert.match(c,/!catalog\.clientes\.includes\(cliente\)\|\|!catalog\.filiais\.includes\(filial\)/);
 const page=load("pages/solicitacao-troca-notas.html");
 for(const field of ["cliente","filial","origem","localColeta","destino","localDescarga"])
  assert.ok(page.includes('name="'+field+'"'),field);
 for(const slot of ["nota_origem","laudo","ticket_pesagem","ordem"])
  assert.ok(page.includes('data-slot="'+slot+'"'),slot);
});

test("Solicitação e execução têm telas próprias e sem barras duplicadas",()=>{
 for(const name of ["solicitacao-troca-notas","execucao-troca-notas"]){
  const p=load("pages/"+name+".html");
  assert.match(p,/id="tnBoard"/);
  assert.doesNotMatch(p,/class="cad-topbar"/);
  assert.match(p,/assets\/js\/troca-notas[.]js/);
  assert.match(p,/id="tnMessages"/);
 }
 const exe=load("pages/execucao-troca-notas.html");
 assert.match(exe,/id="tnFinalFile"/);
 assert.match(exe,/id="tnMine"/);
 assert.match(exe,/value="TROCADA"/);
 const ui=load("assets/js/troca-notas.js");
 assert.match(ui,/const STATUSES=\[\["FILA"/);
 assert.match(ui,/async function upload\(/);
 assert.match(ui,/if\(execMode\?!result\.execucaoHabilitada\|\|!result\.executor:!result\.solicitacoesHabilitadas\)/);
 assert.doesNotThrow(()=>new Script(ui));
});

test("Acesso direto dos tenants e cards da Home obedecem ao Super Admin",()=>{
 const pages=load("assets/js/tenant-page.js");
 const route=load("assets/js/tenant-route.js");
 const home=load("pages/home.html");
 const gate=load("assets/js/troca-home.js");
 const auth=load("assets/js/auth.js");
 for(const feature of ["solicitacao-troca-notas","execucao-troca-notas"]){
  assert.ok(pages.includes('"'+feature+'.html"'),feature);
  assert.ok(route.includes('"'+feature+'.html"'),feature);
  assert.ok(home.includes('data-feature="'+feature+'"'),feature);
  assert.ok(auth.includes('feature:"'+feature+'"'),feature);
  assert.ok(gate.includes(feature),feature);
 }
 assert.match(home,/__PORTAL_TROCA_MODULES_CONFIRMED/);
 assert.match(gate,/result\.executor===true|data\.executor===true/);
 assert.doesNotThrow(()=>new Script(gate));
});

test("Deploy prepara banco D1 antes de publicar Worker",()=>{
 const wf=load(".github/workflows/deploy-portal-hotfix.yml");
 assert.match(wf,/node --check src\/controllers\/troca-notas[.]js/);
 assert.match(wf,/0007_troca_notas[.]sql/);
 const schema=load("worker/migrations/super-admin/0007_troca_notas.sql");
 assert.match(schema,/CREATE TABLE IF NOT EXISTS portal_troca_sequence/);
 assert.match(schema,/CREATE UNIQUE INDEX IF NOT EXISTS idx_troca_numero/);
});
