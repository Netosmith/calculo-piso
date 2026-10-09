const MAINTENANCE_KV_KEY = "portal:maintenance:v1";
const MAINTENANCE_R2_KEY = "__system/maintenance.json";
const DEFAULT_MESSAGE = "Portal temporariamente indisponível para manutenção.";

function defaultState() {
  return {
    enabled: false,
    message: DEFAULT_MESSAGE,
    updatedAt: "",
    updatedBy: ""
  };
}

function normalizeState(parsed) {
  return {
    enabled: parsed?.enabled === true,
    message: String(parsed?.message || DEFAULT_MESSAGE).trim() || DEFAULT_MESSAGE,
    updatedAt: String(parsed?.updatedAt || ""),
    updatedBy: String(parsed?.updatedBy || "")
  };
}

export function isAdministrator(session) {
  return String(session?.perfil || "").trim().toUpperCase() === "ADMINISTRADOR";
}

export async function getMaintenanceState(env) {
  // R2 é a fonte principal para não depender da cota diária de escrita do KV.
  if (env?.CLIENT_LOGOS) {
    try {
      const object = await env.CLIENT_LOGOS.get(MAINTENANCE_R2_KEY);
      if (object?.body) {
        const parsed = JSON.parse(await object.text());
        return normalizeState(parsed);
      }
    } catch (error) {
      console.warn("[MAINTENANCE] Falha ao ler estado no R2", {
        message: String(error?.message || error)
      });
    }
  }

  // Compatibilidade: se houver estado antigo no KV, ainda conseguimos lê-lo.
  if (env?.SESSIONS) {
    try {
      const raw = await env.SESSIONS.get(MAINTENANCE_KV_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.warn("[MAINTENANCE] Falha ao ler estado legado no KV", {
        message: String(error?.message || error)
      });
    }
  }

  return defaultState();
}

export async function setMaintenanceState(env, input = {}) {
  if (!env?.CLIENT_LOGOS) {
    throw new Error("Armazenamento R2 de manutenção indisponível.");
  }

  const state = {
    enabled: input.enabled === true,
    message: String(input.message || DEFAULT_MESSAGE).trim().slice(0, 240) || DEFAULT_MESSAGE,
    updatedAt: new Date().toISOString(),
    updatedBy: String(input.updatedBy || "").trim().slice(0, 100)
  };

  await env.CLIENT_LOGOS.put(
    MAINTENANCE_R2_KEY,
    JSON.stringify(state),
    {
      httpMetadata: {
        contentType: "application/json",
        cacheControl: "no-store"
      },
      customMetadata: {
        tipo: "portal-maintenance",
        atualizadoPor: state.updatedBy,
        atualizadoEm: state.updatedAt
      }
    }
  );

  return state;
}
