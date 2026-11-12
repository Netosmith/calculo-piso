import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const load=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("Os módulos Pedidos são independentes e dependem do Super Admin",()=>{
 const reg=load("worker/src/config/tenant-modules.js");
 const admin=load("pages/super-admin.html");
 const controller=load("worker/src/controllers/abertura-pedidos.js");
 for(const key of ["solicitacao-pedidos","execucao-pedidos"]){
  assert.ok(reg.includes('"'+key+'"'),key);
  assert.ok(admin.includes("['"+key+"'"),key);
  assert.ok(controller.includes('"'+key+'"'),key);
 }
 assert.ok(controller.includes("enabled=1 AND module_key IN"));
 assert.ok(controller.includes('private/optional-modules-v1.json'));
 assert.ok(controller.includes("if(execView&&!executor)"));
 assert.ok(controller.includes("if(!execView&&!flags.solicitar)"));
});

test("Dados do pedido correspondem aos vinte campos e documentos solicitados",()=>{
 const c=load("worker/src/controllers/abertura-pedidos.js");
 const page=load("pages/solicitacao-pedidos.html");
 const keys=["email","nomeSolicitante","telefoneWhats","unidadeEmbarque","numeroPedidoOC","nfeManifestada",
  "tomadorCnpj","coletaIe","entregaCnpj","entregaIe","freteEmpresa","freteMotorista",
  "adiantamentoPct","icms","produto","especie","tag","obs","coordenadasColeta","coordenadasEntrega"];
 for(const key of keys){
  assert.ok(page.includes('name="'+key+'"'),"Form field "+key);
  assert.ok(c.includes('"'+key+'"'),"Backend field "+key);
 }
 const script=load("docs/CADASTRO_DRIVE_APPS_SCRIPT.gs");
 for(const slot of ["nota","nota_coleta","liberacao","rota_pedagio","tabela_antt"]){
  assert.ok(page.includes('data-slot="'+slot+'"'),"Form attachment "+slot);
  assert.ok(c.includes('"'+slot+'"'),"Backend attachment "+slot);
  assert.ok(script.includes('"'+slot+'"'),"Google Drive slot "+slot);
 }
});

test("Cada pedido e documento são separados por transportadora e solicitante",()=>{
 const c=load("worker/src/controllers/abertura-pedidos.js");
 const db=load("worker/migrations/super-admin/0008_abertura_pedidos.sql");
 for(const table of ["tickets","docs","messages","history","sequence"]){
  assert.ok(db.includes("portal_pedidos_"+table),table);
 }
 assert.ok(db.includes("idx_pedidos_numero"));
 assert.ok(db.includes("trg_pedidos_numero"));
 assert.ok(c.includes("WHERE tenant_id=? AND solicitante_id=?"));
 assert.ok(c.includes('if(execView?!executor:!owner)'));
 assert.ok(c.includes('row.executor_id!==p.user'));
 assert.ok(c.includes("WHERE id=? AND tenant_id=? AND solicitante_id=? AND status='RASCUNHO'"));
 assert.ok(c.includes('SLOTS.has(b.slot)'));
});

test("Finalizar requer numero de pedido no sistema e impedir finalizacao sem o campo",()=>{
 const c=load("worker/src/controllers/abertura-pedidos.js");
 const page=load("pages/execucao-pedidos.html");
 const js=load("assets/js/abertura-pedidos.js");
 assert.ok(c.includes('(row.tipo_solicitacao||"PEDIDO")==="PEDIDO"&&!numeroPedidoSistema'));
 assert.ok(c.includes("numero_pedido_sistema=CASE WHEN ?='FINALIZADO'"));
 assert.ok(c.includes('status IN (\'ANDAMENTO\',\'PENDENTE\')'));
 assert.ok(page.includes('name="numeroPedidoSistema"'));
 assert.ok(page.includes('id="pedSystemNumberValue"'));
 assert.ok(page.includes('id="tnMine"'));
 assert.ok(js.includes('numeroPedidoSistema:f.elements.numeroPedidoSistema.value.trim()'));
 assert.ok(js.includes('$("pedSystemNumberValue").textContent=row.numeroPedidoSistema||""'));
});

test("Kanban compacto e chat no mesmo layout, sem duplicar barra global",()=>{
 for(const page of ["solicitacao-pedidos","execucao-pedidos"]){
  const html=load("pages/"+page+".html");
  assert.ok(html.includes('id="tnBoard"'));
  assert.ok(html.includes('id="tnMessages"'));
  assert.ok(html.includes('value="FILA"'));
  assert.ok(html.includes('value="ANDAMENTO"'));
  assert.ok(html.includes('value="PENDENTE"'));
  assert.ok(html.includes('value="FINALIZADO"'));
  assert.ok(!html.includes('class="cad-topbar"'));
 }
 assert.doesNotThrow(()=>new Script(load("assets/js/abertura-pedidos.js")));
 assert.doesNotThrow(()=>new Script(load("assets/js/pedidos-home.js")));
});

test("Permissões e URLs isoladas para GNOVA, Transvale e modelos",()=>{
 const route=load("assets/js/tenant-route.js");
 const guard=load("assets/js/tenant-page.js");
 const home=load("pages/home.html");
 const auth=load("assets/js/auth.js");
 for(const f of ["solicitacao-pedidos","execucao-pedidos"]){
  assert.ok(route.includes('"'+f+'.html"'));
  assert.ok(guard.includes('"'+f+'.html"'));
  assert.ok(auth.includes('feature:"'+f+'"'));
  assert.ok(home.includes('data-feature="'+f+'"'));
  for(const folder of ["gnova","transvale","modelo01","modelo02"]){
   assert.ok(load("pages/"+folder+"/"+f+".html").includes(f+".html"),folder);
  }
 }
 assert.ok(home.includes("__PORTAL_PEDIDOS_MODULES_CONFIRMED"));
 assert.ok(load("assets/js/pedidos-home.js").includes("/v1/abertura-pedidos/config"));
});

test("Workflow valida a API e migra tabelas D1 antes da publicação",()=>{
 const workflow=load(".github/workflows/deploy-portal-hotfix.yml");
 assert.ok(workflow.includes("node --check src/controllers/abertura-pedidos.js"));
 assert.ok(workflow.includes("node --check ../assets/js/abertura-pedidos.js"));
 assert.ok(workflow.includes("node --test tests/abertura-pedidos.test.mjs"));
 const migration=workflow.indexOf("0008_abertura_pedidos.sql");
 const deploy=workflow.indexOf("- name: Publicar Worker");
 assert.ok(migration>0&&deploy>migration);
});
