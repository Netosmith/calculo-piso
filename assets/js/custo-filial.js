const API = "https://script.google.com/macros/s/AKfycbybdYXsbNcEHCDznZwHL0SaJG-Y56GJ55Nq3DGCVjf8qmoRm-N1LgtrTV9A8Nprs83L/exec";

let metas = [];
let dados = [];

let chartFat = null;
let chartTon = null;

// ==========================
// LOAD
// ==========================

async function load(){

  try{
    const res = await fetch(API + "?action=getAll");
    const json = await res.json();

    metas = json.metas || [];
    dados = json.lancamentos || [];

  }catch(e){
    console.warn("Erro ao carregar API, usando vazio");
    metas = [];
    dados = [];
  }

  processar();
}

// ==========================
// PROCESSAMENTO
// ==========================

function processar(){

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;

  let resumo = {};

  dados.forEach(r => {

    const d = new Date(r.Data || r.data);
    if(!d || isNaN(d)) return;

    if(d.getMonth() + 1 !== mesAtual) return;

    const filial = (r.Filial || r.filial || "").toUpperCase();

    if(!resumo[filial]){
      resumo[filial] = { fat:0, ton:0, dias:0 };
    }

    resumo[filial].fat += Number(r.Faturamento || r.faturamento || 0);
    resumo[filial].ton += Number(r.Toneladas || r.toneladas || 0);
    resumo[filial].dias++;
  });

  let ranking = [];

  metas.forEach(m => {

    const filial = (m.Filial || m.filial || "").toUpperCase();
    const r = resumo[filial] || { fat:0, ton:0, dias:0 };

    const meta = Number(m.MetaMesR$ || m.metaMesFat || 0);

    const perc = meta > 0 ? (r.fat / meta) * 100 : 0;

    const diasMes = 30;
    const projecao = r.dias > 0 ? (r.fat / r.dias) * diasMes : 0;

    ranking.push({
      filial,
      fat: r.fat,
      ton: r.ton,
      meta,
      perc,
      projecao
    });

  });

  ranking.sort((a,b)=>b.perc - a.perc);

  renderKPIs(ranking);
  renderRanking(ranking);
  renderAlertas(ranking);
  renderGrafico(ranking);
}

// ==========================
// KPI TOPO
// ==========================

function renderKPIs(r){

  const totalMeta = r.reduce((a,b)=>a + b.meta, 0);
  const totalFat = r.reduce((a,b)=>a + b.fat, 0);
  const totalTon = r.reduce((a,b)=>a + b.ton, 0);

  setText("kpiMetaFat", formatBRL(totalMeta));
  setText("kpiRealFat", formatBRL(totalFat));
  setText("kpiMetaTon", totalTon.toLocaleString() + " t");
  setText("kpiRealTon", totalTon.toLocaleString() + " t");
}

// ==========================
// RANKING
// ==========================

function renderRanking(r){

  const el = document.getElementById("ranking");

  if(!r.length){
    el.innerHTML = `<div class="emptyState">Sem dados ainda</div>`;
    return;
  }

  el.innerHTML = r.map(x => {

    let status = "warn";
    let label = "EM ANDAMENTO";

    if(x.perc >= 100){
      status = "ok";
      label = "META BATIDA";
    } else if(x.perc < 70){
      status = "alert";
      label = "ABAIXO";
    }

    return `
    <div class="rankingCard">
      <div class="rankingTop">
        <h3>${x.filial}</h3>
        <span class="badge ${status}">${label}</span>
      </div>

      <div class="metaLine">
        💰 ${formatBRL(x.fat)} / ${formatBRL(x.meta)}
      </div>

      <div class="metaLine">
        📦 ${x.ton.toLocaleString()} toneladas
      </div>

      <div class="metaLine">
        📈 ${x.perc.toFixed(1)}%
      </div>

      <div class="metaLine">
        🧠 Projeção: ${formatBRL(x.projecao)}
      </div>
    </div>
    `;

  }).join("");
}

// ==========================
// ALERTAS
// ==========================

function renderAlertas(r){

  const el = document.getElementById("alertas");

  if(!r.length){
    el.innerHTML = `<div class="emptyState">Sem dados ainda</div>`;
    return;
  }

  el.innerHTML = r.map(x => {

    if(x.perc < 70){
      return `<div class="alertItem alert">⚠ ${x.filial} abaixo da meta</div>`;
    }

    if(x.projecao >= x.meta){
      return `<div class="alertItem ok">🚀 ${x.filial} vai bater meta</div>`;
    }

    return `<div class="alertItem">📊 ${x.filial} em andamento</div>`;

  }).join("");
}

// ==========================
// GRÁFICOS
// ==========================

function renderGrafico(r){

  const labels = r.map(x => x.filial);

  // FATURAMENTO
  if(chartFat) chartFat.destroy();

  chartFat = new Chart(document.getElementById("graficoFaturamento"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label:"Meta", data:r.map(x=>x.meta) },
        { label:"Real", data:r.map(x=>x.fat) }
      ]
    }
  });

  // TONELADAS
  if(chartTon) chartTon.destroy();

  chartTon = new Chart(document.getElementById("graficoTon"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label:"Toneladas", data:r.map(x=>x.ton) }
      ]
    }
  });
}

// ==========================
// HELPERS
// ==========================

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function formatBRL(v){
  return Number(v || 0).toLocaleString("pt-BR", {
    style:"currency",
    currency:"BRL"
  });
}

// ==========================
// START
// ==========================

load();
