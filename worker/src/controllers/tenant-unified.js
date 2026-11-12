// Unified Portal Frete tenant routes, hosted by the EXISTING portalfrete-api Worker.
// Nova Frota legacy cookies and Apps Script resources are never consulted here.
import {ALLOWED_ORIGINS} from "../config.js";
import {errorResponse,success} from "../utils/response.js";
import {validTenantId,normalizeTenantUser,authenticateTenant,hasTenantSessionCookie,
  tenantSession,tenantSessionCookie,clearTenantSessionCookie,revokeTenantSession}
 from "../services/tenant-auth.js";
import {clearSessionCookie} from "../services/session.js";
import {tenantFreights,tenantBi} from "../services/tenant-freights.js";
import {readTenantIntegration,callTenantAppScript} from "../services/tenant-integration.js";
import {readTenantArtThemes} from "../services/tenant-art-themes.js";
import {sharedClientNamesController,createSharedClientController} from "../services/shared-client-catalog.js";
import {regionalUfController} from "../services/tenant-regional-ufs.js";
import {LEGACY_NOVA_FROTA} from "../config/transportadoras.js";
import {tenantUsersController} from "../services/tenant-user-management.js";
import {ownerSupportPrincipal} from "../services/tenant-owner-support.js";
import {modulesForProfile} from "../services/profile-access.js";
import {readTenantVisual} from "../services/tenant-visual-assets.js";

export const tenantPortalEnabled=env=>env?.TENANT_PORTAL_ENABLED==="enabled" && Boolean(env.TENANTS_DB);

function tenantJsonError(message,status){return errorResponse(message,status);}
function sameSiteWrite(request){
 const origin=request.headers.get("Origin")||"";
 const fetchSite=request.headers.get("Sec-Fetch-Site");
 return ALLOWED_ORIGINS.has(origin) && (!fetchSite || ["same-site","same-origin"].includes(fetchSite));
}
async function enabledModules(db,tenantId){
 const result=await db.prepare(
  "SELECT module_key FROM portal_tenant_modules WHERE tenant_id=? AND enabled=1 ORDER BY module_key"
 ).bind(tenantId).all();
 return (result?.results||[]).map(row=>row.module_key);
}
export async function publicTenantsController(request,env){
 if(request.method!=="GET")return tenantJsonError("Metodo nao permitido.",405);
 // Do not expose the customer catalog to anonymous visitors.
 // Known tenant URLs authenticate using their explicit tenant id; neither
 // this endpoint nor the login form enumerates tenant names or identifiers.
 return success({transportadoras:[{id:LEGACY_NOVA_FROTA.id,name:LEGACY_NOVA_FROTA.nome}]});
}
export async function tenantLoginController(request,env,body){
 if(!tenantPortalEnabled(env))return tenantJsonError("Acesso de novas transportadoras ainda indisponivel.",503);
 const tenantId=body.transportadoraId;
 const usuario=normalizeTenantUser(body.usuario);
 const senha=body.senha;
 if(!validTenantId(tenantId)||!usuario||typeof senha!=="string" ||
    senha.length>128 || !senha.length)return tenantJsonError("Empresa, usuario ou senha invalidos.",401);
 try{
  const result=await authenticateTenant(env.TENANTS_DB,tenantId,usuario,senha);
  if(!result.ok){
   const response=tenantJsonError(result.status===429?"Muitas tentativas. Aguarde antes de tentar novamente.":"Empresa, usuario ou senha invalidos.",result.status);
   if(result.status===429)response.headers.set("Retry-After","900");
   return response;
  }
  const tenant=await env.TENANTS_DB.prepare("SELECT name FROM portal_tenants WHERE id=?").bind(tenantId).first();
  const member=await env.TENANTS_DB.prepare("SELECT role FROM portal_tenant_users WHERE tenant_id=? AND user_id=?")
    .bind(tenantId,usuario).first();
  const modules=await modulesForProfile(env,tenantId,member?.role||"OPERACIONAL",await enabledModules(env.TENANTS_DB,tenantId));
  const session=tenantPublicSession({
   tenant_id:tenantId,tenant_name:tenant?.name||tenantId,user_id:usuario,role:member?.role||"OPERACIONAL"
  },modules);
  const response=success({session,requiresStateSelection:false});
  response.headers.append("Set-Cookie",tenantSessionCookie(result.session.token));
  response.headers.append("Set-Cookie",clearSessionCookie());
  return response;
 }catch(error){
  console.error("[TENANT LOGIN] Database unavailable",{type:error?.name||"Error"});
  return tenantJsonError("Acesso de transportadoras temporariamente indisponivel.",503);
 }
}
export function tenantPublicSession(principal,modules=[]){
 return {
  usuario:principal.user_id,
  nome:principal.user_id,
  perfil:principal.role,
  estados:["GERAL"],
  estado:"GERAL",
  transportadoraId:principal.tenant_id,
  transportadoraNome:principal.tenant_name,
  // Never disclose other enabled tenant modules in a PISO session.
  modules:String(principal.role||"").trim().toUpperCase()==="PISO"
    ? modules.filter(module=>["piso2","cadastro-solicitacoes","solicitacao-troca-notas","solicitacao-pedidos"].includes(module)) : modules,
  tenantMode:true,
  ...(principal.owner_support===true ? {ownerSupport:true} : {})
 };
}
export async function currentTenantPrincipal(request,env){
 if(!tenantPortalEnabled(env))return null;
 return tenantSession(env.TENANTS_DB,request);
}
export async function tenantSessionController(request,env){
 const principal=await currentTenantPrincipal(request,env);
 if(!principal)return tenantJsonError("Sessao da transportadora invalida ou expirada.",401);
 return success({session:tenantPublicSession(principal,await modulesForProfile(env,principal.tenant_id,principal.role,await enabledModules(env.TENANTS_DB,principal.tenant_id),principal.owner_support===true))});
}
export async function tenantLogoutController(request,env){
 if(env.TENANTS_DB){
  try{await revokeTenantSession(env.TENANTS_DB,request);}
  catch(error){console.warn("[TENANT LOGOUT] Revocation unavailable",{type:error?.name||"Error"});}
 }
 const response=success({loggedOut:true});
 response.headers.append("Set-Cookie",clearTenantSessionCookie());
 response.headers.append("Set-Cookie",clearSessionCookie());
 return response;
}
// The company URL selects a target, but only an authenticated signed owner
// session may open that target without becoming one of its local users.
export async function tenantContextController(request,env){
 if(request.method!=="GET")return tenantJsonError("Metodo nao permitido.",405);
 if(!tenantPortalEnabled(env))return tenantJsonError("Portal de transportadoras indisponivel.",503);
 const target=new URL(request.url).searchParams.get("tenantId");
 if(!validTenantId(target))return tenantJsonError("Transportadora invalida.",400);
 try{
  const owner=await ownerSupportPrincipal(request,env,target);
  if(owner)return success({session:tenantPublicSession(owner,
   await modulesForProfile(env,target,owner.role,await enabledModules(env.TENANTS_DB,target),true))});
  const current=await tenantSession(env.TENANTS_DB,request);
  if(!current||current.tenant_id!==target)return tenantJsonError("Sessao sem acesso a esta transportadora.",403);
  return success({session:tenantPublicSession(current,
   await modulesForProfile(env,target,current.role,await enabledModules(env.TENANTS_DB,target)))});
 }catch(error){
  console.error("[TENANT CONTEXT] Unavailable",{type:error?.name||"Error"});
  return tenantJsonError("Nao foi possivel validar o acesso a transportadora.",503);
 }
}

export async function tenantApiController(request,env){
 if(!tenantPortalEnabled(env))return tenantJsonError("Portal de transportadoras indisponivel.",503);
 const path=new URL(request.url).pathname;
 if(request.method!=="GET"){
  if(!["POST","PATCH"].includes(request.method))return tenantJsonError("Metodo nao permitido.",405);
  if(!sameSiteWrite(request))return tenantJsonError("Origem nao autorizada.",403);
  const type=(request.headers.get("Content-Type")||"").split(";")[0].trim().toLowerCase();
  // Multipart é permitido SOMENTE ao criar um novo cliente e sua logo.
  // As demais operações da transportadora continuam estritamente JSON.
  const logoCreate=path==="/v1/tenant/catalogo/clientes" && request.method==="POST";
  if(type!=="application/json" && !(logoCreate && type==="multipart/form-data"))
    return tenantJsonError("Formato de dados nao permitido.",415);
 }
 try{
  // An explicit support context is NEVER an identity supplied by the browser:
  // verify the signed legacy owner session on every company-scoped request.
  // Query scope is limited to image/artwork GET requests with no header support.
  const supportHeader=request.headers.get("X-Portal-Support-Tenant");
  const supportQuery=(["/v1/tenant/logo","/v1/tenant/artes"].includes(path) ||
    /^\/v1\/tenant\/visual\/(?:logo-dark|logo-light|hero-art|hero-home)$/.test(path)) &&
    request.method==="GET" ? new URL(request.url).searchParams.get("supportTenant") : null;
  if(supportHeader && supportQuery && supportHeader!==supportQuery)
    return tenantJsonError("Contexto de transportadora inconsistente.",403);
  const supportTarget=supportHeader||supportQuery;
  let principal;
  if(supportTarget){
    if(!validTenantId(supportTarget))return tenantJsonError("Transportadora invalida.",403);
    principal=await ownerSupportPrincipal(request,env,supportTarget);
    if(!principal)return tenantJsonError("Acesso exclusivo do proprietario.",403);
  }else{
    principal=await tenantSession(env.TENANTS_DB,request);
  }
  if(!principal)return tenantJsonError("Sessao invalida ou transportadora inativa.",401);
  const modules=await modulesForProfile(env,principal.tenant_id,principal.role,
    await enabledModules(env.TENANTS_DB,principal.tenant_id),principal.owner_support===true);
  if(path==="/v1/tenant/me"&&request.method==="GET")
   return success({session:tenantPublicSession(principal,modules)});
  // Except for its own identity and logo, PISO cannot access any tenant
  // data endpoint other than the narrowly authorized Piso 2 gateway.
  if(String(principal.role||"").toUpperCase()==="PISO" &&
     !["/v1/tenant/me","/v1/tenant/logo","/v1/tenant/gateway"].includes(path))
    return tenantJsonError("Perfil PISO restrito ao Calculo de Piso 2.",403);
  const visual=path.match(/^\/v1\/tenant\/visual\/(logo-dark|logo-light|hero-art|hero-home)$/);
  if(visual && request.method==="GET")
    return readTenantVisual(env,principal.tenant_id,visual[1]);
  if(path==="/v1/tenant/artes"&&request.method==="GET"){
    return readTenantArtThemes(env,principal.tenant_id);
  }
  if(path==="/v1/tenant/logo"&&request.method==="GET"){
   if(!env.TENANT_BRANDS)return tenantJsonError("Armazenamento de logos indisponivel.",503);
   const row=await env.TENANTS_DB.prepare("SELECT logo_key FROM portal_tenants WHERE id=?")
    .bind(principal.tenant_id).first();
   const key=row?.logo_key;
   const mime=typeof key==="string"?(key.endsWith(".png")?"image/png":key.endsWith(".jpg")?"image/jpeg":
     key.endsWith(".webp")?"image/webp":null):null;
   if(!mime||!key.startsWith("tenant/"+principal.tenant_id+"/logo/"))
    return tenantJsonError("Logo nao cadastrada.",404);
   const object=await env.TENANT_BRANDS.get(key);
   if(!object)return tenantJsonError("Logo nao encontrada.",404);
   return new Response(object.body,{headers:{
    "Content-Type":mime,"Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-site"
   }});
  }
  if((path==="/v1/tenant/usuarios"||path.startsWith("/v1/tenant/usuarios/"))&&["GET","POST","PATCH"].includes(request.method))
    return tenantUsersController(request,env,principal,modules,path);
  if(path==="/v1/tenant/regionais/ufs"&&["GET","POST"].includes(request.method))
    return regionalUfController(request,env,principal,modules);
  if(path==="/v1/tenant/catalogo/clientes"){
    // O catálogo central é visível onde já era autorizado (somente nomes).
    // Exclusivamente ADMINISTRADOR com CADASTROS habilitado pode adicionar
    // novo cliente. Não existem rotas PATCH/PUT/DELETE deste catálogo.
    if(request.method==="POST"){
      if(String(principal.role||"").toUpperCase()!=="ADMINISTRADOR"||
         !modules.includes("cadastros"))
        return tenantJsonError("Somente o administrador com Cadastros liberado pode adicionar clientes.",403);
      return createSharedClientController(env,principal,request);
    }
    if(request.method!=="GET")return tenantJsonError("Alteração ou exclusão de clientes não permitida.",405);
    if(!modules.some(key=>key.startsWith("fretes-")||["cadastros","fretes","fretes2","controle",
      "share","divulgacao","bi"].includes(key)))
      return tenantJsonError("Catálogo não liberado para este perfil.",403);
    return sharedClientNamesController(env);
  }
  if(path==="/v1/tenant/integracao"&&request.method==="GET"){
    const config=await readTenantIntegration(env,principal.tenant_id);
    return success({integracao:{configured:Boolean(config),enabled:config?.enabled===true}});
  }
  if(path==="/v1/tenant/gateway"&&request.method==="POST"){
    const raw=await request.text();
    if(raw.length>150000)return tenantJsonError("Requisicao excede o limite.",413);
    let payload;
    try{payload=JSON.parse(raw);}catch{return tenantJsonError("Dados invalidos.",400);}
    if(!payload||typeof payload!=="object"||Array.isArray(payload)||
      Object.keys(payload).some(k=>!["module","action","params"].includes(k)))
      return tenantJsonError("Campos nao permitidos.",400);
    return callTenantAppScript(env,principal,modules,payload);
  }
  if(path==="/v1/tenant/bi"&&request.method==="GET")
   return tenantBi(env.TENANTS_DB,principal,modules);
  if(path==="/v1/tenant/fretes"||path.startsWith("/v1/tenant/fretes/"))
   return tenantFreights(request,env.TENANTS_DB,principal,modules);
  return tenantJsonError("Recurso indisponivel.",404);
 }catch(error){
  console.error("[TENANT PORTAL] Request failure",{type:error?.name||"Error"});
  return tenantJsonError("Operacao temporariamente indisponivel.",503);
 }
}
