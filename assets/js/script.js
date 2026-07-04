const API_URL = "https://script.google.com/macros/s/AKfycbzz4TBd-h-ywYBJTFJ0R_jKoAf84TJHcrMPlPRpz6rTzFcSBK3VRTKL20xoqAgBvVbjsA/exec";

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

function criarGrafico(id, tipo, labels, valores, horizontal = false) {
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
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      plugins: {
        legend: { display: tipo === "pie" }
      },
      scales: tipo === "pie" ? {} : {
        x: {
          beginAtZero: true
        }
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

  const local = agrupar(lista, campos.local, campos.contratada).slice(0, 10);
criarGrafico("graficoLocal", "bar", local.map(x => x[0]), local.map(x => x[1]), true);

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

const btnImportar = document.getElementById("btnImportar");
const inputExcel = document.getElementById("arquivoExcel");

btnImportar.addEventListener("click", () => {
  inputExcel.click();
});

inputExcel.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  btnImportar.textContent = "⏳ Lendo arquivo...";
  btnImportar.disabled = true;

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const primeiraAba = workbook.SheetNames[0];
    const sheet = workbook.Sheets[primeiraAba];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: ""
    });

    if (!rows.length) {
      alert("A planilha está vazia.");
      return;
    }

    btnImportar.textContent = "⏳ Importando...";

    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ rows })
    });

    const resultado = await resposta.json();

    if (!resultado.ok) {
      alert("Erro na importação: " + resultado.message);
      return;
    }

    alert(`Importação concluída!\nLinhas importadas: ${resultado.linhas}`);

    dados = rows;

    limparFiltros();
    preencherFiltro("filtroFilial", campos.filial);
    preencherFiltro("filtroProduto", campos.produto);
    preencherFiltro("filtroUF", campos.uf);
    preencherFiltro("filtroLocal", campos.local);

    atualizar();

  } catch (error) {
    alert("Erro ao importar arquivo: " + error.message);
  } finally {
    btnImportar.textContent = "📂 Importar Excel";
    btnImportar.disabled = false;
    inputExcel.value = "";
  }
});

function limparFiltros() {
  ["filtroFilial", "filtroProduto", "filtroUF", "filtroLocal"].forEach(id => {
    const select = document.getElementById(id);
    select.innerHTML = select.options[0].outerHTML;
  });
}
