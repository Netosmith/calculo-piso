const API = "https://script.google.com/macros/s/AKfycbybdYXsbNcEHCDznZwHL0SaJG-Y56GJ55Nq3DGCVjf8qmoRm-N1LgtrTV9A8Nprs83L/exec";

let metas = [];
let dados = [];

async function load(){
const res = await fetch(API + "?action=getAll");
const json = await res.json();

metas = json.metas;
dados = json.lancamentos;

processar();
}

function processar(){

const hoje = new Date();
const mesAtual = hoje.getMonth()+1;

let resumo = {};

dados.forEach(r=>{
const d = new Date(r.Data);
if(d.getMonth()+1 !== mesAtual) return;

if(!resumo[r.Filial]){
resumo[r.Filial] = {fat:0, ton:0, dias:0};
}

resumo[r.Filial].fat += Number(r.Faturamento);
resumo[r.Filial].ton += Number(r.Toneladas);
resumo[r.Filial].dias++;
});

let ranking = [];

metas.forEach(m=>{

const r = resumo[m.Filial] || {fat:0,ton:0,dias:0};

const perc = r.fat / m.MetaMesR$ * 100;

const diasMes = 30;
const projecao = (r.fat / r.dias) * diasMes;

ranking.push({
filial:m.Filial,
fat:r.fat,
meta:m.MetaMesR$,
perc,
projecao
});
});

ranking.sort((a,b)=>b.perc-a.perc);

renderRanking(ranking);
renderAlertas(ranking);
renderGrafico(ranking);
}

function renderRanking(r){
const el = document.getElementById("ranking");

el.innerHTML = r.map(x=>`
<div class="card">
<div>${x.filial}</div>
<div class="kpi">${x.perc.toFixed(1)}%</div>
<div>${x.fat.toLocaleString()}</div>
</div>
`).join('');
}

function renderAlertas(r){
const el = document.getElementById("alertas");

el.innerHTML = r.map(x=>{
if(x.perc < 70){
return `<div class="alert">⚠ ${x.filial} abaixo da meta</div>`;
}
if(x.projecao >= x.meta){
return `<div class="ok">🚀 ${x.filial} vai bater meta</div>`;
}
return `<div>${x.filial} em andamento</div>`;
}).join('');
}

function renderGrafico(r){

new Chart(document.getElementById("graficoFaturamento"),{
type:"bar",
data:{
labels:r.map(x=>x.filial),
datasets:[
{label:"Meta",data:r.map(x=>x.meta)},
{label:"Real",data:r.map(x=>x.fat)}
]
}
});

}

load();
