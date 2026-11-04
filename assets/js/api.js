// =====================================================
// api.js | PORTAL FRETE
// Comunicação única com o Cloudflare Worker
// =====================================================

const PORTAL_API_BASE = "https://api.portalfrete.net.br";
const PORTAL_RETRYABLE_STATUS = new Set([502, 503, 504]);

// Support access is never granted by this header: the Worker independently
// authenticates LUZIANO's signed legacy session on every request.
function ownerSupportTenant(){
  const session=window.__PORTAL_TENANT_SESSION;
  const expected=window.__PORTAL_TENANT_EXPECTED;
  if(session?.ownerSupport!==true)return "";
  if(!expected||session.transportadoraId!==expected)
    throw new Error("Contexto de suporte diferente da transportadora atual.");
  return expected;
}
function tenantRequestOptions(options={}){
 const target=ownerSupportTenant();
 return target ? {...options,headers:{...(options.headers||{}),
   "X-Portal-Support-Tenant":target}} : options;
}
function tenantResourceUrl(resource){
 const suffix=resource==="logo"||resource==="artes"?resource:null;
 if(!suffix)throw new Error("Recurso visual da transportadora invalido.");
 const target=ownerSupportTenant();
 return PORTAL_API_BASE+"/v1/tenant/"+suffix+
   (target?"?supportTenant="+encodeURIComponent(target):"");
}
window.portalTenantResourceUrl=tenantResourceUrl;

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


async function portalFileRequest(path, options = {}) {
  const response = await fetch(`${PORTAL_API_BASE}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    cache: "no-store",
    headers: options.headers || {},
    body: options.body
  });

  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error("Resposta inválida da API de arquivos do Portal Frete.");
    error.status = response.status;
    throw error;
  }

  if (!response.ok || data?.ok !== true) {
    const error = new Error(data?.error || "Falha na API de arquivos do Portal Frete.");
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
  login(usuario, senha, transportadoraId = "nova-frota") {
    return portalApiRequest("/v1/login", {
      method: "POST",
      body: { usuario, senha, transportadoraId },
      retries: 1
    });
  },
  transportadorasPublicas(){
    return portalApiRequest("/v1/transportadoras/public");
  },
  tenantRequest(path,options={}){
    if(typeof path!=="string" || !/^\/(?:me|bi|integracao|catalogo\/clientes|regionais\/ufs|usuarios(?:\/[A-Z0-9][A-Z0-9._-]{1,79})?|fretes(?:\/[a-f0-9-]{36})?)$/.test(path)){
      return Promise.reject(new Error("Rota da transportadora inválida."));
    }
    return portalApiRequest("/v1/tenant"+path,tenantRequestOptions(options));
  },
  tenantLogoUrl(){
    return tenantResourceUrl("logo");
  },
  tenantResourceUrl,
  tenantContext(tenantId){
    if(!/^[a-z][a-z0-9-]{2,47}$/.test(String(tenantId||"")))
      return Promise.reject(new Error("Identificador de transportadora invalido."));
    return portalApiRequest("/v1/tenant/context?tenantId="+encodeURIComponent(tenantId));
  },
  session() {
    // The owner keeps the Nova Frota session; tenant pages derive a temporary
    // view of the chosen company instead of creating a tenant user/login.
    const expected=window.__PORTAL_TENANT_EXPECTED;
    if(expected)return this.tenantContext(expected);
    return portalApiRequest("/v1/session");
  },
  selectState(estado) {
    return portalApiRequest("/v1/session/state", { method: "POST", body: { estado } });
  },
  logout() {
    return portalApiRequest("/v1/logout", { method: "POST", body: {} });
  },
  maintenanceStatus() {
    return portalApiRequest("/v1/maintenance");
  },
  setMaintenance(enabled, message = "") {
    return portalApiRequest("/v1/maintenance", {
      method: "POST",
      body: { enabled: Boolean(enabled), message }
    });
  },
  async call(module, action, params = {}) {
    // URL does not grant access. Signed Worker session chooses the tenant
    // and resolves its Apps Script URL/key from private R2.
    const scoped=window.__PORTAL_TENANT_EXPECTED;
    let session=window.__PORTAL_TENANT_SESSION;
    if(scoped){
      if(session?.tenantMode!==true||session.transportadoraId!==scoped){
        const response=await portalApiRequest("/v1/session");
        session=response.session;
        if(session?.tenantMode!==true||session.transportadoraId!==scoped){
          throw new Error("Sessão de transportadora inválida.");
        }
        window.__PORTAL_TENANT_SESSION=session;
      }
    }
    const isTenant=session?.tenantMode===true;
    const requestOptions={
      method:"POST",body:{module,action,params}
    };
    const result = await portalApiRequest(isTenant?"/v1/tenant/gateway":"/v1/gateway",
      isTenant?tenantRequestOptions(requestOptions):requestOptions);

    return normalizeGatewayEnvelope(result);
  },
  clientLogoUrl(cliente, cacheBust = "") {
    const name = String(cliente || "").trim();
    const suffix = cacheBust ? `?v=${encodeURIComponent(cacheBust)}` : "";
    return `${PORTAL_API_BASE}/v1/client-logos/${encodeURIComponent(name)}${suffix}`;
  },
  putClientLogo(cliente, file) {
    if (!file) return Promise.reject(new Error("Selecione uma imagem."));
    return portalFileRequest(
      `/v1/client-logos/${encodeURIComponent(String(cliente || "").trim())}`,
      {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      }
    );
  },
  deleteClientLogo(cliente) {
    return portalFileRequest(
      `/v1/client-logos/${encodeURIComponent(String(cliente || "").trim())}`,
      { method: "DELETE" }
    );
  }
};
