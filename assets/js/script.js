const API_URL = "https://script.google.com/macros/s/AKfycbzX58pfe0ihVk3RtZ1C1IMbKwlahOBeP7518XEywv-A5V0ELzwyiUfFXir-EtvEyWZKkQ/exec";

let dados = [];
let charts = {};

const campos = {
  produto: "NomeProduto",
  filial: "NomeFilial",
  local: "Local Embarque",
  uf: "UF",
  contratada: "Qtd Contratada",
  faturada: "Qtd Faturada",
  restante: "Qtd Restante",
  contrato: "AS400 Contrato",
  data: "DataMaximaEntrega Hierarchy - Data Entrega"
};

function numero(valor) {
  if (!valor) return 0;
  return Number(String(valor).replace(/\./g, "").replace(",", ".")) || 0;
}

function moedaTon(valor) {
  return numero(valor).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " t";
}

function preencherFiltro(id, campo) {
  const el = document.getElementById(id);
  const valores = [...new Set(dados.map(x => x[campo]).filter(Boolean))].sort();

  valores.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
}

function dadosFiltrados() {
  return dados.filter(x => {
    const filial = document.getElementById("filtroFilial").value;
    const produto = document.getElementById("filtroProduto").value;
    const uf = document.getElementById("filtroUF").value;
    const local = document.getElementById("filtroLocal").value;

    return (!filial || x[campos.filial] === filial)
      && (!produto || x[campos.produto] === produto)
      && (!uf || x[campos.uf] === uf)
      && (!local || x[campos.local] === local);
  });
}

function agrupar(lista, campo, valorCampo) {
  const mapa = {};

  lista.forEach(item => {
    const chave = item[campo] || "Não informado";
    mapa[chave] = (mapa[chave] || 0) + numero(item[valorCampo]);
  });

  return Object.entries(mapa)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
}

function criarGrafico(id, tipo, labels, valores) {
  if (charts[id]) charts[id].destroy();

  charts[id] = new Chart(document.getElementById(id), {
    type: tipo,
    data: {
      labels,
      datasets: [{
        data: valores,
        label: "Toneladas"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: tipo === "pie" }
      }
    }
  });
}

function atualizar() {
  const lista = dadosFiltrados();

  const contratada = lista.reduce((s, x) => s + numero(x[campos.contratada]), 0);
  const faturada = lista.reduce((s, x) => s + numero(x[campos.faturada]), 0);
  const restante = lista.reduce((s, x) => s + numero(x[campos.restante]), 0);
  const contratos = new Set(lista.map(x => x[campos.contrato]).filter(Boolean)).size;
  const viagens = Math.ceil(restante / 37);

  document.getElementById("totalContratada").textContent = moedaTon(contratada);
  document.getElementById("totalFaturada").textContent = moedaTon(faturada);
  document.getElementById("totalRestante").textContent = moedaTon(restante);
  document.getElementById("totalContratos").textContent = contratos;
  document.getElementById("totalViagens").textContent = viagens.toLocaleString("pt-BR");

  const filial = agrupar(lista, campos.filial, campos.contratada);
  criarGrafico("graficoFilial", "bar", filial.map(x => x[0]), filial.map(x => x[1]));

  const produto = agrupar(lista, campos.produto, campos.contratada);
  criarGrafico("graficoProduto", "pie", produto.map(x => x[0]), produto.map(x => x[1]));

  const local = agrupar(lista, campos.local, campos.contratada);
  criarGrafico("graficoLocal", "bar", local.map(x => x[0]), local.map(x => x[1]));

  const data = agrupar(lista, campos.data, campos.restante);
  criarGrafico("graficoData", "bar", data.map(x => x[0]), data.map(x => x[1]));

  montarTabela(lista);
}

function montarTabela(lista) {
  const linhas = agrupar(lista, campos.filial, campos.contratada);
  const tbody = document.getElementById("tabelaResumo");
  tbody.innerHTML = "";

  linhas.forEach(([filial]) => {
    const itens = lista.filter(x => (x[campos.filial] || "Não informado") === filial);
    const contratada = itens.reduce((s, x) => s + numero(x[campos.contratada]), 0);
    const faturada = itens.reduce((s, x) => s + numero(x[campos.faturada]), 0);
    const restante = itens.reduce((s, x) => s + numero(x[campos.restante]), 0);

    tbody.innerHTML += `
      <tr>
        <td>${filial}</td>
        <td>${moedaTon(contratada)}</td>
        <td>${moedaTon(faturada)}</td>
        <td>${moedaTon(restante)}</td>
        <td>${Math.ceil(restante / 37).toLocaleString("pt-BR")}</td>
      </tr>
    `;
  });
}

async function iniciar() {
  const resposta = await fetch(API_URL);
  dados = await resposta.json();

  preencherFiltro("filtroFilial", campos.filial);
  preencherFiltro("filtroProduto", campos.produto);
  preencherFiltro("filtroUF", campos.uf);
  preencherFiltro("filtroLocal", campos.local);

  document.querySelectorAll("select").forEach(select => {
    select.addEventListener("change", atualizar);
  });

  atualizar();
}

iniciar();
