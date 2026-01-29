/* share-clientes.js | NOVA FROTA
   - Painel "Share Clientes" derivado 100% da base Fretes (nf_fretes_rows_v1)
   - Cliente select fixo (com base nos clientes existentes + lista fixa opcional)
   - CMH's Local/Trans: lidos do Fretes e travados (sem ediÃ§Ã£o)
   - Total Geral = Local + Trans
   - "Quantidade por corredor": agrupado por Destino
   - Print PNG via html2canvas (inclui logo do cliente)
*/
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ===== Base vinda do Fretes =====
  const LS_KEY_FRETES_ROWS = "nf_fretes_rows_v1";

  // ===== Config: logos por cliente =====
  // Regra: colocar em /assets/img/clientes/ com nome igual ao cliente em MAIÃSCULO (sem espaÃ§os extras).
  // Ex: CARGILL.png, COFCO.png, MOSAIC.png
  const LOGO_BASE_PATH = "../assets/img/clientes/";
  const LOGO_EXTS = ["png", "jpg", "jpeg", "webp"];

  // ===== Config: cliente select fixo =====
  // Se quiser forÃ§ar uma ordem/sem depender do conteÃºdo, preencha aqui.
  // Se estiver vazio, o select serÃ¡ montado a partir dos clientes existentes na base.
  const CLIENTES_FIXOS = [
    "CARGILL",
    "CARAMURU",
    "COFCO",
    "MOSAIC",
    "OURO SAFRA",
    "CERRADINHO",
    "MMV GRÃOS",
    "CONCEITO AGRÃCOLA",
    "MILHÃO ALIMENTOS",
    "CHS"
  ];

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function up(v) {
    return safeText(v).toUpperCase();
  }

  function num(v) {
    const n = Number(String(v).replace(",", "."));
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

  function loadFretesRows() {
    try {
      const raw = localStorage.getItem(LS_KEY_FRETES_ROWS);
      if (!raw) return [];
      const rows = JSON.parse(raw);
      if (!Array.isArray(rows)) return [];
      return rows;
    } catch {
      return [];
    }
  }

  // ===== Deriva CMH's do Fretes =====
  // ObservaÃ§Ã£o: seu fretes.js ainda nÃ£o tem campos "cmhLocal" e "cmhTrans".
  // Se vocÃª jÃ¡ tiver, Ã³timo: ele usa.
  // Se nÃ£o tiver, ele tenta mapear de campos alternativos (caso vocÃª adicione depois).
  function getCmhLocal(row) {
    return row.cmhLocal ?? row.cmh_local ?? row.cmhL ?? "";
  }
  function getCmhTrans(row) {
    return row.cmhTrans ?? row.cmh_trans ?? row.cmhT ?? "";
  }

  function computeTotalGeral(cmhLocal, cmhTrans) {
    const a = num(cmhLocal);
    const b = num(cmhTrans);
    if (!a && !b) return "";
    return (a + b);
  }

  // ===== Clientes =====
  function buildClientesList(rows) {
    const fromData = Array.from(new Set(rows.map(r => up(r.cliente)).filter(Boolean)))
      .sort((a,b)=>a.localeCompare(b,"pt-BR"));
    const fixed = CLIENTES_FIXOS.map(up).filter(Boolean);
    const merged = Array.from(new Set([...fixed, ...fromData]));
    // mantÃ©m a ordem do fixo no topo (se existir), resto em ordem alfabÃ©tica
    const ordered = [];
    fixed.forEach(c => { if (merged.includes(c)) ordered.push(c); });
    fromData.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered;
  }

  function fillSelect(sel, items, { includeAll = false, allLabel = "Todos" } = {}) {
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
  }

  // ===== Logo =====
  async function setClientLogo(cliente) {
    const img = $("imgLogo");
    const fb = $("logoFallback");
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

  // ===== Filtros =====
  function matchesSearch(row, q) {
    if (!q) return true;
    const blob = [row.origem, row.coleta, row.destino, row.descarga, row.produto, row.obs]
      .map(safeText).join(" ").toLowerCase();
    return blob.includes(q.toLowerCase());
  }

  function buildDestinosList(rows) {
    return Array.from(new Set(rows.map(r => safeText(r.destino)).filter(Boolean)))
      .sort((a,b)=>a.localeCompare(b,"pt-BR"));
  }

  // ===== KPIs =====
  function setKpis(rowsFiltered) {
    const lotes = rowsFiltered.length;
    const cam = lotes; // pode virar regra real depois
    const vol = rowsFiltered.reduce((acc, r) => acc + num(r.volume), 0);
    $("kLotes").textContent = String(lotes);
    $("kCaminhao").textContent = String(cam);
    $("kVolume").textContent = String(vol);
  }

  // ===== Corredores (Destino) =====
  function setCorredores(rowsFiltered) {
    const map = new Map();
    rowsFiltered.forEach((r) => {
      const dest = safeText(r.destino) || "SEM DESTINO";
      map.set(dest, (map.get(dest) || 0) + 1);
    });

    const list = Array.from(map.entries())
      .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0],"pt-BR"));

    const wrap = $("corrList");
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

  // ===== Tabela =====
  function renderTable(rowsFiltered) {
    const tbody = $("tbodyShare");
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
        <td class="num">${escapeHtml(formatBRL(r.valorEmpresa))}</td>
        <td>${escapeHtml(safeText(r.produto))}</td>
        <td class="num">${escapeHtml(safeText(cmhL))}</td>
        <td class="num">${escapeHtml(safeText(cmhT))}</td>
        <td class="num">${escapeHtml(safeText(total))}</td>
        <td><span class="statusPill ${statusClass(r.status)}">${escapeHtml(up(r.status) || "SUSPENSO")}</span></td>
        <td>${escapeHtml(safeText(r.obs))}</td>
      `;

      tbody.appendChild(tr);
    });
  }

  // ===== Print (PNG) =====
  async function doPrint() {
    const page = $("pageShare");
    document.body.classList.add("printMode");
    await new Promise(r => setTimeout(r, 80));

    const canvas = await html2canvas(page, {
      backgroundColor: null,
      scale: 2,
      useCORS: true
    });

    document.body.classList.remove("printMode");

    const dataUrl = canvas.toDataURL("image/png");

    const a = document.createElement("a");
    const cliente = up($("selCliente").value) || "CLIENTE";
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    a.download = `share-${cliente}-${stamp}.png`;
    a.href = dataUrl;
    a.click();
  }

  // ===== Utils =====
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ===== Main =====
  let state = {
    rowsAll: [],
    clientes: [],
  };

  function applyFiltersAndRender() {
    const cliente = up($("selCliente").value);
    const q = safeText($("inpBusca").value);
    const st = up($("selStatus").value);
    const dest = safeText($("selDestino").value);

    let list = state.rowsAll.slice();

    if (cliente) list = list.filter(r => up(r.cliente) === cliente);
    if (st) list = list.filter(r => up(r.status) === st);
    if (dest) list = list.filter(r => safeText(r.destino) === dest);
    if (q) list = list.filter(r => matchesSearch(r, q));

    setKpis(list);
    setCorredores(list);
    renderTable(list);
  }

  function rebuildDestinosForCliente() {
    const cliente = up($("selCliente").value);
    const list = state.rowsAll.filter(r => up(r.cliente) === cliente);
    const destinos = buildDestinosList(list);
    fillSelect($("selDestino"), destinos, { includeAll: true, allLabel: "Todos" });
  }

  function refresh() {
    state.rowsAll = loadFretesRows();

    state.clientes = buildClientesList(state.rowsAll);
    fillSelect($("selCliente"), state.clientes, { includeAll: false });

    const firstWithData = state.clientes.find(c => state.rowsAll.some(r => up(r.cliente) === c));
    if (firstWithData) $("selCliente").value = firstWithData;

    setClientLogo($("selCliente").value);
    rebuildDestinosForCliente();
    applyFiltersAndRender();
  }

  function init() {
    $("selCliente").addEventListener("change", () => {
      setClientLogo($("selCliente").value);
      rebuildDestinosForCliente();
      applyFiltersAndRender();
    });
    $("inpBusca").addEventListener("input", applyFiltersAndRender);
    $("selStatus").addEventListener("change", applyFiltersAndRender);
    $("selDestino").addEventListener("change", applyFiltersAndRender);

    $("btnReload").addEventListener("click", refresh);
    $("btnPrint").addEventListener("click", doPrint);

    refresh();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
