// Staging-only entrypoint: deliberately excludes the legacy freights, games,
// fleet, Apps Script login and other production routes.
import {superAdminController} from "./controllers/super-admin.js";
import {verifiedStagingOwner} from "./services/staging-access.js";
import {stagingPanelHtml} from "./staging-panel.js";
import {writeTenantCatalog} from "./services/super-admin-tenant-write.js";
import {errorResponse,success} from "./utils/response.js";

function withHeaders(response,origin=null) {
  const headers=new Headers(response.headers);
  headers.set("Cache-Control","no-store");
  headers.set("X-Portal-Environment","super-admin-staging");
  headers.set("X-Content-Type-Options","nosniff");
  headers.set("Referrer-Policy","no-referrer");
  if(origin){
    headers.set("Access-Control-Allow-Origin",origin);
    headers.set("Access-Control-Allow-Credentials","true");
    headers.set("Vary","Origin");
  }
  return new Response(response.body,{status:response.status,headers});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"")||"/";
    const origin=request.headers.get("Origin");
    // By default only same-origin browser requests are allowed. An explicitly
    // configured staging origin may be used after cookie/identity homologation.
    const configured=String(env.SUPER_ADMIN_STAGING_ALLOWED_ORIGIN||"");
    const allowed=(!origin || origin===url.origin ||
      (configured.startsWith("https://")&&origin===configured));
    if(!allowed)return errorResponse("Origem nao autorizada.",403);
    const cors=origin||null;

    if(request.method==="OPTIONS"){
      if(!cors)return errorResponse("Preflight invalido.",403);
      return new Response(null,{status:204,headers:{
        "Access-Control-Allow-Origin":cors,
        "Access-Control-Allow-Credentials":"true",
        "Access-Control-Allow-Methods":"GET, HEAD, POST, PUT, PATCH, OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type, Authorization",
        "Access-Control-Max-Age":"300",
        "Vary":"Origin"
      }});
    }

    if(path==="/health"&&request.method==="GET"){
      // Only a structural readiness probe, never tenant rows or credentials.
      if(!env.TENANTS_DB||!env.TENANT_BRANDS)
        return withHeaders(errorResponse("Infraestrutura de homologacao incompleta.",503),cors);
      try{
        await env.TENANTS_DB.prepare("SELECT id FROM portal_tenants LIMIT 1").first();
        return withHeaders(success({environment:"staging",database:"ready",storage:"bound"}),cors);
      }catch{
        return withHeaders(errorResponse("Esquema D1 de homologacao indisponivel.",503),cors);
      }
    }

    if(path==="/super-admin" || path==="/" || path.startsWith("/v1/super-admin/")){
      // Cloudflare Access authenticates this exact Worker. We also verify the
      // runtime-provided AUD and exact owner email, never request headers.
      const owner=await verifiedStagingOwner(env,ctx);
      if(!owner)return withHeaders(errorResponse("Cloudflare Access do proprietario obrigatorio.",403),cors);
      if(path==="/super-admin" || path==="/"){
        if(request.method!=="GET")return withHeaders(errorResponse("Metodo nao permitido.",405),cors);
        const html=stagingPanelHtml();
        const response=new Response(html,{headers:{
          "Content-Type":"text/html; charset=utf-8",
          "Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'",
          "X-Robots-Tag":"noindex, nofollow",
          "X-Frame-Options":"DENY"
        }});
        return withHeaders(response,cors);
      }
      // Only this dedicated staging entrypoint may accept Access-verified writes.
      // Production controllers still enforce their independent OIDC+MFA gate.
      const adminEnv={...env,SUPER_ADMIN_USER:"ACCESS_OWNER",SUPER_ADMIN_LEGACY_USERS_READ:"disabled"};
      const stageWrite=env.SUPER_ADMIN_STAGING_WRITES==="enabled";
      const tenantWrite=stageWrite && env.SUPER_ADMIN_TENANT_WRITES==="enabled" && Boolean(env.TENANTS_DB);
      try{
        if(path==="/v1/super-admin/me" && request.method==="GET"){
          const response=await superAdminController(request,adminEnv,owner);
          if(!response.ok)return withHeaders(response,cors);
          const body=await response.json(),ready=Boolean(body.capabilities?.tenantCatalog);
          body.capabilities.tenantWrite=Boolean(ready&&tenantWrite);
          body.capabilities.membershipWrite=Boolean(ready&&tenantWrite&&env.SUPER_ADMIN_MEMBERSHIP_WRITES==="enabled");
          body.capabilities.brandWrite=Boolean(ready&&tenantWrite&&env.SUPER_ADMIN_BRAND_WRITES==="enabled"&&env.TENANT_BRANDS);
          return withHeaders(success(body),cors);
        }
        if(request.method!=="GET"){
          if(!stageWrite)return withHeaders(errorResponse("Edicao indisponivel neste ambiente.",405),cors);
          if(!["POST","PATCH","PUT"].includes(request.method))
            return withHeaders(errorResponse("Metodo nao permitido.",405),cors);
          // Cookies alone must never permit cross-site requests or HTML forms.
          if(origin!==url.origin || (request.headers.get("Sec-Fetch-Site") && request.headers.get("Sec-Fetch-Site")!=="same-origin"))
            return withHeaders(errorResponse("Origem da alteracao nao autorizada.",403),cors);
          const mime=(request.headers.get("Content-Type")||"").split(";")[0].trim().toLowerCase();
          const logo=path.endsWith("/logo") && request.method==="PUT";
          if((!logo && mime!=="application/json") ||
             (logo && !["image/png","image/jpeg","image/webp"].includes(mime)))
            return withHeaders(errorResponse("Tipo de conteudo nao permitido.",415),cors);
          return withHeaders(await writeTenantCatalog(request,adminEnv,"cloudflare-access-owner"),cors);
        }
        return withHeaders(await superAdminController(request,adminEnv,owner),cors);
      }catch{return withHeaders(errorResponse("Falha na API administrativa de homologacao.",500),cors);}
    }
    return withHeaders(errorResponse("Rota indisponivel no ambiente de homologacao.",404),cors);
  }
};
