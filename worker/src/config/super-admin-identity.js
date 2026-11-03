import { LEGACY_NOVA_FROTA, tenantIdForLegacySession } from "./transportadoras.js";

// Controle adicional para operações globais de escrita.
// Não basta conhecer o nome de usuário: exige identificador estável
// emitido por um provedor de autenticação confiável e confirmado no servidor.
// Enquanto não houver integração desse provedor, toda escrita fica bloqueada.
export function canManageTenants(session, env) {
  if (!session || tenantIdForLegacySession(session)!==LEGACY_NOVA_FROTA.id) return false;
  const owner = String(env?.SUPER_ADMIN_USER || "").trim().toUpperCase();
  const ownerSubject = String(env?.SUPER_ADMIN_SUBJECT || "").trim();
  const subject = typeof session.authSubject === "string" ? session.authSubject.trim() : "";
  const assurance = session.authAssurance;
  return Boolean(owner && ownerSubject && subject &&
    String(session.usuario || "").trim().toUpperCase()===owner &&
    subject===ownerSubject && assurance==="mfa" &&
    session.authProviderVerified===true);
}
