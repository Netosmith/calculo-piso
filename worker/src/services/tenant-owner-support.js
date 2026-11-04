import {getSession,readSessionId} from "./session.js";
import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";
import {validTenantId} from "./tenant-auth.js";

/**
 * Owner support access is derived from the existing signed Nova Frota login.
 * This never provisions a tenant user, password, or tenant session cookie.
 * The requested tenant is only a scope; it is NOT an authorization grant.
 */
export async function ownerSupportPrincipal(request,env,tenantId){
 if(!validTenantId(tenantId)||!env?.TENANTS_DB)return null;
 const ownerId=String(env.SUPER_ADMIN_USER||"").trim().toUpperCase();
 if(!ownerId)return null;
 const legacy=await getSession(env,readSessionId(request));
 if(!legacy ||
   String(legacy.usuario||"").trim().toUpperCase()!==ownerId ||
   String(legacy.perfil||"").trim().toUpperCase()!=="ADMINISTRADOR" ||
   tenantIdForLegacySession(legacy)!==LEGACY_NOVA_FROTA.id)return null;
 const tenant=await env.TENANTS_DB.prepare(
  "SELECT id,name FROM portal_tenants WHERE id=? AND status='active' LIMIT 1"
 ).bind(tenantId).first();
 if(!tenant)return null;
 return {
  tenant_id:tenant.id,
  tenant_name:tenant.name,
  user_id:ownerId,
  role:"ADMINISTRADOR",
  owner_support:true
 };
}
