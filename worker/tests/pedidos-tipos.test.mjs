import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {Script} from "node:vm";
import {normalizedFields,TIPOS_SOLICITACAO} from "../src/controllers/abertura-pedidos.js";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("Seis tipos têm validações próprias e a abertura padrão não muda",()=>{
 assert.deepEqual(Object.keys(TIPOS_SOLICITACAO),[
  "PEDIDO","CORRECAO_PEDIDO","CTE_COMPLEMENTAR","CARTA_CORRECAO","PAGAMENTO","PAGAMENTO_GUIA"
 ]);
 assert.throws(()=>normalizedFields({tipoSolicitacao:"PEDIDO"}),/Campo obrigatório/);
 assert.equal(normalizedFields({tipoSolicitacao:"CORRECAO_PEDIDO",
  dadosEspecificos:{numeroPedidoCorrecao:"18942",textoCorrecao:"Trocar o tomador.\nRetificar a filial."}},"USUARIO").nomeSolicitante,"USUARIO");
 assert.equal(normalizedFields({tipoSolicitacao:"CORRECAO_PEDIDO",
  dadosEspecificos:{numeroPedidoCorrecao:"18942",textoCorrecao:"Trocar o tomador.\nRetificar a filial."}}).numeroPedidoOC,"18942");
 assert.equal(normalizedFields({tipoSolicitacao:"CTE_COMPLEMENTAR",
  dadosEspecificos:{numeroCte:"98765",descricaoComplemento:"Adicionar dados de ICMS."}}).tipoSolicitacao,"CTE_COMPLEMENTAR");
 assert.equal(normalizedFields({tipoSolicitacao:"CARTA_CORRECAO",
  dadosEspecificos:{documentoTipo:"MDFE",numeroDocumento:"12345",textoCarta:"Corrigir a observação."}}).dadosEspecificos.documentoTipo,"MDFE");
 assert.throws(()=>normalizedFields({tipoSolicitacao:"CARTA_CORRECAO",
  dadosEspecificos:{documentoTipo:"OUTRO",numeroDocumento:"12345",textoCarta:"Corrigir"}}),/CT-e ou MDF-e/);
 assert.throws(()=>normalizedFields({tipoSolicitacao:"CTE_COMPLEMENTAR",
  dadosEspecificos:{numeroCte:"98765",descricaoComplemento:""}}),/Campo obrigatório/);
 const pix={ctePagamento:"CT123",placaPagamento:"ABC1D23",nomeBeneficiario:"Motorista",
  cpfCnpjPagamento:"12345678901",formaPagamento:"PIX_IRION",etapaPagamento:"ADIANTAMENTO",pixPagamento:"email@pix.com",bancoPagamento:"Banco principal",agenciaPagamento:"0001",contaPagamento:"98765-0"};
 assert.equal(normalizedFields({tipoSolicitacao:"PAGAMENTO",dadosEspecificos:pix}).dadosEspecificos.pixPagamento,"email@pix.com");
 assert.equal(normalizedFields({tipoSolicitacao:"PAGAMENTO",dadosEspecificos:pix}).dadosEspecificos.bancoPagamento,"Banco principal");
 assert.throws(()=>normalizedFields({tipoSolicitacao:"PAGAMENTO",dadosEspecificos:{...pix,bancoPagamento:""}}),/bancoPagamento/);
 const conjunto=normalizedFields({tipoSolicitacao:"PAGAMENTO",dadosEspecificos:{...pix,etapaPagamento:"ADIANTAMENTO_E_SALDO"}});
 assert.equal(conjunto.dadosEspecificos.etapaPagamento,"ADIANTAMENTO_E_SALDO");
 assert.throws(()=>normalizedFields({tipoSolicitacao:"PAGAMENTO",dadosEspecificos:{...pix,formaPagamento:"DEPOSITO",agenciaPagamento:""}}),/agenciaPagamento/);
 assert.equal(normalizedFields({tipoSolicitacao:"PAGAMENTO",dadosEspecificos:{...pix,formaPagamento:"DEPOSITO",bancoPagamento:"Banco",agenciaPagamento:"001",contaPagamento:"1234"}}).dadosEspecificos.contaPagamento,"1234");
 assert.equal(normalizedFields({tipoSolicitacao:"PAGAMENTO",dadosEspecificos:{...pix,formaPagamento:"DEPOSITO"}}).dadosEspecificos.pixPagamento,"");
 assert.equal(normalizedFields({tipoSolicitacao:"PAGAMENTO_GUIA",dadosEspecificos:{cteGuia:"CT1",nfGuia:"NF2"}}).tipoSolicitacao,"PAGAMENTO_GUIA");
 assert.throws(()=>normalizedFields({tipoSolicitacao:"PAGAMENTO_GUIA",dadosEspecificos:{cteGuia:"CT1"}}),/Campo obrigatório/);
 assert.throws(()=>normalizedFields({tipoSolicitacao:"X",dadosEspecificos:{}}),/Tipo de solicitação inválido/);
});

test("Migração D1 preserva protocolos, números e dados de pedidos existentes",()=>{
 const db=new DatabaseSync(":memory:");
 db.exec(read("worker/migrations/super-admin/0008_abertura_pedidos.sql"));
 const columns=["id","tenant_id","protocolo","solicitante_id","nome_solicitante",
  "telefone_whats","unidade_embarque","numero_pedido_oc","nfe_manifestada","tomador_cnpj",
  "coleta_ie","entrega_cnpj","entrega_ie","frete_empresa","frete_motorista",
  "adiantamento_pct","produto","especie","tag"];
 db.prepare("INSERT INTO portal_pedidos_tickets("+columns.join(",")+") VALUES("+columns.map(()=>"?").join(",")+")")
  .run("pedido-antigo","nova-frota","PED-ANTIGO-1","USUARIO",...columns.slice(4).map(()=>"VALOR"));
 const old=db.prepare("SELECT numero FROM portal_pedidos_tickets WHERE id='pedido-antigo'").get();
 assert.equal(old.numero,1);
 db.exec(read("worker/migrations/super-admin/0009_pedidos_tipos_solicitacao.sql"));
 db.exec(read("worker/migrations/super-admin/0010_chamados_financeiro.sql"));
 const preserved=db.prepare("SELECT tipo_solicitacao,dados_especificos_json,numero FROM portal_pedidos_tickets WHERE id='pedido-antigo'").get();
 assert.equal(preserved.tipo_solicitacao,"PEDIDO");
 assert.equal(preserved.dados_especificos_json,"{}");
 assert.equal(preserved.numero,1);
 db.prepare("UPDATE portal_pedidos_tickets SET tipo_solicitacao=?,dados_especificos_json=? WHERE id=?")
  .run("CORRECAO_PEDIDO",JSON.stringify({textoCorrecao:"Trocar o tomador"}),"pedido-antigo");
 const after=db.prepare("SELECT * FROM portal_pedidos_tickets WHERE id='pedido-antigo'").get();
 assert.equal(JSON.parse(after.dados_especificos_json).textoCorrecao,"Trocar o tomador");
 assert.equal(after.numero,1);
 assert.equal(after.categoria_chamado,"");
 assert.equal(db.prepare("SELECT tipo_anexo FROM portal_pedidos_docs LIMIT 0").columns().length,1);
 assert.throws(()=>db.prepare("UPDATE portal_pedidos_tickets SET tipo_solicitacao='TIPO_FALSO' WHERE id='pedido-antigo'").run());
 db.close();
});

test("Tela tem seletor padrão Pedido e campos distintos com IDs únicos",()=>{
 const html=read("pages/solicitacao-pedidos.html");
 const exec=read("pages/execucao-pedidos.html");
 const js=read("assets/js/abertura-pedidos.js");
 const css=read("assets/css/abertura-pedidos.css");
 assert.match(html,/<select id="tnKindSelect"/);
 assert.match(html,/<option value="PEDIDO">/);
 for(const tipo of ["CORRECAO_PEDIDO","CTE_COMPLEMENTAR","CARTA_CORRECAO","PAGAMENTO","PAGAMENTO_GUIA"]){
  assert.ok(html.includes('data-kind-fields="'+tipo+'"'),tipo);
  assert.ok(css.includes('[data-kind="'+tipo+'"]'),tipo);
  assert.ok(js.includes(tipo),tipo);
 }
 for(const field of ["numeroPedidoCorrecao","textoCorrecao","numeroCte",
  "descricaoComplemento","documentoTipo","numeroDocumento","textoCarta"]){
  assert.ok(html.includes('name="'+field+'"'),field);
  assert.ok(js.includes(field),field);
 }
 assert.ok(html.includes('id="pedEtapaPagamento"'));
 assert.ok(html.includes('<option value="ADIANTAMENTO_E_SALDO">Adiantamento e Saldo</option>'));
 for(const campo of ["bancoPagamento","agenciaPagamento","contaPagamento"]){
  assert.ok(html.includes('name="'+campo+'"'),campo);
 }
 assert.ok(js.includes('label.dataset.pedPayment==="bank"||!deposit'));
 assert.ok(css.includes('#pedFormaPagamento[data-method="PIX_IRION"]'));
 assert.ok(css.includes('#pedFormaPagamento[data-method="DEPOSITO"]'));
 assert.ok(css.includes('#pedEtapaPagamento[data-stage="ADIANTAMENTO_E_SALDO"]'));
  assert.ok(html.includes('id="pedidoComplementDoc"'));
 assert.ok(html.includes('data-slot="liberacao" required disabled'));
 assert.ok(html.includes('id="pedidoOriginalFields"'));
 assert.ok(exec.includes('id="tnDetailTipo"'));
 assert.ok(js.includes('form.elements.tipoSolicitacao.value=formKind'));
 assert.ok(js.includes('renderDocs(id,data.anexos||[],kind)'));
 assert.doesNotThrow(()=>new Script(js));
});

test("API obriga liberação do cliente no CT-e e só exige número de sistema no pedido original",()=>{
 const api=read("worker/src/controllers/abertura-pedidos.js");
 assert.ok(api.includes('row.tipo_solicitacao==="CTE_COMPLEMENTAR"'));
 assert.ok(api.includes("Anexe a liberação do cliente antes de enviar"));
 assert.ok(api.includes('row.tipo_solicitacao==="CORRECAO_PEDIDO"'));
 assert.ok(api.includes("INSERT INTO portal_pedidos_messages"));
 assert.ok(api.includes('effectiveKind(row)==="PEDIDO"&&!numeroPedidoSistema'));
});
