const PROFILE_FEATURES = {
  GO: ["fretes", "divulgacao", "estadias"],
  GOADM: ["administrativo", "patrimonio", "estadias"],
  OPERACIONAL: [
    "piso", "piso2", "fretes", "share", "divulgacao",
    "fretes-mercado", "bi", "controle", "estadias", "embarques"
  ],
  COMERCIAL: [
    "piso", "piso2", "fretes", "share", "divulgacao", "bi",
    "fretes-mercado", "controle", "fretes2", "estadias", "embarques"
  ],
  ADMINISTRADOR: [
    "home", "piso", "piso2", "fretes", "share", "divulgacao", "bi",
    "custo-filial", "fretes-mercado", "administrativo", "patrimonio",
    "cadastros", "fretes2", "controle", "estadias", "embarques"
  ],
  ESTADIAS_ADMIN: ["estadias"],
  ESTADIAS_EDITOR: ["estadias"],
  ESTADIAS_CONSULTA: ["estadias"],
  PISO: ["piso2"],
  SP: ["piso", "divulgacao", "estadias"],
  MG: ["piso", "divulgacao", "estadias"],
  MT: ["piso", "divulgacao", "fretes2", "controle", "share", "estadias", "embarques"],
  BA: ["piso", "divulgacao", "estadias"],
  SC: ["piso", "divulgacao", "estadias"],
  TO: ["piso", "divulgacao", "estadias"],
  PR: ["piso", "divulgacao", "estadias"],
  PA: ["piso", "divulgacao", "estadias"],
  MA: ["piso", "divulgacao", "estadias"]
};

export const MODULE_ACTIONS = {
  home: ["read"],
  piso: ["read", "calculate"],
  piso2: ["read", "calculate"],
  fretes: ["read", "create", "update", "delete"],
  fretes2: ["read", "create", "update", "delete"],
  "fretes-mercado": ["read", "create", "update", "delete"],
  controle: ["read", "create", "update", "delete"],
  share: ["read", "export"],
  bi: ["read", "export"],
  "custo-filial": ["read", "create", "update", "delete", "export"],
  divulgacao: ["read", "create", "export"],
  administrativo: ["read", "create", "update", "delete"],
  patrimonio: ["read", "create", "update", "delete"],
  cadastros: ["read", "create", "update", "delete"],
  estadias: ["read", "create", "update", "approve", "reject", "delete"],
  embarques: ["read", "create", "update", "delete", "export"]
};

const ADMIN_PROFILES = new Set(["ADMINISTRADOR"]);
const WRITE_PROFILES = new Set([
  "ADMINISTRADOR", "OPERACIONAL", "COMERCIAL", "GO", "GOADM", "MT",
  "ESTADIAS_ADMIN", "ESTADIAS_EDITOR"
]);
const DELETE_PROFILES = new Set([
  "ADMINISTRADOR", "GOADM", "ESTADIAS_ADMIN"
]);
const FREIGHT_DELETE_PROFILES = new Set([
  "ADMINISTRADOR", "OPERACIONAL", "COMERCIAL"
]);
const FRETES2_DELETE_PROFILES = new Set([
  "ADMINISTRADOR", "OPERACIONAL", "COMERCIAL", "MT"
]);
const HOME_REQUEST_CREATE_PROFILES = new Set([
  "ADMINISTRADOR", "GOADM", "OPERACIONAL", "COMERCIAL"
]);

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

export function hasFeature(session, moduleName) {
  const profile = normalize(session?.perfil);

  // Administrador tem acesso a todos os módulos registrados no gateway.
  if (ADMIN_PROFILES.has(profile)) return true;

  const features = PROFILE_FEATURES[profile] || [];
  return moduleName === "home" || features.includes(moduleName);
}

export function canRunGatewayAction(session, moduleName, actionName, params = {}) {
  const allowedActions = MODULE_ACTIONS[moduleName];
  if (!allowedActions || !allowedActions.includes(actionName)) return false;

  const profile = normalize(session?.perfil);
  const resource = normalize(params?.resource);

  if (
    moduleName === "administrativo" &&
    actionName === "create" &&
    resource === "SOLICITACOES"
  ) {
    return HOME_REQUEST_CREATE_PROFILES.has(profile);
  }

  if (!hasFeature(session, moduleName)) return false;
  if (ADMIN_PROFILES.has(profile)) return true;

  if (["read", "calculate", "export"].includes(actionName)) return true;

  if (actionName === "delete") {
    if (moduleName === "fretes2") {
      return FRETES2_DELETE_PROFILES.has(profile);
    }

    if (moduleName === "fretes") {
      return FREIGHT_DELETE_PROFILES.has(profile);
    }

    return DELETE_PROFILES.has(profile);
  }

  if (["approve", "reject"].includes(actionName)) {
    return ["ADMINISTRADOR", "GOADM", "ESTADIAS_ADMIN"].includes(profile);
  }

  return WRITE_PROFILES.has(profile);
}
