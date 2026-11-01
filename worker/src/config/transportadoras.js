/**
 * Identidade da transportadora legada.
 *
 * A Nova Frota é a empresa inicial do Portal Frete.
 * Este módulo NÃO migra dados nem autoriza acesso entre empresas.
 * Nunca usar este ID como fallback genérico para usuários de novas empresas.
 */
export const LEGACY_NOVA_FROTA = Object.freeze({
  id: "nova-frota",
  nome: "Nova Frota Logística e Transportes",
  legacy: true,
  logo: "../assets/img/logo-novafrota.png"
});

/**
 * Apenas sessões legadas, autenticadas pelo cadastro atual, podem ser
 * reconhecidas como pertencentes à empresa inicial durante a transição.
 * O provisionamento de outros tenants exige identificação explícita.
 */
export function tenantIdForLegacySession(session) {
  if (!session || !session.usuario) return null;
  if (session.transportadoraId) return String(session.transportadoraId);
  return LEGACY_NOVA_FROTA.id;
}
