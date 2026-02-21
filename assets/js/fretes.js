/* fretes.js | NOVA FROTA (AJUSTADO + PISO S/N + MODAL + LISTAS LOCAIS) */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzQv34T2Oi_hs5Re91N81XM1lH_5mZSkNJw8_8I6Ij4HZNFb97mcL8fNmob1Bg8ZGI6/exec";

  // ======================================================
  // ✅ CATÁLOGO LOCAL (GITHUB)
  // Edite aqui para manter sua lista fixa no repositório
  // ======================================================
  const CATALOGO = {
    regionais: [
      "ITUMBIARA",
      "RIO VERDE",
      "JATAI",
    ],
    filiais: {
      ITUMBIARA: ["ITUMBIARA", "GOIANIA"],
      "RIO VERDE": ["RIO VERDE", "SANTA HELENA"],
      JATAI: ["JATAI"],
    },
    // Clientes por FILIAL (opcional, pode deixar vazio e usar só sugestão geral)
    clientesPorFilial: {
      ITUMBIARA: ["LDC", "CARGILL", "COFCO"],
      "RIO VERDE": ["CARGILL", "CUTRALE"],
      JATAI: ["MOSAIC"],
    },
    // Contatos por CLIENTE (opcional)
    contatosPorCliente: {
      LDC: ["(64) 99999-9999"],
      CARGILL: ["(64) 98888-8888"],
    },

    // ✅ Se quiser listas “globais” também:
    clientesGlobais: ["LDC", "CARGILL", "COFCO", "MOSAIC", "CUTRALE"],
    contatosGlobais: ["(64) 99999-9999", "(64) 98888-8888"],
  };

  // ======================================================
  // DOM helpers
  // ======================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function getTbody() {
    return document.querySelector("#tbody") || document.querySelector("tbody");
  }

  function setStatus(text) {
    const el =
      document.querySelector("[data-sync-status]") ||
      document.querySelector("#syncStatus") ||
      document.querySelector("#status") ||
      document.querySelector(".syncStatus");
    if (el) el.textContent = text;
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function toUpperClean(v) {
    return safeText(v).toUpperCase();
  }

  // ======================================================
  // Parse número pt-BR (ex: "1.234,56" -> 1234.56)
  // ======================================================
  function parsePtNumber(value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;

    let s = String(value).trim();
    if (!s) return NaN;

    s = s.replace(/\s+/g, "").replace(/[^\d.,-]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function ceil0(n) {
    return Math.ceil(n);
  }

  // ======================================================
  // WhatsApp helper
  // ======================================================
  function extractPhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";
    let digits = s.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return "";
  }

  function whatsappLinkFromContato(contato) {
    const phone = extractPhoneBR(contato);
    return phone ? "https://wa.me/" + phone : "";
  }

  // ======================================================
  // API (JSON + JSONP)
  // ======================================================
  async function apiGet(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const rawText = await res.text().catch(() => "");

    const looksHtml =
      ct.includes("text/html") ||
      /^\s*<!doctype html/i.test(rawText) ||
      /^\s*<html/i.test(rawText);

    if (looksHtml) {
      const err = new Error("API retornou HTML (deploy/permissão do Apps Script).");
      err.httpStatus = res.status;
      err.url = url.toString();
      err.preview = rawText.slice(0, 260);
      throw err;
    }

    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      const t = String(rawText || "").trim();
      const p1 = t.indexOf("(");
      const p2 = t.lastIndexOf(")");

      const looksJsonp = p1 > 0 && p2 > p1 && /^[a-zA-Z_$][\w$]*\s*\(/.test(t);
      if (looksJsonp) {
        const inner = t.slice(p1 + 1, p2).trim();
        try {
          data = inner ? JSON.parse(inner) : null;
        } catch {
          const err = new Error("Falha ao interpretar JSONP da API.");
          err.url = url.toString();
          err.preview = t.slice(0, 260);
          throw err;
        }
      } else {
        const err = new Error("Falha ao interpretar JSON da API.");
        err.url = url.toString();
        err.preview = t.slice(0, 260);
        throw err;
      }
    }

    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.httpStatus = res.status;
      err.data = data;
      err.url = url.toString();
      throw err;
    }

    return data;
  }

  async function fetchRows() {
    const tries = [{ action: "list" }, { action: "rows" }, {}];

    let lastErr = null;
    for (const p of tries) {
      try {
        const data = await apiGet(p);
        const rows =
          data?.data ||
          data?.rows ||
          data?.fretes ||
          data?.result ||
          (Array.isArray(data) ? data : null);

        if (Array.isArray(rows)) return rows;
        lastErr = new Error("Resposta sem array de linhas (params: " + JSON.stringify(p) + ")");
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Falha ao buscar dados.");
  }

  // ======================================================
  // COLUNAS (na ordem do HTML)
  // ======================================================
  const COLS = [
    { key: "regional", label: "Regional" },
    { key: "filial", label: "Filial" },
    { key: "cliente", label: "Cliente" },
    { key: "origem", label: "Origem" },
    { key: "coleta", label: "Coleta" },

    { key: "contato", label: "Contato", isContato: true },

    { key: "destino", label: "Destino" },
    { key: "uf", label: "UF" },
    { key: "descarga", label: "Descarga" },
    { key: "volume", label: "Volume" },

    { key: "valorEmpresa", label: "Vlr Empresa" },
    { key: "valorMotorista", label: "Vlr Motorista" },

    { key: "km", label: "KM" },
    { key: "pedagioEixo", label: "Pedágio/Eixo" },

    { key: "e5", label: "5E", isSN: true },
    { key: "e6", label: "6E", isSN: true },
    { key: "e7", label: "7E", isSN: true },
    { key: "e4", label: "4E", isSN: true },
    { key: "e9", label: "9E", isSN: true },

    { key: "produto", label: "Produto" },
    { key: "icms", label: "ICMS" },

    { key: "pedidoSat", label: "Pedido SAT" },

    { key: "porta", label: "Porta" },
    { key: "transito", label: "Trânsito" },
    { key: "status", label: "Status" },
    { key: "obs", label: "Observações" },

    { key: "__acoes", label: "Ações", isAcoes: true },
  ];

  function valueFromRow(row, key, index) {
    if (Array.isArray(row)) return safeText(row[index] ?? "");

    if (row && typeof row === "object") {
      const map = {
        regional: ["regional"],
        filial: ["filial"],
        cliente: ["cliente"],
        origem: ["origem"],
        coleta: ["coleta"],
        contato: ["contato", "contatos", "telefone", "fone"],
        destino: ["destino"],
        uf: ["uf", "estado"],
        descarga: ["descarga"],
        volume: ["volume"],

        valorEmpresa: ["valorEmpresa", "vlrEmpresa", "empresa"],
        valorMotorista: ["valorMotorista", "vlrMotorista", "motorista"],

        km: ["km"],
        pedagioEixo: ["pedagioEixo", "pedagio", "pedagio_por_eixo"],

        e5: ["e5", "5e"],
        e6: ["e6", "6e"],
        e7: ["e7", "7e"],
        e4: ["e4", "4e"],
        e9: ["e9", "9e"],

        produto: ["produto"],
        icms: ["icms"],

        pedidoSat: ["pedidoSat", "pedidoSAT", "pedido", "sat"],

        porta: ["porta"],
        transito: ["transito", "trânsito", "transitoDias"],
        status: ["status"],
        obs: ["obs", "observacao", "observações", "observacoes"],
      };

      const candidates = map[key] || [key];
      for (const c of candidates) {
        if (c in row) return safeText(row[c]);
      }
    }
    return "";
  }

  function buildContatoCell(contatoText) {
    const td = document.createElement("td");

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "6px";
    wrap.style.minWidth = "0";

    const span = document.createElement("span");
    span.textContent = contatoText || "";
    span.style.whiteSpace = "nowrap";
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";
    span.style.minWidth = "0";
    wrap.appendChild(span);

    const wpp = whatsappLinkFromContato(contatoText);
    if (wpp) {
      const a = document.createElement("a");
      a.href = wpp;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Chamar no WhatsApp";
      a.className = "waIcon";

      const img = document.createElement("img");
      img.src = "../assets/img/whatsapp.png";
      img.alt = "WhatsApp";
      img.onerror = () => {
        a.textContent = "📞";
        a.style.background = "#EEF2F7";
      };

      a.appendChild(img);
      wrap.appendChild(a);
    }

    td.appendChild(wrap);
    return td;
  }

  function buildSNCell(v) {
    const td = document.createElement("td");
    td.className = "num";

    const vv = safeText(v).toUpperCase();
    const span = document.createElement("span");
    span.className =
      "pillSN " + (vv === "S" ? "s" : vv === "N" ? "n" : "empty");
    span.textContent = vv || "-";

    td.appendChild(span);
    return td;
  }

  function buildAcoesCell(row) {
    const td = document.createElement("td");
    td.className = "num";

    const id = row?.id ? String(row.id) : "";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btnTiny ghost";
    btnEdit.textContent = "Editar";
    btnEdit.style.marginRight = "6px";
    btnEdit.addEventListener("click", () => openModal("edit", row));

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btnTiny";
    btnDel.textContent = "Excluir";
    btnDel.addEventListener("click", async () => {
      if (!id) return alert("Sem ID para excluir.");
      if (!confirm("Excluir este frete?")) return;

      try {
        setStatus("🗑 Excluindo...");
        const data = await apiGet({ action: "delete", id });
        if (data?.ok) {
          setStatus("✅ Excluído");
          await atualizar();
        } else {
          setStatus("❌ Falha ao excluir");
          alert(data?.error || "Falha ao excluir.");
        }
      } catch (e) {
        console.error("[fretes] erro delete:", e);
        setStatus("❌ Erro ao excluir");
      }
    });

    td.appendChild(btnEdit);
    td.appendChild(btnDel);
    return td;
  }

  // ======================================================
  // ✅ PISO MÍNIMO (S/N) baseado na sua página do piso
  // ======================================================
  const PISO_PARAMS = {
    e9: { eixos: 9, rkm: 8.53, custoCC: 877.83, weightInputId: "w9", defaultPeso: 47 },
    e4: { eixos: 4, rkm: 7.4505, custoCC: 792.30, weightInputId: "w4", defaultPeso: 39 },
    e7: { eixos: 7, rkm: 7.4505, custoCC: 792.30, weightInputId: "w7", defaultPeso: 36 },
    e6: { eixos: 6, rkm: 6.8058, custoCC: 656.76, weightInputId: "w6", defaultPeso: 31 },
    e5: { eixos: 5, rkm: 6.1859, custoCC: 642.10, weightInputId: "w5", defaultPeso: 26 },
  };

  function getPesoFromUI(id, fallback) {
    const el = document.getElementById(id);
    const v = parsePtNumber(el?.value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  function calcMinRPorTon(param, km, pedagioPorEixo) {
    const peso = getPesoFromUI(param.weightInputId, param.defaultPeso);
    const numerador = (param.rkm * km) + param.custoCC + (pedagioPorEixo * param.eixos);
    const base = numerador / peso;
    return ceil0(base);
  }

  function sn(valueMotoristaTon, minTon) {
    if (!Number.isFinite(valueMotoristaTon) || !Number.isFinite(minTon)) return "";
    return valueMotoristaTon >= minTon ? "S" : "N";
  }

  function applyPisoSN(rows) {
    return (rows || []).map((r) => {
      const km = parsePtNumber(valueFromRow(r, "km")) || 0;
      const ped = parsePtNumber(valueFromRow(r, "pedagioEixo")) || 0;
      const vm = parsePtNumber(valueFromRow(r, "valorMotorista"));

      const min5 = calcMinRPorTon(PISO_PARAMS.e5, km, ped);
      const min6 = calcMinRPorTon(PISO_PARAMS.e6, km, ped);
      const min7 = calcMinRPorTon(PISO_PARAMS.e7, km, ped);
      const min4 = calcMinRPorTon(PISO_PARAMS.e4, km, ped);
      const min9 = calcMinRPorTon(PISO_PARAMS.e9, km, ped);

      return {
        ...r,
        e5: sn(vm, min5),
        e6: sn(vm, min6),
        e7: sn(vm, min7),
        e4: sn(vm, min4),
        e9: sn(vm, min9),
      };
    });
  }

  // ======================================================
  // ✅ MODAL + LISTAS (autocomplete encadeado)
  // ======================================================
  const MODAL = {
    el: () => document.getElementById("modal"),
    title: () => document.getElementById("modalTitle"),
    btnClose: () => document.getElementById("btnCloseModal"),
    btnCancel: () => document.getElementById("btnCancel"),
    btnSave: () => document.getElementById("btnSave"),

    regional: () => document.getElementById("mRegional"),
    filial: () => document.getElementById("mFilial"),
    cliente: () => document.getElementById("mCliente"),
    contato: () => document.getElementById("mContato"),

    origem: () => document.getElementById("mOrigem"),
    coleta: () => document.getElementById("mColeta"),
    destino: () => document.getElementById("mDestino"),
    uf: () => document.getElementById("mUF"),
    descarga: () => document.getElementById("mDescarga"),
    produto: () => document.getElementById("mProduto"),
    km: () => document.getElementById("mKM"),
    ped: () => document.getElementById("mPed"),
    volume: () => document.getElementById("mVolume"),
    icms: () => document.getElementById("mICMS"),
    empresa: () => document.getElementById("mEmpresa"),
    motorista: () => document.getElementById("mMotorista"),
    sat: () => document.getElementById("mSat"),
    porta: () => document.getElementById("mPorta"),
    transito: () => document.getElementById("mTransito"),
    status: () => document.getElementById("mStatus"),
    obs: () => document.getElementById("mObs"),
  };

  const DLS = {
    regional: "dl_mRegional",
    filial: "dl_mFilial",
    cliente: "dl_mCliente",
    contato: "dl_mContato",
  };

  function ensureDatalist(id) {
    let dl = document.getElementById(id);
    if (!dl) {
      dl = document.createElement("datalist");
      dl.id = id;
      document.body.appendChild(dl);
    }
    return dl;
  }

  function fillDatalist(dlId, items) {
    const dl = ensureDatalist(dlId);
    dl.innerHTML = "";
    (items || [])
      .map((x) => toUpperClean(x))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        dl.appendChild(opt);
      });
  }

  // ✅ extras salvos no navegador (sem mexer no GitHub)
  const LS_KEY = "nf_fretes_catalogo_extra_v1";
  function loadExtra() {
    try {
      const o = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      return o && typeof o === "object" ? o : {};
    } catch {
      return {};
    }
  }
  function saveExtra(o) {
    localStorage.setItem(LS_KEY, JSON.stringify(o || {}));
  }
  function addExtra(kind, value) {
    const v = toUpperClean(value);
    if (!v) return;
    const extra = loadExtra();
    extra[kind] = extra[kind] || [];
    if (!extra[kind].includes(v)) extra[kind].push(v);
    saveExtra(extra);
  }

  function mergedList(base, kind) {
    const extra = loadExtra();
    const add = Array.isArray(extra[kind]) ? extra[kind] : [];
    return Array.from(new Set([...(base || []), ...add].map(toUpperClean))).filter(Boolean);
  }

  function applyUppercaseLive(inputEl) {
    if (!inputEl) return;
    inputEl.style.textTransform = "uppercase";
    inputEl.addEventListener("input", () => {
      const start = inputEl.selectionStart;
      const end = inputEl.selectionEnd;
      inputEl.value = toUpperClean(inputEl.value);
      try {
        inputEl.setSelectionRange(start, end);
      } catch {}
    });
    inputEl.addEventListener("blur", () => {
      inputEl.value = toUpperClean(inputEl.value);
    });
  }

  function computeFiliaisByRegional(regional) {
    const r = toUpperClean(regional);
    const by = CATALOGO.filiais || {};
    const list = by[r] || [];
    return mergedList(list, `filiais_${r}`);
  }

  function computeClientesByFilial(filial) {
    const f = toUpperClean(filial);
    const by = CATALOGO.clientesPorFilial || {};
    const list = by[f] || [];
    const global = CATALOGO.clientesGlobais || [];
    return mergedList([...global, ...list], `clientes_${f}`);
  }

  function computeContatosByCliente(cliente) {
    const c = toUpperClean(cliente);
    const by = CATALOGO.contatosPorCliente || {};
    const list = by[c] || [];
    const global = CATALOGO.contatosGlobais || [];
    return mergedList([...global, ...list], `contatos_${c}`);
  }

  function setupModalSelectors() {
    const iReg = MODAL.regional();
    const iFil = MODAL.filial();
    const iCli = MODAL.cliente();
    const iCon = MODAL.contato();

    if (iReg) iReg.setAttribute("list", DLS.regional);
    if (iFil) iFil.setAttribute("list", DLS.filial);
    if (iCli) iCli.setAttribute("list", DLS.cliente);
    if (iCon) iCon.setAttribute("list", DLS.contato);

    // uppercase live
    [iReg, iFil, iCli, iCon].forEach(applyUppercaseLive);

    // inicial
    fillDatalist(DLS.regional, mergedList(CATALOGO.regionais || [], "regionais"));

    const refreshByReg = () => {
      const reg = toUpperClean(iReg?.value);
      fillDatalist(DLS.filial, computeFiliaisByRegional(reg));
      // quando mudar regional, limpa abaixo para evitar combo incoerente
      if (iFil) iFil.value = toUpperClean(iFil.value);
      refreshByFilial();
    };

    const refreshByFilial = () => {
      const fil = toUpperClean(iFil?.value);
      fillDatalist(DLS.cliente, computeClientesByFilial(fil));
      if (iCli) iCli.value = toUpperClean(iCli.value);
      refreshByCliente();
    };

    const refreshByCliente = () => {
      const cli = toUpperClean(iCli?.value);
      fillDatalist(DLS.contato, computeContatosByCliente(cli));
      if (iCon) iCon.value = toUpperClean(iCon.value);
    };

    iReg?.addEventListener("input", refreshByReg);
    iFil?.addEventListener("input", refreshByFilial);
    iCli?.addEventListener("input", refreshByCliente);

    // primeira montagem
    refreshByReg();
  }

  let modalMode = "new"; // "new" | "edit"
  let editingRow = null;

  function showModal(show) {
    const m = MODAL.el();
    if (!m) return;
    m.style.display = show ? "flex" : "none";
    m.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function clearModal() {
    const ids = [
      "mRegional","mFilial","mCliente","mContato",
      "mOrigem","mColeta","mDestino","mUF","mDescarga","mProduto",
      "mKM","mPed","mVolume","mICMS","mEmpresa","mMotorista",
      "mSat","mPorta","mTransito","mStatus","mObs"
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === "SELECT") el.value = "LIBERADO";
      else el.value = "";
    });
    // default status
    const st = MODAL.status();
    if (st) st.value = "LIBERADO";
  }

  function fillModalFromRow(row) {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = toUpperClean(v);
    };

    set("mRegional", valueFromRow(row, "regional"));
    set("mFilial", valueFromRow(row, "filial"));
    set("mCliente", valueFromRow(row, "cliente"));
    set("mContato", valueFromRow(row, "contato"));

    set("mOrigem", valueFromRow(row, "origem"));
    set("mColeta", valueFromRow(row, "coleta"));
    set("mDestino", valueFromRow(row, "destino"));
    set("mUF", valueFromRow(row, "uf"));
    set("mDescarga", valueFromRow(row, "descarga"));
    set("mProduto", valueFromRow(row, "produto"));

    const setRaw = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = safeText(v);
    };

    setRaw("mKM", valueFromRow(row, "km"));
    setRaw("mPed", valueFromRow(row, "pedagioEixo"));
    setRaw("mVolume", valueFromRow(row, "volume"));
    setRaw("mICMS", valueFromRow(row, "icms"));
    setRaw("mEmpresa", valueFromRow(row, "valorEmpresa"));
    setRaw("mMotorista", valueFromRow(row, "valorMotorista"));

    set("mSat", valueFromRow(row, "pedidoSat"));
    set("mPorta", valueFromRow(row, "porta"));
    setRaw("mTransito", valueFromRow(row, "transito"));

    const st = MODAL.status();
    if (st) st.value = toUpperClean(valueFromRow(row, "status")) || "LIBERADO";

    const obs = MODAL.obs();
    if (obs) obs.value = safeText(valueFromRow(row, "obs"));
  }

  function openModal(mode, row) {
    modalMode = mode === "edit" ? "edit" : "new";
    editingRow = row || null;

    const title = MODAL.title();
    if (title) title.textContent = modalMode === "edit" ? "Editar Frete" : "Novo Frete";

    if (modalMode === "new") clearModal();
    else fillModalFromRow(row);

    // garantir datalists sempre atualizados
    setupModalSelectors();

    showModal(true);
    // foco no primeiro campo
    setTimeout(() => MODAL.regional()?.focus(), 50);
  }

  function closeModal() {
    showModal(false);
  }

  function readModalPayload() {
    // upper em campos textuais
    const payload = {
      regional: toUpperClean(MODAL.regional()?.value),
      filial: toUpperClean(MODAL.filial()?.value),
      cliente: toUpperClean(MODAL.cliente()?.value),
      contato: toUpperClean(MODAL.contato()?.value),

      origem: toUpperClean(MODAL.origem()?.value),
      coleta: toUpperClean(MODAL.coleta()?.value),
      destino: toUpperClean(MODAL.destino()?.value),
      uf: toUpperClean(MODAL.uf()?.value),
      descarga: toUpperClean(MODAL.descarga()?.value),
      produto: toUpperClean(MODAL.produto()?.value),

      km: safeText(MODAL.km()?.value),
      pedagioEixo: safeText(MODAL.ped()?.value),
      volume: safeText(MODAL.volume()?.value),
      icms: safeText(MODAL.icms()?.value),
      valorEmpresa: safeText(MODAL.empresa()?.value),
      valorMotorista: safeText(MODAL.motorista()?.value),

      pedidoSat: toUpperClean(MODAL.sat()?.value),
      porta: toUpperClean(MODAL.porta()?.value),
      transito: safeText(MODAL.transito()?.value),
      status: toUpperClean(MODAL.status()?.value),
      obs: safeText(MODAL.obs()?.value),
    };

    // guarda extras no navegador (sugestões)
    addExtra("regionais", payload.regional);
    addExtra(`filiais_${payload.regional}`, payload.filial);
    addExtra(`clientes_${payload.filial}`, payload.cliente);
    addExtra(`contatos_${payload.cliente}`, payload.contato);

    return payload;
  }

  async function saveModal() {
    const payload = readModalPayload();

    // validação mínima
    if (!payload.filial) return alert("Informe a FILIAL.");
    if (!payload.cliente) return alert("Informe o CLIENTE.");

    try {
      setStatus("💾 Salvando...");

      const id = editingRow?.id ? String(editingRow.id) : "";

      // tenta ações comuns no Apps Script (fallback)
      const tries = modalMode === "edit"
        ? [
            { action: "update", id, ...payload },
            { action: "edit", id, ...payload },
            { action: "upsert", id, ...payload },
            { action: "save", id, ...payload },
          ]
        : [
            { action: "create", ...payload },
            { action: "add", ...payload },
            { action: "insert", ...payload },
            { action: "upsert", ...payload },
            { action: "save", ...payload },
          ];

      let last = null;
      for (const p of tries) {
        try {
          const data = await apiGet(p);
          if (data?.ok) {
            setStatus("✅ Salvo");
            closeModal();
            await atualizar();
            return;
          }
          last = data;
        } catch (e) {
          last = e;
        }
      }

      console.error("[fretes] falha save tries:", last);
      setStatus("❌ Falha ao salvar");
      alert("Não consegui salvar no Apps Script.\nConfira se seu backend aceita action=create/update (ou me mande o doGet/doPost do Apps Script).");
    } catch (e) {
      console.error("[fretes] erro salvar:", e);
      setStatus("❌ Erro ao salvar");
      alert("Erro ao salvar. Veja o console (F12).");
    }
  }

  function bindModalButtons() {
    MODAL.btnClose()?.addEventListener("click", closeModal);
    MODAL.btnCancel()?.addEventListener("click", closeModal);
    MODAL.btnSave()?.addEventListener("click", saveModal);

    // fecha clicando no fundo
    MODAL.el()?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "modal") closeModal();
    });

    // ESC fecha
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && MODAL.el()?.style.display === "flex") closeModal();
    });
  }

  // ======================================================
  // RENDER (agrupa por filial, ordena por cliente)
  // ======================================================
  function render(rowsRaw) {
    const tbody = getTbody();
    if (!tbody) return;

    tbody.innerHTML = "";
    if (!rowsRaw || !rowsRaw.length) return;

    const rows = applyPisoSN(rowsRaw);

    rows.sort((a, b) => {
      const fa = safeText(a?.filial).localeCompare(safeText(b?.filial));
      if (fa !== 0) return fa;

      const ca = safeText(a?.cliente).localeCompare(safeText(b?.cliente));
      if (ca !== 0) return ca;

      const oa = safeText(a?.origem).localeCompare(safeText(b?.origem));
      if (oa !== 0) return oa;

      return safeText(a?.destino).localeCompare(safeText(b?.destino));
    });

    let filialAtual = "";

    rows.forEach((row) => {
      const filialRow = safeText(row?.filial);
      if (filialRow !== filialAtual) {
        filialAtual = filialRow;

        const trGroup = document.createElement("tr");
        trGroup.className = "groupRow";

        const td = document.createElement("td");
        td.colSpan = COLS.length;
        td.textContent = filialAtual || "SEM FILIAL";

        trGroup.appendChild(td);
        tbody.appendChild(trGroup);
      }

      const tr = document.createElement("tr");

      COLS.forEach((col, idx) => {
        if (col.isContato) {
          const contatoText = valueFromRow(row, "contato", idx);
          tr.appendChild(buildContatoCell(contatoText));
          return;
        }

        if (col.isAcoes) {
          tr.appendChild(buildAcoesCell(row));
          return;
        }

        if (col.isSN) {
          tr.appendChild(buildSNCell(valueFromRow(row, col.key, idx)));
          return;
        }

        const td = document.createElement("td");
        td.textContent = valueFromRow(row, col.key, idx);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ======================================================
  // AÇÕES
  // ======================================================
  async function atualizar() {
    try {
      setStatus("🔄 Carregando...");
      const rows = await fetchRows();
      render(rows);
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[fretes] erro ao atualizar:", e);

      if (String(e?.message || "").includes("retornou HTML")) {
        setStatus("❌ Erro ao sincronizar (deploy/permissão)");
        console.warn("[fretes] Trecho retorno:", e.preview || "");
      } else {
        setStatus("❌ Erro ao sincronizar");
      }
    }
  }

  function bindButtons() {
    const btnAtualizar = $("#btnReloadFromSheets");
    const btnNovo = $("#btnNew");

    if (btnAtualizar) btnAtualizar.addEventListener("click", atualizar);

    if (btnNovo) {
      btnNovo.addEventListener("click", () => {
        openModal("new", null);
      });
    }

    // ✅ quando pesos mudarem, recalcula a tabela (S/N)
    ["#w9", "#w4", "#w7", "#w6", "#w5"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", () => {
        atualizar();
      });
    });

    // modal
    bindModalButtons();
  }

  function init() {
    bindButtons();
    // montar datalists uma vez
    setupModalSelectors();
    atualizar();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
