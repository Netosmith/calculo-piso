// Central read-only, cross-transportadora client NAME catalog.
// The original Nova Frota CLIENTES sheet is the authoritative list.
// NEVER copy addresses, contacts, prices, phone numbers or internal columns.
import {callAppsScript} from "./appscript.js";
import {clientLogoKey,validImageSignature} from "../controllers/client-logos.js";
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
  return errorResponse("Cadastro de clientes indisponível.",503);
 const MAX_FILE_BYTES=2*1024*1024;
 const TYPES=new Set(["image/png","image/jpeg","image/webp"]);
 let cliente="",logo=null,logoBytes=null,logoType="";
 try{
  const ctype=String(request.headers.get("Content-Type")||"").toLowerCase();
  if(ctype.startsWith("multipart/form-data")){
   const size=Number(request.headers.get("Content-Length")||0);
   if(size>MAX_FILE_BYTES+10000)return errorResponse("Imagem acima de 2 MB.",413);
   const data=await request.formData();
   const keys=[...data.keys()];
   if(!keys.length||keys.some(k=>!["cliente","ativo","logo"].includes(k))||
      keys.some(k=>data.getAll(k).length!==1))
    return errorResponse("Campos não permitidos no cadastro.",400);
   if(typeof data.get("cliente")!=="string"||data.get("ativo")!=="SIM")
    return errorResponse("Informe o nome e mantenha o cliente ATIVO.",400);
   cliente=clean(data.get("cliente")).toUpperCase();
   logo=data.get("logo");
   if(logo!==null){
    if(typeof logo!=="object"||typeof logo.arrayBuffer!=="function"||
       typeof logo.size!=="number"||logo.size<8||logo.size>MAX_FILE_BYTES)
     return errorResponse("Logo inválida ou acima de 2 MB.",400);
    logoType=String(logo.type||"").toLowerCase();
    if(!TYPES.has(logoType))return errorResponse("Use PNG, JPG ou WEBP para a logo.",415);
    if(!env.CLIENT_LOGOS)return errorResponse("Armazenamento de logos indisponível.",503);
    logoBytes=await logo.arrayBuffer();
    if(logoBytes.byteLength>MAX_FILE_BYTES||!validImageSignature(logoType,logoBytes))
     return errorResponse("O arquivo não contém uma imagem válida.",415);
   }
  }else if(ctype.includes("application/json")){
   const raw=await request.text();
   if(!raw||raw.length>650)return errorResponse("Dados do cliente inválidos.",400);
   const body=JSON.parse(raw);
   if(!body||Array.isArray(body)||typeof body!=="object"||
      Object.keys(body).some(k=>!["cliente","ativo"].includes(k))||
      typeof body.cliente!=="string"||!["SIM",undefined].includes(body.ativo))
    return errorResponse("Informe somente nome e status ATIVO.",400);
   cliente=clean(body.cliente).toUpperCase();
  }else return errorResponse("Formato do cadastro não aceito.",415);
 }catch(_){return errorResponse("Dados do cliente ou da logo inválidos.",400)}
 if(cliente.length<2||cliente.length>140||/[<>\\\x00-\x1f\x7f]/.test(cliente))
  return errorResponse("Nome do cliente inválido.",400);
 const user=clean(principal.user_id||"").slice(0,70);
 const tenant=clean(principal.tenant_id||"").slice(0,70);
 // Rejeita também nomes INATIVOS: um cadastro antigo jamais pode ser
 // reaberto para sobrescrever logo pelo fluxo limitado dos tenants.
 try{
  const catalog=await callAppsScript(env,{
   action:"portal_gateway",method:"POST",
   params:{module:"cadastros",action:"read",payload:{resource:"clientes",operation:"list"},
    auth:{usuario:"PORTAL-CATALOGO",perfil:"ADMINISTRADOR",estado:"GO",estados:["GO","MT"]}}
  });
  if(catalog?.ok!==true)throw new Error("Catalog read rejected");
  const exists=rowsFrom(catalog.data).some(row=>{
   if(!row||typeof row!=="object"||Array.isArray(row))return false;
   return clean(row.cliente??row.Cliente??row.nomeCliente??"").toUpperCase()===cliente;
  });
  if(exists)return errorResponse("Este cliente já está cadastrado.",409);
  if(logoBytes){
   const oldLogo=await env.CLIENT_LOGOS.head(clientLogoKey(cliente));
   if(oldLogo)return errorResponse("Já existe uma logo para este nome. Procure o administrador central.",409);
  }
 }catch(err){
  console.warn("[CLIENT REGISTER] Duplicate check unavailable",{type:err?.name||"Error"});
  return errorResponse("Não foi possível conferir o cadastro antes de incluir.",503);
 }
 try{
  const created=await callAppsScript(env,{
   action:"portal_gateway",method:"POST",
   params:{module:"cadastros",action:"create",
    payload:{resource:"clientes",operation:"add",cliente,ordem:"0",ativo:"SIM"},
    auth:{usuario:"PORTAL-CATALOGO",perfil:"ADMINISTRADOR",
      estado:"GO",estados:["GO","MT"]}}
  });
  if(created?.ok!==true)
   return errorResponse("A base de clientes não confirmou o cadastro.",502);
 }catch(err){
  console.warn("[CLIENT REGISTER] Create failed",{type:err?.name||"Error"});
  return errorResponse("Não foi possível cadastrar o cliente.",502);
 }
 let logoSaved=false,logoError="";
 if(logoBytes){
  try{
   await env.CLIENT_LOGOS.put(clientLogoKey(cliente),logoBytes,{
    httpMetadata:{contentType:logoType,cacheControl:"public, max-age=300, must-revalidate"},
    customMetadata:{
      cliente,atualizadoPor:("TENANT-"+tenant+"-"+user).slice(0,100),
      atualizadoEm:new Date().toISOString()
    }
   });
   logoSaved=true;
  }catch(err){
   logoError="Cliente cadastrado, mas a logo não foi gravada. Solicite apoio do administrador.";
   console.warn("[CLIENT REGISTER] Logo write failed",{type:err?.name||"Error"});
  }
 }
 if(env.SESSIONS){
  try{await env.SESSIONS.delete(CACHE_KEY)}catch(_){}
 }
 if(env.TENANTS_DB){
  try{
   await env.TENANTS_DB.prepare(
    "INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)"
   ).bind(crypto.randomUUID(),user,tenant,"catalog.client.create",
     JSON.stringify({cliente,logoIncluded:Boolean(logoBytes),logoSaved})).run();
  }catch(err){console.warn("[CLIENT REGISTER] Audit unavailable",{type:err?.name||"Error"})}
 }
 return success({
  cliente:{id:"global:"+cliente,cliente,ordem:0,ativo:"SIM"},
  logoIncluded:Boolean(logoBytes),logoSaved,logoError
 },201);
}
