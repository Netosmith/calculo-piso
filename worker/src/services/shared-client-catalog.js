// Central read-only, cross-transportadora client NAME catalog.
// The original Nova Frota CLIENTES sheet is the authoritative list.
// NEVER copy addresses, contacts, prices, phone numbers or internal columns.
import {callAppsScript} from "./appscript.js";
import {success,errorResponse} from "../utils/response.js";

const CACHE_KEY="tenant:shared-client-names:v1";
const CACHE_SECONDS=120;
const MAX_CLIENTS=2500;
const clean=value=>String(value??"").trim().replace(/\s+/g," ").normalize("NFC");
function rowsFrom(value,depth=0){
 if(Array.isArray(value))return value;
 if(depth>6||!value||typeof value!=="object")return [];
 for(const key of ["data","rows","items","clientes","result"]){
  if(Object.hasOwn(value,key)){
   const rows=rowsFrom(value[key],depth+1);
   if(rows.length||Array.isArray(value[key]))return rows;
  }
 }
 return [];
}
export function sanitizeSharedClients(raw){
 const names=new Map();
 for(const row of rowsFrom(raw).slice(0,10000)){
  if(!row||typeof row!=="object"||Array.isArray(row))continue;
  const active=clean(row.ativo??row.Ativo??"SIM").toUpperCase();
  if(["NAO","NÃO","FALSE","0","INATIVO"].includes(active))continue;
  const name=clean(row.cliente??row.Cliente??row.nomeCliente??"").toUpperCase();
  if(!name||name.length>140||/[<>\x00-\x1f]/.test(name))continue;
  const rank=Number(row.ordem??row.Ordem);
  names.set(name,{
   id:"global:"+name,cliente:name,
   ordem:Number.isSafeInteger(rank)&&rank>=0&&rank<100000?rank:0,
   ativo:"SIM"
  });
  if(names.size>=MAX_CLIENTS)break;
 }
 return [...names.values()].sort((a,b)=>
  (a.ordem||99999)-(b.ordem||99999)||a.cliente.localeCompare(b.cliente,"pt-BR"));
}
export async function sharedClientNamesController(env){
 if(!env.APPS_SCRIPT_URL||!env.PORTAL_KEY)
  return errorResponse("Catálogo central de clientes indisponível.",503);
 if(env.SESSIONS){
  try{
   const cache=await env.SESSIONS.get(CACHE_KEY);
   if(cache){
    const clients=JSON.parse(cache);
    if(Array.isArray(clients))return success({clientes:clients,origem:"catalogo-compartilhado"});
   }
  }catch(_){}
 }
 try{
  const response=await callAppsScript(env,{
   action:"portal_gateway",method:"POST",
   params:{
    module:"cadastros",action:"read",
    payload:{resource:"clientes",operation:"list"},
    auth:{usuario:"PORTAL-CATALOGO",perfil:"ADMINISTRADOR",
      estado:"GO",estados:["GO","MT"]}
   }
  });
  if(response?.ok!==true)throw new Error("Catálogo central recusou a leitura.");
  const clientes=sanitizeSharedClients(response.data);
  if(env.SESSIONS){
   try{await env.SESSIONS.put(CACHE_KEY,JSON.stringify(clientes),
    {expirationTtl:CACHE_SECONDS});}catch(_){}
  }
  return success({clientes,origem:"catalogo-compartilhado"});
 }catch(error){
  console.warn("[SHARED CLIENT CATALOG] Read unavailable",{
   type:error?.name||"Error"
  });
  return errorResponse("Não foi possível ler os clientes compartilhados.",502);
 }
}

/**
 * Inclusão limitada no catálogo central, destinada a ADMINISTRADORES de
 * transportadoras com módulo Cadastros habilitado.
 *
 * Não recebe módulo, operação, autenticador, planilha ou chave do browser.
 * Escreve SOMENTE um novo nome de cliente na fonte central da Nova Frota.
 * Não há endpoint de editar, desativar ou excluir.
 */
export async function createSharedClientController(env,principal,request){
 if(!env.APPS_SCRIPT_URL||!env.PORTAL_KEY)
  return errorResponse("Catálogo central indisponível.",503);
 let body;
 try{
  const raw=await request.text();
  if(!raw||raw.length>600)return errorResponse("Dados do cliente inválidos.",400);
  body=JSON.parse(raw);
 }catch(_){return errorResponse("Dados do cliente inválidos.",400)}
 if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).length!==1||!Object.hasOwn(body,"cliente")||
    typeof body.cliente!=="string")
  return errorResponse("Informe somente o nome do novo cliente.",400);
 const cliente=clean(body.cliente).toUpperCase();
 if(cliente.length<2||cliente.length>140||/[<>\\\x00-\x1f\x7f]/.test(cliente))
  return errorResponse("Nome do cliente inválido.",400);
 const user=clean(principal.user_id||"").slice(0,70);
 const tenant=clean(principal.tenant_id||"").slice(0,70);
 // Consultar a fonte central fresca para não depender do cache compartilhado.
 let existing;
 try{
  const catalog=await callAppsScript(env,{
   action:"portal_gateway",method:"POST",
   params:{module:"cadastros",action:"read",payload:{resource:"clientes",operation:"list"},
    auth:{usuario:"PORTAL-CATALOGO",perfil:"ADMINISTRADOR",estado:"GO",estados:["GO","MT"]}}
  });
  if(catalog?.ok!==true)throw new Error("Catalog read rejected");
  existing=sanitizeSharedClients(catalog.data);
 }catch(err){
  console.warn("[SHARED CLIENT] Cannot verify duplicates",{type:err?.name||"Error"});
  return errorResponse("Não foi possível conferir o catálogo antes de incluir o cliente.",503);
 }
 if(existing.some(row=>row.cliente===cliente))
  return errorResponse("Este cliente já está cadastrado no catálogo compartilhado.",409);
 try{
  // Mesma operação usada pela tela central de Cadastros da Nova Frota.
  const created=await callAppsScript(env,{
   action:"portal_gateway",method:"POST",
   params:{
    module:"cadastros",action:"create",
    payload:{resource:"clientes",operation:"add",cliente,ordem:"0",ativo:"SIM"},
    auth:{usuario:"PORTAL-CATALOGO",perfil:"ADMINISTRADOR",
      estado:"GO",estados:["GO","MT"]}
   }
  });
  if(created?.ok!==true)
   return errorResponse("A base central não confirmou a inclusão do cliente.",502);
  // Cache inclui apenas NOMES de clientes, não dados operacionais.
  if(env.SESSIONS){
   try{await env.SESSIONS.delete(CACHE_KEY)}catch(_){}
  }
  if(env.TENANTS_DB){
   try{
    await env.TENANTS_DB.prepare(
      "INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)"
    ).bind(crypto.randomUUID(),user,tenant,"catalog.client.create",
      JSON.stringify({cliente})).run();
   }catch(error){
    console.warn("[SHARED CLIENT] Audit write unavailable",{type:error?.name||"Error"});
   }
  }
  return success({cliente:{id:"global:"+cliente,cliente,ordem:0,ativo:"SIM"}},201);
 }catch(err){
  console.warn("[SHARED CLIENT] Create rejected",{type:err?.name||"Error"});
  return errorResponse("Não foi possível salvar o novo cliente na base central.",502);
 }
}
