// Matriz de acessos gerenciada exclusivamente pelo Super Admin.
// Liberação efetiva = módulos ativos da transportadora ∩ matriz do perfil.
// Este arquivo é a fonte compartilhada entre API, sessões e painel administrativo.
import {TENANT_MODULES} from "../config/tenant-modules.js";
import {NOVA_FROTA_MANAGED_MODULES} from "./nova-frota-modules.js";
import {errorResponse,success} from "../utils/response.js";

export const PROFILE_ROLES=Object.freeze(["ADMINISTRADOR","COMERCIAL","OPERACIONAL","GOADM","PISO"]);
export const PROFILE_MODULES=Object.freeze([...new Set([...TENANT_MODULES,...NOVA_FROTA_MANAGED_MODULES])]);
const KEYS=new Set(PROFILE_MODULES);
const UF=/^fretes-(?:ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)$/;
const ID=/^(?:nova-frota|[a-z][a-z0-9-]{2,48})$/;
const storageKey=id=>"tenant/"+id+"/private/profile-access-v1.json";
const roleName=value=>String(value||"").trim().toUpperCase();
const isLegacy=id=>id==="nova-frota";

function availableForCompany(id){
 return PROFILE_MODULES.filter(module=>isLegacy(id)||
  !["fretes2","funcionarios","relatorio"].includes(module));
}
function normalizeModules(id,role,values){
 if(!Array.isArray(values))return [];
 const allowed=new Set(values);
 return availableForCompany(id).filter(module=>allowed.has(module)&&
   !(role==="PISO"&&module!=="piso2")&&
   !(role==="COMERCIAL"&&["cadastros","funcionarios"].includes(module)));
}
export function defaultProfileModules(id,role){
 const all=availableForCompany(id);
 if(role==="ADMINISTRADOR")return all;
 if(role==="COMERCIAL")return normalizeModules(id,role,all);
 if(role==="GOADM")return all.filter(x=>x==="administrativo");
 if(role==="PISO")return all.filter(x=>x==="piso2");
 if(role==="OPERACIONAL")return all.filter(x=>
   ["piso","piso2","fretes","fretes2","divulgacao","controle","ordem",
    "estadias","monitoramento","fretes-mercado","embarques","chamados",
    "cadastro-solicitacoes","solicitacao-troca-notas","solicitacao-pedidos"].includes(x)||
    UF.test(x));
 return [];
}
export function defaultProfileAccess(id){
 return Object.fromEntries(PROFILE_ROLES.map(role=>[role,defaultProfileModules(id,role)]));
}
export async function readProfileAccess(env,id){
 if(!ID.test(id))throw new Error("Identificador de transportadora inválido.");
 if(!env?.TENANT_BRANDS)throw new Error("Armazenamento de perfis indisponível.");
 const raw=await env.TENANT_BRANDS.get(storageKey(id));
 const defaults=defaultProfileAccess(id);
 if(!raw)return {profiles:defaults,configured:false};
 const saved=await raw.json();
 if(saved?.version!==1||!saved.profiles||typeof saved.profiles!=="object"||
   Array.isArray(saved.profiles)||PROFILE_ROLES.some(role=>!Array.isArray(saved.profiles[role])))
  throw new Error("Configuração de perfis inválida.");
 const profiles={};
 for(const role of PROFILE_ROLES){
  const list=saved.profiles[role];
  if(list.length>PROFILE_MODULES.length||
    list.some(key=>typeof key!=="string"||!KEYS.has(key))||
    new Set(list).size!==list.length)throw new Error("Configuração de perfis inválida.");
  // ADMINISTRADOR é sempre pleno dentro dos módulos ativos; PISO jamais recebe outros.
  profiles[role]=role==="ADMINISTRADOR"?defaults.ADMINISTRADOR:normalizeModules(id,role,list);
 }
 return {profiles,configured:true,updatedAt:saved.updatedAt||null};
}
export async function modulesForProfile(env,id,profile,enabledModules,ownerSupport=false){
 const enabled=Array.isArray(enabledModules)?enabledModules.filter(k=>KEYS.has(k)):[];
 const role=roleName(profile);
 if(ownerSupport===true)return enabled;
 // Perfis históricos ainda existentes em cadastros antigos continuam seguindo
 // as regras legadas até sua migração individual para os cinco perfis atuais.
 if(!PROFILE_ROLES.includes(role))return enabled;
 const config=await readProfileAccess(env,id);
 const permitted=new Set(config.profiles[role]||[]);
 return enabled.filter(module=>permitted.has(module));
}
export async function profileAllowsModule(env,id,role,module,ownerSupport=false){
 if(ownerSupport===true)return true;
 const key=String(module||"").trim().toLowerCase();
 if(!KEYS.has(key))return false;
 if(!PROFILE_ROLES.includes(roleName(role)))return true;
 const data=await readProfileAccess(env,id);
 return data.profiles[roleName(role)].includes(key);
}
export async function adminReadProfileAccess(env,id){
 if(!ID.test(id))return errorResponse("Transportadora inválida.",400);
 if(id!=="nova-frota"){
  if(!env?.TENANTS_DB)return errorResponse("Banco indisponível.",503);
  const found=await env.TENANTS_DB.prepare("SELECT id FROM portal_tenants WHERE id=?").bind(id).first();
  if(!found)return errorResponse("Transportadora não encontrada.",404);
 }
 try{
  const data=await readProfileAccess(env,id);
  return success({tenantId:id,roles:PROFILE_ROLES,modules:availableForCompany(id),
    profiles:data.profiles,configured:data.configured,updatedAt:data.updatedAt||null});
 }catch{
  return errorResponse("Não foi possível consultar os perfis.",503);
 }
}
export async function adminWriteProfileAccess(request,env,actor,id){
 if(!ID.test(id))return errorResponse("Transportadora inválida.",400);
 if(!env.TENANT_BRANDS)return errorResponse("Armazenamento indisponível.",503);
 if(id!=="nova-frota"){
  if(!env.TENANTS_DB)return errorResponse("Banco indisponível.",503);
  const found=await env.TENANTS_DB.prepare("SELECT id FROM portal_tenants WHERE id=?").bind(id).first();
  if(!found)return errorResponse("Transportadora não encontrada.",404);
 }
 let data;
 try{
  const raw=await request.text();
  if(raw.length>20000)throw Error("limit");
  data=JSON.parse(raw);
  if(!data||typeof data!=="object"||Array.isArray(data)||
     Object.keys(data).some(x=>x!=="profiles")||
     !data.profiles||typeof data.profiles!=="object"||Array.isArray(data.profiles)||
     Object.keys(data.profiles).some(x=>!PROFILE_ROLES.includes(x))||
     PROFILE_ROLES.some(role=>!Array.isArray(data.profiles[role])))throw Error("shape");
  for(const role of PROFILE_ROLES){
   const list=data.profiles[role];
   if(list.length>PROFILE_MODULES.length||new Set(list).size!==list.length||
      list.some(x=>typeof x!=="string"||!KEYS.has(x)))throw Error("values");
  }
 }catch{return errorResponse("Matriz de perfis inválida.",400);}
 const profiles={};
 for(const role of PROFILE_ROLES){
  profiles[role]=role==="ADMINISTRADOR"
    ?defaultProfileModules(id,role)
    :normalizeModules(id,role,data.profiles[role]);
 }
 const updatedAt=new Date().toISOString();
 try{
  await env.TENANT_BRANDS.put(storageKey(id),JSON.stringify({
   version:1,profiles,updatedAt,actor
  }),{httpMetadata:{contentType:"application/json"}});
  // Nova Frota é legada e pode não possuir registro em portal_tenants.
  if(id!=="nova-frota"&&env.TENANTS_DB){
   await env.TENANTS_DB.prepare("INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(),actor,id,"profiles.update",
      JSON.stringify({roles:PROFILE_ROLES,updatedAt})).run();
  }
  return success({tenantId:id,roles:PROFILE_ROLES,profiles,configured:true,updatedAt});
 }catch{
  return errorResponse("Não foi possível gravar os perfis.",503);
 }
}
