// ==========================================
// CUSTO / FILIAL - NOVA FROTA
// Ajustado para o HTML atual
// Home + painel Meta + painel Lançamento
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

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value;
}

function getValue(id) {
  const el = $(id);
  return el ? el.value : "";
}

function setStatus(msg, isError = false) {
  const el = $("syncStatus");
  if (!el) return;
  el.textContent = msg;
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

  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
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

function formatDateBR(ymd) {
  const d = ymdToDate(ymd);
  if (!d) return ymd || "";
  return d.toLocaleDateString("pt-BR");
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

// ==========================================
// API
// ==========================================

async function apiGet(action) {
  const url = `${API_URL}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error || `Erro GET: ${action}`);
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
    throw new Error(json.error || `Erro POST: ${payload.action || ""}`);
  }

  return json;
}

// ==========================================
// NORMALIZAÇÃO
// ==========================================

function normalizarMeta(x) {
  const ano = Number(x.ano || 0);
  const mes = Number(x.mes || 0);

  const metaMesFat = num(x.metaMesFat || 0);
  const metaMesTon = num(x.metaMesTon || 0);

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
    ano,
    mes,
    metaDiaFat,
    metaMesFat,
    metaAnoFat,
    metaDiaTon,
    metaMesTon,
    metaAnoTon,
    createdAt: x.createdAt || "",
    updatedAt: x.updatedAt || ""
  };
}

function normalizarLancamento(x) {
  const data = onlyText(x.data);
  const d = ymdToDate(data);

  return {
    id: onlyText(x.id),
    data,
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
    setStatus("🔄 Carregando dados...");

    if (!API_URL || API_URL.includes("COLE_AQUI")) {
      throw new Error("Preencha a API_URL no custo-filial.js");
    }

    const json = await apiGet("getAll");

    DB.metas = Array.isArray(json.metas) ? json.metas.map(normalizarMeta) : [];
    DB.lancamentos = Array.isArray(json.lancamentos) ? json.lancamentos.map(normalizarLancamento) : [];

    preencherFiltroFilial();
    renderHome();
    renderMetaTable();
    renderLancamentosTable();

    setStatus("✅ Dados sincronizados.");
  } catch (err) {
    console.error(err);
    renderHome();
    renderMetaTable();
    renderLancamentosTable();
    setStatus(`❌ ${err.message}`, true);
  }
}

// ==========================================
// TABS / PAINÉIS
// ==========================================

function ativarPainel(tipo) {
  const isMeta = tipo === "meta";

  const tabMeta = $("tabMeta");
  const tabLanc = $("tabLancamento");
  const panelMeta = $("panelMeta");
  const panelLanc = $("panelLancamento");

  if (tabMeta) tabMeta.classList.toggle("active", isMeta);
  if (tabLanc) tabLanc.classList.toggle("active", !isMeta);

  if (tabMeta) {
    tabMeta.classList.toggle("meta", true);
    if (!isMeta) tabMeta.classList.remove("lanc");
  }

  if (tabLanc) {
    tabLanc.classList.toggle("lanc", !isMeta);
    if (isMeta) tabLanc.classList.remove("active");
  }

  if (panelMeta) panelMeta.classList.toggle("active", isMeta);
  if (panelLanc) panelLanc.classList.toggle("active", !isMeta);
}

function irParaPainel(tipo) {
  ativarPainel(tipo);

  const alvo = tipo === "meta" ? $("panelMeta") : $("panelLancamento");
  if (alvo) {
    alvo.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ==========================================
// FILTROS
// ==========================================

function getFiliaisOrdenadas() {
  const set = new Set();

  DB.metas.forEach((x) => {
    if (x.filial) set.add(x.filial);
  });

  DB.lancamentos.forEach((x) => {
    if (x.filial) set.add(x.filial);
  });

  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function preencherFiltroFilial() {
  const sel = $("filtroFilial");
  if (!sel) return;

  const atual = STATE.filtroFilial || "";
  const filiais = getFiliaisOrdenadas();

  sel.innerHTML =
    `<option value="">Todas</option>` +
    filiais.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");

  if (filiais.includes(atual)) {
    sel.value = atual;
  } else {
    sel.value = "";
    STATE.filtroFilial = "";
  }
}

function aplicarFiltrosMeta(lista) {
  const { ano, mes } = getFiltroAnoMes();

  return lista.filter((x) => {
    if (STATE.filtroFilial && x.filial !== STATE.filtroFilial) return false;
    if (Number(x.ano) !== Number(ano)) return false;
    if (Number(x.mes) !== Number(mes)) return false;
    return true;
  });
}

function aplicarFiltrosLancamento(lista) {
  const { ano, mes } = getFiltroAnoMes();

  return lista.filter((x) => {
    if (STATE.filtroFilial && x.filial !== STATE.filtroFilial) return false;
    if (Number(x.ano) !== Number(ano)) return false;
    if (Number(x.mes) !== Number(mes)) return false;
    return true;
  });
}

// ==========================================
// AGREGAÇÃO HOME
// ==========================================

function montarBaseHome() {
  const metas = aplicarFiltrosMeta(DB.metas);
  const lancs = aplicarFiltrosLancamento(DB.lancamentos);
  const { ano, mes } = getFiltroAnoMes();

  const mapa = new Map();

  metas.forEach((m) => {
    if (!mapa.has(m.filial)) {
      mapa.set(m.filial, {
        filial: m.filial,
        metaMesFat: 0,
        metaMesTon: 0,
        realFat: 0,
        realTon: 0,
        custo: 0
      });
    }

    const row = mapa.get(m.filial);
    row.metaMesFat += num(m.metaMesFat);
    row.metaMesTon += num(m.metaMesTon);
  });

  lancs.forEach((l) => {
    if (!mapa.has(l.filial)) {
      mapa.set(l.filial, {
        filial: l.filial,
        metaMesFat: 0,
        metaMesTon: 0,
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

  const diasMes = diasNoMes(ano, mes);
  const diasPassados = Math.max(diasPassadosNoMes(ano, mes), 1);

  const base = [...mapa.values()].map((x) => {
    const pctFat = x.metaMesFat > 0 ? (x.realFat / x.metaMesFat) * 100 : 0;
    const pctTon = x.metaMesTon > 0 ? (x.realTon / x.metaMesTon) * 100 : 0;
    const projFat = diasPassados > 0 ? (x.realFat / diasPassados) * diasMes : 0;
    const projTon = diasPassados > 0 ? (x.realTon / diasPassados) * diasMes : 0;
    const custoTon = x.realTon > 0 ? x.custo / x.realTon : 0;

    let nivel = "warn";
    let tendencia = "ATENÇÃO";

    const bateFat = x.metaMesFat > 0 ? projFat >= x.metaMesFat : false;
    const bateTon = x.metaMesTon > 0 ? projTon >= x.metaMesTon : false;

    if (bateFat || bateTon) {
      nivel = "ok";
      tendencia = "POSITIVA";
    } else if ((x.metaMesFat > 0 && pctFat < 50) || (x.metaMesTon > 0 && pctTon < 50)) {
      nivel = "bad";
      tendencia = "NEGATIVA";
    }

    return {
      ...x,
      pctFat,
      pctTon,
      projFat,
      projTon,
      custoTon,
      nivel,
      tendencia
    };
  });

  base.sort((a, b) => {
    const aScore = Math.max(a.pctFat, a.pctTon);
    const bScore = Math.max(b.pctFat, b.pctTon);
    return bScore - aScore;
  });

  return base;
}

// ==========================================
// HOME
// ==========================================

function renderHome() {
  const base = montarBaseHome();
  renderKPIs(base);
  renderAlertas(base);
  renderRanking(base);
  renderCharts(base);
}

function renderKPIs(base) {
  const totalFat = base.reduce((s, x) => s + x.realFat, 0);
  const totalTon = base.reduce((s, x) => s + x.realTon, 0);
  const totalCusto = base.reduce((s, x) => s + x.custo, 0);
  const custoTon = totalTon > 0 ? totalCusto / totalTon : 0;
  const filiais = base.length;

  setText("kpiFiliais", String(filiais));
  setText("kpiFatReal", brl(totalFat));
  setText("kpiTonReal", tons(totalTon));
  setText("kpiCustoTon", brl(custoTon));
}

function renderAlertas(base) {
  const box = $("alertas");
  if (!box) return;

  if (!base.length) {
    box.innerHTML = `<div class="emptyState">Sem dados para o período selecionado.</div>`;
    return;
  }

  box.innerHTML = base.slice(0, 10).map((x) => {
    const detalhe = `Fat ${pct(x.pctFat)} • Ton ${pct(x.pctTon)}`;
    return `<div class="alertItem ${x.nivel}">${escapeHtml(x.filial)} • ${escapeHtml(x.tendencia)} • ${detalhe}</div>`;
  }).join("");
}

function renderRanking(base) {
  const tbody = $("ranking");
  if (!tbody) return;

  if (!base.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="emptyState">Sem dados para o período selecionado.</td></tr>`;
    return;
  }

  tbody.innerHTML = base.map((x, i) => `
    <tr>
      <td><span class="rankBadge">${i + 1}</span></td>
      <td>${escapeHtml(x.filial)}</td>
      <td class="num">${brl(x.realFat)}</td>
      <td class="num">${brl(x.metaMesFat)}</td>
      <td class="num">${pct(x.pctFat)}</td>
      <td class="num">${brl(x.projFat)}</td>
      <td class="num">${tons(x.realTon)}</td>
      <td class="num">${tons(x.metaMesTon)}</td>
      <td class="num">${pct(x.pctTon)}</td>
      <td><span class="pill ${x.nivel}">${escapeHtml(x.tendencia)}</span></td>
      <td><span class="pill ${x.nivel}">${x.nivel === "ok" ? "Ritmo bom" : x.nivel === "bad" ? "Abaixo do esperado" : "Atenção"}</span></td>
    </tr>
  `).join("");
}

// ==========================================
// CHARTS
// ==========================================

function destroyChart(chart) {
  if (chart && typeof chart.destroy === "function") {
    chart.destroy();
  }
}

function renderCharts(base) {
  if (typeof Chart === "undefined") return;

  const labels = base.map((x) => x.filial);
  const fatMeta = base.map((x) => x.metaMesFat);
  const fatReal = base.map((x) => x.realFat);
  const tonMeta = base.map((x) => x.metaMesTon);
  const tonReal = base.map((x) => x.realTon);
  const projMeta = base.map((x) => x.metaMesFat);
  const projReal = base.map((x) => x.projFat);

  const options = {
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

  const fatEl = $("graficoFaturamento");
  if (fatEl) {
    destroyChart(charts.faturamento);
    charts.faturamento = new Chart(fatEl, {
      type: "bar",
      data: {
        labels,
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
      options
    });
  }

  const tonEl = $("graficoTon");
  if (tonEl) {
    destroyChart(charts.ton);
    charts.ton = new Chart(tonEl, {
      type: "bar",
      data: {
        labels,
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
      options
    });
  }

  const projEl = $("graficoProjecao");
  if (projEl) {
    destroyChart(charts.projecao);
    charts.projecao = new Chart(projEl, {
      type: "bar",
      data: {
        labels,
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
      options
    });
  }
}

// ==========================================
// META
// ==========================================

function limparFormMeta() {
  STATE.editMetaId = "";
  setValue("metaFilial", STATE.filtroFilial || "");
  setValue("metaAno", STATE.filtroAno || getAnoMesAtual().ano);
  setValue("metaMes", STATE.filtroMes || getAnoMesAtual().mes);
  setValue("metaDiaFat", "");
  setValue("metaMesFat", "");
  setValue("metaAnoFat", "");
  setValue("metaDiaTon", "");
  setValue("metaMesTon", "");
  setValue("metaAnoTon", "");
}

function preencherMetaExistenteSeHouver() {
  const filial = upper(getValue("metaFilial"));
  const ano = Number(getValue("metaAno"));
  const mes = Number(getValue("metaMes"));

  if (!filial || !ano || !mes) {
    STATE.editMetaId = "";
    return;
  }

  const meta = DB.metas.find((x) =>
    x.filial === filial &&
    Number(x.ano) === Number(ano) &&
    Number(x.mes) === Number(mes)
  );

  if (!meta) {
    STATE.editMetaId = "";
    setValue("metaDiaFat", "");
    setValue("metaMesFat", "");
    setValue("metaAnoFat", "");
    setValue("metaDiaTon", "");
    setValue("metaMesTon", "");
    setValue("metaAnoTon", "");
    return;
  }

  STATE.editMetaId = meta.id;
  setValue("metaDiaFat", meta.metaDiaFat || "");
  setValue("metaMesFat", meta.metaMesFat || "");
  setValue("metaAnoFat", meta.metaAnoFat || "");
  setValue("metaDiaTon", meta.metaDiaTon || "");
  setValue("metaMesTon", meta.metaMesTon || "");
  setValue("metaAnoTon", meta.metaAnoTon || "");
}

async function salvarMeta() {
  try {
    const payload = {
      filial: upper(getValue("metaFilial")),
      ano: Number(getValue("metaAno")),
      mes: Number(getValue("metaMes")),
      metaDiaFat: num(getValue("metaDiaFat")),
      metaMesFat: num(getValue("metaMesFat")),
      metaAnoFat: num(getValue("metaAnoFat")),
      metaDiaTon: num(getValue("metaDiaTon")),
      metaMesTon: num(getValue("metaMesTon")),
      metaAnoTon: num(getValue("metaAnoTon"))
    };

    if (!payload.filial) throw new Error("Informe a filial.");
    if (!payload.ano) throw new Error("Informe o ano.");
    if (!payload.mes) throw new Error("Informe o mês.");

    let existing = DB.metas.find((x) =>
      x.filial === payload.filial &&
      Number(x.ano) === Number(payload.ano) &&
      Number(x.mes) === Number(payload.mes)
    );

    if (STATE.editMetaId) {
      const byId = DB.metas.find((x) => x.id === STATE.editMetaId);
      if (byId) existing = byId;
    }

    if (existing && existing.id) {
      await apiPost({
        action: "update_meta",
        id: existing.id,
        ...payload
      });
      setStatus("✅ Meta atualizada com sucesso.");
    } else {
      await apiPost({
        action: "add_meta",
        ...payload
      });
      setStatus("✅ Meta salva com sucesso.");
    }

    await loadAll();
    renderMetaTable();
    ativarPainel("meta");
  } catch (err) {
    console.error(err);
    setStatus(`❌ ${err.message}`, true);
  }
}

function renderMetaTable() {
  const tbody = $("tbodyMetas");
  if (!tbody) return;

  const lista = aplicarFiltrosMeta(DB.metas)
    .slice()
    .sort((a, b) => a.filial.localeCompare(b.filial, "pt-BR"));

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="emptyState">Nenhuma meta cadastrada para o período.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((x) => `
    <tr>
      <td>${escapeHtml(x.filial)}</td>
      <td>${x.ano}</td>
      <td>${x.mes}</td>
      <td class="num">${num(x.metaDiaFat).toLocaleString("pt-BR")}</td>
      <td class="num">${num(x.metaMesFat).toLocaleString("pt-BR")}</td>
      <td class="num">${num(x.metaAnoFat).toLocaleString("pt-BR")}</td>
      <td class="num">${num(x.metaDiaTon).toLocaleString("pt-BR")}</td>
      <td class="num">${num(x.metaMesTon).toLocaleString("pt-BR")}</td>
      <td class="num">${num(x.metaAnoTon).toLocaleString("pt-BR")}</td>
      <td>
        <button class="miniBtn edit" type="button" onclick="editarMetaById('${x.id}')">Editar</button>
      </td>
    </tr>
  `).join("");
}

function editarMetaById(id) {
  const x = DB.metas.find((m) => String(m.id) === String(id));
  if (!x) return;

  STATE.editMetaId = x.id;
  setValue("metaFilial", x.filial);
  setValue("metaAno", x.ano);
  setValue("metaMes", x.mes);
  setValue("metaDiaFat", x.metaDiaFat);
  setValue("metaMesFat", x.metaMesFat);
  setValue("metaAnoFat", x.metaAnoFat);
  setValue("metaDiaTon", x.metaDiaTon);
  setValue("metaMesTon", x.metaMesTon);
  setValue("metaAnoTon", x.metaAnoTon);

  ativarPainel("meta");
  const panel = $("panelMeta");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ==========================================
// LANÇAMENTO
// ==========================================

function limparFormLancamento() {
  STATE.editLancId = "";

  const hoje = getHoje();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");

  setValue("lancFilial", STATE.filtroFilial || "");
  setValue("lancData", `${yyyy}-${mm}-${dd}`);
  setValue("lancFaturamento", "");
  setValue("lancToneladas", "");
  setValue("lancCusto", "");
  setValue("lancObservacao", "");
}

async function salvarLancamento() {
  try {
    const payload = {
      filial: upper(getValue("lancFilial")),
      data: onlyText(getValue("lancData")),
      faturamento: num(getValue("lancFaturamento")),
      toneladas: num(getValue("lancToneladas")),
      custo: num(getValue("lancCusto")),
      observacao: onlyText(getValue("lancObservacao"))
    };

    if (!payload.filial) throw new Error("Informe a filial.");
    if (!payload.data) throw new Error("Informe a data.");
    if (!payload.faturamento && !payload.toneladas && !payload.custo) {
      throw new Error("Informe pelo menos faturamento, toneladas ou custo.");
    }

    await apiPost({
      action: "add_lancamento",
      ...payload
    });

    setStatus("✅ Lançamento salvo com sucesso.");
    await loadAll();
    renderLancamentosTable();
    limparFormLancamento();
    ativarPainel("lanc");
  } catch (err) {
    console.error(err);
    setStatus(`❌ ${err.message}`, true);
  }
}

function renderLancamentosTable() {
  const tbody = $("tbodyLancamentos");
  if (!tbody) return;

  const lista = aplicarFiltrosLancamento(DB.lancamentos)
    .slice()
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="emptyState">Nenhum lançamento cadastrado para o período.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((x) => `
    <tr>
      <td>${formatDateBR(x.data)}</td>
      <td>${escapeHtml(x.filial)}</td>
      <td>${x.ano}</td>
      <td>${x.mes}</td>
      <td class="num">${brl(x.faturamento)}</td>
      <td class="num">${tons(x.toneladas)}</td>
      <td class="num">${brl(x.custo)}</td>
      <td>${escapeHtml(x.observacao || "-")}</td>
      <td>-</td>
    </tr>
  `).join("");
}

// ==========================================
// EVENTOS
// ==========================================

function bindHeaderButtons() {
  $("btnIrMeta")?.addEventListener("click", () => {
    irParaPainel("meta");
  });

  $("btnIrLancamento")?.addEventListener("click", () => {
    irParaPainel("lanc");
  });

  $("btnAtualizar")?.addEventListener("click", () => {
    loadAll();
  });
}

function bindTabs() {
  $("tabMeta")?.addEventListener("click", () => {
    ativarPainel("meta");
  });

  $("tabLancamento")?.addEventListener("click", () => {
    ativarPainel("lanc");
  });
}

function bindFiltros() {
  $("filtroFilial")?.addEventListener("change", (e) => {
    STATE.filtroFilial = upper(e.target.value || "");
  });

  $("filtroAno")?.addEventListener("input", (e) => {
    STATE.filtroAno = onlyText(e.target.value || "");
  });

  $("filtroMes")?.addEventListener("input", (e) => {
    STATE.filtroMes = onlyText(e.target.value || "");
  });

  $("btnAplicarFiltros")?.addEventListener("click", () => {
    renderHome();
    renderMetaTable();
    renderLancamentosTable();
  });

  $("btnLimparFiltros")?.addEventListener("click", () => {
    const am = getAnoMesAtual();
    STATE.filtroFilial = "";
    STATE.filtroAno = String(am.ano);
    STATE.filtroMes = String(am.mes);

    setValue("filtroAno", STATE.filtroAno);
    setValue("filtroMes", STATE.filtroMes);
    if ($("filtroFilial")) $("filtroFilial").value = "";

    renderHome();
    renderMetaTable();
    renderLancamentosTable();
  });
}

function bindMetaEvents() {
  $("btnSalvarMeta")?.addEventListener("click", salvarMeta);
  $("btnLimparMeta")?.addEventListener("click", limparFormMeta);

  $("metaFilial")?.addEventListener("blur", preencherMetaExistenteSeHouver);
  $("metaAno")?.addEventListener("blur", preencherMetaExistenteSeHouver);
  $("metaMes")?.addEventListener("blur", preencherMetaExistenteSeHouver);
}

function bindLancamentoEvents() {
  $("btnSalvarLancamento")?.addEventListener("click", salvarLancamento);
  $("btnLimparLancamento")?.addEventListener("click", limparFormLancamento);
}

// ==========================================
// INIT
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    bindHeaderButtons();
    bindTabs();
    bindFiltros();
    bindMetaEvents();
    bindLancamentoEvents();

    const am = getAnoMesAtual();
    STATE.filtroAno = String(am.ano);
    STATE.filtroMes = String(am.mes);

    setValue("filtroAno", STATE.filtroAno);
    setValue("filtroMes", STATE.filtroMes);

    limparFormMeta();
    limparFormLancamento();

    ativarPainel("meta");

    renderHome();
    renderMetaTable();
    renderLancamentosTable();

    await loadAll();
  } catch (err) {
    console.error(err);
    setStatus(`❌ ${err.message}`, true);
  }
});
