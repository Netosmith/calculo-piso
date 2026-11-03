// Registro central dos cards gerenciáveis pelo Super Admin.
// A presença neste registro NÃO concede acesso ao módulo: o backend deve validar
// tenant, status e permissão em cada requisição antes de disponibilizar dados.
export const TENANT_MODULES = Object.freeze([
  "piso", "piso2", "fretes", "fretes2", "fretes-sp", "fretes-ms", "fretes-ba", "fretes-pr", "fretes-sc", "fretes-ro", "fretes-to", "fretes-ma", "bi", "divulgacao", "controle",
  "share", "ordem", "cadastros", "estadias", "custo-frota",
  "administrativo", "monitoramento",
"fretes-mercado", "custo-filial", "patrimonio", "embarques", "chamados"
]);

export function validTenantModule(value) {
  return typeof value === "string" && TENANT_MODULES.includes(value);
}

export function enabledModulesForTenant(rows) {
  if (!Array.isArray(rows)) return [];
  const enabled = new Set(rows.filter(row => row?.enabled === 1).map(row => row.module_key));
  return TENANT_MODULES.filter(module => enabled.has(module));
}
