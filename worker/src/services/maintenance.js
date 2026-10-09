const MAINTENANCE_KEY = "portal:maintenance:v1";
const DEFAULT_MESSAGE = "Portal temporariamente indisponível para manutenção.";

export function isAdministrator(session) {
  return String(session?.perfil || "").trim().toUpperCase() === "ADMINISTRADOR";
}

export async function getMaintenanceState(env) {
  if (!env?.SESSIONS) {
    return {
      enabled: false,
      message: DEFAULT_MESSAGE,
      updatedAt: "",
      updatedBy: ""
    };
  }

  try {
    const raw = await env.SESSIONS.get(MAINTENANCE_KEY);
    if (!raw) {
      return {
        enabled: false,
        message: DEFAULT_MESSAGE,
        updatedAt: "",
        updatedBy: ""
      };
    }

    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled === true,
      message: String(parsed?.message || DEFAULT_MESSAGE).trim() || DEFAULT_MESSAGE,
      updatedAt: String(parsed?.updatedAt || ""),
      updatedBy: String(parsed?.updatedBy || "")
    };
  } catch (error) {
    console.warn("[MAINTENANCE] Falha ao ler estado", {
      message: String(error?.message || error)
    });

    return {
      enabled: false,
      message: DEFAULT_MESSAGE,
      updatedAt: "",
      updatedBy: ""
    };
  }
}

export async function setMaintenanceState(env, input = {}) {
  if (!env?.SESSIONS) {
    throw new Error("Armazenamento de manutenção indisponível.");
  }

  const state = {
    enabled: input.enabled === true,
    message: String(input.message || DEFAULT_MESSAGE).trim().slice(0, 240) || DEFAULT_MESSAGE,
    updatedAt: new Date().toISOString(),
    updatedBy: String(input.updatedBy || "").trim().slice(0, 100)
  };

  await env.SESSIONS.put(MAINTENANCE_KEY, JSON.stringify(state));
  return state;
}
