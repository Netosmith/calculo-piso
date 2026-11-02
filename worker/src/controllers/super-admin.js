import { callAppsScript } from "../services/appscript.js";
import { writeTenantCatalog } from "../services/super-admin-tenant-write.js";
import { projectLegacyUsers } from "../services/legacy-user-projection.js";
import { verifySuperAdminIdentity } from "../services/oidc-admin-auth.js";
import { canManageTenants } from "../config/super-admin-identity.js";
import { TENANT_MODULES, enabledModulesForTenant } from "../config/tenant-modules.js";
import { LEGACY_NOVA_FROTA, tenantIdForLegacySession } from "../config/transportadoras.js";
import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";

// Bootstrap restrito: conta existente autenticada pelo Apps Script.
// O papel global NÃO pode ser atribuído via cadastro comum.
export async function superAdminController(request, env) {
  const session = await getSession(env, readSessionId(request));
  if (!session) return errorResponse("Sessão inválida ou expirada.",401);
  // Identidade do proprietário configurada exclusivamente como segredo no Worker.
  // Sem configuração, o painel permanece fechado (fail closed).
  const ownerId = String(env.SUPER_ADMIN_USER || "").trim().toUpperCase();
  const isOwner = Boolean(ownerId) && String(session.usuario || "").trim().toUpperCase() === ownerId
    && tenantIdForLegacySession(session) === LEGACY_NOVA_FROTA.id;
  if (!isOwner) return errorResponse("Acesso exclusivo do Super Admin.",403);
  const path = new URL(request.url).pathname;
  if (request.method !== "GET") {
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
      return success({elevated:true,tenantWrite:Boolean(env.TENANTS_DB&&env.SUPER_ADMIN_TENANT_WRITES==="enabled")});
    return writeTenantCatalog(request,env,verified.subject);
  }
  if (path === "/v1/super-admin/me") return success({superAdmin:true,usuario:session.usuario,capabilities:{tenantCatalog:Boolean(env.TENANTS_DB),legacyUserRead:env.SUPER_ADMIN_LEGACY_USERS_READ==="enabled",tenantWrite:Boolean(env.TENANTS_DB&&env.SUPER_ADMIN_OIDC&&env.SUPER_ADMIN_SUBJECT&&env.SUPER_ADMIN_TENANT_WRITES==="enabled"),userWrite:false}});
  if (path === "/v1/super-admin/modules") return success({modules:TENANT_MODULES});
  if (path === "/v1/super-admin/transportadoras") {
    // Até o provisionamento do catálogo, preservar a leitura da empresa legada.
    const legacy = {id:LEGACY_NOVA_FROTA.id,name:LEGACY_NOVA_FROTA.nome,active:true,modules:[]};
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
        "SELECT user_id, role, active, created_at FROM portal_tenant_users WHERE tenant_id=? ORDER BY user_id LIMIT 500"
      ).bind(tenantId).all();
      return success({
        tenantId,
        usuarios:(result?.results || []).map(u=>({
          id:u.user_id,perfil:u.role,ativo:u.active===1,dataVinculo:u.created_at
        })),
        origem:"vinculos-d1",
        completo:false,
        aviso:"Lista de vínculos do catálogo. Usuários legados ainda não foram sincronizados; resultado vazio não significa ausência de usuários."
      });
    } catch (error) {
      console.error("[SUPER ADMIN] Consulta de usuários indisponível",String(error?.message || error));
      return errorResponse("Consulta de usuários indisponível.",503);
    }
  }
  return errorResponse("Recurso administrativo não implementado.",404);
}
