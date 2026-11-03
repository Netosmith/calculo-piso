// Private tenant Apps Script integration stored in existing R2, shared by
// portalfrete-api and the Cloudflare Access-gated Super Admin Worker.
// Never return the execution URL or gateway key to ordinary tenant sessions.
import {errorResponse,success} from "../utils/response.js";
import {callAppsScript} from "./appscript.js";
import {canRunGatewayAction} from "./permissions.js";

const SLUG=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SHEET_ID=/^[A-Za-z0-9_-]{20,160}$/;
const UF=/^(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/;
const KEY=/^[A-Za-z0-9_\-!@#$%^&*+=]{24,256}$/;
const BASE_UFS=new Set(["GO","MT","SP","MS","BA","PR","SC","RO","TO","MA"]);
export const validFreightBase=base=>BASE_UFS.has(String(base||"").toUpperCase());
const integrationObjectKey=(id,base="")=>base
 ? "tenant/"+id+"/private/base-"+base.toLowerCase()+"-apps-script-v1.json"
 : "tenant/"+id+"/private/apps-script-v1.json";
function validTenant(id){return typeof id==="string" && id!=="nova-frota" &&
 id.length<=48 && SLUG.test(id);}
export function validScriptUrl(value){
 if(typeof value!=="string"||value.length>400)return false;
 try{
  const parsed=new URL(value);
  return parsed.protocol==="https:"&&parsed.hostname==="script.google.com"&&
   parsed.username===""&&parsed.password===""&&parsed.search===""&&parsed.hash===""&&
   /^\/macros\/s\/[A-Za-z0-9_-]{30,250}\/exec$/.test(parsed.pathname);
 }catch{return false;}
}
function safeConfig(value){
 if(!value || typeof value!=="object" || !validScriptUrl(value.scriptUrl) ||
  !SHEET_ID.test(value.spreadsheetId||"") || !KEY.test(value.gatewayKey||"") ||
  !UF.test(value.estado||""))return null;
 return {scriptUrl:value.scriptUrl,spreadsheetId:value.spreadsheetId,
  gatewayKey:value.gatewayKey,estado:value.estado,enabled:value.enabled===true};
}
export async function readTenantIntegration(env,id,base=""){
 if(!validTenant(id)||!env.TENANT_BRANDS||(base&&!validFreightBase(base)))return null;
 const object=await env.TENANT_BRANDS.get(integrationObjectKey(id,base));
 if(!object)return null;
 const data=await object.json();
 return safeConfig(data);
}
function summary(config){
 return {configured:Boolean(config),enabled:config?.enabled===true,
  spreadsheetId:config?.spreadsheetId||null,estado:config?.estado||null,
  scriptUrlConfigured:Boolean(config?.scriptUrl),
  gatewayKeyConfigured:Boolean(config?.gatewayKey)};
}
// This read is only invoked AFTER the Super Admin owner identity gate.
export async function adminReadTenantIntegration(env,id,base=""){
 if(!validTenant(id))return errorResponse("Transportadora invalida.",400);
 if(!env.TENANTS_DB||!env.TENANT_BRANDS)return errorResponse("Armazenamento indisponivel.",503);
 try{
  const tenant=await env.TENANTS_DB.prepare("SELECT id FROM portal_tenants WHERE id=?").bind(id).first();
  if(!tenant)return errorResponse("Transportadora nao encontrada.",404);
  return success({tenantId:id,base:base||"geral",integracao:summary(await readTenantIntegration(env,id,base))});
 }catch{
  return errorResponse("Nao foi possivel consultar a integracao.",503);
 }
}
// Access-owner-only: caller must check same-origin, Content-Type and write opt-in.
export async function adminWriteTenantIntegration(request,env,actor,id,base=""){
 if(!validTenant(id))return errorResponse("Transportadora invalida.",400);
 if(!env.TENANTS_DB||!env.TENANT_BRANDS)return errorResponse("Armazenamento indisponivel.",503);
 let payload;
 try{
  const raw=await request.text();
  if(raw.length>3000)throw Error("large");
  payload=JSON.parse(raw);
  if(!payload||typeof payload!=="object"||Array.isArray(payload)||
   Object.keys(payload).some(k=>!["scriptUrl","spreadsheetId","gatewayKey","estado","enabled"].includes(k)))throw Error("shape");
 }catch{return errorResponse("Dados de integracao invalidos.",400);}
 try{
  const tenant=await env.TENANTS_DB.prepare("SELECT id FROM portal_tenants WHERE id=?").bind(id).first();
  if(!tenant)return errorResponse("Transportadora nao encontrada.",404);
  const previous=await readTenantIntegration(env,id,base);
  const candidate={
   scriptUrl:payload.scriptUrl??previous?.scriptUrl,
   spreadsheetId:payload.spreadsheetId??previous?.spreadsheetId,
   gatewayKey:payload.gatewayKey||previous?.gatewayKey,
   estado:payload.estado??previous?.estado,
   enabled:payload.enabled===true
  };
  const config=safeConfig(candidate);
  if(!config)return errorResponse("Informe URL do Apps Script, ID da planilha, UF e chave exclusiva (minimo 24 caracteres).",400);
  if(base&&(!validFreightBase(base)||config.estado!==base))
    return errorResponse("UF da integracao diferente da base operacional.",400);
  // Fail closed: new integrations start DISABLED, unless the owner explicitly
  // confirms enablement; the Apps Script must be validated against the copy.
  if(!previous&&config.enabled)return errorResponse("Salve primeiro a integracao desativada e valide a planilha antes de ativar.",409);
  // A dedicated base must prove both tenant and spreadsheet identity at activation.
  // Never rely on a UI checkbox or a copied sheet ID alone.
  if(base&&config.enabled){
   const ping=await callAppsScript({
    ...env,APPS_SCRIPT_URL:config.scriptUrl,PORTAL_KEY:config.gatewayKey
   },{action:"gateway_ping",method:"GET",params:{}});
   if(!ping?.ok||ping.data?.gateway!=="authorized"||
      ping.data?.transportadoraId!==id||ping.data?.spreadsheetId!==config.spreadsheetId)
     return errorResponse("Base nao validada: Apps Script ou planilha pertence a outro vinculo.",409);
  }
  await env.TENANT_BRANDS.put(integrationObjectKey(id,base),JSON.stringify(config),{
   httpMetadata:{contentType:"application/json"}
  });
  await env.TENANTS_DB.prepare(
   "INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES(?,?,?,?,?)"
  ).bind(crypto.randomUUID(),actor,id,base?"base.integration.update":"integration.update",JSON.stringify({base:base||"geral",
   provider:"apps-script",enabled:config.enabled,estado:config.estado
  })).run();
  return success({tenantId:id,base:base||"geral",integracao:summary(config)});
 }catch(error){
  console.error("[TENANT INTEGRATION] write failed",{type:error?.name||"Error"});
  return errorResponse("Nao foi possivel salvar a integracao.",503);
 }
}
/**
 * Owner-only, read-only connectivity check. This does not require the
 * integration to be enabled and never reads freight/user rows.
 * Apps Script gateway_ping authenticates the configured key and reports
 * its bound tenant / spreadsheet identity. Nothing sensitive is reflected.
 */
export async function adminTestTenantIntegration(env,id,base=""){
 if(!validTenant(id))return errorResponse("Transportadora invalida.",400);
 if(!env.TENANTS_DB||!env.TENANT_BRANDS)return errorResponse("Infraestrutura da integracao indisponivel.",503);
 try{
  const tenant=await env.TENANTS_DB.prepare("SELECT id FROM portal_tenants WHERE id=?").bind(id).first();
  if(!tenant)return errorResponse("Transportadora nao encontrada.",404);
  const config=await readTenantIntegration(env,id,base);
  if(!config)return errorResponse("Configure e salve primeiro a integracao da transportadora.",409);
  // A GET on the owner UI triggers only the hardcoded gateway_ping command.
  // Never accept a module, action, spreadsheetId or script URL from the browser.
  const reply=await callAppsScript({
   ...env,APPS_SCRIPT_URL:config.scriptUrl,PORTAL_KEY:config.gatewayKey
  },{action:"gateway_ping",method:"GET",params:{}});
  if(!reply?.ok || !reply?.data || reply.data.gateway!=="authorized"){
   return errorResponse("Apps Script nao confirmou a autorizacao do gateway.",502);
  }
  const tenantMatch=reply.data.transportadoraId===id;
  const spreadsheetMatch=reply.data.spreadsheetId===config.spreadsheetId;
  if(!tenantMatch||!spreadsheetMatch)
   return errorResponse("Apps Script conectado a outra empresa ou planilha. Integracao continua sem validacao.",409,{
    tenantMatch,spreadsheetMatch
   });
  return success({tenantId:id,base:base||"geral",conectado:true,gatewayAutorizado:true,
   empresaCorreta:true,planilhaCorreta:true,integracaoAtiva:config.enabled});
 }catch(error){
  // Do not log script URLs, keys, raw remote bodies, or tenant records.
  console.error("[TENANT INTEGRATION] read-only ping failed",{type:error?.name||"Error"});
  return errorResponse("Nao foi possivel validar a conexao com o Apps Script. Confira a implantacao e a chave.",502);
 }
}
export async function callTenantAppScript(env,principal,modules,payload){
 const module=String(payload?.module||"").trim().toLowerCase();
 const action=String(payload?.action||"").trim().toLowerCase();
 const role=String(principal.role||"").toUpperCase();
 // The Home KPI request is read-only and belongs to every non-PISO tenant
 // with at least one enabled module. Never allow a tenant-wide D1 fallback.
 const allowed=modules.includes(module) ||
  (module==="home" && action==="read" && role!=="PISO" && modules.length>0);
 const permissionSession={perfil:role};
 const permissionModule=role==="PISO"&&module==="piso"?"piso2":module;
 if(!allowed||!canRunGatewayAction(permissionSession,permissionModule,action,payload?.params))
  return errorResponse("Acao nao permitida para este perfil ou transportadora.",403);
 const base=module.match(/^fretes-(go|mt|sp|ms|ba|pr|sc|ro|to|ma)$/)?.[1].toUpperCase()||"";
 const config=await readTenantIntegration(env,principal.tenant_id,base);
 if(!config||!config.enabled)return errorResponse("Planilha desta transportadora ainda nao vinculada.",503);
 const requestPayload=payload.params&&typeof payload.params==="object"&&!Array.isArray(payload.params)?payload.params:{};
 const result=await callAppsScript({
  ...env,APPS_SCRIPT_URL:config.scriptUrl,PORTAL_KEY:config.gatewayKey
 },{
  action:"portal_gateway",method:"POST",
  params:{
   // Each dedicated base has its own validated Apps Script + Sheets.
   // The established fretes protocol runs inside that base's isolated script.
   module:base?"fretes":module,action,payload:requestPayload,
   auth:{usuario:principal.user_id,nome:principal.user_id,
    perfil:role,estado:config.estado,estados:[config.estado]}
  }
 });
 if(!result?.ok)return errorResponse("Apps Script da transportadora recusou a operacao.",502);
 // Preserve the same gateway envelope consumed by legacy pages; nothing here
 // is read from, cached under, or sent to Nova Frota's Apps Script.
 return success({data:result});
}
