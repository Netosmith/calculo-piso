import { LEGACY_NOVA_FROTA, tenantIdForLegacySession } from "../config/transportadoras.js";
import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";

// Bootstrap restrito: conta existente autenticada pelo Apps Script.
// O papel global NÃO pode ser atribuído via cadastro comum.
export async function superAdminController(request, env) {
  if (request.method !== "GET") return errorResponse("Método não permitido.",405);
  const session = await getSession(env, readSessionId(request));
  if (!session) return errorResponse("Sessão inválida ou expirada.",401);
  // Identidade do proprietário configurada exclusivamente como segredo no Worker.
  // Sem configuração, o painel permanece fechado (fail closed).
  const ownerId = String(env.SUPER_ADMIN_USER || "").trim().toUpperCase();
  const isOwner = Boolean(ownerId) && String(session.usuario || "").trim().toUpperCase() === ownerId
    && tenantIdForLegacySession(session) === LEGACY_NOVA_FROTA.id;
  if (!isOwner) return errorResponse("Acesso exclusivo do Super Admin.",403);
  const path = new URL(request.url).pathname;
  if (path === "/v1/super-admin/me") return success({superAdmin:true,usuario:session.usuario});
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
          "SELECT module_key FROM portal_tenant_modules WHERE tenant_id=? AND enabled=1"
        ).bind(company.id).all();
        return {
          id:company.id,
          name:company.name,
          active:company.status==="active",
          modules:(modules?.results || []).map(row=>row.module_key)
        };
      }));
      if (!transportadoras.some(company=>company.id===legacy.id)) transportadoras.unshift(legacy);
      return success({transportadoras,catalogo:"d1"});
    } catch (error) {
      console.error("[SUPER ADMIN] Catálogo indisponível",String(error?.message || error));
      return errorResponse("Catálogo de transportadoras indisponível.",503);
    }
  }
  return errorResponse("Recurso administrativo não implementado.",404);
}
