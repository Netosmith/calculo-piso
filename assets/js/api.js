// =====================================================
// api.js | PORTAL FRETE
// Comunicação única com o Cloudflare Worker
// =====================================================

const PORTAL_API_BASE = "https://api.portalfrete.net.br";

async function portalApiRequest(path, options = {}) {
  const response = await fetch(`${PORTAL_API_BASE}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Resposta inválida da API do Portal Frete.");
  }

  if (!response.ok || data?.ok !== true) {
    const error = new Error(data?.error || "Falha na API do Portal Frete.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
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
    return portalApiRequest("/v1/login", { method: "POST", body: { usuario, senha } });
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
