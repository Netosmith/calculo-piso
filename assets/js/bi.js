/* bi.js | NOVA FROTA */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyOfN1PHdk_C4D5z1SFEEVEg7wWKnc7SberIARP4p6gt38fcrNeiNDjbq2vYrE9ryL0/exec";

  const PESO_MEDIO_TON = 38;

  const $ = (sel) => document.querySelector(sel);

  const STATE = {
    rows: [],
    filtered: [],
    charts: {
      filial: null,
      cliente: null,
      volumeFilial: null,
      portaTransito: null,
    },
  };

  function safeText(v) {
    return String(v ?? "").trim();
  }

  function upper(v) {
    return safeText(v).toUpperCase();
  }

  function parsePtNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    let s = String(value).trim();
    if (!s) return 0;

    s = s.replace(/\s+/g, "").replace(/[^\d.,-]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtInt(n) {
    return (Number(n) || 0).toLocaleString("pt-BR");
  }

  function fmtTon(n) {
    return `${(Number(n) || 0).toLocaleString("pt-BR")} t`;
  }

  function fmtMoney(n) {
    return (Number(n) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function setStatus(text) {
    const el = $("#syncStatus");
    if (el) el.textContent = text;
  }

  function jsonp(url, timeoutMs = 35000) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";

      const t = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout (JSONP)"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(t);
        try { delete window[cb]; } catch {}
        try { s.remove(); } catch {}
      }

      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };

      s.src = url + sep + "callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
      s.onerror = () => {
        cleanup();
        reject(new Error("Erro ao carregar script (JSONP)"));
      };

      document.head.appendChild(s);
    });
  }

  function buildUrl(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }

  async function apiGet(paramsObj) {
    const res = await jsonp(buildUrl(paramsObj));
    if (!res || res.ok === false) {
      throw new Error(res?.error || "Falha na API");
    }
    return res;
  }

  function normalizeRow(r) {
    return {
      id: safeText(r?.id),
      regional: upper(r?.regional),
      filial: upper(r?.filial),
      cliente: upper(r?.cliente),
      origem: upper(r?.origem),
      coleta: upper(r?.coleta),
      contato: upper(r?.contato),
      destino: upper(r?.destino),
      uf: upper(r?.uf),
      descarga: upper(r?.descarga),
      volume: parsePtNumber(r?.volume),
      valorEmpresa: parsePtNumber(r?.valorEmpresa),
      valorMotorista: parsePtNumber(r?.valorMotorista),
      km: parsePtNumber(r?.km),
      pedagioEixo: parsePtNumber(r?.pedagioEixo),
      produto: upper(r?.produto),
      icms: safeText(r?.icms),
      pedidoSat: safeText(r?.pedidoSat),
      porta: parsePtNumber(r?.porta),
      transito: parsePtNumber(r?.transito),
      status: upper(r?.status),
      obs: safeText(r?.obs),
    };
  }

  function fillSelect(selectEl, items, placeholder) {
    if (!selectEl) return;
    const current = selectEl.value;

    selectEl.innerHTML = "";
    const op0 = document.createElement("option");
    op0.value = "";
    op0.textContent = placeholder;
    selectEl.appendChild(op0);

    items.forEach((item) => {
      const op = document.createElement("option");
      op.value = item;
      op.textContent = item;
      selectEl.appendChild(op);
    });

    if ([...selectEl.options].some((o) => o.value === current)) {
      selectEl.value = current;
    }
  }

  function fillFilters(rows) {
    const filiais = [...new Set(rows.map((r) => r.filial).filter(Boolean))].sort();
    const clientes = [...new Set(rows.map((r) => r.cliente).filter(Boolean))].sort();
    const status = [...new Set(rows.map((r) => r.status).filter(Boolean))].sort();

    fillSelect($("#fFilial"), filiais, "Todas as filiais");
    fillSelect($("#fCliente"), clientes, "Todos os clientes");
    fillSelect($("#fStatus"), status, "Todos os status");
  }

  function getFilteredRows() {
    const filial = upper($("#fFilial")?.value || "");
    const cliente = upper($("#fCliente")?.value || "");
    const status = upper($("#fStatus")?.value || "");
    const busca = upper($("#fBusca")?.value || "");

    return STATE.rows.filter((row) => {
      if (filial && row.filial !== filial) return false;
      if (cliente && row.cliente !== cliente) return false;
      if (status && row.status !== status) return false;

      if (busca) {
        const blob = upper(JSON.stringify(row));
        if (!blob.includes(busca)) return false;
      }

      return true;
    });
  }

  function calcTotals(rows) {
    const porta = rows.reduce((acc, r) => acc + r.porta, 0);
    const transito = rows.reduce((acc, r) => acc + r.transito, 0);
    const veiculos = porta + transito;
    const volume = veiculos * PESO_MEDIO_TON;

    const fretesEmpresa = rows.map((r) => r.valorEmpresa).filter((n) => Number.isFinite(n) && n > 0);
    const margens = rows
      .map((r) => r.valorEmpresa - r.valorMotorista)
      .filter((n) => Number.isFinite(n));

    const freteMedio =
      fretesEmpresa.length ? fretesEmpresa.reduce((a, b) => a + b, 0) / fretesEmpresa.length : 0;

    const margemMedia =
      margens.length ? margens.reduce((a, b) => a + b, 0) / margens.length : 0;

    return { porta, transito, veiculos, volume, freteMedio, margemMedia };
  }

  function groupBy(rows, field) {
    const map = new Map();

    rows.forEach((r) => {
      const key = safeText(r[field]) || "SEM " + field.toUpperCase();

      if (!map.has(key)) {
        map.set(key, {
          nome: key,
          porta: 0,
          transito: 0,
          veiculos: 0,
          volume: 0,
          freteSum: 0,
          freteCount: 0,
          margemSum: 0,
          margemCount: 0,
        });
      }

      const item = map.get(key);
      item.porta += r.porta;
      item.transito += r.transito;
      item.veiculos += r.porta + r.transito;
      item.volume += (r.porta + r.transito) * PESO_MEDIO_TON;

      if (Number.isFinite(r.valorEmpresa) && r.valorEmpresa > 0) {
        item.freteSum += r.valorEmpresa;
        item.freteCount += 1;
      }

      const margem = r.valorEmpresa - r.valorMotorista;
      if (Number.isFinite(margem)) {
        item.margemSum += margem;
        item.margemCount += 1;
      }
    });

    return [...map.values()].map((item) => ({
      ...item,
      freteMedio: item.freteCount ? item.freteSum / item.freteCount : 0,
      margemMedia: item.margemCount ? item.margemSum / item.margemCount : 0,
    }));
  }

  function updateKpis(rows) {
    const t = calcTotals(rows);

    $("#kpiPorta").textContent = fmtInt(t.porta);
    $("#kpiTransito").textContent = fmtInt(t.transito);
    $("#kpiVeiculos").textContent = fmtInt(t.veiculos);
    $("#kpiVolume").textContent = fmtTon(t.volume);
    $("#kpiFreteMedio").textContent = fmtMoney(t.freteMedio);
    $("#kpiMargemMedia").textContent = fmtMoney(t.margemMedia);
  }

  function destroyChart(chart) {
    if (chart && typeof chart.destroy === "function") chart.destroy();
  }

  function makeBarChart(canvasId, labels, data, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    return new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label,
          data,
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  function makeGroupedChart(canvasId, labels, data1, data2, label1, label2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    return new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: label1, data: data1, borderWidth: 1 },
          { label: label2, data: data2, borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  function renderCharts(rows) {
    const porFilial = groupBy(rows, "filial").sort((a, b) => b.veiculos - a.veiculos);
    const porCliente = groupBy(rows, "cliente").sort((a, b) => b.veiculos - a.veiculos);

    destroyChart(STATE.charts.filial);
    destroyChart(STATE.charts.cliente);
    destroyChart(STATE.charts.volumeFilial);
    destroyChart(STATE.charts.portaTransito);

    STATE.charts.filial = makeBarChart(
      "chartFilial",
      porFilial.map((x) => x.nome),
      porFilial.map((x) => x.veiculos),
      "Veículos"
    );

    STATE.charts.cliente = makeBarChart(
      "chartCliente",
      porCliente.map((x) => x.nome),
      porCliente.map((x) => x.veiculos),
      "Veículos"
    );

    STATE.charts.volumeFilial = makeBarChart(
      "chartVolumeFilial",
      porFilial.map((x) => x.nome),
      porFilial.map((x) => x.volume),
      "Toneladas"
    );

    STATE.charts.portaTransito = makeGroupedChart(
      "chartPortaTransito",
      porFilial.map((x) => x.nome),
      porFilial.map((x) => x.porta),
      porFilial.map((x) => x.transito),
      "Porta",
      "Trânsito"
    );
  }

  function renderTable(rows) {
    const tbody = $("#tbodyFilial");
    if (!tbody) return;

    const porFilial = groupBy(rows, "filial").sort((a, b) => b.veiculos - a.veiculos);
    tbody.innerHTML = "";

    if (!porFilial.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" style="text-align:center; opacity:.75;">Nenhum dado encontrado.</td>`;
      tbody.appendChild(tr);
      return;
    }

    porFilial.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.nome}</td>
        <td class="num">${fmtInt(item.porta)}</td>
        <td class="num">${fmtInt(item.transito)}</td>
        <td class="num">${fmtInt(item.veiculos)}</td>
        <td class="num">${fmtTon(item.volume)}</td>
        <td class="num">${fmtMoney(item.freteMedio)}</td>
        <td class="num">${fmtMoney(item.margemMedia)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAll() {
    STATE.filtered = getFilteredRows();
    updateKpis(STATE.filtered);
    renderCharts(STATE.filtered);
    renderTable(STATE.filtered);
  }

  async function atualizar() {
    try {
      setStatus("🔄 Carregando...");
      const res = await apiGet({ action: "fretes_list" });
      STATE.rows = Array.isArray(res.data) ? res.data.map(normalizeRow) : [];
      fillFilters(STATE.rows);
      renderAll();
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[bi] erro ao atualizar:", e);
      setStatus("❌ Erro ao carregar");
      alert(e.message || "Falha ao carregar o B.I.");
    }
  }

  function limparFiltros() {
    if ($("#fFilial")) $("#fFilial").value = "";
    if ($("#fCliente")) $("#fCliente").value = "";
    if ($("#fStatus")) $("#fStatus").value = "";
    if ($("#fBusca")) $("#fBusca").value = "";
    renderAll();
  }

  function bindEvents() {
    $("#fFilial")?.addEventListener("change", renderAll);
    $("#fCliente")?.addEventListener("change", renderAll);
    $("#fStatus")?.addEventListener("change", renderAll);
    $("#fBusca")?.addEventListener("input", renderAll);

    $("#btnAtualizar")?.addEventListener("click", atualizar);
    $("#btnLimpar")?.addEventListener("click", limparFiltros);
  }

  function init() {
    bindEvents();
    atualizar();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
