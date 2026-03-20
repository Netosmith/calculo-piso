/* bi.js | NOVA FROTA */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbysabnW3gmEpzwrc0AAnRFlGdNeAK_7tF1hpYaYnxajxv4fLYpPPtL9ZUPZJljkMMNV/exec";

  const PESO_MEDIO = 38;

  const $ = (sel) => document.querySelector(sel);

  const STATE = {
    rows: [],
    charts: {}
  };

  function safeText(v) {
    return String(v ?? "").trim();
  }

  function upper(v) {
    return safeText(v).toUpperCase();
  }

  function num(v) {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;

    let s = String(v).trim();
    if (!s) return 0;

    s = s.replace(/\s+/g, "").replace(/[^\d.,-]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function moneyBR(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function intBR(v) {
    return (Number(v) || 0).toLocaleString("pt-BR");
  }

  function setStatus(text, isOk = true) {
    const el = $("#syncStatus");
    if (!el) return;
    el.textContent = text;
    el.style.color = isOk ? "#067647" : "#b42318";
  }

  function jsonp(url, timeoutMs = 30000) {
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
    Object.entries(paramsObj || {}).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
    return url.toString();
  }

  async function apiGet(paramsObj) {
    const res = await jsonp(buildUrl(paramsObj), 35000);
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
      volume: num(r?.volume),
      valorEmpresa: num(r?.valorEmpresa),
      valorMotorista: num(r?.valorMotorista),
      km: num(r?.km),
      pedagioEixo: num(r?.pedagioEixo),
      produto: upper(r?.produto),
      icms: upper(r?.icms),
      pedidoSat: safeText(r?.pedidoSat),
      porta: num(r?.porta),
      transito: num(r?.transito),
      status: upper(r?.status),
      obs: safeText(r?.obs)
    };
  }

  function fillSelect(el, values, placeholder) {
    if (!el) return;
    const current = el.value;

    el.innerHTML = "";
    const op0 = document.createElement("option");
    op0.value = "";
    op0.textContent = placeholder;
    el.appendChild(op0);

    values.forEach((v) => {
      const op = document.createElement("option");
      op.value = v;
      op.textContent = v;
      el.appendChild(op);
    });

    if ([...el.options].some(o => o.value === current)) {
      el.value = current;
    }
  }

  function loadFilterOptions(rows) {
    const filiais = [...new Set(rows.map(r => upper(r.filial)).filter(Boolean))].sort();
    const clientes = [...new Set(rows.map(r => upper(r.cliente)).filter(Boolean))].sort();
    const status = [...new Set(rows.map(r => upper(r.status)).filter(Boolean))].sort();

    fillSelect($("#fFilial"), filiais, "Todas as filiais");
    fillSelect($("#fCliente"), clientes, "Todos os clientes");
    fillSelect($("#fStatus"), status, "Todos os status");
  }

  function getFilteredRows() {
    const filial = upper($("#fFilial")?.value || "");
    const cliente = upper($("#fCliente")?.value || "");
    const status = upper($("#fStatus")?.value || "");
    const busca = upper($("#fBusca")?.value || "");

    return STATE.rows.filter((r) => {
      if (filial && upper(r.filial) !== filial) return false;
      if (cliente && upper(r.cliente) !== cliente) return false;
      if (status && upper(r.status) !== status) return false;

      if (busca) {
        const blob = [
          r.filial, r.cliente, r.origem, r.destino, r.produto, r.contato, r.descarga, r.obs
        ].join(" ");
        if (!upper(blob).includes(busca)) return false;
      }

      return true;
    });
  }

  function calcKPIs(rows) {
    const porta = rows.reduce((acc, r) => acc + num(r.porta), 0);
    const transito = rows.reduce((acc, r) => acc + num(r.transito), 0);
    const totalVeiculos = porta + transito;
    const volume = totalVeiculos * PESO_MEDIO;

    const freteMedio = rows.length
      ? rows.reduce((acc, r) => acc + num(r.valorEmpresa), 0) / rows.length
      : 0;

    const margemMedia = rows.length
      ? rows.reduce((acc, r) => acc + (num(r.valorEmpresa) - num(r.valorMotorista)), 0) / rows.length
      : 0;

    return { porta, transito, totalVeiculos, volume, freteMedio, margemMedia };
  }

  function renderKPIs(rows) {
    const k = calcKPIs(rows);

    $("#kpiPorta").textContent = intBR(k.porta);
    $("#kpiTransito").textContent = intBR(k.transito);
    $("#kpiVeiculos").textContent = intBR(k.totalVeiculos);
    $("#kpiVolume").textContent = intBR(k.volume) + " t";
    $("#kpiFreteMedio").textContent = moneyBR(k.freteMedio);
    $("#kpiMargemMedia").textContent = moneyBR(k.margemMedia);
  }

  function groupBy(rows, key) {
    const map = new Map();
    rows.forEach((r) => {
      const k = upper(r[key]) || "SEM DADO";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return map;
  }

  function buildResumoFilial(rows) {
    const map = groupBy(rows, "filial");
    const arr = [];

    map.forEach((list, filial) => {
      const porta = list.reduce((a, r) => a + num(r.porta), 0);
      const transito = list.reduce((a, r) => a + num(r.transito), 0);
      const veiculos = porta + transito;
      const volume = veiculos * PESO_MEDIO;
      const freteMedio = list.length
        ? list.reduce((a, r) => a + num(r.valorEmpresa), 0) / list.length
        : 0;
      const margemMedia = list.length
        ? list.reduce((a, r) => a + (num(r.valorEmpresa) - num(r.valorMotorista)), 0) / list.length
        : 0;

      arr.push({
        filial,
        porta,
        transito,
        veiculos,
        volume,
        freteMedio,
        margemMedia
      });
    });

    return arr.sort((a, b) => b.veiculos - a.veiculos || a.filial.localeCompare(b.filial));
  }

  function buildResumoCliente(rows) {
    const map = groupBy(rows, "cliente");
    const arr = [];

    map.forEach((list, cliente) => {
      const porta = list.reduce((a, r) => a + num(r.porta), 0);
      const transito = list.reduce((a, r) => a + num(r.transito), 0);
      const veiculos = porta + transito;
      const margemMedia = list.length
        ? list.reduce((a, r) => a + (num(r.valorEmpresa) - num(r.valorMotorista)), 0) / list.length
        : 0;

      arr.push({
        cliente,
        veiculos,
        margemMedia
      });
    });

    return arr.sort((a, b) => b.veiculos - a.veiculos || a.cliente.localeCompare(b.cliente));
  }

  function destroyCharts() {
    Object.values(STATE.charts).forEach((chart) => {
      if (chart && typeof chart.destroy === "function") {
        chart.destroy();
      }
    });
    STATE.charts = {};
  }

  function chartBaseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#334155",
            font: {
              weight: "700"
            }
          }
        },
        tooltip: {
          mode: "index",
          intersect: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#475569",
            font: {
              weight: "700"
            }
          },
          grid: {
            color: "rgba(148,163,184,.12)"
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#475569"
          },
          grid: {
            color: "rgba(148,163,184,.18)"
          }
        }
      }
    };
  }

  function renderCharts(rows) {
    destroyCharts();

    const resumoFilial = buildResumoFilial(rows);
    const resumoCliente = buildResumoCliente(rows);

    const labelsFilial = resumoFilial.map(r => r.filial);
    const veiculosFilial = resumoFilial.map(r => r.veiculos);
    const volumeFilial = resumoFilial.map(r => r.volume);
    const portaFilial = resumoFilial.map(r => r.porta);
    const transitoFilial = resumoFilial.map(r => r.transito);

    const labelsCliente = resumoCliente.map(r => r.cliente);
    const veiculosCliente = resumoCliente.map(r => r.veiculos);
    const margemCliente = resumoCliente.map(r => Number(r.margemMedia.toFixed(2)));

    const c1 = document.getElementById("chartVeiculosFilial");
    const c2 = document.getElementById("chartVeiculosCliente");
    const c3 = document.getElementById("chartVolumeFilial");
    const c4 = document.getElementById("chartPortaTransito");
    const c5 = document.getElementById("chartMargemCliente");

    if (c1) {
      STATE.charts.chartVeiculosFilial = new Chart(c1, {
        type: "bar",
        data: {
          labels: labelsFilial,
          datasets: [{
            label: "Veículos",
            data: veiculosFilial,
            backgroundColor: "rgba(59,130,246,.65)",
            borderColor: "rgba(59,130,246,1)",
            borderWidth: 1.5,
            borderRadius: 8
          }]
        },
        options: chartBaseOptions()
      });
    }

    if (c2) {
      STATE.charts.chartVeiculosCliente = new Chart(c2, {
        type: "doughnut",
        data: {
          labels: labelsCliente,
          datasets: [{
            label: "Veículos",
            data: veiculosCliente,
            backgroundColor: [
              "#3b82f6", "#16a34a", "#8b5cf6", "#f59e0b", "#ec4899",
              "#0ea5e9", "#14b8a6", "#ef4444", "#84cc16", "#6366f1"
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#334155",
                font: { weight: "700" }
              }
            }
          }
        }
      });
    }

    if (c3) {
      STATE.charts.chartVolumeFilial = new Chart(c3, {
        type: "line",
        data: {
          labels: labelsFilial,
          datasets: [{
            label: "Toneladas",
            data: volumeFilial,
            borderColor: "rgba(22,163,74,1)",
            backgroundColor: "rgba(22,163,74,.16)",
            fill: true,
            tension: .35,
            pointRadius: 4,
            pointHoverRadius: 5
          }]
        },
        options: chartBaseOptions()
      });
    }

    if (c4) {
      STATE.charts.chartPortaTransito = new Chart(c4, {
        type: "bar",
        data: {
          labels: labelsFilial,
          datasets: [
            {
              label: "Porta",
              data: portaFilial,
              backgroundColor: "rgba(59,130,246,.62)",
              borderColor: "rgba(59,130,246,1)",
              borderWidth: 1.2,
              borderRadius: 8
            },
            {
              label: "Trânsito",
              data: transitoFilial,
              backgroundColor: "rgba(236,72,153,.52)",
              borderColor: "rgba(236,72,153,1)",
              borderWidth: 1.2,
              borderRadius: 8
            }
          ]
        },
        options: chartBaseOptions()
      });
    }

    if (c5) {
      STATE.charts.chartMargemCliente = new Chart(c5, {
        type: "polarArea",
        data: {
          labels: labelsCliente,
          datasets: [{
            label: "Margem Média",
            data: margemCliente,
            backgroundColor: [
              "rgba(59,130,246,.50)",
              "rgba(22,163,74,.50)",
              "rgba(139,92,246,.50)",
              "rgba(245,158,11,.50)",
              "rgba(236,72,153,.50)",
              "rgba(14,165,233,.50)",
              "rgba(20,184,166,.50)",
              "rgba(239,68,68,.50)"
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: {
                color: "#334155",
                font: { weight: "700" }
              }
            }
          },
          scales: {
            r: {
              ticks: {
                backdropColor: "transparent",
                color: "#64748b"
              },
              grid: {
                color: "rgba(148,163,184,.18)"
              },
              angleLines: {
                color: "rgba(148,163,184,.18)"
              }
            }
          }
        }
      });
    }
  }

  function renderIndicativoFilial(rows) {
    const tbody = $("#tbodyIndicativo");
    if (!tbody) return;

    const resumo = buildResumoFilial(rows);
    tbody.innerHTML = "";

    if (!resumo.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">Nenhum registro encontrado.</td></tr>`;
      return;
    }

    resumo.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.filial}</td>
        <td class="num">${intBR(r.porta)}</td>
        <td class="num">${intBR(r.transito)}</td>
        <td class="num">${intBR(r.veiculos)}</td>
        <td class="num">${intBR(r.volume)} t</td>
        <td class="num">${moneyBR(r.freteMedio)}</td>
        <td class="num">${moneyBR(r.margemMedia)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAll() {
    const rows = getFilteredRows();
    renderKPIs(rows);
    renderCharts(rows);
    renderIndicativoFilial(rows);
  }

  async function loadData() {
    try {
      setStatus("🔄 Carregando...", true);

      const res = await apiGet({ action: "fretes_list" });
      STATE.rows = Array.isArray(res.data) ? res.data.map(normalizeRow) : [];

      loadFilterOptions(STATE.rows);
      renderAll();

      setStatus("✅ Atualizado", true);
    } catch (e) {
      console.error("[bi] erro ao carregar:", e);
      setStatus("❌ Falha ao carregar", false);
      alert(e.message || "Falha ao carregar dados.");
    }
  }

  function clearFilters() {
    if ($("#fFilial")) $("#fFilial").value = "";
    if ($("#fCliente")) $("#fCliente").value = "";
    if ($("#fStatus")) $("#fStatus").value = "";
    if ($("#fBusca")) $("#fBusca").value = "";
    renderAll();
  }

  function bindEvents() {
    $("#btnAtualizar")?.addEventListener("click", loadData);
    $("#btnLimpar")?.addEventListener("click", clearFilters);

    $("#fFilial")?.addEventListener("change", renderAll);
    $("#fCliente")?.addEventListener("change", renderAll);
    $("#fStatus")?.addEventListener("change", renderAll);
    $("#fBusca")?.addEventListener("input", renderAll);
  }

  function init() {
    bindEvents();
    loadData();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
