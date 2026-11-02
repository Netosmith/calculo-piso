// Staging-only entrypoint: deliberately excludes the legacy freights, games,
// fleet, Apps Script login and other production routes.
import {superAdminController} from "./controllers/super-admin.js";
import {errorResponse,success} from "./utils/response.js";

function withHeaders(response,origin=null) {
  const headers=new Headers(response.headers);
  headers.set("Cache-Control","no-store");
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
  async fetch(request,env){
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

    if(path.startsWith("/v1/super-admin/")){
      // Super Admin authorization still requires a signed owner session.
      // Do not wire staging to production sessions or Apps Script automatically.
      if(!env.PORTAL_KEY||!env.SUPER_ADMIN_USER)
        return withHeaders(errorResponse("Autenticacao de homologacao ainda nao configurada.",503),cors);
      try{return withHeaders(await superAdminController(request,env),cors);}
      catch{return withHeaders(errorResponse("Falha na API administrativa de homologacao.",500),cors);}
    }
    return withHeaders(errorResponse("Rota indisponivel no ambiente de homologacao.",404),cors);
  }
};
