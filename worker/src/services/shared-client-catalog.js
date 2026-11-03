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
