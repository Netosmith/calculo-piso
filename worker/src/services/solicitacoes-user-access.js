// Subperfil SOLICITACOES por usuário, isolado por transportadora.
// O login D1 mantém o papel físico OPERACIONAL para compatibilidade com seu CHECK legado.
// Esta camada R2 atribui o perfil virtual e a seleção individual dos módulos.
import {errorResponse,success} from "../utils/response.js";
import {TENANT_MODULES} from "../config/tenant-modules.js";
import {NOVA_FROTA_MANAGED_MODULES} from "./nova-frota-modules.js";

export const isSolicRequest=key=>key==="cadastro-solicitacoes"||/^solicitacao-[a-z0-9-]+$/.test(String(key||""));
export const isSolicExecution=key=>/^execucao-[a-z0-9-]+$/.test(String(key||""));
export const isSolicModule=key=>isSolicRequest(key)||isSolicExecution(key);
export const SOLIC_MODULE_KEYS=Object.freeze([...new Set([
 "solicitacao-pedidos","execucao-pedidos",
 "cadastro-solicitacoes","execucao-cadastros",
 "solicitacao-troca-notas","execucao-troca-notas",
 ...[...TENANT_MODULES,...NOVA_FROTA_MANAGED_MODULES].filter(isSolicModule)
])]);
export const SOLIC_DEFAULT_KEYS=Object.freeze(["solicitacao-pedidos","execucao-pedidos"]);
const TENANT=/^(?:nova-frota|[a-z][a-z0-9-]{2,48})$/;
const USER=/^[A-Z0-9][A-Z0-9._-]{1,79}$/;
const KEY=id=>"tenant/"+id+"/private/solicitacoes-user-access-v1.json";
const normalize=name=>String(name||"").trim().toUpperCase();
const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const cleanKeys=(values,available=SOLIC_MODULE_KEYS)=>available.filter(key=>values.includes(key));

export async function readSolicUserAccess(env,id){
 if(!TENANT.test(id))throw Error("Transportadora inválida.");
 if(!env?.TENANT_BRANDS)return {configured:false,usuarios:{}};
 const file=await env.TENANT_BRANDS.get(KEY(id));
 if(!file)return {configured:false,usuarios:{}};
 const data=await file.json();
 if(data?.version!==1||!data.usuarios||typeof data.usuarios!=="object"||Array.isArray(data.usuarios))
  throw Error("Configuração individual de Solicitações inválida.");
 const usuarios={};
 for(const [username,record] of Object.entries(data.usuarios)){
  if(!USER.test(username)||!record||record.perfil!=="SOLICITACOES"||
     !Array.isArray(record.modules)||record.modules.length>SOLIC_MODULE_KEYS.length||
     new Set(record.modules).size!==record.modules.length||
     record.modules.some(key=>!SOLIC_MODULE_KEYS.includes(key)))
   throw Error("Configuração individual de Solicitações inválida.");
  usuarios[username]={perfil:"SOLICITACOES",modules:[...record.modules]};
 }
 return {configured:true,usuarios,updatedAt:data.updatedAt||null};
}
export async function effectiveSolicRole(env,id,user,physicalRole){
 const profile=String(physicalRole||"").trim().toUpperCase();
 if(profile==="SOLICITACOES"||!env?.TENANT_BRANDS)return profile;
 const data=await readSolicUserAccess(env,id);
 return has(data.usuarios,normalize(user))?"SOLICITACOES":profile;
}
export async function solicModulesForUser(env,id,user,available=SOLIC_MODULE_KEYS){
 const data=await readSolicUserAccess(env,id);
 const assigned=data.usuarios[normalize(user)];
 return cleanKeys(assigned?assigned.modules:[...SOLIC_DEFAULT_KEYS],available);
}
async function writeDoc(env,id,usuarios,actor){
 const updatedAt=new Date().toISOString();
 await env.TENANT_BRANDS.put(KEY(id),JSON.stringify({version:1,usuarios,updatedAt,actor}),
  {httpMetadata:{contentType:"application/json"}});
 if(id!=="nova-frota"&&env.TENANTS_DB){
  await env.TENANTS_DB.prepare("INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES(?,?,?,?,?)")
   .bind(crypto.randomUUID(),actor,id,"solicitacoes-users.update",
    JSON.stringify({usuarios:Object.keys(usuarios),updatedAt})).run();
 }
 return {usuarios,updatedAt};
}
// A edição de perfil de um vínculo não pode ampliar módulos; começa apenas com os 2 básicos.
export async function assignSolicProfile(env,id,user,enabled,actor){
 const username=normalize(user);
 if(!TENANT.test(id)||!USER.test(username))throw Error("Usuário ou empresa inválidos.");
 const state=await readSolicUserAccess(env,id);
 const usuarios={...state.usuarios};
 if(enabled){
  if(!has(usuarios,username))usuarios[username]={perfil:"SOLICITACOES",modules:[...SOLIC_DEFAULT_KEYS]};
 }else delete usuarios[username];
 return writeDoc(env,id,usuarios,actor);
}
export async function adminReadSolicUserAccess(env,id){
 if(!TENANT.test(id))return errorResponse("Transportadora inválida.",400);
 try{
  const data=await readSolicUserAccess(env,id);
  return success({tenantId:id,modules:SOLIC_MODULE_KEYS,defaults:SOLIC_DEFAULT_KEYS,...data});
 }catch{return errorResponse("Não foi possível carregar os acessos individuais.",503);}
}
export async function adminWriteSolicUserAccess(request,env,actor,id){
 if(!TENANT.test(id))return errorResponse("Transportadora inválida.",400);
 let usuarios;
 try{
  const raw=await request.text();
  if(raw.length>90000)throw Error("limit");
  const doc=JSON.parse(raw);
  if(!doc||typeof doc!=="object"||Array.isArray(doc)||Object.keys(doc).length!==1||
    !doc.usuarios||typeof doc.usuarios!=="object"||Array.isArray(doc.usuarios))throw Error("shape");
  const entries=Object.entries(doc.usuarios);
  if(entries.length>500)throw Error("many");
  usuarios={};
  for(const [username,modules] of entries){
   if(!USER.test(username)||!Array.isArray(modules)||modules.length>SOLIC_MODULE_KEYS.length||
     modules.some(k=>!SOLIC_MODULE_KEYS.includes(k))||new Set(modules).size!==modules.length)
    throw Error("values");
   usuarios[username]={perfil:"SOLICITACOES",modules:cleanKeys(modules)};
  }
 }catch{return errorResponse("Informe usuários e módulos válidos para o perfil SOLICITAÇÕES.",400);}
 try{
  const saved=await writeDoc(env,id,usuarios,actor);
  return success({tenantId:id,configured:true,usuarios:saved.usuarios,updatedAt:saved.updatedAt});
 }catch{return errorResponse("Não foi possível salvar os acessos individuais.",503);}
}
