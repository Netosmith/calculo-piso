/* custo-filial.js | NOVA FROTA */
(function () {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbw7JzUswFUn76uHvT-hkrOroGfb35lnQDWkz4nTDoyQschtBta-fDAYAYQeTNkVAKxN/exec";
  const $ = (id) => document.getElementById(id);

  const STATE = {
    metas: [],
    dados: [],
    charts: {
      faturamento: null,
      toneladas: null,
      projecao: null,
    }
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

  function setStatus(text, type = "info") {
    const el = $("syncStatus");
    if (!el) return;

    el.textContent = text;

    if (type === "error") el.style.color = "#fca5a5";
    else if (type === "success") el.style.color = "#86efac";
    else el.style.color = "#93c5fd";
  }

  function jsonp(url, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";
      let finished = false;

      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error("Timeout ao carregar dados"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch {}
        try { script.remove(); } catch {}
      }

      window[cb] = (data) => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(data);
      };

      script.src = url + sep + "callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
      script.async = true;

      script.onerror = () => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error("Erro ao carregar Apps Script"));
      };

      document.head.appendChild(script);
    });
  }

  function buildUrl(paramsObj) {
    const url = new URL(API);
    Object.entries(paramsObj || {}).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
    return url.toString();
  }

  async function apiGet(paramsObj) {
    const res = await jsonp(buildUrl(paramsObj), 35000);
    if (!res) throw new Error("Resposta vazia da API");
    if (res.ok === false) throw new Error(res.error || "Falha na API");
    return res;
  }

  function parseDateAny(value) {
    const s = safeText(value);
    if (!s) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split("/").map(Number);
      return new Date(y, m - 1, d);
    }

    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function normalizeMeta(row) {
    return {
      id: safeText(row?.id),
      filial: upper(row?.filial),
      metaMesFat: num(row?.metaMesFat ?? row?.MetaMesFat ?? row?.metaFat ?? row?.meta_faturamento),
      metaMesTon: num(row?.metaMesTon ?? row?.MetaMesTon ?? row?.metaTon ?? row?.meta_toneladas),
      createdAt: num(row?.createdAt),
      updatedAt: num(row?.updatedAt),
    };
  }

  function normalizeLancamento(row) {
    return {
      id: safeText(row?.id),
      filial: upper(row?.filial ?? row?.Filial),
      data: safeText(row?.data ?? row?.Data),
      faturamento: num(row?.faturamento ?? row?.Faturamento),
      toneladas: num(row?.toneladas ?? row?.Toneladas),
      createdAt: num(row?.createdAt),
      updatedAt: num(row?.updatedAt),
    };
  }

  function getDiasNoMes(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getResumoAtual() {
    const hoje = new Date();
    const mes = hoje.getMonth();
    const ano = hoje.getFullYear();
    const diasMes = getDiasNoMes(hoje);
    const diaAtual = hoje.getDate();

    const resumo = {};

    STATE.dados.forEach((r) => {
      const dt = parseDateAny(r.data);
      if (!dt) return;
      if (dt.getMonth() !== mes || dt.getFullYear() !== ano) return;

      const filial = upper(r.filial);
      if (!filial) return;

      if (!resumo[filial]) {
        resumo[filial] = {
          fat: 0,
          ton: 0,
          diasComLancamento: new Set()
        };
      }

      resumo[filial].fat += num(r.faturamento);
      resumo[filial].ton += num(r.toneladas);
      resumo[filial].diasComLancamento.add(dt.getDate());
    });

    const ranking = STATE.metas.map((m) => {
      const real = resumo[m.filial] || { fat: 0, ton: 0, diasComLancamento: new Set() };

      const diasLancados = real.diasComLancamento.size || 0;
      const fat = real.fat;
      const ton = real.ton;

      const percFat = m.metaMesFat > 0 ? (fat / m.metaMesFat) * 100 : 0;
      const percTon = m.metaMesTon > 0 ? (ton / m.metaMesTon) * 100 : 0;

      const mediaFatDia = diaAtual > 0 ? fat / diaAtual : 0;
      const mediaTonDia = diaAtual > 0 ? ton / diaAtual : 0;

      const projFat = mediaFatDia * diasMes;
      const projTon = mediaTonDia * diasMes;

      const vaiBaterFat = projFat >= m.metaMesFat && m.metaMesFat > 0;
      const vaiBaterTon = projTon >= m.metaMesTon && m.metaMesTon > 0;

      let tendencia = "EM ANDAMENTO";
      if (vaiBaterFat && vaiBaterTon) tendencia = "VAI BATER";
      else if (!vaiBaterFat && !vaiBaterTon) tendencia = "RISCO";
      else tendencia = "PARCIAL";

      let alerta = "OK";
      if (percFat < 70 || percTon < 70) alerta = "ABAIXO DA META";
      if (percFat < 40 && percTon < 40) alerta = "CRÍTICO";

      const score = ((percFat || 0) * 0.6) + ((percTon || 0) * 0.4);

      return {
        filial: m.filial,
        metaFat: m.metaMesFat,
        metaTon: m.metaMesTon,
        fat,
        ton,
        percFat,
        percTon,
        projFat,
        projTon,
        tendencia,
        alerta,
        diasLancados,
        score
      };
    });

    ranking.sort((a, b) => b.score - a.score || a.filial.localeCompare(b.filial, "pt-BR"));

    return {
      ranking,
      diasMes,
      diaAtual
    };
  }

  function renderKPIs(ranking) {
    const totalFat = ranking.reduce((acc, r) => acc + r.fat, 0);
    const totalTon = ranking.reduce((acc, r) => acc + r.ton, 0);
    const batendo = ranking.filter((r) => r.tendencia === "VAI BATER").length;

    $("kpiFiliais").textContent = intBR(ranking.length);
    $("kpiFatReal").textContent = moneyBR(totalFat);
    $("kpiTonReal").textContent = intBR(totalTon) + " t";
    $("kpiMetaBatida").textContent = intBR(batendo);
  }

  function pillClass(text) {
    const s = upper(text);
    if (s === "VAI BATER" || s === "OK") return "ok";
    if (s === "PARCIAL" || s === "ABAIXO DA META") return "warn";
    return "bad";
  }

  function renderRanking(ranking) {
    const tbody = $("ranking");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!ranking.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="emptyState">Nenhuma meta cadastrada ainda.</td></tr>`;
      return;
    }

    ranking.forEach((x, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="rankBadge">${i + 1}</span></td>
        <td>${x.filial}</td>
        <td class="num">${moneyBR(x.fat)}</td>
        <td class="num">${moneyBR(x.metaFat)}</td>
        <td class="num">${x.percFat.toFixed(1)}%</td>
        <td class="num">${moneyBR(x.projFat)}</td>
        <td class="num">${intBR(x.ton)} t</td>
        <td class="num">${intBR(x.metaTon)} t</td>
        <td class="num">${x.percTon.toFixed(1)}%</td>
        <td><span class="pill ${pillClass(x.tendencia)}">${x.tendencia}</span></td>
        <td><span class="pill ${pillClass(x.alerta)}">${x.alerta}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAlertas(ranking) {
    const el = $("alertas");
    if (!el) return;

    if (!ranking.length) {
      el.innerHTML = `<div class="alertItem warn">Nenhuma meta encontrada para análise.</div>`;
      return;
    }

    el.innerHTML = ranking.map((x) => {
      if (x.alerta === "CRÍTICO") {
        return `<div class="alertItem bad">🔴 ${x.filial}: desempenho crítico. Projeção ${moneyBR(x.projFat)} e ${intBR(x.projTon)} t.</div>`;
      }
      if (x.alerta === "ABAIXO DA META") {
        return `<div class="alertItem warn">🟠 ${x.filial}: abaixo da meta. Está em ${x.percFat.toFixed(1)}% do faturamento e ${x.percTon.toFixed(1)}% das toneladas.</div>`;
      }
      return `<div class="alertItem ok">🟢 ${x.filial}: tendência positiva. Deve fechar o mês em ${moneyBR(x.projFat)} e ${intBR(x.projTon)} t.</div>`;
    }).join("");
  }

  function destroyCharts() {
    Object.values(STATE.charts).forEach((chart) => {
      if (chart && typeof chart.destroy === "function") chart.destroy();
    });

    STATE.charts = {
      faturamento: null,
      toneladas: null,
      projecao: null,
    };
  }

  function chartBaseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#cbd5e1",
            font: { weight: "700" }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(255,255,255,.05)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(255,255,255,.08)" }
        }
      }
    };
  }

  function renderCharts(ranking) {
    destroyCharts();

    if (typeof Chart === "undefined") return;

    const labels = ranking.map((x) => x.filial);

    const ctxFat = $("graficoFaturamento");
    const ctxTon = $("graficoTon");
    const ctxProj = $("graficoProjecao");

    if (ctxFat) {
      STATE.charts.faturamento = new Chart(ctxFat, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Meta Faturamento",
              data: ranking.map((x) => x.metaFat),
              backgroundColor: "rgba(59,130,246,.65)",
              borderColor: "rgba(59,130,246,1)",
              borderWidth: 1.5,
              borderRadius: 8
            },
            {
              label: "Real Faturamento",
              data: ranking.map((x) => x.fat),
              backgroundColor: "rgba(34,197,94,.65)",
              borderColor: "rgba(34,197,94,1)",
              borderWidth: 1.5,
              borderRadius: 8
            }
          ]
        },
        options: chartBaseOptions()
      });
    }

    if (ctxTon) {
      STATE.charts.toneladas = new Chart(ctxTon, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Meta Toneladas",
              data: ranking.map((x) => x.metaTon),
              backgroundColor: "rgba(245,158,11,.65)",
              borderColor: "rgba(245,158,11,1)",
              borderWidth: 1.5,
              borderRadius: 8
            },
            {
              label: "Real Toneladas",
              data: ranking.map((x) => x.ton),
              backgroundColor: "rgba(139,92,246,.65)",
              borderColor: "rgba(139,92,246,1)",
              borderWidth: 1.5,
              borderRadius: 8
            }
          ]
        },
        options: chartBaseOptions()
      });
    }

    if (ctxProj) {
      STATE.charts.projecao = new Chart(ctxProj, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Projeção Faturamento",
              data: ranking.map((x) => x.projFat),
              borderColor: "rgba(34,197,94,1)",
              backgroundColor: "rgba(34,197,94,.20)",
              tension: 0.25,
              fill: false
            },
            {
              label: "Meta Faturamento",
              data: ranking.map((x) => x.metaFat),
              borderColor: "rgba(239,68,68,1)",
              backgroundColor: "rgba(239,68,68,.20)",
              tension: 0.25,
              fill: false
            }
          ]
        },
        options: chartBaseOptions()
      });
    }
  }

  function openModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("isOpen");
    el.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("isOpen");
    el.setAttribute("aria-hidden", "true");
  }

  function clearMetaModal() {
    $("metaFilial").value = "";
    $("metaFat").value = "";
    $("metaTon").value = "";
  }

  function clearLancamentoModal() {
    $("lancFilial").value = "";
    $("lancData").value = new Date().toISOString().slice(0, 10);
    $("lancFat").value = "";
    $("lancTon").value = "";
  }

  function prefillMetaByFilial() {
    const filial = upper($("metaFilial")?.value);
    if (!filial) return;

    const existente = STATE.metas.find((m) => upper(m.filial) === filial);
    if (!existente) return;

    $("metaFat").value = existente.metaMesFat || "";
    $("metaTon").value = existente.metaMesTon || "";
  }

  async function salvarMeta() {
    const filial = upper($("metaFilial")?.value);
    const metaFat = num($("metaFat")?.value);
    const metaTon = num($("metaTon")?.value);

    if (!filial) {
      alert("Informe a filial.");
      return;
    }

    try {
      setStatus("💾 Salvando meta...", "info");

      await apiGet({
        action: "add_meta",
        filial,
        metaMesFat: metaFat,
        metaMesTon: metaTon
      });

      closeModal("modalMeta");
      clearMetaModal();
      await load();
      setStatus("✅ Meta salva", "success");
    } catch (e) {
      console.error("[custo-filial] erro ao salvar meta:", e);
      setStatus("❌ Erro ao salvar meta", "error");
      alert(e.message || "Falha ao salvar meta.");
    }
  }

  async function salvarLancamento() {
    const filial = upper($("lancFilial")?.value);
    const data = safeText($("lancData")?.value);
    const faturamento = num($("lancFat")?.value);
    const toneladas = num($("lancTon")?.value);

    if (!filial) {
      alert("Informe a filial.");
      return;
    }

    if (!data) {
      alert("Informe a data.");
      return;
    }

    try {
      setStatus("💾 Salvando produção...", "info");

      await apiGet({
        action: "add_lancamento",
        filial,
        data,
        faturamento,
        toneladas
      });

      closeModal("modalLanc");
      clearLancamentoModal();
      await load();
      setStatus("✅ Produção salva", "success");
    } catch (e) {
      console.error("[custo-filial] erro ao salvar lançamento:", e);
      setStatus("❌ Erro ao salvar produção", "error");
      alert(e.message || "Falha ao salvar produção.");
    }
  }

  function renderAll() {
    const { ranking } = getResumoAtual();
    renderKPIs(ranking);
    renderRanking(ranking);
    renderAlertas(ranking);
    renderCharts(ranking);
  }

  async function load() {
    try {
      setStatus("🔄 Carregando...", "info");

      const res = await apiGet({ action: "getAll" });

      STATE.metas = Array.isArray(res.metas) ? res.metas.map(normalizeMeta) : [];
      STATE.dados = Array.isArray(res.lancamentos) ? res.lancamentos.map(normalizeLancamento) : [];

      renderAll();

      setStatus(`✅ ${STATE.metas.length} metas e ${STATE.dados.length} lançamentos carregados`, "success");
    } catch (e) {
      console.error("[custo-filial] erro ao carregar:", e);
      setStatus("❌ Falha ao carregar dados", "error");
      alert("Erro ao carregar Custo / Filial: " + (e.message || "Erro desconhecido"));
    }
  }

  function bindEvents() {
    $("btnNovaMeta")?.addEventListener("click", () => {
      clearMetaModal();
      openModal("modalMeta");
    });

    $("btnNovoLancamento")?.addEventListener("click", () => {
      clearLancamentoModal();
      openModal("modalLanc");
    });

    $("btnAtualizar")?.addEventListener("click", load);

    $("btnSalvarMeta")?.addEventListener("click", salvarMeta);
    $("btnSalvarLancamento")?.addEventListener("click", salvarLancamento);

    $("metaFilial")?.addEventListener("blur", prefillMetaByFilial);

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-close");
        if (id) closeModal(id);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal("modalMeta");
        closeModal("modalLanc");
      }
    });

    $("modalMeta")?.addEventListener("click", (e) => {
      if (e.target === $("modalMeta")) closeModal("modalMeta");
    });

    $("modalLanc")?.addEventListener("click", (e) => {
      if (e.target === $("modalLanc")) closeModal("modalLanc");
    });
  }

  function init() {
    clearLancamentoModal();
    bindEvents();
    load();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
