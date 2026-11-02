// Isolated tenant-facing Worker. No Cloudflare Access admin bypass,
// Apps Script, legacy Nova Frota routes or production credentials.
import {tenantPortalPage} from "./tenant-portal-page.js";
import {authenticateTenant,tenantSession,tenantSessionCookie,
 clearTenantSessionCookie,revokeTenantSession} from "./services/tenant-auth.js";
import {tenantFreights,tenantBi} from "./services/tenant-freights.js";
import {errorResponse,success} from "./utils/response.js";

function secure(response){
 const headers=new Headers(response.headers);
 headers.set("Cache-Control","private, no-store");
 headers.set("X-Content-Type-Options","nosniff");
 headers.set("Referrer-Policy","no-referrer");
 headers.set("X-Frame-Options","DENY");
 headers.set("X-Portal-Environment","tenant-staging");
 return new Response(response.body,{status:response.status,headers});
}
function page(){
 return secure(new Response(tenantPortalPage,{headers:{
  "Content-Type":"text/html; charset=utf-8",
  "Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Robots-Tag":"noindex,nofollow"
 }}));
}
async function readBody(req){
 const type=(req.headers.get("Content-Type")||"").split(";")[0].trim().toLowerCase();
 if(type!=="application/json")throw new TypeError("content-type");
 const raw=await req.text();
 if(raw.length>1024)throw new TypeError("body too long");
 const result=JSON.parse(raw);
 if(!result||typeof result!=="object"||Array.isArray(result))
  throw new TypeError("body invalid");
 return result;
}
function sameOrigin(req){
 const url=new URL(req.url);
 return req.headers.get("Origin")===url.origin &&
  (!req.headers.get("Sec-Fetch-Site")||req.headers.get("Sec-Fetch-Site")==="same-origin");
}
const err=(message,status)=>secure(errorResponse(message,status));

export default {
 async fetch(request,env){
  const db=env.TENANTS_DB;
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/+$/,"")||"/";
  if(request.method==="GET"&&path==="/health"){
   if(!db||!env.TENANT_BRANDS)return err("D1 ou R2 nao associado.",503);
   try{
    await db.prepare("SELECT token_hash FROM portal_tenant_sessions LIMIT 1").first();
    await db.prepare("SELECT id FROM portal_tenant_freights LIMIT 1").first();
    return secure(success({environment:"tenant-staging",database:"ready"}));
   }catch{return err("Migracao de acesso pendente.",503);}
  }
  if(request.method==="GET"&&(path==="/"||path==="/entrar"))return page();
  if(!path.startsWith("/api/"))return err("Rota inexistente.",404);
  if(!db)return err("Banco de usuarios nao provisionado.",503);

  if(request.method!=="GET"){
   if(!["POST","PATCH"].includes(request.method))return err("Metodo nao permitido.",405);
   if(!sameOrigin(request))return err("Origem da solicitacao nao autorizada.",403);
  }
  try{
   if(path==="/api/login"&&request.method==="POST"){
    let body;
    try{body=await readBody(request);}catch{return err("Dados invalidos.",400);}
    if(Object.keys(body).some(k=>!["tenantId","usuario","senha"].includes(k)))
      return err("Dados invalidos.",400);
    const tenantId=body.tenantId,usuario=body.usuario,senha=body.senha;
    const result=await authenticateTenant(db,tenantId,usuario,senha);
    if(!result.ok){
     const response=errorResponse(result.status===429?
      "Muitas tentativas. Aguarde 15 minutos.":"Empresa, usuario ou senha invalidos.",result.status);
     if(result.status===429)response.headers.set("Retry-After","900");
     return secure(response);
    }
    const response=success({autenticado:true});
    response.headers.set("Set-Cookie",tenantSessionCookie(result.session.token));
    return secure(response);
   }
   if(path==="/api/logout"&&request.method==="POST"){
    await revokeTenantSession(db,request);
    const response=success({encerrada:true});
    response.headers.set("Set-Cookie",clearTenantSessionCookie());
    return secure(response);
   }

   const principal=await tenantSession(db,request);
   if(!principal)return err("Sessao invalida, conta inativa ou transportadora desativada.",401);
   const enabled=await db.prepare(`SELECT module_key FROM portal_tenant_modules
     WHERE tenant_id=? AND enabled=1 ORDER BY module_key`).bind(principal.tenant_id).all();
   const modules=(enabled.results||[]).map(r=>r.module_key);
   if(path==="/api/logo" && request.method==="GET"){
    if(!env.TENANT_BRANDS)return err("Armazenamento da empresa indisponivel.",503);
    const brand=await db.prepare("SELECT logo_key FROM portal_tenants WHERE id=?")
      .bind(principal.tenant_id).first();
    const key=brand?.logo_key;
    const mime=typeof key==="string"?
      key.endsWith(".png")?"image/png":key.endsWith(".jpg")?"image/jpeg":key.endsWith(".webp")?"image/webp":null:null;
    if(!mime)return err("Logo da empresa nao cadastrada.",404);
    const image=await env.TENANT_BRANDS.get(key);
    if(!image)return err("Logo da empresa nao encontrada.",404);
    return secure(new Response(image.body,{headers:{"Content-Type":mime}}));
   }
   if(path==="/api/me"&&request.method==="GET")
    return secure(success({
     tenant:{id:principal.tenant_id,name:principal.tenant_name},
     usuario:principal.user_id,perfil:principal.role,modules
    }));
   if((path==="/api/fretes"||path.startsWith("/api/fretes/")) &&
       ["GET","POST","PATCH"].includes(request.method))
    return secure(await tenantFreights(request,db,principal,modules));
   if(path==="/api/bi"&&request.method==="GET")
    return secure(await tenantBi(db,principal,modules));
   return err("Recurso nao implementado neste ambiente.",404);
  }catch(error){
   console.error("[TENANT STAGING] Request failed",{type:error?.name||"Error"});
   return err("Serviço temporariamente indisponivel.",503);
  }
 }
};
