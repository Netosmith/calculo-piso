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
    body: options.body === undefined
      ? undefined
      : JSON.stringify(options.body)
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

window.PortalAPI = {
  login(usuario, senha) {
    return portalApiRequest("/v1/login", {
      method: "POST",
      body: { usuario, senha }
    });
  },

  session() {
    return portalApiRequest("/v1/session");
  },

  selectState(estado) {
    return portalApiRequest("/v1/session/state", {
      method: "POST",
      body: { estado }
    });
  },

  logout() {
    return portalApiRequest("/v1/logout", {
      method: "POST",
      body: {}
    });
  }
};
