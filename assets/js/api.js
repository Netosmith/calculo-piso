// =====================================================
// api.js | PORTAL FRETE
// Comunicação única com o Cloudflare Worker
// =====================================================

const PORTAL_API_BASE = "https://api.portalfrete.net.br";
const PORTAL_RETRYABLE_STATUS = new Set([502, 503, 504]);

function waitPortalRetry(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortalTransientError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "").toLowerCase();

  return (
    PORTAL_RETRYABLE_STATUS.has(status) ||
    error?.name === "AbortError" ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("rede") ||
    message.includes("timeout") ||
    message.includes("tempo limite") ||
    message.includes("aborted")
  );
}

async function portalApiRequest(path, options = {}) {
  const retries = Math.max(0, Number(options.retries || 0));
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${PORTAL_API_BASE}${path}`, {
        method: options.method || "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...(options.headers || {})
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });

      let data;
      try {
        data = await response.json();
      } catch {
        const error = new Error("Resposta inválida da API do Portal Frete.");
        error.status = response.status;
        throw error;
      }

      if (!response.ok || data?.ok !== true) {
        const error = new Error(data?.error || "Falha na API do Portal Frete.");
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      lastError = error;

      if (attempt >= retries || !isPortalTransientError(error)) {
        throw error;
      }

      await waitPortalRetry(700 * (attempt + 1));
    }
  }

  throw lastError || new Error("Falha na API do Portal Frete.");
}

function normalizeGatewayEnvelope(result) {
  const inner = result?.data;

  if (
    inner &&
    typeof inner === "object" &&
    !Array.isArray(inner) &&
    inner.ok === true &&
    Object.prototype.hasOwnProperty.call(inner, "data")
  ) {
    const { data, ...gatewayMeta } = inner;
    return {
      ...result,
      data,
      gatewayMeta
    };
  }

  return result;
}

window.PortalAPI = {
  login(usuario, senha) {
    return portalApiRequest("/v1/login", {
      method: "POST",
      body: { usuario, senha },
      retries: 1
    });
  },
  session() {
    return portalApiRequest("/v1/session");
  },
  selectState(estado) {
    return portalApiRequest("/v1/session/state", { method: "POST", body: { estado } });
  },
  logout() {
    return portalApiRequest("/v1/logout", { method: "POST", body: {} });
  },
  async call(module, action, params = {}) {
    const result = await portalApiRequest("/v1/gateway", {
      method: "POST",
      body: { module, action, params }
    });

    return normalizeGatewayEnvelope(result);
  }
};
