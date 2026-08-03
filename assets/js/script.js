const PESO_MEDIO_VIAGEM = 37;
let dados = [];
let charts = {};

const campos = {
  contratoAS400: "AS400 Contrato",
  contratoSAP: "SAP Contrato",
  produto: "NomeProduto",
  incoterms: "Incoterms",
  fornecedor: "Fornecedor",
  endereco: "Endereço",
  local: "Endereço Embarque",
  contratada: "Qtd Contratada",
  faturada: "Qtd Faturada",
  recebida: "Qtd Recebida",
  data: "DataMaximaEntrega Hierarchy - Data Entrega",
  uf: "UF",
  filial: "NomeFilial"
};

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  let texto = String(valor).trim().replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
  if (!texto) return 0;
  const temVirgula = texto.includes(",");
  const temPonto = texto.includes(".");
  if (temVirgula && temPonto) {
    texto = texto.lastIndexOf(",") > texto.lastIndexOf(".") ? texto.replace(/\./g, "").replace(",", ".") : texto.replace(/,/g, "");
  } else if (temVirgula) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (temPonto) {
    const partes = texto.split(".");
    if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) texto = partes.join("");
  }
  const resultado = Number(texto);
  return Number.isFinite(resultado) ? resultado : 0;
}

function normalizarNumeroImportacao(valor) {
  if (valor === null || valor === undefined || valor === "") return "";

  // Quando o Excel armazena o dado como número, raw:true entrega o valor real.
  // Ex.: uma célula exibida como 1.200 chega aqui como 1200.
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : "";
  }

  let texto = String(valor)
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!texto) return "";

  const temVirgula = texto.includes(",");
  const temPonto = texto.includes(".");

  if (temVirgula && temPonto) {
    // Formato brasileiro: 1.250,75
    if (texto.lastIndexOf(",") > texto.lastIndexOf(".")) {
      texto = texto.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato internacional: 1,250.75
      texto = texto.replace(/,/g, "");
    }
  } else if (temVirgula) {
    // Vírgula sem ponto é tratada como separador decimal.
    texto = texto.replace(",", ".");
  } else if (temPonto) {
    const partes = texto.split(".");

    // Um único ponto seguido de exatamente três dígitos é milhar.
    // Ex.: "1.200" -> 1200.
    if (
      partes.length > 2 ||
      (partes.length === 2 && partes[1].length === 3)
    ) {
      texto = partes.join("");
    }
  }

  const resultado = Number(texto);
  return Number.isFinite(resultado) ? resultado : "";
}

function normalizarDataImportacao(valor) {
  if (valor === null || valor === undefined || valor === "") return "";

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const dia = String(valor.getDate()).padStart(2, "0");
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const ano = valor.getFullYear();

    return `${dia}/${mes}/${ano}`;
  }

  return String(valor).trim();
}

function restanteItem(item) {
  return Math.max(0, numero(item[campos.contratada]) - numero(item[campos.recebida]));
}

function normalizarTexto(valor) { return String(valor ?? "").trim(); }
function moedaTon(valor) { return numero(valor).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " t"; }
function percentual(valor, total) { return total ? Math.max(0, Math.min(100, (numero(valor) / numero(total)) * 100)) : 0; }

function formatarDataGrafico(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return "Não informado";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto;
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? texto : data.toLocaleDateString("pt-BR");
}

function atualizarStatus(mensagem) {
  const el = document.getElementById("statusMensagem");
  if (el) el.textContent = mensagem;
}

function definirTexto(id, valor) {
  const elemento = document.getElementById(id);

  if (!elemento) {
    console.warn(`Elemento não encontrado no HTML: #${id}`);
    return;
  }

  elemento.textContent = valor;
}

function atualizarCabecalho() {
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ultimaAtualizacao = document.getElementById("ultimaAtualizacao");
  const totalRegistros = document.getElementById("totalRegistros");
  if (ultimaAtualizacao) ultimaAtualizacao.textContent = hora;
  if (totalRegistros) totalRegistros.textContent = dados.length.toLocaleString("pt-BR");
}

function limparOpcoesFiltro(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const primeira = el.options[0];
  el.innerHTML = "";
  el.appendChild(primeira);
}

function preencherFiltro(id, campo) {
  const el = document.getElementById(id);
  if (!el) return;
  const valorAtual = el.value;
  const valores = [...new Set(dados.map(item => normalizarTexto(item[campo])).filter(Boolean))].sort((a,b) => a.localeCompare(b,"pt-BR"));
  valores.forEach(valor => {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = valor;
    el.appendChild(option);
  });
  if (valores.includes(valorAtual)) el.value = valorAtual;
}

function reconstruirFiltros() {
  [["filtroFilial",campos.filial],["filtroProduto",campos.produto],["filtroUF",campos.uf],["filtroLocal",campos.local]].forEach(([id,campo]) => {
    limparOpcoesFiltro(id);
    preencherFiltro(id,campo);
  });
}

function dadosFiltrados() {
  const filial = document.getElementById("filtroFilial")?.value || "";
  const produto = document.getElementById("filtroProduto")?.value || "";
  const uf = document.getElementById("filtroUF")?.value || "";
  const local = document.getElementById("filtroLocal")?.value || "";
  return dados.filter(item => (!filial || normalizarTexto(item[campos.filial]) === filial) && (!produto || normalizarTexto(item[campos.produto]) === produto) && (!uf || normalizarTexto(item[campos.uf]) === uf) && (!local || normalizarTexto(item[campos.local]) === local));
}

function agrupar(lista, campo, seletorValor, limite = 12) {
  const mapa = new Map();
  lista.forEach(item => {
    const chave = normalizarTexto(item[campo]) || "Não informado";
    const valor = typeof seletorValor === "function" ? numero(seletorValor(item)) : numero(item[seletorValor]);
    mapa.set(chave, (mapa.get(chave) || 0) + valor);
  });
  return [...mapa.entries()].sort((a,b) => b[1] - a[1]).slice(0,limite);
}

function corGrafico(indice) {
  const cores = ["rgba(79,141,247,.88)","rgba(52,189,131,.88)","rgba(242,185,53,.88)","rgba(155,110,229,.88)","rgba(242,140,69,.88)","rgba(89,194,219,.88)","rgba(238,106,145,.88)","rgba(132,205,95,.88)","rgba(115,143,242,.88)","rgba(231,168,93,.88)","rgba(104,199,165,.88)","rgba(183,126,224,.88)"];
  return cores[indice % cores.length];
}

function criarGrafico(id, tipo, labels, valores, horizontal = false) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) charts[id].destroy();
  const isPizza = tipo === "doughnut" || tipo === "pie";
  charts[id] = new Chart(canvas, {
    type: tipo,
    data: { labels, datasets: [{ label:"Toneladas", data:valores, backgroundColor:isPizza ? labels.map((_,i)=>corGrafico(i)) : "rgba(79,141,247,.78)", borderColor:isPizza ? labels.map((_,i)=>corGrafico(i)) : "rgba(79,141,247,1)", borderWidth:1, borderRadius:isPizza?0:8, maxBarThickness:42 }] },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive:true,
      maintainAspectRatio:false,
      animation:{duration:650},
      interaction:{mode:"index",intersect:false},
      plugins:{
        legend:{display:isPizza,position:"bottom",labels:{color:"#c8d6e7",boxWidth:12,boxHeight:12,padding:16,font:{family:"Inter"}}},
        tooltip:{backgroundColor:"rgba(5,18,35,.96)",titleColor:"#fff",bodyColor:"#dbe7f4",borderColor:"rgba(133,171,218,.26)",borderWidth:1,padding:12,callbacks:{label(context){return ` ${numero(context.raw).toLocaleString("pt-BR",{maximumFractionDigits:0})} t`;}}}
      },
      scales:isPizza?{}:{
        x:{beginAtZero:true,grid:{color:"rgba(164,193,226,.08)"},ticks:{color:"#9fb2c9",callback(value){return Number(value).toLocaleString("pt-BR");}}},
        y:{beginAtZero:true,grid:{color:"rgba(164,193,226,.08)"},ticks:{color:"#c5d3e3",autoSkip:false}}
      }
    }
  });
}

function atualizar() {
  const lista = dadosFiltrados();
  const contratada = lista.reduce((t,i)=>t+numero(i[campos.contratada]),0);
  const recebida = lista.reduce((t,i)=>t+numero(i[campos.recebida]),0);
  const restante = lista.reduce((t,i)=>t+restanteItem(i),0);
  const contratos = new Set(lista.map(i=>normalizarTexto(i[campos.contratoAS400])).filter(Boolean)).size;
  const viagens = Math.ceil(restante / PESO_MEDIO_VIAGEM);

  definirTexto("totalContratada", moedaTon(contratada));
  definirTexto("totalRecebida", moedaTon(recebida));
  definirTexto("totalRestante", moedaTon(restante));
  definirTexto("totalContratos", contratos.toLocaleString("pt-BR"));
  definirTexto("totalViagens", viagens.toLocaleString("pt-BR"));

  const porFilial = agrupar(lista,campos.filial,campos.contratada);
  criarGrafico("graficoFilial","bar",porFilial.map(x=>x[0]),porFilial.map(x=>x[1]));
  const porProduto = agrupar(lista,campos.produto,campos.contratada);
  criarGrafico("graficoProduto","doughnut",porProduto.map(x=>x[0]),porProduto.map(x=>x[1]));
  const porLocal = agrupar(lista,campos.local,campos.contratada,10);
  criarGrafico("graficoLocal","bar",porLocal.map(x=>x[0]),porLocal.map(x=>x[1]),true);
  const porData = agrupar(lista,campos.data,restanteItem,16).map(([data,valor])=>[formatarDataGrafico(data),valor]);
  criarGrafico("graficoData","bar",porData.map(x=>x[0]),porData.map(x=>x[1]));

  montarTabela(lista);
  atualizarStatus(`${lista.length.toLocaleString("pt-BR")} registros exibidos após os filtros.`);
  atualizarCabecalho();
}

function montarTabela(lista) {
  const tbody = document.getElementById("tabelaResumo");
  if (!tbody) return;
  tbody.innerHTML = "";
  const filiais = [...new Set(lista.map(i=>normalizarTexto(i[campos.filial])||"Não informado"))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  if (!filiais.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="emptyState">Nenhum registro encontrado para os filtros selecionados.</td></tr>';
    return;
  }
  filiais.forEach(filial => {
    const itens = lista.filter(i=>(normalizarTexto(i[campos.filial])||"Não informado")===filial);
    const contratada = itens.reduce((t,i)=>t+numero(i[campos.contratada]),0);
    const recebida = itens.reduce((t,i)=>t+numero(i[campos.recebida]),0);
    const restante = itens.reduce((t,i)=>t+restanteItem(i),0);
    const conclusao = percentual(recebida,contratada);
    const viagens = Math.ceil(restante/PESO_MEDIO_VIAGEM);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><strong>${filial}</strong></td><td>${moedaTon(contratada)}</td><td>${moedaTon(recebida)}</td><td>${moedaTon(restante)}</td><td class="progressCell"><div class="progressLine"><span style="width:${conclusao.toFixed(2)}%"></span></div><small class="progressText">${conclusao.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% recebido</small></td><td>${viagens.toLocaleString("pt-BR")}</td>`;
    tbody.appendChild(tr);
  });
}

function extrairDadosResposta(resultado) {
  if (Array.isArray(resultado)) return resultado;
  if (Array.isArray(resultado?.data)) return resultado.data;
  if (Array.isArray(resultado?.rows)) return resultado.rows;
  return [];
}

function iniciar() {
  dados = [];
  reconstruirFiltros();
  document.querySelectorAll(".filters select").forEach(select=>select.addEventListener("change",atualizar));
  atualizar();
  atualizarStatus("Importe uma planilha Excel para iniciar a análise local.");
}

function configurarImportacao() {
  const btnImportar = document.getElementById("btnImportar");
  const inputExcel = document.getElementById("arquivoExcel");

  if (!btnImportar || !inputExcel) {
    console.error("Elementos da importação não encontrados no HTML.");
    atualizarStatus("Erro de configuração: elementos de importação não encontrados.");
    return;
  }

  btnImportar.addEventListener("click", () => {
    inputExcel.click();
  });

  inputExcel.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    btnImportar.textContent = "⏳ Lendo arquivo...";
    btnImportar.disabled = true;

    try {
      const buffer = await file.arrayBuffer();

      // cellDates mantém datas como datas, enquanto raw:true preserva
      // os valores numéricos reais do Excel. Ex.: 1.200 continua 1200.
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true
      });

      const primeiraAba = workbook.SheetNames[0];
      const sheet = workbook.Sheets[primeiraAba];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: true
      });

      // Padroniza apenas as colunas numéricas antes de enviá-las à API.
      // Números reais vindos do Excel são mantidos sem alteração.
      const colunasNumericas = [
        campos.contratada,
        campos.faturada,
        campos.recebida
      ];

      rows.forEach(item => {
        colunasNumericas.forEach(coluna => {
          item[coluna] = normalizarNumeroImportacao(item[coluna]);
        });

        item[campos.data] = normalizarDataImportacao(item[campos.data]);
      });

      if (!rows.length) {
        throw new Error("A planilha está vazia.");
      }

      const obrigatorias = [
        campos.contratoAS400,
        campos.produto,
        campos.local,
        campos.contratada,
        campos.recebida,
        campos.data,
        campos.uf,
        campos.filial
      ];

      const encontradas = Object.keys(rows[0] || {});
      const ausentes = obrigatorias.filter(
        coluna => !encontradas.includes(coluna)
      );

      if (ausentes.length) {
        throw new Error(
          "Colunas não encontradas: " + ausentes.join(", ")
        );
      }

      btnImportar.textContent = "⏳ Processando...";

      dados = rows;
      reconstruirFiltros();
      atualizar();

      const linhasImportadas = rows.length;

      alert(
        `Importação local concluída!\nLinhas analisadas: ${linhasImportadas.toLocaleString("pt-BR")}`
      );

    } catch (erro) {
      console.error("Erro ao importar arquivo:", erro);
      alert("Erro ao importar arquivo: " + erro.message);
    } finally {
      btnImportar.textContent = "📂 Importar Excel";
      btnImportar.disabled = false;
      inputExcel.value = "";
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  configurarImportacao();
  iniciar();
});
