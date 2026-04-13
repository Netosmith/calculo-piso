// ==========================================
// CUSTO FILIAL - FRONT
// Ajustado para Apps Script novo
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbwyvX-Yw6qvMKZmo0UPB54w13ULUQDo6DG4qMYLSjx3boiaQWTMcaExR0qMf_Y29qtI/exec";

let METAS = [];
let LANCAMENTOS = [];

let META_EDIT_ID = "";
let LANC_EDIT_ID = "";

// ==========================================
// HELPERS
// ==========================================

const $ = (id) => document.getElementById(id);

function normalizarTexto(v) {
  return String(v || "").trim();
}

function normalizarTextoUpper(v) {
  return normalizarTexto(v).toUpperCase();
}

function toNumberBR(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;

  const s = String(v)
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function moedaBR(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function numeroBR(v, casas = 2) {
  return Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarDataISOparaBR(dataISO) {
  if (!dataISO) return "";
  const d = new Date(dataISO);
  if (isNaN(d.getTime())) return dataISO;
  return d.toLocaleDateString("pt-BR");
}

async function apiGet(action) {
  const url = `${API_URL}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error || "Erro na requisição GET");
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
    throw new Error(json.error || "Erro na requisição POST");
  }

  return json;
}

// ==========================================
// LOAD
// ==========================================

async function carregarTudoCustoFilial() {
  try {
    mostrarStatus("Carregando dados...");
    const json = await apiGet("getAll");

    METAS = Array.isArray(json.metas) ? json.metas : [];
    LANCAMENTOS = Array.isArray(json.lancamentos) ? json.lancamentos : [];

    renderMetas();
    renderLancamentos();
    renderResumo();
    preencherFiltrosFilial();

    mostrarStatus("Dados carregados.");
  } catch (err) {
    console.error(err);
    mostrarStatus(`Erro ao carregar: ${err.message}`, true);
  }
}

// ==========================================
// STATUS
// ==========================================

function mostrarStatus(msg, erro = false) {
  const el = $("custoFilialStatus");
  if (!el) return;
  el.textContent = msg;
  el.style.color = erro ? "#b91c1c" : "";
}

// ==========================================
// FILTROS
// ==========================================

function getFiltros() {
  return {
    filial: normalizarTextoUpper($("filtroFilial")?.value || ""),
    ano: normalizarTexto($("filtroAno")?.value || ""),
    mes: normalizarTexto($("filtroMes")?.value || "")
  };
}

function preencherFiltrosFilial() {
  const select = $("filtroFilial");
  if (!select) return;

  const atual = select.value;

  const filiais = [...new Set([
    ...METAS.map(x => normalizarTextoUpper(x.filial)),
    ...LANCAMENTOS.map(x => normalizarTextoUpper(x.filial))
  ])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML = `<option value="">Todas</option>` +
    filiais.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");

  if (filiais.includes(atual)) {
    select.value = atual;
  }
}

function aplicarFiltroLista(lista) {
  const { filial, ano, mes } = getFiltros();

  return lista.filter(item => {
    const okFilial = !filial || normalizarTextoUpper(item.filial) === filial;
    const okAno = !ano || String(item.ano || "") === String(ano);
    const okMes = !mes || String(item.mes || "") === String(mes);
    return okFilial && okAno && okMes;
  });
}

// ==========================================
// METAS
// ==========================================

function getMetaFormData() {
  return {
    id: META_EDIT_ID || "",
    filial: normalizarTextoUpper($("metaFilial")?.value),
    ano: normalizarTexto($("metaAno")?.value),
    mes: normalizarTexto($("metaMes")?.value),
    metaDiaFat: toNumberBR($("metaDiaFat")?.value),
    metaMesFat: toNumberBR($("metaMesFat")?.value),
    metaAnoFat: toNumberBR($("metaAnoFat")?.value),
    metaDiaTon: toNumberBR($("metaDiaTon")?.value),
    metaMesTon: toNumberBR($("metaMesTon")?.value),
    metaAnoTon: toNumberBR($("metaAnoTon")?.value)
  };
}

function validarMeta(data) {
  if (!data.filial) throw new Error("Informe a filial.");
  if (!data.ano) throw new Error("Informe o ano.");
  if (!data.mes) throw new Error("Informe o mês.");
}

async function salvarMeta() {
  try {
    const data = getMetaFormData();
    validarMeta(data);

    if (META_EDIT_ID) {
      await apiPost({
        action: "update_meta",
        ...data
      });
      mostrarStatus("Meta atualizada com sucesso.");
    } else {
      await apiPost({
        action: "add_meta",
        ...data
      });
      mostrarStatus("Meta cadastrada com sucesso.");
    }

    limparFormMeta();
    await carregarTudoCustoFilial();
  } catch (err) {
    console.error(err);
    mostrarStatus(err.message, true);
  }
}

function editarMeta(id) {
  const item = METAS.find(x => String(x.id) === String(id));
  if (!item) return;

  META_EDIT_ID = item.id;

  if ($("metaFilial")) $("metaFilial").value = item.filial || "";
  if ($("metaAno")) $("metaAno").value = item.ano || "";
  if ($("metaMes")) $("metaMes").value = item.mes || "";
  if ($("metaDiaFat")) $("metaDiaFat").value = item.metaDiaFat || "";
  if ($("metaMesFat")) $("metaMesFat").value = item.metaMesFat || "";
  if ($("metaAnoFat")) $("metaAnoFat").value = item.metaAnoFat || "";
  if ($("metaDiaTon")) $("metaDiaTon").value = item.metaDiaTon || "";
  if ($("metaMesTon")) $("metaMesTon").value = item.metaMesTon || "";
  if ($("metaAnoTon")) $("metaAnoTon").value = item.metaAnoTon || "";

  mostrarStatus("Editando meta.");
}

async function excluirMeta(id) {
  if (!confirm("Deseja excluir esta meta?")) return;

  try {
    await apiPost({
      action: "delete_meta",
      id
    });

    if (META_EDIT_ID === id) limparFormMeta();
    await carregarTudoCustoFilial();
    mostrarStatus("Meta excluída com sucesso.");
  } catch (err) {
    console.error(err);
    mostrarStatus(err.message, true);
  }
}

function limparFormMeta() {
  META_EDIT_ID = "";

  [
    "metaFilial",
    "metaAno",
    "metaMes",
    "metaDiaFat",
    "metaMesFat",
    "metaAnoFat",
    "metaDiaTon",
    "metaMesTon",
    "metaAnoTon"
  ].forEach(id => {
    if ($(id)) $(id).value = "";
  });
}

function renderMetas() {
  const tbody = $("tbodyMetas");
  if (!tbody) return;

  const lista = aplicarFiltroLista(METAS);

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11">Nenhuma meta encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(item => `
    <tr>
      <td>${escapeHtml(item.filial)}</td>
      <td>${escapeHtml(item.ano)}</td>
      <td>${escapeHtml(item.mes)}</td>
      <td>${moedaBR(item.metaDiaFat)}</td>
      <td>${moedaBR(item.metaMesFat)}</td>
      <td>${moedaBR(item.metaAnoFat)}</td>
      <td>${numeroBR(item.metaDiaTon)}</td>
      <td>${numeroBR(item.metaMesTon)}</td>
      <td>${numeroBR(item.metaAnoTon)}</td>
      <td>
        <button type="button" onclick="editarMeta('${String(item.id)}')">Editar</button>
      </td>
      <td>
        <button type="button" onclick="excluirMeta('${String(item.id)}')">Excluir</button>
      </td>
    </tr>
  `).join("");
}

// ==========================================
// LANÇAMENTOS
// ==========================================

function getLancamentoFormData() {
  return {
    id: LANC_EDIT_ID || "",
    data: normalizarTexto($("lancData")?.value),
    filial: normalizarTextoUpper($("lancFilial")?.value),
    faturamento: toNumberBR($("lancFaturamento")?.value),
    toneladas: toNumberBR($("lancToneladas")?.value),
    custo: toNumberBR($("lancCusto")?.value),
    observacao: normalizarTexto($("lancObservacao")?.value)
  };
}

function validarLancamento(data) {
  if (!data.data) throw new Error("Informe a data.");
  if (!data.filial) throw new Error("Informe a filial.");
}

async function salvarLancamento() {
  try {
    const data = getLancamentoFormData();
    validarLancamento(data);

    if (LANC_EDIT_ID) {
      await apiPost({
        action: "update_lancamento",
        ...data
      });
      mostrarStatus("Lançamento atualizado com sucesso.");
    } else {
      await apiPost({
        action: "add_lancamento",
        ...data
      });
      mostrarStatus("Lançamento cadastrado com sucesso.");
    }

    limparFormLancamento();
    await carregarTudoCustoFilial();
  } catch (err) {
    console.error(err);
    mostrarStatus(err.message, true);
  }
}

function editarLancamento(id) {
  const item = LANCAMENTOS.find(x => String(x.id) === String(id));
  if (!item) return;

  LANC_EDIT_ID = item.id;

  if ($("lancData")) $("lancData").value = item.data || "";
  if ($("lancFilial")) $("lancFilial").value = item.filial || "";
  if ($("lancFaturamento")) $("lancFaturamento").value = item.faturamento || "";
  if ($("lancToneladas")) $("lancToneladas").value = item.toneladas || "";
  if ($("lancCusto")) $("lancCusto").value = item.custo || "";
  if ($("lancObservacao")) $("lancObservacao").value = item.observacao || "";

  mostrarStatus("Editando lançamento.");
}

async function excluirLancamento(id) {
  if (!confirm("Deseja excluir este lançamento?")) return;

  try {
    await apiPost({
      action: "delete_lancamento",
      id
    });

    if (LANC_EDIT_ID === id) limparFormLancamento();
    await carregarTudoCustoFilial();
    mostrarStatus("Lançamento excluído com sucesso.");
  } catch (err) {
    console.error(err);
    mostrarStatus(err.message, true);
  }
}

function limparFormLancamento() {
  LANC_EDIT_ID = "";

  [
    "lancData",
    "lancFilial",
    "lancFaturamento",
    "lancToneladas",
    "lancCusto",
    "lancObservacao"
  ].forEach(id => {
    if ($(id)) $(id).value = "";
  });
}

function renderLancamentos() {
  const tbody = $("tbodyLancamentos");
  if (!tbody) return;

  const lista = aplicarFiltroLista(LANCAMENTOS)
    .slice()
    .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">Nenhum lançamento encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(item => `
    <tr>
      <td>${formatarDataISOparaBR(item.data)}</td>
      <td>${escapeHtml(item.filial)}</td>
      <td>${escapeHtml(item.ano)}</td>
      <td>${escapeHtml(item.mes)}</td>
      <td>${moedaBR(item.faturamento)}</td>
      <td>${numeroBR(item.toneladas)}</td>
      <td>${moedaBR(item.custo)}</td>
      <td>${escapeHtml(item.observacao)}</td>
      <td>
        <button type="button" onclick="editarLancamento('${String(item.id)}')">Editar</button>
        <button type="button" onclick="excluirLancamento('${String(item.id)}')">Excluir</button>
      </td>
    </tr>
  `).join("");
}

// ==========================================
// RESUMO
// ==========================================

function renderResumo() {
  const lista = aplicarFiltroLista(LANCAMENTOS);

  const totalFat = lista.reduce((s, x) => s + Number(x.faturamento || 0), 0);
  const totalTon = lista.reduce((s, x) => s + Number(x.toneladas || 0), 0);
  const totalCusto = lista.reduce((s, x) => s + Number(x.custo || 0), 0);
  const custoPorTon = totalTon > 0 ? totalCusto / totalTon : 0;

  if ($("resumoFaturamento")) $("resumoFaturamento").textContent = moedaBR(totalFat);
  if ($("resumoToneladas")) $("resumoToneladas").textContent = numeroBR(totalTon);
  if ($("resumoCusto")) $("resumoCusto").textContent = moedaBR(totalCusto);
  if ($("resumoCustoTon")) $("resumoCustoTon").textContent = moedaBR(custoPorTon);
}

// ==========================================
// EVENTOS
// ==========================================

function bindEventosCustoFilial() {
  if ($("btnSalvarMeta")) {
    $("btnSalvarMeta").addEventListener("click", salvarMeta);
  }

  if ($("btnLimparMeta")) {
    $("btnLimparMeta").addEventListener("click", limparFormMeta);
  }

  if ($("btnSalvarLancamento")) {
    $("btnSalvarLancamento").addEventListener("click", salvarLancamento);
  }

  if ($("btnLimparLancamento")) {
    $("btnLimparLancamento").addEventListener("click", limparFormLancamento);
  }

  ["filtroFilial", "filtroAno", "filtroMes"].forEach(id => {
    if ($(id)) {
      $(id).addEventListener("change", () => {
        renderMetas();
        renderLancamentos();
        renderResumo();
      });
    }
  });
}

// ==========================================
// INIT
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  bindEventosCustoFilial();
  await carregarTudoCustoFilial();
});
