const API_URL = "https://script.google.com/macros/s/AKfycbwyvX-Yw6qvMKZmo0UPB54w13ULUQDo6DG4qMYLSjx3boiaQWTMcaExR0qMf_Y29qtI/exec";

let METAS = [];
let LANCAMENTOS = [];

let META_EDIT_ID = "";
let LANC_EDIT_ID = "";

let chartFat = null;
let chartTon = null;
let chartProj = null;

const $ = (id) => document.getElementById(id);

// ==============================
// HELPERS
// ==============================
function txt(v){ return String(v || "").trim(); }
function txtUp(v){ return txt(v).toUpperCase(); }

function num(v){
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function moeda(v){
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function numero(v, casas = 2){
  return Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function pct(v){
  return `${numero(v, 1)}%`;
}

function dataBR(iso){
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(msg, erro = false){
  const el = $("syncStatus");
  if (!el) return;
  el.textContent = msg;
  el.style.color = erro ? "#fca5a5" : "#93c5fd";
}

function abrirModal(id){
  const el = $(id);
  if (el) el.classList.add("isOpen");
}

function fecharModal(id){
  const el = $(id);
  if (el) el.classList.remove("isOpen");
}

// ==============================
// API
// ==============================
async function apiGet(action){
  const res = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Erro na requisição");
  return json;
}

async function apiPost(payload){
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Erro na requisição");
  return json;
}

// ==============================
// FILTROS
// ==============================
function getFiltros(){
  return {
    filial: txtUp($("filtroFilial")?.value),
    ano: txt($("filtroAno")?.value),
    mes: txt($("filtroMes")?.value)
  };
}

function preencherFiltroFilial(){
  const select = $("filtroFilial");
  if (!select) return;

  const atual = select.value;

  const filiais = [...new Set([
    ...METAS.map(x => txtUp(x.filial)),
    ...LANCAMENTOS.map(x => txtUp(x.filial))
  ])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML =
    `<option value="">Todas</option>` +
    filiais.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");

  if (filiais.includes(atual)) select.value = atual;
}

function metasFiltradas(){
  const { filial, ano, mes } = getFiltros();
  return METAS.filter(item => {
    if (filial && txtUp(item.filial) !== filial) return false;
    if (ano && String(item.ano || "") !== ano) return false;
    if (mes && String(item.mes || "") !== mes) return false;
    return true;
  });
}

function lancamentosFiltrados(){
  const { filial, ano, mes } = getFiltros();
  return LANCAMENTOS.filter(item => {
    if (filial && txtUp(item.filial) !== filial) return false;
    if (ano && String(item.ano || "") !== ano) return false;
    if (mes && String(item.mes || "") !== mes) return false;
    return true;
  });
}

// ==============================
// AGREGAÇÃO
// ==============================
function construirResumoPorFilial(){
  const metas = metasFiltradas();
  const lancs = lancamentosFiltrados();

  const mapa = new Map();

  metas.forEach(m => {
    const filial = txtUp(m.filial);
    if (!filial) return;

    if (!mapa.has(filial)) {
      mapa.set(filial, {
        filial,
        metaDiaFat: 0,
        metaMesFat: 0,
        metaAnoFat: 0,
        metaDiaTon: 0,
        metaMesTon: 0,
        metaAnoTon: 0,
        fatReal: 0,
        tonReal: 0,
        custo: 0
      });
    }

    const row = mapa.get(filial);
    row.metaDiaFat += num(m.metaDiaFat);
    row.metaMesFat += num(m.metaMesFat);
    row.metaAnoFat += num(m.metaAnoFat);
    row.metaDiaTon += num(m.metaDiaTon);
    row.metaMesTon += num(m.metaMesTon);
    row.metaAnoTon += num(m.metaAnoTon);
  });

  lancs.forEach(l => {
    const filial = txtUp(l.filial);
    if (!filial) return;

    if (!mapa.has(filial)) {
      mapa.set(filial, {
        filial,
        metaDiaFat: 0,
        metaMesFat: 0,
        metaAnoFat: 0,
        metaDiaTon: 0,
        metaMesTon: 0,
        metaAnoTon: 0,
        fatReal: 0,
        tonReal: 0,
        custo: 0
      });
    }

    const row = mapa.get(filial);
    row.fatReal += num(l.faturamento);
    row.tonReal += num(l.toneladas);
    row.custo += num(l.custo);
  });

  return [...mapa.values()].sort((a, b) => b.fatReal - a.fatReal);
}

// ==============================
// KPIs
// ==============================
function renderKPIs(){
  const lancs = lancamentosFiltrados();

  const fat = lancs.reduce((s, x) => s + num(x.faturamento), 0);
  const ton = lancs.reduce((s, x) => s + num(x.toneladas), 0);
  const custo = lancs.reduce((s, x) => s + num(x.custo), 0);
  const custoTon = ton > 0 ? custo / ton : 0;

  $("kpiFatReal").textContent = moeda(fat);
  $("kpiTonReal").textContent = numero(ton);
  $("kpiCusto").textContent = moeda(custo);
  $("kpiCustoTon").textContent = moeda(custoTon);
}

// ==============================
// GRÁFICOS
// ==============================
function destruirCharts(){
  if (chartFat) chartFat.destroy();
  if (chartTon) chartTon.destroy();
  if (chartProj) chartProj.destroy();
}

function renderCharts(){
  destruirCharts();

  const base = construirResumoPorFilial();
  const labels = base.map(x => x.filial);
  const metaFat = base.map(x => num(x.metaMesFat));
  const realFat = base.map(x => num(x.fatReal));
  const metaTon = base.map(x => num(x.metaMesTon));
  const realTon = base.map(x => num(x.tonReal));

  const hoje = new Date();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diaAtual = Math.max(1, hoje.getDate());

  const projFat = base.map(x => (num(x.fatReal) / diaAtual) * diasNoMes);
  const metaProjFat = base.map(x => num(x.metaMesFat));

  chartFat = new Chart($("graficoFaturamento"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "META", data: metaFat, backgroundColor: "rgba(59,130,246,.70)", borderColor: "rgba(59,130,246,1)", borderWidth: 1, borderRadius: 8 },
        { label: "ALCANÇADO", data: realFat, backgroundColor: "rgba(34,197,94,.60)", borderColor: "rgba(34,197,94,1)", borderWidth: 1, borderRadius: 8 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#e5e7eb", font: { weight: "700" } } } },
      scales: {
        x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,.05)" } },
        y: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,.05)" } }
      }
    }
  });

  chartTon = new Chart($("graficoTon"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "META", data: metaTon, backgroundColor: "rgba(59,130,246,.70)", borderColor: "rgba(59,130,246,1)", borderWidth: 1, borderRadius: 8 },
        { label: "ALCANÇADO", data: realTon, backgroundColor: "rgba(34,197,94,.60)", borderColor: "rgba(34,197,94,1)", borderWidth: 1, borderRadius: 8 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#e5e7eb", font: { weight: "700" } } } },
      scales: {
        x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,.05)" } },
        y: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,.05)" } }
      }
    }
  });

  chartProj = new Chart($("graficoProjecao"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "META", data: metaProjFat, backgroundColor: "rgba(59,130,246,.70)", borderColor: "rgba(59,130,246,1)", borderWidth: 1, borderRadius: 8 },
        { label: "PROJEÇÃO", data: projFat, backgroundColor: "rgba(245,158,11,.60)", borderColor: "rgba(245,158,11,1)", borderWidth: 1, borderRadius: 8 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#e5e7eb", font: { weight: "700" } } } },
      scales: {
        x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,.05)" } },
        y: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,.05)" } }
      }
    }
  });
}

// ==============================
// ALERTAS
// ==============================
function getClassePercentual(p){
  if (p >= 100) return "ok";
  if (p >= 70) return "warn";
  return "bad";
}

function getBadgeClasse(row){
  const p = row.metaMesFat > 0 ? (row.fatReal / row.metaMesFat) * 100 : 0;
  return getClassePercentual(p);
}

function getTendencia(row){
  const hoje = new Date();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diaAtual = Math.max(1, hoje.getDate());

  const projFat = (row.fatReal / diaAtual) * diasNoMes;
  const perc = row.metaMesFat > 0 ? (projFat / row.metaMesFat) * 100 : 0;

  if (perc >= 100) return "Meta encaminhada";
  if (perc >= 80) return "Atenção";
  return "Risco";
}

function renderAlertas(){
  const el = $("alertas");
  const base = construirResumoPorFilial();

  if (!base.length) {
    el.innerHTML = `<div class="emptyState">Sem dados para exibir.</div>`;
    return;
  }

  el.innerHTML = base.map(row => {
    const pFat = row.metaMesFat > 0 ? (row.fatReal / row.metaMesFat) * 100 : 0;
    const classe = getClassePercentual(pFat);

    return `
      <div class="alertItem ${classe}">
        ${escapeHtml(row.filial)} • Fat. ${pct(pFat)} da meta • ${escapeHtml(getTendencia(row))}
      </div>
    `;
  }).join("");
}

// =================
