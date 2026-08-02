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

// =====================================================
// PONTE SEGURA PARA TELAS LEGADAS JSONP
// =====================================================
(function installSecureLegacyJsonpBridge(){
  if(window.__portalLegacyJsonpBridgeInstalled) return;
  window.__portalLegacyJsonpBridgeInstalled = true;

  const originalAppendChild = HTMLHeadElement.prototype.appendChild;

  function queryObject(url){
    const output = {};
    url.searchParams.forEach((value, key) => {
      if(key !== "callback" && key !== "_" && key !== "action") output[key] = value;
    });
    return output;
  }

  function normalizeRows(data){
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

  function okData(result){ return { ok:true, data:result.data || {} }; }
  function okRows(result){ return { ok:true, data:normalizeRows(result.data) }; }

  function adminRoute(action, params){
    const map = {
      frotaleve_list:["read","frotaleve"],
      frotaleve_add:["create","frotaleve"],
      frotaleve_update:["update","frotaleve"],
      cheques_list:["read","cheques"],
      cheques_add:["create","cheques"],
      cheques_update:["update","cheques"],
      materiais_list:["read","materiais"],
      materiais_add:["create","materiais"],
      materiais_update:["update","materiais"],
      solicit_list:["read","solicitacoes"],
      solicit_add:["create","solicitacoes"],
      solicit_update:["update","solicitacoes"],
      patrimonio_list:["read","patrimonio"],
      patrimonio_add:["create","patrimonio"],
      patrimonio_update:["update","patrimonio"],
      epis_list:["read","epis"],
      epis_add:["create","epis"],
      epis_update:["update","epis"]
    };

    const item = map[action];
    if(!item) return null;

    return {
      module:"administrativo",
      action:item[0],
      params:{ ...params, resource:item[1] },
      adapt:item[0] === "read" ? okRows : okData
    };
  }

  function cadastroRoute(action, params){
    const match = String(action || "").match(/^(usuarios|regionais|filiais|clientes|contatos|funcionarios)_(list|add|update|toggle)$/);
    if(!match) return null;

    const resource = match[1];
    const operation = match[2];
    const actionMap = { list:"read", add:"create", update:"update", toggle:"update" };

    return {
      module:"cadastros",
      action:actionMap[operation],
      params:{ ...params, resource, operation },
      adapt:operation === "list" ? okRows : okData
    };
  }

  function resolveLegacyRoute(action, params){
    const cadastro = cadastroRoute(action, params);
    if(cadastro) return cadastro;

    const admin = adminRoute(action, params);
    if(admin) return admin;

    switch(action){
      case "home_dashboard":
        return { module:"home", action:"read", params:{}, adapt:okData };
      case "cadastros_fretes_list":
        return { module:"fretes", action:"read", params:{resource:"directory"}, adapt:okData };
      case "fretes_list":
        return { module:"fretes", action:"read", params:{}, adapt:okRows };
      case "fretes_add":
        return { module:"fretes", action:"create", params, adapt:okData };
      case "fretes_update":
        return { module:"fretes", action:"update", params, adapt:okData };
      case "fretes_delete":
        return { module:"fretes", action:"delete", params, adapt:okData };
      case "fretes2_list":
        return { module:"fretes2", action:"read", params:{}, adapt:okRows };
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
          params:{base:String(params.base || "fretes").trim().toLowerCase()},
          adapt(result){
            const raw = result.data;
            const rows = normalizeRows(raw);
            return { ok:true, data:rows, base:raw?.base || params.base || "fretes", aba:raw?.aba || "", total:raw?.total ?? rows.length };
          }
        };
      case "historico_diario_list":
        return { module:"bi", action:"read", params:{resource:"daily-history",dataInicio:params.dataInicio||"",dataFim:params.dataFim||""}, adapt:okRows };
      case "historico_fretes_list":
        return { module:"bi", action:"read", params:{resource:"commercial-history",dataInicio:params.dataInicio||"",dataFim:params.dataFim||""}, adapt:okRows };
      case "controle_embarques_list":
        return {module:"controle",action:"read",params:{resource:"embarques"},adapt:okRows};
      case "controle_veiculos_list":
        return {module:"controle",action:"read",params:{resource:"veiculos"},adapt:okRows};
      case "controle_embarques_add":
        return {module:"controle",action:"create",params:{...params,resource:"embarques"},adapt:okData};
      case "controle_embarques_update":
        return {module:"controle",action:"update",params:{...params,resource:"embarques"},adapt:okData};
      case "controle_embarques_delete":
        return {module:"controle",action:"delete",params:{...params,resource:"embarques"},adapt:okData};
      case "controle_veiculos_add":
        return {module:"controle",action:"create",params:{...params,resource:"veiculos"},adapt:okData};
      case "controle_veiculos_update":
        return {module:"controle",action:"update",params:{...params,resource:"veiculos"},adapt:okData};
      case "controle_veiculos_delete":
        return {module:"controle",action:"delete",params:{...params,resource:"veiculos"},adapt:okData};
      case "estadias_list":
        return {module:"estadias",action:"read",params:{...params,resource:"registros"},adapt:okRows};
      default:
        return null;
    }
  }

  function deliverCallback(callbackName, payload){
    if(callbackName && typeof window[callbackName] === "function") window[callbackName](payload);
  }

  HTMLHeadElement.prototype.appendChild = function(node){
    const isScript = node && String(node.tagName || "").toUpperCase() === "SCRIPT";
    const src = isScript ? String(node.src || "") : "";

    if(isScript && src.includes("script.google.com/macros/")){
      let parsed;
      try { parsed = new URL(src); }
      catch { return originalAppendChild.call(this, node); }

      const action = String(parsed.searchParams.get("action") || "").trim();
      const callbackName = String(parsed.searchParams.get("callback") || "").trim();
      const route = resolveLegacyRoute(action, queryObject(parsed));

      if(route){
        Promise.resolve()
          .then(() => window.PortalAPI.call(route.module, route.action, route.params))
          .then(result => deliverCallback(callbackName, route.adapt(result)))
          .catch(error => deliverCallback(callbackName, { ok:false, error:error?.message || "Falha na API segura do Portal Frete." }));
        return node;
      }
    }

    return originalAppendChild.call(this, node);
  };
})();

// =====================================================
// PONTE SEGURA PARA FETCH LEGADO
// =====================================================
(function installSecureLegacyFetchBridge(){
  if(window.__portalLegacyFetchBridgeInstalled) return;
  window.__portalLegacyFetchBridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);

  function jsonResponse(payload){
    return Promise.resolve(new Response(JSON.stringify(payload), {
      status:200,
      headers:{"Content-Type":"application/json;charset=utf-8"}
    }));
  }

  function normalizeRows(data){
    if(Array.isArray(data)) return data;
    if(Array.isArray(data?.data)) return data.data;
    return [];
  }

  async function parseLegacyRequest(input, init){
    const rawUrl = typeof input === "string" ? input : String(input?.url || "");
    if(!rawUrl.includes("script.google.com/macros/")) return null;

    let url;
    try { url = new URL(rawUrl); }
    catch { return null; }

    const method = String(init?.method || input?.method || "GET").toUpperCase();
    let payload = {};

    if(method === "POST"){
      try { payload = JSON.parse(String(init?.body || "{}")); }
      catch { payload = {}; }
    }else{
      url.searchParams.forEach((value,key) => { if(key !== "_") payload[key] = value; });
    }

    const action = String(payload.action || url.searchParams.get("action") || "").trim();

    if(action === "cheques_upload_termo"){
      return { module:"administrativo", action:"update", params:{...payload,resource:"cheques-upload"}, adapt(result){return {ok:true,data:result.data||{}};} };
    }

    const estadiasMap = {
      estadias_save:"create",
      estadias_update:"update",
      estadias_delete:"delete",
      estadias_status:"update"
    };

    if(estadiasMap[action]){
      return {
        module:"estadias",
        action:estadiasMap[action],
        params:{
          ...payload,
          resource:action === "estadias_status" ? "status" : "registros",
          operation:action.replace("estadias_","")
        },
        adapt(result){return {ok:true,data:result.data||{}};}
      };
    }

    switch(action){
      case "getAll":
        return {
          module:"custo-filial", action:"read", params:{resource:"all"},
          adapt(result){
            const data=result.data||{};
            return {ok:true,metas:Array.isArray(data.metas)?data.metas:[],lancamentos:Array.isArray(data.lancamentos)?data.lancamentos:[]};
          }
        };
      case "fretes_list":
        return {module:"fretes",action:"read",params:{},adapt(result){return {ok:true,data:normalizeRows(result.data)};}};
      case "importar_metas_base":
        return {module:"custo-filial",action:"export",params:{resource:"importar-metas"},adapt(result){return {ok:true,data:result.data||{}};}};
      case "add_meta":
        return {module:"custo-filial",action:"create",params:{...payload,resource:"metas"},adapt(result){return {ok:true,data:result.data||{}};}};
      case "update_meta":
        return {module:"custo-filial",action:"update",params:{...payload,resource:"metas"},adapt(result){return {ok:true,data:result.data||{}};}};
      case "add_lancamento":
        return {module:"custo-filial",action:"create",params:{...payload,resource:"lancamentos"},adapt(result){return {ok:true,data:result.data||{}};}};
      case "update_lancamento":
        return {module:"custo-filial",action:"update",params:{...payload,resource:"lancamentos"},adapt(result){return {ok:true,data:result.data||{}};}};
      default:
        return null;
    }
  }

  window.fetch = async function(input, init){
    const route = await parseLegacyRequest(input, init);
    if(!route) return originalFetch(input, init);

    try{
      const result = await window.PortalAPI.call(route.module, route.action, route.params);
      return jsonResponse(route.adapt(result));
    }catch(error){
      return jsonResponse({ok:false,error:error?.message || "Falha na API segura do Portal Frete."});
    }
  };
})();
