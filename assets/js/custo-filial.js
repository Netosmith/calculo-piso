// ==========================================
// CUSTO / FILIAL - NOVA FROTA
// Dashboard + Meta + Lançamento
// Versão robusta
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbysHSesum5p9FfIA6UY5cQbfzGGIbj-b_ml5vNb_NZsOFMPmzMzW65FRByvNqSML6me/exec";

let DB = {
  metas: [],
  lancamentos: []
};

let charts = {
  faturamento: null,
  ton: null,
  projecao: null
};

const STATE = {
  filtroFilial: "",
  filtroAno: "",
  filtroMes: "",
  editMetaId: "",
  editLancId: ""
};

// ==========================================
// HELPERS
// ==========================================

function $(id) {
  return document.getElementById(id);
}

function safeText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function safeValue(id, value) {
  const el = $(id);
  if (el) el.value = value;
}

function setStatus(msg, isError) {
  const el = $("syncStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#fca5a5" : "#93c5fd";
}

function onlyText(v) {
  return String(v == null ? "" : v).trim();
}

function upper(v) {
  return onlyText(v).toUpperCase();
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;

  let s = String(v).trim();
  if (!s) return 0;

  s = s.replace(/\s/g, "");

  if (s.indexOf(",") > -1 && s.indexOf(".") > -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.indexOf(",") > -1) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function brl(v) {
  return num(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function tons(v) {
  return num(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " t";
}

function pct(v) {
  return num(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }) + "%";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ymdToDate(ymd) {
  const s = onlyText(ymd);
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function getHoje() {
  return new Date();
}

function getAnoMesAtual() {
  const hoje = getHoje();
  return {
    ano: hoje.getFullYear(),
    mes: hoje.getMonth() + 1
  };
}

function diasNoMes(ano, mes) {
  return new Date(Number(ano), Number(mes), 0).getDate();
}

function diasPassadosNoMes(ano, mes) {
  const hoje = getHoje();
  const a = Number(ano);
  const m = Number(mes);

  if (!a || !m) return 1;

  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  if (a < anoAtual || (a === anoAtual && m < mesAtual)) {
    return diasNoMes(a, m);
  }

  if (a > anoAtual || (a === anoAtual && m > mesAtual)) {
    return 0;
  }

  return hoje.getDate();
}

function getFiltroAnoMes() {
  const atual = getAnoMesAtual();
  return {
    ano: Number(STATE.filtroAno || atual.ano),
    mes: Number(STATE.filtroMes || atual.mes)
  };
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

function closeAllModals() {
  const modals = document.querySelectorAll(".modal");
  for (let i = 0; i < modals.length; i++) {
    modals[i].classList.remove("isOpen");
    modals[i].setAttribute("aria-hidden", "true");
  }
}

function getFiliaisOrdenadas() {
  const set = new Set();

  DB.metas.forEach(function (x) {
    const f = upper(x.filial);
    if (f) set.add(f);
  });

  DB.lancamentos.forEach(function (x) {
    const f = upper(x.filial);
    if (f) set.add(f);
  });

  return Array.from(set).sort(function (a, b) {
    return a.localeCompare(b, "pt-BR");
  });
}

// ==========================================
// API
// ==========================================

async function apiGet(action) {
  const url = API_URL + "?action=" + encodeURIComponent(action);
  const res = await fetch(url, { method: "GET" });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error || ("Erro GET: " + action));
  }

  return json;
}

async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error || ("Erro POST: " + (payload.action || "")));
  }

  return json;
}

// ==========================================
// NORMALIZAÇÃO
// ==========================================

function normalizarMeta(x) {
  const ano = Number(x.ano || 0);
  const mes = Number(x.mes || 0);

  const metaMesFat = num(x.metaMesFat || x.metaFat || 0);
  const metaMesTon = num(x.metaMesTon || x.metaTon || 0);

  let metaDiaFat = num(x.metaDiaFat || 0);
  let metaDiaTon = num(x.metaDiaTon || 0);
  let metaAnoFat = num(x.metaAnoFat || 0);
  let metaAnoTon = num(x.metaAnoTon || 0);

  const anoCalc = ano || getAnoMesAtual().ano;
  const mesCalc = mes || getAnoMesAtual().mes;
  const dim = diasNoMes(anoCalc, mesCalc) || 30;

  if (!metaDiaFat && metaMesFat) metaDiaFat = metaMesFat / dim;
  if (!metaDiaTon && metaMesTon) metaDiaTon = metaMesTon / dim;
  if (!metaAnoFat && metaMesFat) metaAnoFat = metaMesFat * 12;
  if (!metaAnoTon && metaMesTon) metaAnoTon = metaMesTon * 12;

  return {
    id: onlyText(x.id),
    filial: upper(x.filial),
    ano: ano,
    mes: mes,
    metaDiaFat: metaDiaFat,
    metaMesFat: metaMesFat,
    metaAnoFat: metaAnoFat,
    metaDiaTon: metaDiaTon,
    metaMesTon: metaMesTon,
    metaAnoTon: metaAnoTon,
    createdAt: x.createdAt || "",
    updatedAt: x.updatedAt || ""
  };
}

function normalizarLancamento(x) {
  const data = onlyText(x.data);
  const d = ymdToDate(data);

  return {
    id: onlyText(x.id),
    data: data,
    ano: Number(x.ano || (d ? d.getFullYear() : 0)),
    mes: Number(x.mes || (d ? d.getMonth() + 1 : 0)),
    filial: upper(x.filial),
    faturamento: num(x.faturamento || 0),
    toneladas: num(x.toneladas || 0),
    custo: num(x.custo || 0),
    observacao: onlyText(x.observacao),
    createdAt: x.createdAt || "",
    updatedAt: x.updatedAt || ""
  };
}

// ==========================================
// LOAD
// ==========================================

async function loadAll() {
  try {
    setStatus("🔄 Carregando dados...", false);

    if (!API_URL || API_URL.indexOf("COLE_AQUI") > -1) {
      throw new Error("Preencha a API_URL no custo-filial.js");
    }

    const json = await apiGet("getAll");

    DB.metas = Array.isArray(json.metas) ? json.metas.map(normalizarMeta) : [];
    DB.lancamentos = Array.isArray(json.lancamentos) ? json.lancamentos.map(normalizarLancamento) : [];

    preencherFiltros();
    renderAll();

    setStatus("✅ Dados sincronizados.", false);
  } catch (err) {
    console.error("loadAll:", err);
    preencherFiltros();
    renderAll();
    setStatus("❌ " + err.message, true);
  }
}

// ==========================================
// FILTROS
// ==========================================

function preencherFiltros() {
  const sel = $("filtroFilial");
  if (sel) {
    const atual = STATE.filtroFilial || sel.value || "";
    const filiais = getFiliaisOrdenadas();

    sel.innerHTML =
      '<option value="">Todas</option>' +
      filiais.map(function (f) {
        return '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + "</option>";
      }).join("");

    if (filiais.indexOf(atual) > -1) {
      sel.value = atual;
      STATE.filtroFilial = atual;
    } else {
      sel.value = "";
      STATE.filtroFilial = "";
    }
  }

  const am = getAnoMesAtual();

  if ($("filtroAno") && !$("filtroAno").value && !STATE.filtroAno) $("filtroAno").value = String(am.ano);
  if ($("filtroMes") && !$("filtroMes").value && !STATE.filtroMes) $("filtroMes").value = String(am.mes);

  STATE.filtroAno = onlyText($("filtroAno") ? $("filtroAno").value : (STATE.filtroAno || am.ano));
  STATE.filtroMes = onlyText($("filtroMes") ? $("filtroMes").value : (STATE.filtroMes || am.mes));
}

function getMetaPeriodo() {
  const fm = getFiltroAnoMes();

  return DB.metas.filter(function (x) {
    if (STATE.filtroFilial && x.filial !== STATE.filtroFilial) return false;
    return Number(x.ano) === Number(fm.ano) && Number(x.mes) === Number(fm.mes);
  });
}

function getLancamentosPeriodo() {
  const fm = getFiltroAnoMes();

  return DB.lancamentos.filter(function (x) {
    if (STATE.filtroFilial && x.filial !== STATE.filtroFilial) return false;
    return Number(x.ano) === Number(fm.ano) && Number(x.mes) === Number(fm.mes);
  });
}

// ==========================================
// AGREGAÇÃO
// ==========================================

function montarBaseFiliais() {
  const metas = getMetaPeriodo();
  const lancs = getLancamentosPeriodo();
  const fm = getFiltroAnoMes();

  const mapa = new Map();

  metas.forEach(function (m) {
    if (!mapa.has(m.filial)) {
      mapa.set(m.filial, {
        filial: m.filial,
        ano: fm.ano,
        mes: fm.mes,
        metaId: m.id,
        metaMesFat: 0,
        metaMesTon: 0,
        metaDiaFat: 0,
        metaDiaTon: 0,
        realFat: 0,
        realTon: 0,
        custo: 0
      });
    }

    const row = mapa.get(m.filial);
    row.metaId = m.id;
    row.metaMesFat += num(m.metaMesFat);
    row.metaMesTon += num(m.metaMesTon);
    row.metaDiaFat += num(m.metaDiaFat);
    row.metaDiaTon += num(m.metaDiaTon);
  });

  lancs.forEach(function (l) {
    if (!mapa.has(l.filial)) {
      mapa.set(l.filial, {
        filial: l.filial,
        ano: fm.ano,
        mes: fm.mes,
        metaId: "",
        metaMesFat: 0,
        metaMesTon: 0,
        metaDiaFat: 0,
        metaDiaTon: 0,
        realFat: 0,
        realTon: 0,
        custo: 0
      });
    }

    const row = mapa.get(l.filial);
    row.realFat += num(l.faturamento);
    row.realTon += num(l.toneladas);
    row.custo += num(l.custo);
  });

  const diasMes = diasNoMes(fm.ano, fm.mes);
  const diasPassados = Math.max(diasPassadosNoMes(fm.ano, fm.mes), 1);

  const arr = Array.from(mapa.values()).map(function (x) {
    const pctFatVal = x.metaMesFat > 0 ? (x.realFat / x.metaMesFat) * 100 : 0;
    const pctTonVal = x.metaMesTon > 0 ? (x.realTon / x.metaMesTon) * 100 : 0;

    const projFat = diasPassados > 0 ? (x.realFat / diasPassados) * diasMes : 0;
    const projTon = diasPassados > 0 ? (x.realTon / diasPassados) * diasMes : 0;

    let tendencia = "SEM META";
    let alerta = "Sem meta";
    let nivel = "warn";

    if (x.metaMesFat > 0 || x.metaMesTon > 0) {
      const bateFat = x.metaMesFat > 0 ? projFat >= x.metaMesFat : true;
      const bateTon = x.metaMesTon > 0 ? projTon >= x.metaMesTon : true;

      if (bateFat && bateTon) {
        tendencia = "POSITIVA";
        alerta = "Ritmo bom";
        nivel = "ok";
      } else if (pctFatVal >= 70 || pctTonVal >= 70) {
        tendencia = "ATENÇÃO";
        alerta = "Precisa acelerar";
        nivel = "warn";
      } else {
        tendencia = "NEGATIVA";
        alerta = "Abaixo do esperado";
        nivel = "bad";
      }
    }

    return {
      filial: x.filial,
      ano: x.ano,
      mes: x.mes,
      metaId: x.metaId,
      metaMesFat: x.metaMesFat,
      metaMesTon: x.metaMesTon,
      metaDiaFat: x.metaDiaFat,
      metaDiaTon: x.metaDiaTon,
      realFat: x.realFat,
      realTon: x.realTon,
      custo: x.custo,
      pctFat: pctFatVal,
      pctTon: pctTonVal,
      projFat: projFat,
      projTon: projTon,
      tendencia: tendencia,
      alerta: alerta,
      nivel: nivel
    };
  });

  arr.sort(function (a, b) {
    const pa = Math.max(a.pctFat, a.pctTon);
    const pb = Math.max(b.pctFat, b.pctTon);
    return pb - pa;
  });

  return arr;
}

// ==========================================
// KPIs / ALERTAS / RANKING
// ==========================================

function renderKPIs(base) {
  const totalFat = base.reduce(function (s, x) { return s + x.realFat; }, 0);
  const totalTon = base.reduce(function (s, x) { return s + x.realTon; }, 0);
  const batendo = base.filter(function (x) { return x.nivel === "ok"; }).length;
  const comMeta = base.filter(function (x) { return x.metaMesFat > 0 || x.metaMesTon > 0; }).length;

  safeText("kpiFiliais", String(comMeta));
  safeText("kpiFatReal", brl(totalFat));
  safeText("kpiTonReal", tons(totalTon));
  safeText("kpiMetaBatida", String(batendo));
}

function renderAlertas(base) {
  const box = $("alertas");
  if (!box) return;

  if (!base.length) {
    box.innerHTML = '<div class="emptyState">Sem dados para o período selecionado.</div>';
    return;
  }

  const top = base.slice(0, 12);

  box.innerHTML = top.map(function (x) {
    const texto = (x.metaMesFat > 0 || x.metaMesTon > 0)
      ? escapeHtml(x.filial) + " • Fat " + pct(x.pctFat) + " • Ton " + pct(x.pctTon)
      : escapeHtml(x.filial) + " • Sem meta cadastrada";

    return '<div class="alertItem ' + x.nivel + '">' + texto + "</div>";
  }).join("");
}

function renderRanking(base) {
  const tbody = $("ranking");
  if (!tbody) return;

  if (!base.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="emptyState">Sem dados para o período selecionado.</td></tr>';
    return;
  }

  tbody.innerHTML = base.map(function (x, i) {
    return ''
      + "<tr>"
      + '<td><span class="rankBadge">' + (i + 1) + "</span></td>"
      + "<td>" + escapeHtml(x.filial) + "</td>"
      + '<td class="num">' + brl(x.realFat) + "</td>"
      + '<td class="num">' + brl(x.metaMesFat) + "</td>"
      + '<td class="num">' + pct(x.pctFat) + "</td>"
      + '<td class="num">' + brl(x.projFat) + "</td>"
      + '<td class="num">' + tons(x.realTon) + "</td>"
      + '<td class="num">' + tons(x.metaMesTon) + "</td>"
      + '<td class="num">' + pct(x.pctTon) + "</td>"
      + '<td><span class="pill ' + x.nivel + '">' + escapeHtml(x.tendencia) + "</span></td>"
      + '<td><span class="pill ' + x.nivel + '">' + escapeHtml(x.alerta) + "</span></td>"
      + "</tr>";
  }).join("");
}

// ==========================================
// GRÁFICOS
// ==========================================

function destroyChart(chart) {
  if (chart && typeof chart.destroy === "function") {
    chart.destroy();
  }
}

function renderCharts(base) {
  if (typeof Chart === "undefined") return;

  const labels = base.map(function (x) { return x.filial; });

  const fatMeta = base.map(function (x) { return x.metaMesFat; });
  const fatReal = base.map(function (x) { return x.realFat; });

  const tonMeta = base.map(function (x) { return x.metaMesTon; });
  const tonReal = base.map(function (x) { return x.realTon; });

  const projMeta = base.map(function (x) { return x.metaMesFat; });
  const projReal = base.map(function (x) { return x.projFat; });

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#e5e7eb",
          font: { weight: "bold" }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: "#cbd5e1" },
        grid: { color: "rgba(255,255,255,.06)" }
      },
      y: {
        ticks: { color: "#cbd5e1" },
        grid: { color: "rgba(255,255,255,.06)" }
      }
    }
  };

  const elFat = $("graficoFaturamento");
  if (elFat) {
    destroyChart(charts.faturamento);
    charts.faturamento = new Chart(elFat, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "META",
            data: fatMeta,
            backgroundColor: "rgba(59,130,246,.72)",
            borderColor: "rgba(59,130,246,1)",
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: "ALCANÇADO",
            data: fatReal,
            backgroundColor: "rgba(34,197,94,.58)",
            borderColor: "rgba(34,197,94,1)",
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: commonOptions
    });
  }

  const elTon = $("graficoTon");
  if (elTon) {
    destroyChart(charts.ton);
    charts.ton = new Chart(elTon, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "META",
            data: tonMeta,
            backgroundColor: "rgba(59,130,246,.72)",
            borderColor: "rgba(59,130,246,1)",
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: "ALCANÇADO",
            data: tonReal,
            backgroundColor: "rgba(34,197,94,.58)",
            borderColor: "rgba(34,197,94,1)",
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: commonOptions
    });
  }

  const elProj = $("graficoProjecao");
  if (elProj) {
    destroyChart(charts.projecao);
    charts.projecao = new Chart(elProj, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "META MENSAL",
            data: projMeta,
            backgroundColor: "rgba(139,92,246,.72)",
            borderColor: "rgba(139,92,246,1)",
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: "PROJEÇÃO",
            data: projReal,
            backgroundColor: "rgba(245,158,11,.62)",
            borderColor: "rgba(245,158,11,1)",
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: commonOptions
    });
  }
}

// ==========================================
// RENDER
// ==========================================

function renderAll() {
  const base = montarBaseFiliais();
  renderKPIs(base);
  renderAlertas(base);
  renderRanking(base);
  renderCharts(base);
}

// ==========================================
// META
// ==========================================

function limparFormMeta() {
  STATE.editMetaId = "";
  safeValue("metaFilial", STATE.filtroFilial || "");
  safeValue("metaFat", "");
  safeValue("metaTon", "");
}

function preencherMetaExistenteSeHouver() {
  const filial = upper($("metaFilial") ? $("metaFilial").value : "");
  const fm = getFiltroAnoMes();

  if (!filial) {
    STATE.editMetaId = "";
    return;
  }

  const meta = DB.metas.find(function (x) {
    return x.filial === filial &&
      Number(x.ano) === Number(fm.ano) &&
      Number(x.mes) === Number(fm.mes);
  });

  if (!meta) {
    STATE.editMetaId = "";
    safeValue("metaFat", "");
    safeValue("metaTon", "");
    return;
  }

  STATE.editMetaId = meta.id;
  safeValue("metaFat", meta.metaMesFat || "");
  safeValue("metaTon", meta.metaMesTon || "");
}

async function salvarMeta() {
  try {
    const filial = upper($("metaFilial") ? $("metaFilial").value : "");
    const metaFat = num($("metaFat") ? $("metaFat").value : 0);
    const metaTon = num($("metaTon") ? $("metaTon").value : 0);
    const fm = getFiltroAnoMes();

    if (!filial) throw new Error("Informe a filial.");
    if (!fm.ano || !fm.mes) throw new Error("Defina ano e mês nos filtros.");
    if (!metaFat && !metaTon) throw new Error("Informe meta de faturamento ou toneladas.");

    const dim = diasNoMes(fm.ano, fm.mes);

    const payload = {
      filial: filial,
      ano: fm.ano,
      mes: fm.mes,
      metaDiaFat: metaFat ? metaFat / dim : 0,
      metaMesFat: metaFat,
      metaAnoFat: metaFat ? metaFat * 12 : 0,
      metaDiaTon: metaTon ? metaTon / dim : 0,
      metaMesTon: metaTon,
      metaAnoTon: metaTon ? metaTon * 12 : 0
    };

    let existente = DB.metas.find(function (x) {
      return x.filial === filial &&
        Number(x.ano) === Number(fm.ano) &&
        Number(x.mes) === Number(fm.mes);
    });

    if (STATE.editMetaId) {
      const porId = DB.metas.find(function (x) { return x.id === STATE.editMetaId; });
      if (porId) existente = porId;
    }

    if (existente && existente.id) {
      await apiPost({
        action: "update_meta",
        id: existente.id,
        filial: payload.filial,
        ano: payload.ano,
        mes: payload.mes,
        metaDiaFat: payload.metaDiaFat,
        metaMesFat: payload.metaMesFat,
        metaAnoFat: payload.metaAnoFat,
        metaDiaTon: payload.metaDiaTon,
        metaMesTon: payload.metaMesTon,
        metaAnoTon: payload.metaAnoTon
      });
      setStatus("✅ Meta atualizada com sucesso.", false);
    } else {
      await apiPost({
        action: "add_meta",
        filial: payload.filial,
        ano: payload.ano,
        mes: payload.mes,
        metaDiaFat: payload.metaDiaFat,
        metaMesFat: payload.metaMesFat,
        metaAnoFat: payload.metaAnoFat,
        metaDiaTon: payload.metaDiaTon,
        metaMesTon: payload.metaMesTon,
        metaAnoTon: payload.metaAnoTon
      });
      setStatus("✅ Meta salva com sucesso.", false);
    }

    closeModal("modalMeta");
    limparFormMeta();
    await loadAll();
  } catch (err) {
    console.error("salvarMeta:", err);
    setStatus("❌ " + err.message, true);
  }
}

// ==========================================
// LANÇAMENTO
// ==========================================

function limparFormLancamento() {
  STATE.editLancId = "";
  safeValue("lancFilial", STATE.filtroFilial || "");

  const hoje = getHoje();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");

  safeValue("lancData", yyyy + "-" + mm + "-" + dd);
  safeValue("lancFat", "");
  safeValue("lancTon", "");
}

async function salvarLancamento() {
  try {
    const filial = upper($("lancFilial") ? $("lancFilial").value : "");
    const data = onlyText($("lancData") ? $("lancData").value : "");
    const faturamento = num($("lancFat") ? $("lancFat").value : 0);
    const toneladas = num($("lancTon") ? $("lancTon").value : 0);

    if (!filial) throw new Error("Informe a filial.");
    if (!data) throw new Error("Informe a data.");
    if (!faturamento && !toneladas) throw new Error("Informe faturamento ou toneladas.");

    const d = ymdToDate(data);
    if (!d) throw new Error("Data inválida.");

    await apiPost({
      action: "add_lancamento",
      filial: filial,
      data: data,
      faturamento: faturamento,
      toneladas: toneladas,
      custo: 0,
      observacao: ""
    });

    setStatus("✅ Lançamento salvo com sucesso.", false);
    closeModal("modalLanc");
    limparFormLancamento();
    await loadAll();
  } catch (err) {
    console.error("salvarLancamento:", err);
    setStatus("❌ " + err.message, true);
  }
}

// ==========================================
// EVENTOS
// ==========================================

function bindModalEvents() {
  const closeBtns = document.querySelectorAll("[data-close]");
  for (let i = 0; i < closeBtns.length; i++) {
    closeBtns[i].addEventListener("click", function () {
      const id = this.getAttribute("data-close");
      if (id) closeModal(id);
    });
  }

  const modals = document.querySelectorAll(".modal");
  for (let i = 0; i < modals.length; i++) {
    modals[i].addEventListener("click", function (e) {
      if (e.target === this) closeModal(this.id);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllModals();
  });
}

function bindHeaderButtons() {
  const btnMeta = $("btnNovaMeta");
  if (btnMeta) {
    btnMeta.addEventListener("click", function () {
      limparFormMeta();
      openModal("modalMeta");
      setTimeout(function () {
        const el = $("metaFilial");
        if (el) el.focus();
      }, 30);
    });
  }

  const btnLanc = $("btnNovoLancamento");
  if (btnLanc) {
    btnLanc.addEventListener("click", function () {
      limparFormLancamento();
      openModal("modalLanc");
      setTimeout(function () {
        const el = $("lancFilial");
        if (el) el.focus();
      }, 30);
    });
  }

  const btnAtualizar = $("btnAtualizar");
  if (btnAtualizar) {
    btnAtualizar.addEventListener("click", function () {
      loadAll();
    });
  }

  const btnSalvarMeta = $("btnSalvarMeta");
  if (btnSalvarMeta) {
    btnSalvarMeta.addEventListener("click", function () {
      salvarMeta();
    });
  }

  const btnSalvarLanc = $("btnSalvarLancamento");
  if (btnSalvarLanc) {
    btnSalvarLanc.addEventListener("click", function () {
      salvarLancamento();
    });
  }
}

function bindFiltros() {
  const fFilial = $("filtroFilial");
  if (fFilial) {
    fFilial.addEventListener("change", function (e) {
      STATE.filtroFilial = upper(e.target.value || "");
      renderAll();
    });
  }

  const fAno = $("filtroAno");
  if (fAno) {
    fAno.addEventListener("input", function (e) {
      STATE.filtroAno = onlyText(e.target.value || "");
      renderAll();
    });
  }

  const fMes = $("filtroMes");
  if (fMes) {
    fMes.addEventListener("input", function (e) {
      STATE.filtroMes = onlyText(e.target.value || "");
      renderAll();
    });
  }
}

function bindMetaHelpers() {
  const campo = $("metaFilial");
  if (!campo) return;

  campo.addEventListener("blur", function () {
    preencherMetaExistenteSeHouver();
  });

  campo.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      preencherMetaExistenteSeHouver();
    }
  });
}

// ==========================================
// INIT
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
  try {
    bindModalEvents();
    bindHeaderButtons();
    bindFiltros();
    bindMetaHelpers();

    const am = getAnoMesAtual();
    safeValue("filtroAno", String(am.ano));
    safeValue("filtroMes", String(am.mes));

    STATE.filtroAno = String(am.ano);
    STATE.filtroMes = String(am.mes);

    limparFormMeta();
    limparFormLancamento();

    renderAll();
    loadAll();
  } catch (err) {
    console.error("init:", err);
    setStatus("❌ " + err.message, true);
  }
});
