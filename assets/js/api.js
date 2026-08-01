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
  },

  call(module, action, params = {}) {
    return portalApiRequest("/v1/gateway", {
      method: "POST",
      body: { module, action, params }
    });
  }
};

// =====================================================
// COMPATIBILIDADE TEMPORÁRIA DA HOME
//
// A Home antiga ainda monta uma tag <script> JSONP apontando
// diretamente para o Apps Script. Enquanto o HTML é migrado,
// interceptamos somente essa chamada e entregamos o mesmo
// callback usando o gateway autenticado do Worker.
//
// Nenhuma requisição de métricas da Home sai diretamente para
// o Apps Script.
// =====================================================
(function installSecureHomeDashboardBridge(){
  if(window.__portalHomeDashboardBridgeInstalled) return;
  window.__portalHomeDashboardBridgeInstalled = true;

  const originalAppendChild = HTMLHeadElement.prototype.appendChild;

  HTMLHeadElement.prototype.appendChild = function(node){
    const isScript = node && String(node.tagName || "").toUpperCase() === "SCRIPT";
    const src = isScript ? String(node.src || "") : "";

    if(
      isScript &&
      src.includes("script.google.com/macros/") &&
      src.includes("action=home_dashboard")
    ){
      let callbackName = "";

      try{
        callbackName = new URL(src).searchParams.get("callback") || "";
      }catch(error){
        callbackName = "";
      }

      Promise.resolve()
        .then(() => window.PortalAPI.call("home", "read", {}))
        .then(result => {
          if(callbackName && typeof window[callbackName] === "function"){
            window[callbackName]({
              ok: true,
              data: result.data || {}
            });
          }
        })
        .catch(error => {
          if(callbackName && typeof window[callbackName] === "function"){
            window[callbackName]({
              ok: false,
              error: error?.message || "Falha ao consultar os indicadores da Home."
            });
          }
        });

      return node;
    }

    return originalAppendChild.call(this, node);
  };
})();
