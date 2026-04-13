
// ==========================================
// CUSTO / FILIAL - NOVA FROTA
// Ajustado para custo-filial.html enviado
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbwyvX-Yw6qvMKZmo0UPB54w13ULUQDo6DG4qMYLSjx3boiaQWTMcaExR0qMf_Y29qtI/exec";

let METAS = [];
let LANCAMENTOS = [];

let chartFat = null;
let chartTon = null;
let chartProj = null;

let META_EDIT_ID = "";
let LANC_EDIT_ID = "";

// ==========================================
// HELPERS
// ==========================================

const $ = (id) => document.getElementById(id);

function texto(v) {
  return String(v || "").trim();
}

function textoUpper(v) {
  return texto(v).toUpperCase();
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function moeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function numero(v, casas = 0) {
  return Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function percentual(v) {
  return `${Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(msg, erro = false) {
  const el = $("syncStatus");
  if (!el) return;
  el.textContent = msg;
  el.style.color = erro ? "#fca5a5" : "#93c5fd";
}

function hojeInfo() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const dia = agora.getDate();
  const diasNoMes = new Date(ano, mes, 0).getDate();
  return { ano, mes, dia, diasNoMes };
}

function abrirModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add("isOpen");
  el.setAttribute("aria-hidden", "false");
}

function fecharModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("isOpen");
  el.setAttribute("aria-hidden", "true");
}

function fecharTodosModais() {
  document.querySelectorAll(".modal").forEach((m) => {
    m.classList.remove("isOpen");
    m.setAttribute("aria-hidden", "true");
  });
}

function tendenciaClasse(pct) {
  if (pct >= 100) return "ok";
  if (pct >= 75) return "warn";
  return "bad";
}

function tendenciaTexto(pct) {
  if (pct >= 100) return "META BATIDA";
  if (pct >= 75) return "NO RITMO";
  return "ABAIXO";
}

function alertaTexto(pct) {
  if (pct >= 100) return "Operação acima da meta";
  if (pct >= 75) return "Acompanhar ritmo";
  return "Precisa reação imediata";
}

function daysProjection(realAcumulado, diaAtual) {
  if (!diaAtual || diaAtual <= 0) return 0;
  return (realAcumulado / diaAtual) * hojeInfo().diasNoMes;
}

function normalizarFilial(v) {
  return textoUpper(v);
}

// ==========================================
// API
// ==========================================

async function apiGet(action) {
  const url = `${API_URL}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error || "Erro ao consultar dados");
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
    throw new Error(json.error || "Erro ao salvar dados");
  }

  return json;
}

// ==========================================
// DATA LOAD
// ==========================================

async function carregarDados() {
  try {
    setStatus("🔄 Carregando dados...");
    const json = await apiGet("getAll");

    METAS = Array.isArray(json.metas) ? json.metas : [];
    LANCAMENTOS = Array.isArray(json.lancamentos) ? json.lancamentos : [];

    renderTudo();
    setStatus("✅ Dados atualizados com sucesso.");
  } catch (err) {
    console.error(err);
    setStatus(`❌ ${err.message}`, true);
  }
}

// ==========================================
// PROCESSAMENTO
// ==========================================

function metasMesAtual() {
  const { ano, mes } = hojeInfo();
  return METAS.filter(m =>
    String(m.ano) === String(ano) &&
    String(m.mes) === String(mes)
  );
}

function lancamentosMesAtual() {
  const { ano, mes } = hojeInfo();
  return LANCAMENTOS.filter(l =>
    String(l.ano) === String(ano) &&
    String(l.mes) === String(mes)
  );
}

function agruparPainelFiliais() {
  const metasAtuais = metasMesAtual();
  const lancsAtuais = lancamentosMesAtual();
  const { dia } = hojeInfo();

  const map = {};

  metasAtuais.forEach(m => {
    const filial = normalizarFilial(m.filial);
    if (!filial) return;

    if (!map[filial]) {
      map[filial] = {
        filial,
        metaId: "",
        fatReal: 0,
        tonReal: 0,
        metaFat: 0,
        metaTon: 0,
        projFat: 0,
        projTon: 0,
        pctFat: 0,
        pctTon: 0
      };
    }

    map[filial].metaId = m.id || "";
    map[filial].metaFat += num(m.metaMesFat);
    map[filial].metaTon += num(m.metaMesTon);
  });

  lancsAtuais.forEach(l => {
    const filial = normalizarFilial(l.filial);
    if (!filial) return;

    if (!map[filial]) {
      map[filial] = {
        filial,
        metaId: "",
        fatReal: 0,
        tonReal: 0,
        metaFat: 0,
        metaTon: 0,
        projFat: 0,
        projTon: 0,
        pctFat: 0,
        pctTon: 0
      };
    }

    map[filial].fatReal += num(l.faturamento);
    map[filial].tonReal += num(l.toneladas);
  });

  const lista = Object.values(map).map(item => {
    const pctFat = item.metaFat > 0 ? (item.fatReal / item.metaFat) * 100 : 0;
    const pctTon = item.metaTon > 0 ? (item.tonReal / item.metaTon) * 100 : 0;
    const projFat = daysProjection(item.fatReal, dia);
    const projTon = daysProjection(item.tonReal, dia);

    return {
      ...item,
      pctFat,
      pctTon,
      projFat,
      projTon,
      tendencia: tendenciaTexto(pctFat),
      tendenciaClass: tendenciaClasse(pctFat),
      alerta: alertaTexto(pctFat)
    };
  });

  lista.sort((a, b) => b.pctFat - a.pctFat);
  return lista;
}

// ==========================================
// KPI
// ==========================================

function renderKPIs(lista) {
  const filiaisMonitoradas = lista.filter(x => x.metaFat > 0 || x.metaTon > 0).length;
  const fatReal = lista.reduce((s, x) => s + x.fatReal, 0);
  const tonReal = lista.reduce((s, x) => s + x.tonReal, 0);
  const metaBatida = lista.filter(x => x.projFat >= x.metaFat && x.metaFat > 0).length;

  if ($("kpiFiliais")) $("kpiFiliais").textContent = numero(filiaisMonitoradas, 0);
  if ($("kpiFatReal")) $("kpiFatReal").textContent = moeda(fatReal);
  if ($("kpiTonReal")) $("kpiTonReal").textContent = `${numero(tonReal, 0)} t`;
  if ($("kpiMetaBatida")) $("kpiMetaBatida").textContent = numero(metaBatida, 0);
}

// ==========================================
// ALERTAS
// ==========================================

function renderAlertas(lista) {
  const el = $("alertas");
  if (!el) return;

  if (!lista.length) {
    el.innerHTML = `<div class="emptyState">Sem dados para exibir alertas.</div>`;
    return;
  }

  const itens = lista
    .slice()
    .sort((a, b) => a.pctFat - b.pctFat)
    .slice(0, 8);

  el.innerHTML = itens.map(item => `
    <div class="alertItem ${item.tendenciaClass}">
      <strong>${escapeHtml(item.filial)}</strong><br>
      ${escapeHtml(item.alerta)} · ${percentual(item.pctFat)} da meta de faturamento
    </div>
  `).join("");
}

// ==========================================
// RANKING
// ==========================================

function renderRanking(lista) {
  const tbody = $("ranking");
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11">
          <div class="emptyState">Nenhuma filial com dados neste mês.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map((item, idx) => `
    <tr>
      <td><span class="rankBadge">${idx + 1}</span></td>
      <td>
        <strong>${escapeHtml(item.filial)}</strong><br>
        <button
          type="button"
          style="margin-top:6px;padding:4px 8px;border:none;border-radius:8px;cursor:pointer;font-weight:800;"
          onclick="abrirMetaPorFilial('${String(item.metaId || "")}', '${escapeHtml(item.filial)}')"
        >
          Editar meta
        </button>
      </td>
      <td class="num">${moeda(item.fatReal)}</td>
      <td class="num">${moeda(item.metaFat)}</td>
      <td class="num">${percentual(item.pctFat)}</td>
      <td class="num">${moeda(item.projFat)}</td>
      <td class="num">${numero(item.tonReal, 0)}</td>
      <td class="num">${numero(item.metaTon, 0)}</td>
      <td class="num">${percentual(item.pctTon)}</td>
      <td><span class="pill ${item.tendenciaClass}">${escapeHtml(item.tendencia)}</span></td>
      <td>${escapeHtml(item.alerta)}</td>
    </tr>
  `).join("");
}

// ==========================================
// CHARTS
// ==========================================

function destruirGraficos() {
  if (chartFat) chartFat.destroy();
  if (chartTon) chartTon.destroy();
  if (chartProj) chartProj.destroy();
}

function renderGraficos(lista) {
  destruirGraficos();

  const labels = lista.map(x => x.filial);
  const fatReal = lista.map(x => x.fatReal);
  const fatMeta = lista.map(x => x.metaFat);
  const tonReal = lista.map(x => x.tonReal);
  const tonMeta = lista.map(x => x.metaTon);
  const projFat = lista.map(x => x.projFat);

  const ctxFat = $("graficoFaturamento");
  const ctxTon = $("graficoTon");
  const ctxProj = $("graficoProjecao");

  if (ctxFat) {
    chartFat = new Chart(ctxFat, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Faturamento Real",
            data: fatReal,
            backgroundColor: "rgba(59,130,246,0.75)",
            borderColor: "rgba(59,130,246,1)",
            borderWidth: 1
          },
          {
            label: "Meta Mensal",
            data: fatMeta,
            backgroundColor: "rgba(34,197,94,0.55)",
            borderColor: "rgba(34,197,94,1)",
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#e5e7eb" }
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
      }
    });
  }

  if (ctxTon) {
    chartTon = new Chart(ctxTon, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Toneladas Reais",
            data: tonReal,
            backgroundColor: "rgba(245,158,11,0.70)",
            borderColor: "rgba(245,158,11,1)",
            borderWidth: 1
          },
          {
            label: "Meta Mensal",
            data: tonMeta,
            backgroundColor: "rgba(139,92,246,0.55)",
            borderColor: "rgba(139,92,246,1)",
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#e5e7eb" }
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
      }
    });
  }

  if (ctxProj) {
    chartProj = new Chart(ctxProj, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Projeção de Faturamento",
            data: projFat,
            backgroundColor: "rgba(34,197,94,0.75)",
            borderColor: "rgba(34,197,94,1)",
            borderWidth: 1
          },
          {
            label: "Meta Mensal",
            data: fatMeta,
            backgroundColor: "rgba(239,68,68,0.45)",
            borderColor: "rgba(239,68,68,1)",
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#e5e7eb" }
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
      }
    });
  }
}

// ==========================================
// META
// ==========================================

function limparModalMeta() {
  META_EDIT_ID = "";
  if ($("metaFilial")) $("metaFilial").value = "";
  if ($("metaFat")) $("metaFat").value = "";
  if ($("metaTon")) $("metaTon").value = "";
}

function buscarMetaAtualPorFilial(filial) {
  const { ano, mes } = hojeInfo();
  return METAS.find(m =>
    normalizarFilial(m.filial) === normalizarFilial(filial) &&
    String(m.ano) === String(ano) &&
    String(m.mes) === String(mes)
  ) || null;
}

function abrirMetaPorFilial(metaId, filial) {
  const nomeFilial = textoUpper(filial);
  const meta = buscarMetaAtualPorFilial(nomeFilial);

  META_EDIT_ID = meta?.id || metaId || "";

  if ($("metaFilial")) $("metaFilial").value = nomeFilial;
  if ($("metaFat")) $("metaFat").value = meta?.metaMesFat || "";
  if ($("metaTon")) $("metaTon").value = meta?.metaMesTon || "";

  abrirModal("modalMeta");
}

async function salvarMeta() {
  try {
    const filial = textoUpper($("metaFilial")?.value);
    const metaMesFat = num($("metaFat")?.value);
    const metaMesTon = num($("metaTon")?.value);

    if (!filial) {
      throw new Error("Informe a filial.");
    }

    const { ano, mes, diasNoMes } = hojeInfo();

    const payload = {
      filial,
      ano,
      mes,
      metaDiaFat: metaMesFat / diasNoMes,
      metaMesFat,
      metaAnoFat: metaMesFat * 12,
      metaDiaTon: metaMesTon / diasNoMes,
      metaMesTon,
      metaAnoTon: metaMesTon * 12
    };

    const metaExistente = buscarMetaAtualPorFilial(filial);

    if (META_EDIT_ID || metaExistente?.id) {
      await apiPost({
        action: "update_meta",
        id: META_EDIT_ID || metaExistente.id,
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

    limparModalMeta();
    fecharModal("modalMeta");
    await carregarDados();
  } catch (err) {
    console.error(err);
    setStatus(`❌ ${err.message}`, true);
  }
}

// ==========================================
// LANÇAMENTO
// ==========================================

function limparModalLanc() {
  LANC_EDIT_ID = "";
  if ($("lancFilial")) $("lancFilial").value = "";
  if ($("lancData")) $("lancData").value = "";
  if ($("lancFat")) $("lancFat").value = "";
  if ($("lancTon")) $("lancTon").value = "";
}

async function salvarLancamento() {
  try {
    const filial = textoUpper($("lancFilial")?.value);
    const data = texto($("lancData")?.value);
    const faturamento = num($("lancFat")?.value);
    const toneladas = num($("lancTon")?.value);

    if (!filial) throw new Error("Informe a filial.");
    if (!data) throw new Error("Informe a data.");

    const payload = {
      filial,
      data,
      faturamento,
      toneladas,
      custo: 0,
      observacao: ""
    };

    if (LANC_EDIT_ID) {
      await apiPost({
        action: "update_lancamento",
        id: LANC_EDIT_ID,
        ...payload
      });
      setStatus("✅ Produção atualizada com sucesso.");
    } else {
      await apiPost({
        action: "add_lancamento",
        ...payload
      });
      setStatus("✅ Produção lançada com sucesso.");
    }

    limparModalLanc();
    fecharModal("modalLanc");
    await carregarDados();
  } catch (err) {
    console.error(err);
    setStatus(`❌ ${err.message}`, true);
  }
}

// ==========================================
// RENDER GERAL
// ==========================================

function renderTudo() {
  const lista = agruparPainelFiliais();
  renderKPIs(lista);
  renderAlertas(lista);
  renderRanking(lista);
  renderGraficos(lista);
}

// ==========================================
// EVENTOS
// ==========================================

function bindEventos() {
  if ($("btnNovaMeta")) {
    $("btnNovaMeta").addEventListener("click", () => {
      limparModalMeta();
      abrirModal("modalMeta");
    });
  }

  if ($("btnNovoLancamento")) {
    $("btnNovoLancamento").addEventListener("click", () => {
      limparModalLanc();
      abrirModal("modalLanc");
    });
  }

  if ($("btnAtualizar")) {
    $("btnAtualizar").addEventListener("click", carregarDados);
  }

  if ($("btnSalvarMeta")) {
    $("btnSalvarMeta").addEventListener("click", salvarMeta);
  }

  if ($("btnSalvarLancamento")) {
    $("btnSalvarLancamento").addEventListener("click", salvarLancamento);
  }

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-close");
      fecharModal(id);
    });
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("isOpen");
        modal.setAttribute("aria-hidden", "true");
      }
    });
  });
}

// ==========================================
// INIT
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  bindEventos();
  await carregarDados();
});

// expõe para uso inline no ranking
window.abrirMetaPorFilial = abrirMetaPorFilial;
