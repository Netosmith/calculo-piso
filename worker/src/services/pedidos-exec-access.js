import {errorResponse,success} from "../utils/response.js";

// Subperfil de execução por usuário, segregado por transportadora.
// Não amplia a matriz de módulos: execucao-pedidos deve continuar habilitado.
export const PEDIDOS_EXEC_KINDS=Object.freeze([
 "PEDIDO","CORRECAO_PEDIDO","CTE_COMPLEMENTAR","CARTA_CORRECAO","PAGAMENTO","PAGAMENTO_GUIA"
]);
export const PEDIDOS_EXEC_LEGACY_KINDS=Object.freeze(PEDIDOS_EXEC_KINDS.slice(0,4));
const VALID_TENANT=/^(?:nova-frota|[a-z][a-z0-9-]{2,48})$/;
const VALID_USER=/^[A-Za-z0-9._-]{2,80}$/;
const KEY=id=>"tenant/"+id+"/private/pedidos-exec-access-v1.json";
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);

export async function readPedidosExecAccess(env,id){
 if(!VALID_TENANT.test(id)||!env.TENANT_BRANDS)throw Error("Configuração indisponível.");
 const raw=await env.TENANT_BRANDS.get(KEY(id));
 if(!raw)return {configured:false,usuarios:{}};
 const doc=await raw.json();
 if(doc?.version!==1||!doc.usuarios||typeof doc.usuarios!=="object"||Array.isArray(doc.usuarios))
  throw Error("Configuração de execução inválida.");
 const usuarios={};
 for(const [user,kinds] of Object.entries(doc.usuarios)){
  if(!VALID_USER.test(user)||user!==user.toUpperCase()||!Array.isArray(kinds)||
   kinds.length<1||kinds.length>PEDIDOS_EXEC_KINDS.length||new Set(kinds).size!==kinds.length||
   kinds.some(x=>!PEDIDOS_EXEC_KINDS.includes(x)))throw Error("Configuração de execução inválida.");
  usuarios[user]=kinds;
 }
 return {configured:true,usuarios,updatedAt:doc.updatedAt||null};
}

export async function executorKindsFor(env,id,user,ownerSupport=false){
 if(ownerSupport)return [...PEDIDOS_EXEC_KINDS];
 const profile=await readPedidosExecAccess(env,id);
 if(!profile.configured)return [...PEDIDOS_EXEC_LEGACY_KINDS];
 return [...(profile.usuarios[String(user||"").trim().toUpperCase()]||[])];
}

export async function adminReadPedidosExec(env,id){
 if(!VALID_TENANT.test(id))return errorResponse("Transportadora inválida.",400);
 try{
  const data=await readPedidosExecAccess(env,id);
  return success({tenantId:id,tipos:PEDIDOS_EXEC_KINDS,...data});
 }catch{return errorResponse("Não foi possível carregar os perfis de execução.",503);}
}

export async function adminWritePedidosExec(request,env,actor,id){
 if(!VALID_TENANT.test(id)||!env.TENANT_BRANDS)return errorResponse("Transportadora ou armazenamento inválido.",400);
 let usuarios;
 try{
  const raw=await request.text();
  if(raw.length>60000)throw Error("limit");
  const body=JSON.parse(raw);
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).length!==1||
   !own(body,"usuarios")||!body.usuarios||typeof body.usuarios!=="object"||Array.isArray(body.usuarios))
   throw Error("shape");
  const entries=Object.entries(body.usuarios);
  if(entries.length>500)throw Error("limit");
  usuarios={};
  for(const [original,kinds] of entries){
   const user=original.trim().toUpperCase();
   if(!VALID_USER.test(original)||user!==original||!Array.isArray(kinds)||
    kinds.length<1||kinds.length>PEDIDOS_EXEC_KINDS.length||new Set(kinds).size!==kinds.length||
    kinds.some(x=>!PEDIDOS_EXEC_KINDS.includes(x)))throw Error("values");
   usuarios[user]=PEDIDOS_EXEC_KINDS.filter(x=>kinds.includes(x));
  }
 }catch{return errorResponse("Informe usuários e tipos válidos para o perfil Pedido Execução.",400);}
 try{
  const updatedAt=new Date().toISOString();
  await env.TENANT_BRANDS.put(KEY(id),JSON.stringify({version:1,usuarios,updatedAt,actor}),
   {httpMetadata:{contentType:"application/json"}});
  if(id!=="nova-frota"&&env.TENANTS_DB){
   await env.TENANTS_DB.prepare("INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(),actor,id,"pedidos-exec-access.update",
     JSON.stringify({usuarios:Object.keys(usuarios),updatedAt})).run();
  }
  return success({tenantId:id,configured:true,usuarios,updatedAt});
 }catch{return errorResponse("Não foi possível salvar o perfil Pedido Execução.",503);}
}
