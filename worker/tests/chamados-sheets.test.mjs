import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sheetsConfig} from "../src/services/chamados-sheets.js";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
test("sem ativação explícita a transportadora continua no D1",async()=>{
 const cfg=await sheetsConfig({TENANT_BRANDS:null},"nova-frota");
 assert.equal(cfg.mode,"d1");
 assert.ok(cfg.sheetId.length>25);
 const gnova=await sheetsConfig({TENANT_BRANDS:null},"teste-01");
 const transvale=await sheetsConfig({TENANT_BRANDS:null},"transvale-01");
 assert.notEqual(cfg.sheetId,gnova.sheetId);
 assert.notEqual(gnova.sheetId,transvale.sheetId);
});
test("a ativação somente aceita uma configuração validada no R2",async()=>{
 const env={TENANT_BRANDS:{get:async()=>({json:async()=>({mode:"sheets",sheetId:"11bdFewENA_lUZ2pwIb295RmlubnW_cvVYRZKbo1vWa4",verifiedAt:"2026-11-20T00:00:00Z"})})}};
 const cfg=await sheetsConfig(env,"nova-frota");
 assert.equal(cfg.mode,"sheets");
 assert.ok(cfg.verifiedAt);
 const old=await sheetsConfig({TENANT_BRANDS:{get:async()=>null}},"nova-frota");
 assert.equal(old.mode,"d1");
});
test("somente migração idempotente com comparação de quantidade e fingerprint pode ativar",()=>{
 const source=read("worker/src/services/chamados-sheets.js");
 assert.match(source,/d1\.count!==Number\(sheet\.count\)\|\|d1\.fingerprint!==sheet\.fingerprint/);
 assert.match(source,/mode:"sheets",verifiedAt,actor:p\.user/);
 assert.match(source,/if\(!p\.ownerSupport\)return errorResponse/);
 assert.match(source,/WHERE tenant_id=\? ORDER BY id LIMIT 20 OFFSET \?/);
 assert.match(source,/COALESCE\(NULLIF\(tipo_anexo,''\),slot\) AS slot/);
 const controller=read("worker/src/controllers/abertura-pedidos.js");
 assert.match(controller,/if\(googleSheets\.mode==="sheets"\)/);
 assert.match(controller,/sheetsGateway\(req,p,view,flags,executor,kinds,conf,googleSheets,normalizedFields\)/);
});
test("Apps Script preserva upload e download existentes e organiza onze abas",()=>{
 const script=read("docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs");
 for(const tab of ["SOLICITACOES","PEDIDOS_DETALHES","CORRECOES","PAGAMENTOS","ANEXOS",
  "MENSAGENS","HISTORICO","AUDITORIA","EXCLUIDOS","USUARIOS","CONFIG"])
  assert.ok(script.includes(tab),tab);
 for(const operation of ["health","import","list","historico","get","create","updateDraft","enviar",
  "assumir","situacao","mensagens","upload","download","ocultar","restaurar","corrigir"])
  assert.ok(script.includes('op==="'+operation+'"')||script.includes('"ocultar","restaurar"'),operation);
 assert.ok(script.includes('if(p.action==="upload")'));
 assert.ok(script.includes('if(p.action==="download")'));
 assert.ok(script.includes("function instalarAuditoriaChamados"));
 assert.ok(script.includes("LockService.getScriptLock"));
 assert.match(script,/Utilities\.formatDate\(s,"Etc\/GMT","yyyy-MM-dd HH:mm:ss"\)/);
 assert.match(script,/\^\\d\{4\}-\\d\\d-\\d\\d\[ T\]/);
});

test("início do zero é explícito, exige planilha completamente vazia e preserva histórico antigo no D1",()=>{
 const service=read("worker/src/services/chamados-sheets.js");
 const admin=read("assets/js/super-admin-chamados-sheets.js");
 const page=read("pages/super-admin.html");
 assert.ok(service.includes('path==="iniciar-vazio"&&request.method==="POST"'));
 assert.ok(service.includes('body.confirmacao!=="INICIAR DO ZERO"'));
 assert.ok(service.includes('body.sheetId!==options.sheetId'));
 assert.ok(service.includes('remote.schema!==1||remote.transportadora!==p.id'));
 assert.ok(service.includes('const emptyFingerprint=await digest("")'));
 assert.ok(service.includes('Number(group.count)!==0'));
 assert.ok(service.includes('group.fingerprint!==emptyFingerprint'));
 assert.ok(service.includes('d1HistoricoPreservado:'));
 assert.ok(!service.includes('DELETE FROM portal_pedidos_'));
 assert.ok(admin.includes('pedSheetsStartEmpty'));
 assert.ok(admin.includes('await api("iniciar-vazio","POST"'));
 assert.ok(page.includes('3B. Iniciar base vazia'));
});
