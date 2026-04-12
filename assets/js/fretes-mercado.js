const API = "https://script.google.com/macros/s/AKfycbybdYXsbNcEHCDznZwHL0SaJG-Y56GJ55Nq3DGCVjf8qmoRm-N1LgtrTV9A8Nprs83L/exec";

const REGIOES = [
"TIUB/TIA",
"SANTOS",
"PARANAGUA",
"CHAP SUL",
"RIO VERDE",
"SAO SIMAO"
];

let dados = [];

async function load(){
const res = await fetch(API);
dados = await res.json();
render();
}

function render(){

const container = document.getElementById("tabela");

container.innerHTML = REGIOES.map(r=>{
const linhas = dados.filter(d=>d.REGIAO === r);

return `
<div class="regiao">
<h3>${r}</h3>

<div class="row">
<b>Base</b>
<b>Frete</b>
<b>Oferta</b>
</div>

${linhas.map(l=>`
<div class="row">
<input value="${l.BASE}" readonly>
<input type="number" value="${l.FRETE || ''}">
<select>
<option ${l.TENDENCIA=="Alta"?"selected":""}>Alta</option>
<option ${l.TENDENCIA=="Baixa"?"selected":""}>Baixa</option>
<option ${l.TENDENCIA=="Estável"?"selected":""}>Estável</option>
</select>
</div>
`).join('')}

</div>
`;
}).join('');
}

function salvar(){

const blocos = document.querySelectorAll(".regiao");

let envio = [];

blocos.forEach(b=>{
const regiao = b.querySelector("h3").innerText;

const rows = b.querySelectorAll(".row");

rows.forEach((r,i)=>{
if(i===0) return;

const inputs = r.querySelectorAll("input,select");

envio.push({
regiao,
base:inputs[0].value,
frete:inputs[1].value,
oferta:"",
tendencia:inputs[2].value
});
});
});

fetch(API,{
method:"POST",
body:JSON.stringify({action:"salvar",dados:envio})
});

alert("Salvo com sucesso 🚀");
}

function zerar(){
document.querySelectorAll("input[type=number]").forEach(i=>i.value="");
}

function printTela(){
html2canvas(document.body).then(canvas=>{
const link = document.createElement("a");
link.download="fretes.png";
link.href=canvas.toDataURL();
link.click();
});
}

load();
