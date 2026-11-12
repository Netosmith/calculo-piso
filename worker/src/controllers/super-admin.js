import { callAppsScript } from "../services/appscript.js";
import { writeTenantCatalog } from "../services/super-admin-tenant-write.js";
import { readTenantLogo } from "../services/super-admin-brand.js";
import {readTenantVisual} from "../services/tenant-visual-assets.js";
import {credentialSchemaStatus} from "../services/super-admin-tenant-credentials.js";
import {readTenantArtThemes} from "../services/tenant-art-themes.js";
import {adminReadTenantIntegration,adminTestTenantIntegration} from "../services/tenant-integration.js";
import {cadastroAdminRead} from "./cadastro-solicitacoes.js";
import { projectLegacyUsers } from "../services/legacy-user-projection.js";
import { verifySuperAdminIdentity } from "../services/oidc-admin-auth.js";
import { canManageTenants } from "../config/super-admin-identity.js";
import { TENANT_MODULES, enabledModulesForTenant } from "../config/tenant-modules.js";
import { LEGACY_NOVA_FROTA, tenantIdForLegacySession } from "../config/transportadoras.js";
import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";
import {readNovaFrotaModules} from "../services/nova-frota-modules.js";
import {adminReadProfileAccess} from "../services/profile-access.js";
import { superAdminMonitorDeletion } from "./super-admin-monitor-delete.js";

async function catalogReady(env) {
  if(!env.TENANTS_DB)return false;
  try {
    await env.TENANTS_DB.prepare("SELECT id FROM portal_tenants LIMIT 1").first();
    return true;
  } catch {return false;}
}

// Bootstrap restrito: conta existente autenticada pelo Apps Script.
// O papel global NÃO pode ser atribuído via cadastro comum.
// The optional identity is reserved for the staging entrypoint after
// Cloudflare Access has authenticated and matched the exact owner email/AUD.
// Normal production routing never passes it; browser headers cannot set it.
export async function superAdminController(request, env, verifiedStagingSession = null) {
  const session = verifiedStagingSession || await getSession(env, readSessionId(request));
  if (!session) return errorResponse("Sessão inválida ou expirada.",401);
  // Identidade do proprietário configurada exclusivamente como segredo no Worker.
  // Sem configuração, o painel permanece fechado (fail closed).
  const ownerId = String(env.SUPER_ADMIN_USER || "").trim().toUpperCase();
  const isOwner = Boolean(ownerId) && String(session.usuario || "").trim().toUpperCase() === ownerId
    && tenantIdForLegacySession(session) === LEGACY_NOVA_FROTA.id;
  if (!isOwner) return errorResponse("Acesso exclusivo do Super Admin.",403);
  const path = new URL(request.url).pathname;
  // Sessão assinada do único proprietário; origem e cabeçalho personalizado
  // impedem requisições cross-site de formulário e escritas por outros perfis.
  const portalOwnerWrite = !verifiedStagingSession &&
    env.SUPER_ADMIN_OWNER_PORTAL_WRITES === "enabled" &&
    request.headers.get("Origin") === "https://portalfrete.net.br" &&
    request.headers.get("X-Portal-Super-Admin-Action") === "owner-panel";
  if (request.method !== "GET") {
    if (portalOwnerWrite) {
      if(path==="/v1/super-admin/authorize" && request.method==="POST")
        return success({elevated:true,tenantWrite:env.SUPER_ADMIN_TENANT_WRITES==="enabled",
          membershipWrite:env.SUPER_ADMIN_MEMBERSHIP_WRITES==="enabled",
          brandWrite:env.SUPER_ADMIN_BRAND_WRITES==="enabled"});
      if(path.startsWith("/v1/super-admin/monitor/viagens"))
        return superAdminMonitorDeletion(request,env,ownerId);
      return writeTenantCatalog(request, env, ownerId);
    }
    let oidc=env.SUPER_ADMIN_OIDC;
    if(typeof oidc==="string") {
      try {oidc=JSON.parse(oidc);} catch {oidc=null;}
    }
    const bearer=request.headers.get("Authorization")||"";
    if (!oidc || bearer.length>16007 || !/^Bearer [A-Za-z0-9._-]+$/.test(bearer))
      return errorResponse("Prova de identidade OIDC obrigatoria.",403);
    const verified=await verifySuperAdminIdentity(bearer.slice(7),oidc);
    if(!verified.ok || !verified.subject ||
       verified.subject!==String(env.SUPER_ADMIN_SUBJECT||""))
      return errorResponse("Identidade global ou MFA nao verificada.",403);
    // Claims de privilegio sao montadas no servidor somente depois da
    // validacao criptografica do JWT, nunca aceitas do cliente.
    const trustedSession={...session,authSubject:verified.subject,
      authAssurance:"mfa",authProviderVerified:true};
    if(!canManageTenants(trustedSession,env))
      return errorResponse("Sessao sem permissao de administracao global.",403);
    if(path==="/v1/super-admin/authorize" && request.method==="POST")
      return success({elevated:true,tenantWrite:Boolean(env.TENANTS_DB&&env.SUPER_ADMIN_TENANT_WRITES==="enabled"),membershipWrite:Boolean(env.TENANTS_DB&&env.SUPER_ADMIN_TENANT_WRITES==="enabled"&&env.SUPER_ADMIN_MEMBERSHIP_WRITES==="enabled"),brandWrite:Boolean(env.TENANTS_DB&&env.TENANT_BRANDS&&env.SUPER_ADMIN_TENANT_WRITES==="enabled"&&env.SUPER_ADMIN_BRAND_WRITES==="enabled")});
    if(path.startsWith("/v1/super-admin/monitor/viagens"))
      return superAdminMonitorDeletion(request,env,ownerId);
    return writeTenantCatalog(request,env,verified.subject);
  }
  if (path === "/v1/super-admin/me") {
    const ready=await catalogReady(env);
    const ownerPortalEnabled=env.SUPER_ADMIN_OWNER_PORTAL_WRITES==="enabled";
    const credentialsRequested=env.SUPER_ADMIN_CREDENTIAL_WRITES==="enabled";
    const credentials=credentialsRequested && ready ?
      await credentialSchemaStatus(env.TENANTS_DB) : {ok:false,missing:[]};
    const capabilities={tenantCatalog:ready,legacyUserRead:env.SUPER_ADMIN_LEGACY_USERS_READ==="enabled",tenantWrite:Boolean(ready&&(ownerPortalEnabled||(env.SUPER_ADMIN_OIDC&&env.SUPER_ADMIN_SUBJECT))&&env.SUPER_ADMIN_TENANT_WRITES==="enabled"),membershipWrite:Boolean(ready&&env.SUPER_ADMIN_TENANT_WRITES==="enabled"&&env.SUPER_ADMIN_MEMBERSHIP_WRITES==="enabled"&&(ownerPortalEnabled||(env.SUPER_ADMIN_OIDC&&env.SUPER_ADMIN_SUBJECT))),brandWrite:Boolean(ready&&env.TENANT_BRANDS&&env.SUPER_ADMIN_BRAND_WRITES==="enabled"&&env.SUPER_ADMIN_TENANT_WRITES==="enabled"&&(ownerPortalEnabled||(env.SUPER_ADMIN_OIDC&&env.SUPER_ADMIN_SUBJECT))),userWrite:false};
    // A interface atual usa a autorização já habilitada para escritas do proprietário.
    // O fluxo OIDC alternativo permanece protegido no backend, sem exibir botão inoperante.
    capabilities.monitorTripDelete=Boolean(env.FLEET_DB&&env.FLEET_FILES&&ownerPortalEnabled);
    if(credentialsRequested){
      capabilities.credentialWrite=Boolean(ready&&ownerPortalEnabled&&
        env.SUPER_ADMIN_TENANT_WRITES==="enabled"&&credentials.ok);
      if(credentials.missing.length)capabilities.credentialMissing=credentials.missing;
    }
    return success({superAdmin:true,usuario:session.usuario,capabilities});
  }
  if(path.startsWith("/v1/super-admin/monitor/viagens")&&request.method==="GET")
    return superAdminMonitorDeletion(request,env,ownerId);
  if (path === "/v1/super-admin/modules") return success({modules:TENANT_MODULES});
  const profileAccessPath=path.match(/^\/v1\/super-admin\/transportadoras\/(nova-frota|[a-z0-9-]+)\/profile-access$/);
  if(profileAccessPath && request.method==="GET")return adminReadProfileAccess(env,profileAccessPath[1]);
  if (path === "/v1/super-admin/transportadoras") {
    // Até o provisionamento do catálogo, preservar a leitura da empresa legada.
    let legacyModules;
    try{legacyModules=await readNovaFrotaModules(env);}
    catch{return errorResponse("Não foi possível consultar módulos da Nova Frota.",503);}
    const legacy = {id:LEGACY_NOVA_FROTA.id,name:LEGACY_NOVA_FROTA.nome,active:true,
      modules:legacyModules.modules,modulesConfigured:legacyModules.configured};
    if (!env.TENANTS_DB) return success({transportadoras:[legacy],catalogo:"legado"});
    try {
      const result = await env.TENANTS_DB.prepare(
        "SELECT id, name, status FROM portal_tenants ORDER BY name"
      ).all();
      const companies = Array.isArray(result?.results) ? result.results : [];
      const transportadoras = await Promise.all(companies.map(async company => {
        const modules = await env.TENANTS_DB.prepare(
          "SELECT module_key, enabled FROM portal_tenant_modules WHERE tenant_id=?"
        ).bind(company.id).all();
        return {
          id:company.id,
          name:company.name,
          active:company.status==="active",
          modules:enabledModulesForTenant(modules?.results)
        };
      }));
      if (!transportadoras.some(company=>company.id===legacy.id)) transportadoras.unshift(legacy);
      return success({transportadoras,catalogo:"d1"});
    } catch (error) {
      console.error("[SUPER ADMIN] Catálogo indisponível",String(error?.message || error));
      return errorResponse("Catálogo de transportadoras indisponível.",503);
    }
  }
  // Cloudflare Access / owner session gate is evaluated above this route.
  // Each freight base has its own private Apps Script and spreadsheet.
  const cadastroDriveRoute=path.match(/^\/v1\/super-admin\/transportadoras\/([a-z0-9-]+)\/cadastro-drive$/);
  if(cadastroDriveRoute&&request.method==="GET")return cadastroAdminRead(env,cadastroDriveRoute[1]);
  const baseRoute=path.match(/^\/v1\/super-admin\/transportadoras\/([a-z0-9-]+)\/bases\/(GO|MT|SP|MS|BA|PR|SC|RO|TO|MA|AC|AL|AP|AM|CE|DF|ES|MG|PA|PB|PE|PI|RJ|RN|RS|RR|SE)\/integracao(\/testar)?$/);
  if(baseRoute){
    return baseRoute[3]
      ? adminTestTenantIntegration(env,baseRoute[1],baseRoute[2])
      : adminReadTenantIntegration(env,baseRoute[1],baseRoute[2]);
  }
  if(path.startsWith("/v1/super-admin/transportadoras/")&&path.endsWith("/integracao/testar")){
    const parts=path.split("/");
    if(parts.length!==7||parts[5]!=="integracao")return errorResponse("Rota invalida.",404);
    return adminTestTenantIntegration(env,parts[4]);
  }
  if(path.startsWith("/v1/super-admin/transportadoras/")&&path.endsWith("/integracao")){
    const parts=path.split("/");
    if(parts.length!==6)return errorResponse("Rota invalida.",404);
    return adminReadTenantIntegration(env,parts[4]);
  }
  const visual=path.match(/^\/v1\/super-admin\/transportadoras\/([a-z0-9-]+)\/visual\/(logo-dark|logo-light|hero-art|hero-home)$/);
  if(visual && request.method==="GET")return readTenantVisual(env,visual[1],visual[2]);
  if(path.startsWith("/v1/super-admin/transportadoras/")&&path.endsWith("/artes")){
  const parts=path.split("/");
  if(parts.length!==6)return errorResponse("Rota invalida.",404);
  return readTenantArtThemes(env,parts[4]);
 }
 if(path.startsWith("/v1/super-admin/transportadoras/")&&path.endsWith("/logo")){
    const parts=path.split("/");
    if(parts.length!==6)return errorResponse("Rota invalida.",404);
    return readTenantLogo(env,parts[4]);
  }
  if (path.startsWith("/v1/super-admin/transportadoras/") && path.endsWith("/auditoria")) {
    const parts=path.split("/");
    if(parts.length!==6)return errorResponse("Rota invalida.",404);
    const tenantId=parts[4];
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantId) || tenantId.length>64)
      return errorResponse("Transportadora invalida.",400);
    if(!env.TENANTS_DB)return errorResponse("Historico ainda nao provisionado.",503);
    try {
      const found=await env.TENANTS_DB.prepare(
        "SELECT id FROM portal_tenants WHERE id=?").bind(tenantId).first();
      if(!found)return errorResponse("Transportadora nao encontrada no catalogo.",404);
      const result=await env.TENANTS_DB.prepare(
        "SELECT id,actor_id,action,detail_json,created_at FROM portal_tenant_audit WHERE tenant_id=? ORDER BY created_at DESC,id DESC LIMIT 50"
      ).bind(tenantId).all();
      return success({tenantId,eventos:(result?.results||[]).map(row=>({
        id:row.id,ator:row.actor_id,acao:row.action,quando:row.created_at,
        detalhes:JSON.parse(row.detail_json||"{}")
      }))});
    } catch(error) {
      console.error("[SUPER ADMIN] Audit read failed",{type:error?.name||"Error"});
      return errorResponse("Historico de auditoria indisponivel.",503);
    }
  }
  if (path.startsWith("/v1/super-admin/transportadoras/") && path.endsWith("/usuarios")) {
    const parts = path.split("/");
    if (parts.length !== 6) return errorResponse("Rota inválida.",404);
    const tenantId = parts[4];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantId) || tenantId.length > 64) {
      return errorResponse("Transportadora inválida.",400);
    }
    // Opt-in para homologacao. Nunca consulta usuarios de outras transportadoras
    // no Apps Script legado, nem confunde lista vazia com cadastro completo.
    if (tenantId === LEGACY_NOVA_FROTA.id && env.SUPER_ADMIN_LEGACY_USERS_READ === "enabled") {
      try {
        const result = await callAppsScript(env, {
          action:"portal_gateway", method:"POST",
          params:{
            module:"cadastros",action:"read",
            payload:{resource:"usuarios",operation:"list"},
            auth:{
              usuario:session.usuario,nome:session.nome,perfil:session.perfil,
              estado:session.estado,estados:session.estados
            }
          }
        });
        if (!result?.ok) return errorResponse("Consulta legada recusada.",502);
        const payload = result.data;
        const rows = Array.isArray(payload) ? payload :
          Array.isArray(payload?.data) ? payload.data :
          Array.isArray(payload?.rows) ? payload.rows :
          Array.isArray(payload?.data?.rows) ? payload.data.rows : null;
        if (!rows) return errorResponse("Formato do cadastro legado nao reconhecido.",502);
        return success({
          tenantId,usuarios:projectLegacyUsers(rows),origem:"apps-script-legado",
          completo:true
        });
      } catch (error) {
        console.error("[SUPER ADMIN] Falha na leitura legada", { type: error?.name || "Error" });
        return errorResponse("Nao foi possivel consultar os usuarios legados.",502);
      }
    }
    // O cadastro de autenticação legado continua no Apps Script. O catálogo D1
    // armazena apenas vínculos, não nomes, senhas ou último acesso.
    if (!env.TENANTS_DB) return errorResponse("Catálogo de usuários ainda não provisionado.",503);
    try {
      const company = await env.TENANTS_DB.prepare(
        "SELECT id FROM portal_tenants WHERE id=?"
      ).bind(tenantId).first();
      if (!company && tenantId !== LEGACY_NOVA_FROTA.id) return errorResponse("Transportadora não encontrada.",404);
      const result = await env.TENANTS_DB.prepare(
        `SELECT u.user_id,u.role,u.active,u.created_at,
           EXISTS(SELECT 1 FROM portal_tenant_credentials c
             WHERE c.tenant_id=u.tenant_id AND c.user_id=u.user_id) AS password_set
           FROM portal_tenant_users u WHERE u.tenant_id=? ORDER BY u.user_id LIMIT 500`
      ).bind(tenantId).all();
      return success({
        tenantId,
        usuarios:(result?.results || []).map(u=>({
          id:u.user_id,perfil:u.role,ativo:u.active===1,senhaConfigurada:Boolean(u.password_set),
          acessoPronto:u.active===1&&Boolean(u.password_set),dataVinculo:u.created_at
        })),
        origem:"contas-d1",completo:true,
        aviso:"Login requer usuario ativo, senha cadastrada e transportadora ativa."
      });
    } catch (error) {
      console.error("[SUPER ADMIN] Consulta de usuários indisponível",String(error?.message || error));
      return errorResponse("Consulta de usuários indisponível.",503);
    }
  }
  return errorResponse("Recurso administrativo não implementado.",404);
}
