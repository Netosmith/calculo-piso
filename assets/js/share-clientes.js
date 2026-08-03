/* share-clientes.js | NOVA FROTA | Gateway seguro Cloudflare */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const LS_KEY_BASE = "nf_share_clientes_base_v1";
  const HTML2CANVAS_SRC = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

  const LOGO_BASE_PATH = "../assets/img/clientes/";
  const LOGO_EXTS = ["png", "jpg", "jpeg", "webp"];

  let BASE_ATUAL = "fretes";
  let refreshSequence = 0;
  let html2canvasPromise = null;

  let ocultarFreteEmpresa = true;

  const CLIENTES_FIXOS = [
    "CARGILL", "TERRA ROXA", "VITERRA", "COFCO", "NOVA AGRI", "JBS SEARA",
    "BRF", "MOSAIC", "AMAGGI", "INGREDION", "OLFAR", "LDC", "BRADO", "C VALE",
    "OLAM BRASIL", "SODRU", "BOM JESUS", "SOYBRASIL", "LAVORO",
    "AGRIBRASIL", "BOM FUTURO", "CHS", "CIBRAFERTIL", "CJ TRADE",
    "FERT TOCANTINS", "GAVILON", "GRUPO SCHEFFER", "INPASA",
    "AGRICOLA ALVORADA", "ABJ AGROPECUARIA", "ADM", "FIAGRIL", "FS",
    "ALPHAGRAIN", "FERTIMIG", "FERTIPAR", "GIRASSOL", "GRUPO ATTO",
    "ADUBRAS", "CARAMURU", "YUKAER AGRO", "DUAL", "AGRONELLI", "BELAGRO",
    "COOPERNORT", "SIPAL", "H A PIMENTA", "SAFRAS", "SINAGRO", "CAMPO REAL",
    "AGROSOYA", "COPAGRI", "VMC", "GENERAL MILLS", "CUTRALE", "AGREX",
    "YARA", "HEDGE", "ALZ", "MARUBENI", "MDNORTE", "FS TRADING", "SJC",
    "CJ SELECTA", "COOXUPE", "BTG PACTUAL", "FENIX", "FERTIGRAN",
    "RIFERTIL", "SEMENTES SAO FRANCISCO", "SEMPRE SEMENTES", "GOIASA",
    "SAO MARTINHO", "AGRO CLUB", "MILHAO ALIMENTOS", "TRATO", "BREJEIRO",
    "GEN", "ARAGUAIA", "NUTRIEN", "KOWALSKI LDC", "BIORGANICA",
    "RICARDO MARTINS", "SERGIO GALVAO", "AGROMEN", "PROSOLLO", "USINA DECAL",
    "COOPERVASS", "SOAMI", "RAFIRA", "CONCEITO AGRICOLA", "AGROBOM",
    "MOINHO VITORIA", "MMJV GRAOS", "BOA SAFRA", "NOVA GALIA", "CEREAL",
    "SOMAI ALIMENTOS", "SITARI", "ALENCAR", "AGROMERCANTIL", "OURO SAFRA",
    "FUTURO", "GRAN MILHO", "HERINGER", "CEREAL OURO", "EUROCHEM", "GRANOL",
    "AGROAMAZONIA", "AGROMAVE", "CERTANO", "SEEDCORP", "BAUMINAS",
    "JALLES MACHADO", "ALIMENTOS N1", "ROAN ALIMENTOS", "CERRADINHO",
    "FAZENDAO AGRO", "IACO", "JATAI CEREAIS", "USINA SERRANOPOLIS",
    "FAST FRETE", "RIO DOCE", "INTEGRA", "RENATO CARVALHO", "COMIVA",
    "COMERX", "SCALON E CERHI", "3 TENTOS", "BIOMA", "AGROLESTE",
    "EDSON CROCHIQUIA", "COPAIBA", "ATVOS", "JRCA"
  ];

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function up(v) {
    return safeText(v).toUpperCase();
  }

  function num(v) {
    const raw = String(v ?? "").trim();
    if (!raw) return 0;

    const normalized = raw
      .replace(/\s+/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");

    const n = Number(normalized);
    return isFinite(n) ? n : 0;
  }

  function formatBRL(v) {
    const n = Number(v);
    if (!isFinite(n)) return "";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function statusClass(st) {
    const s = up(st);
    return s === "LIBERADO" ? "liberado" : "suspenso";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getToggleButton() {
    return $("btnToggleFreteEmpresa") || $("btnOcultarFreteEmpresa");
  }

  function updateToggleButtonText() {
    const btn = getToggleButton();
    if (!btn) return;

    btn.textContent = ocultarFreteEmpresa
      ? "MOSTRAR"
      : "OCULTAR";
  }

  function toggleFreteEmpresa(hide) {
    const els = document.querySelectorAll(".col-frete-empresa");
    els.forEach((el) => {
      el.style.display = hide ? "none" : "";
    });

    updateToggleButtonText();
  }

  function updateSyncStatus(status, message) {
    const el = $("syncStatus");
    if (!el) return;

    if (status === "loading") {
      el.textContent = `🔄 ${message || "Carregando..."}`;
      el.style.color = "#5B7CFA";
    } else if (status === "success") {
      el.textContent = `✅ ${message || "Sincronizado"}`;
      el.style.color = "#067647";
    } else if (status === "error") {
      el.textContent = `❌ ${message || "Erro"}`;
      el.style.color = "#991B1B";
    }
  }

  function getBaseLabel(base) {
    return base === "fretes2" ? "FRETES MT" : "FRETES GO";
  }

  function getPaginaFretes(base) {
    return base === "fretes2" ? "./fretes2.html" : "./fretes.html";
  }

  function nowPerformance() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function recordPerformance(label, startedAt) {
    const elapsedMs = Math.max(0, Math.round(nowPerformance() - startedAt));
    window.__portalPerformance = window.__portalPerformance || {};
    window.__portalPerformance[`share:${label}`] = elapsedMs;
    console.info(`[share/perf] ${label}: ${elapsedMs} ms`);
    return elapsedMs;
  }

  function formatElapsed(elapsedMs) {
    if (elapsedMs < 1000) return `${elapsedMs} ms`;
    return `${(elapsedMs / 1000).toFixed(1).replace(".", ",")} s`;
  }

  function friendlySyncError(error) {
    const status = Number(error?.status || error?.data?.status || 0);
    const message = safeText(error?.message).toLowerCase();

    if (status === 401 || message.includes("sessão") || message.includes("session")) {
      return "Sessão expirada. Entre novamente.";
    }

    if (status === 403 || message.includes("permiss")) {
      return "Seu perfil não possui permissão para consultar esta base.";
    }

    if (
      status === 502 || status === 503 || status === 504 ||
      error?.name === "AbortError" ||
      message.includes("timeout") ||
      message.includes("tempo limite") ||
      message.includes("aborted") ||
      message.includes("apps script")
    ) {
      return "Apps Script demorou para responder. Tente Atualizar.";
    }

    if (
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("rede") ||
      (typeof navigator !== "undefined" && navigator.onLine === false)
    ) {
      return "Falha de rede. Verifique a conexão e tente Atualizar.";
    }

    return error?.message || "Não foi possível carregar o Share Clientes.";
  }

  async function waitForPortalReady() {
    const startedAt = nowPerformance();

    if (!window.portalAuthReady || typeof window.portalAuthReady.then !== "function") {
      throw new Error("Validação de sessão indisponível.");
    }

    const session = await window.portalAuthReady;
    recordPerformance("sessao", startedAt);

    if (!session) {
      const error = new Error("Sessão expirada. Entre novamente.");
      error.status = 401;
      throw error;
    }

    if (!window.PortalAPI) {
      throw new Error("API segura do Portal indisponível.");
    }

    const feature = BASE_ATUAL === "fretes2" ? "fretes2" : "fretes";
    if (typeof canAccessFeature === "function" && !canAccessFeature(feature)) {
      const error = new Error("Seu perfil não possui permissão para consultar esta base.");
      error.status = 403;
      throw error;
    }

    return session;
  }

  function salvarBaseSelecionada(base) {
    try {
      localStorage.setItem(LS_KEY_BASE, base);
    } catch {}
  }

  function carregarBaseSelecionada() {
    try {
      return localStorage.getItem(LS_KEY_BASE) === "fretes2"
        ? "fretes2"
        : "fretes";
    } catch {
      return "fretes";
    }
  }

  async function loadFretesRows() {
    await waitForPortalReady();

    const requestStartedAt = nowPerformance();

    // O Share usa exatamente a mesma leitura validada pelas telas Fretes GO/MT.
    // Isso evita manter uma segunda rota de leitura para os mesmos registros.
    const response = await window.PortalAPI.call(BASE_ATUAL, "read", {});
    const elapsedMs = recordPerformance(`${BASE_ATUAL}-api`, requestStartedAt);

    if (response && response.ok === false) {
      throw new Error(response.error || "Erro retornado pelo gateway seguro.");
    }

    const payload = response?.data ?? response;

    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload?.fretes)
            ? payload.fretes
            : Array.isArray(payload?.items)
              ? payload.items
              : [];

    return { rows, elapsedMs };
  }


  function getCmhLocal(row) {
    return row.cmhLocal ?? row.cmh_local ?? row.cmhL ?? row.porta ?? "";
  }

  function getCmhTrans(row) {
    return row.cmhTrans ?? row.cmh_trans ?? row.cmhT ?? row.transito ?? "";
  }

  function computeTotalGeral(cmhLocal, cmhTrans) {
    const a = num(cmhLocal);
    const b = num(cmhTrans);
    if (!a && !b) return "";
    return a + b;
  }

  function buildClientesList(rows) {
    return Array.from(
      new Set(
        (rows || [])
          .map((r) => up(r.cliente))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function fillSelect(sel, items, { includeAll = false, allLabel = "Todos" } = {}) {
    if (!sel) return;

    const current = sel.value;
    sel.innerHTML = "";

    if (includeAll) {
      const op = document.createElement("option");
      op.value = "";
      op.textContent = allLabel;
      sel.appendChild(op);
    }

    items.forEach((it) => {
      const op = document.createElement("option");
      op.value = it;
      op.textContent = it;
      sel.appendChild(op);
    });

    if ([...sel.options].some((o) => o.value === current)) {
      sel.value = current;
    }
  }

  async function setClientLogo(cliente) {
    const img = $("imgLogo");
    const fb = $("logoFallback");
    if (!img || !fb) return;

    const name = up(cliente);

    img.style.display = "none";
    fb.style.display = "none";

    if (!name) {
      fb.textContent = "SELECIONE UM CLIENTE";
      fb.style.display = "block";
      return;
    }

    for (const ext of LOGO_EXTS) {
      const src = `${LOGO_BASE_PATH}${encodeURIComponent(name)}.${ext}`;
      const ok = await probeImage(src);
      if (ok) {
        img.src = src;
        img.style.display = "block";
        return;
      }
    }

    fb.textContent = name;
    fb.style.display = "block";
  }

  function probeImage(src) {
    return new Promise((resolve) => {
      const t = new Image();
      t.onload = () => resolve(true);
      t.onerror = () => resolve(false);
      t.src = src;
    });
  }

  function matchesSearch(row, q) {
    if (!q) return true;

    const blob = [
      row.origem,
      row.coleta,
      row.destino,
      row.descarga,
      row.produto,
      row.obs
    ]
      .map(safeText)
      .join(" ")
      .toLowerCase();

    return blob.includes(q.toLowerCase());
  }

  function buildDestinosList(rows) {
    return Array.from(new Set(rows.map((r) => safeText(r.destino)).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function setKpis(rowsFiltered) {
    const PESO_MEDIO_TON = 38;

    const lotes = rowsFiltered.length;
    const cam = rowsFiltered.reduce(
      (acc, r) => acc + num(getCmhLocal(r)) + num(getCmhTrans(r)),
      0
    );

    const vol = cam * PESO_MEDIO_TON;

    if ($("kLotes")) $("kLotes").textContent = String(lotes);
    if ($("kCaminhao")) $("kCaminhao").textContent = String(cam);
    if ($("kVolume")) {
      $("kVolume").textContent = `${vol.toLocaleString("pt-BR")} t`;
    }
  }

  function setCorredores(rowsFiltered) {
    const map = new Map();

    rowsFiltered.forEach((r) => {
      const dest = safeText(r.destino) || "SEM DESTINO";
      const quantidadeVeiculos =
        num(getCmhLocal(r)) +
        num(getCmhTrans(r));

      map.set(
        dest,
        (map.get(dest) || 0) + quantidadeVeiculos
      );
    });

    const list = Array.from(map.entries())
      .filter(([, quantidade]) => quantidade > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));

    const wrap = $("corrList");
    if (!wrap) return;

    wrap.innerHTML = "";

    if (list.length === 0) {
      const div = document.createElement("div");
      div.className = "muted2 note";
      div.textContent = "Nenhum ponto encontrado para este cliente.";
      wrap.appendChild(div);
      return;
    }

    list.forEach(([dest, qty]) => {
      const item = document.createElement("div");
      item.className = "corrItem";
      item.innerHTML = `<div class="name">${escapeHtml(dest)}</div><div class="qty">${qty}</div>`;
      wrap.appendChild(item);
    });
  }

  function renderTable(rowsFiltered) {
    const tbody = $("tbodyShare");
    if (!tbody) return;

    tbody.innerHTML = "";

    rowsFiltered.forEach((r) => {
      const tr = document.createElement("tr");

      const cmhL = getCmhLocal(r);
      const cmhT = getCmhTrans(r);
      const total = computeTotalGeral(cmhL, cmhT);

      tr.innerHTML = `
        <td>${escapeHtml(safeText(r.origem))}</td>
        <td>${escapeHtml(safeText(r.coleta))}</td>
        <td>${escapeHtml(safeText(r.destino))}</td>
        <td>${escapeHtml(safeText(r.descarga))}</td>
        <td class="num col-frete-empresa">${escapeHtml(formatBRL(num(r.valorEmpresa)))}</td>
        <td>${escapeHtml(safeText(r.produto))}</td>
        <td class="num">${escapeHtml(safeText(cmhL))}</td>
        <td class="num">${escapeHtml(safeText(cmhT))}</td>
        <td class="num">${escapeHtml(safeText(total))}</td>
        <td><span class="statusPill ${statusClass(r.status)}">${escapeHtml(up(r.status) || "SUSPENSO")}</span></td>
        <td>${escapeHtml(safeText(r.obs))}</td>
      `;

      tbody.appendChild(tr);
    });

    toggleFreteEmpresa(ocultarFreteEmpresa);
  }

  function loadHtml2Canvas() {
    if (typeof window.html2canvas === "function") {
      return Promise.resolve(window.html2canvas);
    }

    if (html2canvasPromise) return html2canvasPromise;

    html2canvasPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-share-html2canvas="1"]');
      const script = existing || document.createElement("script");

      const finish = () => {
        if (typeof window.html2canvas === "function") {
          resolve(window.html2canvas);
        } else {
          html2canvasPromise = null;
          reject(new Error("Gerador de imagem indisponível."));
        }
      };

      const fail = () => {
        html2canvasPromise = null;
        reject(new Error("Não foi possível carregar o gerador de imagem."));
      };

      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", fail, { once: true });

      if (!existing) {
        script.src = HTML2CANVAS_SRC;
        script.async = true;
        script.dataset.shareHtml2canvas = "1";
        document.head.appendChild(script);
      }
    });

    return html2canvasPromise;
  }

  async function doPrint() {
    const page = $("pageShare");
    if (!page) return;

    const estadoAntesPrint = ocultarFreteEmpresa;

    try {
      const html2canvasLib = await loadHtml2Canvas();

      ocultarFreteEmpresa = true;
      toggleFreteEmpresa(true);

      document.body.classList.add("printMode");

      await new Promise((r) => setTimeout(r, 120));

      const canvas = await html2canvasLib(page, {
        backgroundColor: null,
        scale: 2,
        useCORS: true
      });

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      const cliente = up($("selCliente")?.value) || "CLIENTE";
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

      const baseNome = BASE_ATUAL === "fretes2" ? "MT" : "GO";
      a.download = `share-${baseNome}-${cliente}-${stamp}.png`;
      a.href = dataUrl;
      a.click();
    } catch (error) {
      alert(`❌ ${friendlySyncError(error)}`);
    } finally {
      ocultarFreteEmpresa = estadoAntesPrint;
      toggleFreteEmpresa(ocultarFreteEmpresa);
      document.body.classList.remove("printMode");
    }
  }

  let state = {
    rowsAll: [],
    clientes: []
  };

  function applyFiltersAndRender() {
    const selCliente = $("selCliente");
    const inpBusca = $("inpBusca");
    const selStatus = $("selStatus");
    const selDestino = $("selDestino");

    const cliente = up(selCliente?.value);
    const q = safeText(inpBusca?.value);
    const st = up(selStatus?.value);
    const dest = safeText(selDestino?.value);

    let list = state.rowsAll.slice();

    if (cliente) list = list.filter((r) => up(r.cliente) === cliente);
    if (st) list = list.filter((r) => up(r.status) === st);
    if (dest) list = list.filter((r) => safeText(r.destino) === dest);
    if (q) list = list.filter((r) => matchesSearch(r, q));

    setKpis(list);
    setCorredores(list);
    renderTable(list);
  }

  function rebuildDestinosForCliente() {
    const selCliente = $("selCliente");
    const selDestino = $("selDestino");
    if (!selCliente || !selDestino) return;

    const cliente = up(selCliente.value);
    const list = state.rowsAll.filter((r) => up(r.cliente) === cliente);
    const destinos = buildDestinosList(list);

    fillSelect(selDestino, destinos, { includeAll: true, allLabel: "Todos" });
  }

  async function refresh({ preserveClient = true } = {}) {
    const sequence = ++refreshSequence;
    const startedAt = nowPerformance();
    const selCliente = $("selCliente");
    const clienteAnterior = preserveClient ? up(selCliente?.value) : "";
    const baseLabel = getBaseLabel(BASE_ATUAL);
    const previousRows = state.rowsAll;

    try {
      updateSyncStatus("loading", `Carregando ${baseLabel}...`);

      const { rows, elapsedMs } = await loadFretesRows();
      if (sequence !== refreshSequence) return;

      state.rowsAll = rows;
      state.clientes = buildClientesList(state.rowsAll);

      fillSelect(selCliente, state.clientes, { includeAll: false });

      const clienteValido = state.clientes.includes(clienteAnterior)
        ? clienteAnterior
        : state.clientes.find((c) =>
            state.rowsAll.some((r) => up(r.cliente) === c)
          ) || state.clientes[0] || "";

      if (selCliente) selCliente.value = clienteValido;

      await setClientLogo(selCliente?.value);
      rebuildDestinosForCliente();
      applyFiltersAndRender();
      toggleFreteEmpresa(ocultarFreteEmpresa);
      updateToggleButtonText();

      updateSyncStatus(
        "success",
        state.rowsAll.length
          ? `${baseLabel} atualizado em ${formatElapsed(elapsedMs)}`
          : `${baseLabel}: nenhum frete cadastrado`
      );

      recordPerformance("total", startedAt);
    } catch (err) {
      if (sequence !== refreshSequence) return;
      console.error(err);

      const hasPreviousRows = previousRows.length > 0;
      if (!hasPreviousRows) {
        state.rowsAll = [];
        state.clientes = [];
        fillSelect(selCliente, [], { includeAll: false });
        await setClientLogo("");
        rebuildDestinosForCliente();
        applyFiltersAndRender();
      }

      const message = friendlySyncError(err);
      updateSyncStatus(
        "error",
        hasPreviousRows
          ? `${baseLabel}: exibindo dados anteriores`
          : `Falha em ${baseLabel}`
      );

      alert(
        `❌ Falha ao carregar ${baseLabel}.\n\nErro: ${message}` +
        (hasPreviousRows ? "\n\nOs dados que já estavam na tela foram preservados." : "")
      );
    }
  }

  function init() {
    const selBase = $("selBase");

    BASE_ATUAL = carregarBaseSelecionada();

    if (selBase) {
      selBase.value = BASE_ATUAL;

      selBase.addEventListener("change", async () => {
        BASE_ATUAL = selBase.value === "fretes2" ? "fretes2" : "fretes";
        salvarBaseSelecionada(BASE_ATUAL);
        await refresh({ preserveClient: false });
      });
    }

    $("selCliente")?.addEventListener("change", async () => {
      await setClientLogo($("selCliente")?.value);
      rebuildDestinosForCliente();
      applyFiltersAndRender();
      toggleFreteEmpresa(ocultarFreteEmpresa);
    });

    $("inpBusca")?.addEventListener("input", applyFiltersAndRender);
    $("selStatus")?.addEventListener("change", applyFiltersAndRender);
    $("selDestino")?.addEventListener("change", applyFiltersAndRender);

    $("btnReload")?.addEventListener("click", () => {
      refresh({ preserveClient: true });
    });

    $("btnPrint")?.addEventListener("click", doPrint);

    const btnToggle = getToggleButton();
    if (btnToggle) {
      btnToggle.addEventListener("click", () => {
        ocultarFreteEmpresa = !ocultarFreteEmpresa;
        toggleFreteEmpresa(ocultarFreteEmpresa);
      });
      updateToggleButtonText();
    }

    $("btnVoltarFretes")?.addEventListener("click", () => {
      window.location.href = getPaginaFretes(BASE_ATUAL);
    });

    refresh({ preserveClient: false });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
