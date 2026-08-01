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
// PONTE SEGURA PARA TELAS LEGADAS
// =====================================================
(function installSecureLegacyJsonpBridge(){
  if(window.__portalLegacyJsonpBridgeInstalled) return;
  window.__portalLegacyJsonpBridgeInstalled = true;

  const originalAppendChild = HTMLHeadElement.prototype.appendChild;

  function queryObject(url){
    const output = {};
    url.searchParams.forEach((value, key) => {
      if(key !== "callback" && key !== "_" && key !== "action"){
        output[key] = value;
      }
    });
    return output;
  }

  function normalizeFretesListData(data){
    if(Array.isArray(data)) return data;
    if(Array.isArray(data?.data)) return data.data;
    return [];
  }

  function normalizeRowsData(data){
    if(Array.isArray(data)) return data;
    if(Array.isArray(data?.data)) return data.data;
    if(Array.isArray(data?.rows)) return data.rows;
    if(Array.isArray(data?.items)) return data.items;
    if(Array.isArray(data?.embarques)) return data.embarques;
    if(Array.isArray(data?.veiculos)) return data.veiculos;
    if(Array.isArray(data?.historico)) return data.historico;
    if(Array.isArray(data?.registros)) return data.registros;
    return [];
  }

  function okData(result){
    return { ok:true, data:result.data || {} };
  }

  function okRows(result){
    return { ok:true, data:normalizeRowsData(result.data) };
  }

  function resolveLegacyRoute(action, params){
    switch(action){
      case "home_dashboard":
        return { module:"home", action:"read", params:{}, adapt:okData };

      case "cadastros_fretes_list":
        return {
          module:"fretes",
          action:"read",
          params:{ resource:"directory" },
          adapt:okData
        };

      case "fretes_list":
        return {
          module:"fretes",
          action:"read",
          params:{},
          adapt(result){ return { ok:true, data:normalizeFretesListData(result.data) }; }
        };

      case "fretes_add":
        return { module:"fretes", action:"create", params, adapt:okData };

      case "fretes_update":
        return { module:"fretes", action:"update", params, adapt:okData };

      case "fretes_delete":
        return { module:"fretes", action:"delete", params, adapt:okData };

      case "fretes2_list":
        return {
          module:"fretes2",
          action:"read",
          params:{},
          adapt(result){ return { ok:true, data:normalizeFretesListData(result.data) }; }
        };

      case "fretes2_add":
        return { module:"fretes2", action:"create", params, adapt:okData };

      case "fretes2_update":
        return { module:"fretes2", action:"update", params, adapt:okData };

      case "fretes2_delete":
        return { module:"fretes2", action:"delete", params, adapt:okData };

      case "list":
      case "share_clientes_list":
        return {
          module:"share",
          action:"read",
          params:{ base:String(params.base || "fretes").trim().toLowerCase() },
          adapt(result){
            const raw = result.data;
            return {
              ok:true,
              data:normalizeFretesListData(raw),
              base:raw?.base || params.base || "fretes",
              aba:raw?.aba || "",
              total:raw?.total ?? normalizeFretesListData(raw).length
            };
          }
        };

      case "historico_diario_list":
        return {
          module:"bi",
          action:"read",
          params:{
            resource:"daily-history",
            dataInicio:params.dataInicio || "",
            dataFim:params.dataFim || ""
          },
          adapt:okRows
        };

      case "historico_fretes_list":
        return {
          module:"bi",
          action:"read",
          params:{
            resource:"commercial-history",
            dataInicio:params.dataInicio || "",
            dataFim:params.dataFim || ""
          },
          adapt:okRows
        };

      // Controle de Embarque
      case "controle_embarques_list":
        return {
          module:"controle",
          action:"read",
          params:{ resource:"embarques" },
          adapt:okRows
        };

      case "controle_veiculos_list":
        return {
          module:"controle",
          action:"read",
          params:{ resource:"veiculos" },
          adapt:okRows
        };

      case "controle_embarques_add":
        return {
          module:"controle",
          action:"create",
          params:{ ...params, resource:"embarques" },
          adapt:okData
        };

      case "controle_embarques_update":
        return {
          module:"controle",
          action:"update",
          params:{ ...params, resource:"embarques" },
          adapt:okData
        };

      case "controle_embarques_delete":
        return {
          module:"controle",
          action:"delete",
          params:{ ...params, resource:"embarques" },
          adapt:okData
        };

      case "controle_veiculos_add":
        return {
          module:"controle",
          action:"create",
          params:{ ...params, resource:"veiculos" },
          adapt:okData
        };

      case "controle_veiculos_update":
        return {
          module:"controle",
          action:"update",
          params:{ ...params, resource:"veiculos" },
          adapt:okData
        };

      case "controle_veiculos_delete":
        return {
          module:"controle",
          action:"delete",
          params:{ ...params, resource:"veiculos" },
          adapt:okData
        };

      default:
        return null;
    }
  }

  function deliverCallback(callbackName, payload){
    if(callbackName && typeof window[callbackName] === "function"){
      window[callbackName](payload);
    }
  }

  HTMLHeadElement.prototype.appendChild = function(node){
    const isScript = node && String(node.tagName || "").toUpperCase() === "SCRIPT";
    const src = isScript ? String(node.src || "") : "";

    if(isScript && src.includes("script.google.com/macros/")){
      let parsed;
      try{
        parsed = new URL(src);
      }catch(error){
        return originalAppendChild.call(this, node);
      }

      const action = String(parsed.searchParams.get("action") || "").trim();
      const callbackName = String(parsed.searchParams.get("callback") || "").trim();
      const params = queryObject(parsed);
      const route = resolveLegacyRoute(action, params);

      if(route){
        Promise.resolve()
          .then(() => window.PortalAPI.call(route.module, route.action, route.params))
          .then(result => deliverCallback(callbackName, route.adapt(result)))
          .catch(error => {
            deliverCallback(callbackName, {
              ok:false,
              error:error?.message || "Falha na API segura do Portal Frete."
            });
          });

        return node;
      }
    }

    return originalAppendChild.call(this, node);
  };
})();