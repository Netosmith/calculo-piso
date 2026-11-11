// Fonte única de liberação global da Nova Frota.
// As permissões POR PERFIL permanecem inalteradas e são verificadas à parte.
export const NOVA_FROTA_LEGACY_DEFAULTS=Object.freeze([
 "piso","piso2","fretes","bi","divulgacao","controle","share","ordem","cadastros",
 "cadastro-solicitacoes","execucao-cadastros","estadias","custo-frota","administrativo",
 "monitoramento","fretes-mercado","custo-filial","patrimonio","embarques","chamados"
]);
export const NOVA_FROTA_NEW_MODULES=Object.freeze([
 "solicitacao-troca-notas","execucao-troca-notas","solicitacao-pedidos","execucao-pedidos"
]);
export const NOVA_FROTA_MANAGED_MODULES=Object.freeze([
 ...NOVA_FROTA_LEGACY_DEFAULTS,...NOVA_FROTA_NEW_MODULES
]);
const DEFAULT_KEY="tenant/nova-frota/private/optional-modules-v1.json";
const FULL_KEY="tenant/nova-frota/private/modules-v2.json";
const VALID=new Set(NOVA_FROTA_MANAGED_MODULES);
const DEFAULT=new Set(NOVA_FROTA_LEGACY_DEFAULTS);
function sanitized(value){
 return Array.isArray(value)&&value.length<=NOVA_FROTA_MANAGED_MODULES.length&&
  value.every(x=>typeof x==="string"&&VALID.has(x))?
  NOVA_FROTA_MANAGED_MODULES.filter(x=>value.includes(x)):null;
}
async function readJsonOrNull(bucket,key){
 const object=await bucket.get(key);
 if(!object)return null;
 try{return await object.json();}catch{return null;}
}
export async function readNovaFrotaModules(env){
 if(!env.TENANT_BRANDS)throw new Error("Armazenamento de permissões indisponível.");
 const v2=await readJsonOrNull(env.TENANT_BRANDS,FULL_KEY);
 if(v2&&v2.version===2){
  const modules=sanitized(v2.modules);
  if(!modules)throw new Error("Configuração de permissões inválida.");
  return {modules,configured:true};
 }
 const old=await readJsonOrNull(env.TENANT_BRANDS,DEFAULT_KEY);
 const optional=sanitized(old?.modules)||[];
 const enabled=new Set([...DEFAULT,...optional.filter(x=>NOVA_FROTA_NEW_MODULES.includes(x))]);
 return {modules:NOVA_FROTA_MANAGED_MODULES.filter(x=>enabled.has(x)),configured:false};
}
export async function isNovaFrotaModuleEnabled(env,key){
 if(!VALID.has(key))return true; // módulo fora desta lista mantém a regra histórica própria
 const state=await readNovaFrotaModules(env);
 return state.modules.includes(key);
}
export async function saveNovaFrotaModules(env,modules,actor){
 const validated=sanitized(modules);
 if(!validated||!Array.isArray(modules)||new Set(modules).size!==modules.length)
  throw new Error("Lista de módulos inválida.");
 if(!env.TENANT_BRANDS)throw new Error("Armazenamento indisponível.");
 await env.TENANT_BRANDS.put(FULL_KEY,JSON.stringify({
  version:2,modules:validated,actor,updatedAt:new Date().toISOString()
 }),{httpMetadata:{contentType:"application/json"}});
 return validated;
}
