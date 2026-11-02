// Staging-only entrypoint: deliberately excludes the legacy freights, games,
// fleet, Apps Script login and other production routes.
import {superAdminController} from "./controllers/super-admin.js";
import {verifiedStagingOwner} from "./services/staging-access.js";
import {stagingPage} from "./staging-page.js";
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
        const html=stagingPage
          .replace("const API_BASE = 'https://api.portalfrete.net.br';","const API_BASE = '';")
          .replace("location.assign('home.html')","location.assign('https://portalfrete.net.br/pages/home.html')");
        const response=new Response(html,{headers:{
          "Content-Type":"text/html; charset=utf-8",
          "Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'",
          "X-Robots-Tag":"noindex, nofollow",
          "X-Frame-Options":"DENY"
        }});
        return withHeaders(response,cors);
      }
      // Staging reads do not use the Nova Frota cookie or Apps Script secret.
      // Writes retain the separate signed OIDC/MFA gate inside the controller.
      const adminEnv={...env,SUPER_ADMIN_USER:"ACCESS_OWNER",SUPER_ADMIN_LEGACY_USERS_READ:"disabled"};
      try{return withHeaders(await superAdminController(request,adminEnv,owner),cors);}
      catch{return withHeaders(errorResponse("Falha na API administrativa de homologacao.",500),cors);}
    }
    return withHeaders(errorResponse("Rota indisponivel no ambiente de homologacao.",404),cors);
  }
};
