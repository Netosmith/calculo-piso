/* bi.js | NOVA FROTA | ATUAL + HISTÓRICO + INTELIGÊNCIA COMERCIAL */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbwACeACFRMk6SCJV8ciGMEcOSXhGTBpOZ_kkHkBYmKkzIxIp6Txbpt_Nyodl6VUrwJx/exec";

  const PESO_MEDIO = 38;
  const AUTO_REFRESH_MS = 60000;
  const $ = (sel) => document.querySelector(sel);

  const STATE = {
    modo: "ATUAL",
    atualRows: [],
    historicoRows: [],
    comercialRows: [],
    comercialFiltradas: [],
    charts: {},
    autoRefreshTimer: null,
    isLoading: false
  };

  /* =========================================================
     UTILITÁRIOS
  ========================================================= */

  function safeText(v) {
    return String(v ?? "").trim();
  }

  function upper(v) {
    return safeText(v).toUpperCase();
  }

  function firstValue(obj, keys, fallback = "") {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return obj[key];
      }
    }
    return fallback;
  }

  function num(v) {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;

    let s = String(v).trim();
    if (!s) return 0;

    s = s.replace(/\s+/g, "").replace(/[^\d.,-]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function moneyBR(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function intBR(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      maximumFractionDigits: 0
    });
  }

  function decimalBR(v, casas = 2) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas
    });
  }

  function percentBR(v) {
    return `${decimalBR(v, 2)}%`;
  }

  function average(values) {
    const valid = values.filter((v) => Number.isFinite(v));
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  }

  function median(values) {
    const arr = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!arr.length) return 0;
    const middle = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[middle] : (arr[middle - 1] + arr[middle]) / 2;
  }

  function minValue(values) {
    const valid = values.filter((v) => Number.isFinite(v) && v > 0);
    return valid.length ? Math.min(...valid) : 0;
  }

  function maxValue(values) {
    const valid = values.filter((v) => Number.isFinite(v) && v > 0);
    return valid.length ? Math.max(...valid) : 0;
  }

  function isoDate(date) {
    const d = date instanceof Date ? date : parseDate(date);
    if (!d || Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const raw = safeText(value);
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) {
      const d = new Date(`${br[3]}-${br[2]}-${br[1]}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDateBR(value) {
    const d = parseDate(value);
    return d ? d.toLocaleDateString("pt-BR") : safeText(value) || "-";
  }

  function formatDateTimeBR(value) {
    const raw = safeText(value);
    const d = raw ? new Date(raw) : null;
    if (!d || Number.isNaN(d.getTime())) return formatDateBR(value);
    return d.toLocaleString("pt-BR");
  }

  function dateKey(value) {
    const d = parseDate(value);
    return d ? isoDate(d) : safeText(value).slice(0, 10);
  }

  function routeName(row) {
    const origem = upper(row.origem) || "SEM ORIGEM";
    const destino = upper(row.destino) || "SEM DESTINO";
    return `${origem} → ${destino}`;
  }

  function groupBy(rows, keyOrFn) {
    const map = new Map();
    rows.forEach((row) => {
      const raw = typeof keyOrFn === "function" ? keyOrFn(row) : row[keyOrFn];
      const key = upper(raw) || "SEM DADO";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }

  function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = value;
  }

  function escapeHtml(value) {
    return safeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setDefaultDates() {
    const hoje = new Date();
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - 30);

    if ($("#fDataInicio") && !$("#fDataInicio").value) {
      $("#fDataInicio").value = isoDate(inicio);
    }
    if ($("#fDataFim") && !$("#fDataFim").value) {
      $("#fDataFim").value = isoDate(hoje);
    }
  }

  function setStatus(text, ok = true) {
    const el = $("#syncStatus");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "#067647" : "#b42318";
  }

  function getMode() {
    return upper($("#fModo")?.value || STATE.modo || "ATUAL");
  }

  function getPeriod() {
    return {
      inicio: $("#fDataInicio")?.value || "",
      fim: $("#fDataFim")?.value || ""
    };
  }

  function inPeriod(value, inicio, fim) {
    const key = dateKey(value);
    if (!key) return true;
    if (inicio && key < inicio) return false;
    if (fim && key > fim) return false;
    return true;
  }

  /* =========================================================
     API / JSONP
  ========================================================= */

  function jsonp(url, timeoutMs = 35000) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";
      let finished = false;

      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error("Timeout ao carregar dados do Apps Script"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch {}
        try { script.remove(); } catch {}
      }

      window[cb] = function (data) {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(data);
      };

      script.src = url + sep + "callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
      script.async = true;

      script.onerror = function () {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error("Erro ao carregar o script JSONP"));
      };

      document.head.appendChild(script);
    });
  }

  function buildUrl(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }

  async function apiGet(paramsObj) {
    const res = await jsonp(buildUrl(paramsObj));
    if (!res) throw new Error("Resposta vazia da API");
    if (res.ok === false) throw new Error(res.error || "Falha na API");
    return res;
  }

  function extractRows(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.rows)) return res.rows;
    if (Array.isArray(res?.fretes)) return res.fretes;
    if (Array.isArray(res?.historico)) return res.historico;
    if (Array.isArray(res?.registros)) return res.registros;
    return [];
  }

  /* =========================================================
     NORMALIZAÇÃO
  ========================================================= */

  function normalizeCurrentRow(r, origemPadrao = "") {
    return {
      id: safeText(firstValue(r, ["id", "idFrete", "ID", "Id"])),
      dataReferencia: safeText(firstValue(r, [
        "dataReferencia", "data", "dataCriacao", "createdAt", "timestamp"
      ])),
      origemDados: upper(firstValue(r, [
        "origemDados", "base", "planilha", "origemBase"
      ], origemPadrao)),
      regional: upper(firstValue(r, ["regional", "Regional"])),
      filial: upper(firstValue(r, ["filial", "Filial", "nomeFilial"])),
      cliente: upper(firstValue(r, ["cliente", "Cliente", "nomeCliente"])),
      origem: upper(firstValue(r, ["origem", "Origem", "cidadeOrigem"])),
      coleta: upper(firstValue(r, ["coleta", "Coleta", "localColeta"])),
      contato: upper(firstValue(r, ["contato", "Contato"])),
      destino: upper(firstValue(r, ["destino", "Destino", "cidadeDestino"])),
      uf: upper(firstValue(r, ["uf", "UF", "estado"])),
      descarga: upper(firstValue(r, ["descarga", "Descarga", "localDescarga"])),
      volume: num(firstValue(r, ["volume", "Volume"])),
      valorEmpresa: num(firstValue(r, [
        "valorEmpresa", "vlrEmpresa", "freteEmpresa", "valor_empresa", "Valor Empresa"
      ])),
      valorMotorista: num(firstValue(r, [
        "valorMotorista", "vlrMotorista", "freteMotorista", "valor_motorista", "Valor Motorista"
      ])),
      km: num(firstValue(r, ["km", "KM"])),
      pedagioEixo: num(firstValue(r, ["pedagioEixo", "pedagio", "Pedágio Eixo"])),
      produto: upper(firstValue(r, ["produto", "Produto"])),
      icms: upper(firstValue(r, ["icms", "ICMS"])),
      pedidoSat: safeText(firstValue(r, ["pedidoSat", "pedido", "sat", "Pedido/SAT"])),
      porta: num(firstValue(r, ["porta", "Porta"])),
      transito: num(firstValue(r, ["transito", "trânsito", "Transito", "Trânsito"])),
      status: upper(firstValue(r, ["status", "Status"])),
      obs: safeText(firstValue(r, ["obs", "observacao", "observação", "Observação"]))
    };
  }

  function normalizeCommercialRow(r) {
    const valorEmpresa = num(firstValue(r, [
      "valorEmpresa", "novoValorEmpresa", "valorEmpresaNovo", "vlrEmpresa",
      "freteEmpresa", "valor_empresa", "Valor Empresa"
    ]));

    const valorMotorista = num(firstValue(r, [
      "valorMotorista", "novoValorMotorista", "valorMotoristaNovo", "vlrMotorista",
      "freteMotorista", "valor_motorista", "Valor Motorista"
    ]));

    const valorEmpresaAnterior = num(firstValue(r, [
      "valorEmpresaAnterior", "antigoValorEmpresa", "valorEmpresaAntigo",
      "vlrEmpresaAnterior"
    ]));

    const valorMotoristaAnterior = num(firstValue(r, [
      "valorMotoristaAnterior", "antigoValorMotorista", "valorMotoristaAntigo",
      "vlrMotoristaAnterior"
    ]));

    const evento = upper(firstValue(r, [
      "evento", "acao", "ação", "tipoEvento", "operacao", "operação"
    ]));

    const alterouValorRaw = upper(firstValue(r, [
      "alterouValor", "mudouValor", "precoAlterado", "preçoAlterado"
    ]));

    const alterouValor =
      alterouValorRaw === "SIM" ||
      alterouValorRaw === "TRUE" ||
      alterouValorRaw === "1" ||
      valorEmpresaAnterior !== valorEmpresa ||
      valorMotoristaAnterior !== valorMotorista;

    const dataEvento = safeText(firstValue(r, [
      "dataEvento", "timestamp", "dataHora", "dataRegistro",
      "dataAlteracao", "dataCriacao", "dataReferencia", "data"
    ]));

    const row = {
      idHistorico: safeText(firstValue(r, [
        "idHistorico", "id", "ID", "uuid"
      ])),
      idFrete: safeText(firstValue(r, [
        "idFrete", "freteId", "idRegistro", "registroId"
      ])),
      dataEvento,
      dataReferencia: dateKey(dataEvento),
      evento: evento || "REGISTRO",
      origemDados: upper(firstValue(r, [
        "origemDados", "base", "planilha", "origemBase"
      ])),
      filial: upper(firstValue(r, ["filial", "Filial", "nomeFilial"])),
      cliente: upper(firstValue(r, ["cliente", "Cliente", "nomeCliente"])),
      origem: upper(firstValue(r, ["origem", "Origem", "cidadeOrigem"])),
      coleta: upper(firstValue(r, ["coleta", "Coleta", "localColeta"])),
      destino: upper(firstValue(r, ["destino", "Destino", "cidadeDestino"])),
      uf: upper(firstValue(r, ["uf", "UF", "estado"])),
      descarga: upper(firstValue(r, ["descarga", "Descarga", "localDescarga"])),
      produto: upper(firstValue(r, ["produto", "Produto"])),
      status: upper(firstValue(r, ["status", "Status"])),
      valorEmpresa,
      valorMotorista,
      valorEmpresaAnterior,
      valorMotoristaAnterior,
      alterouValor,
      usuario: safeText(firstValue(r, ["usuario", "usuário", "emailUsuario", "responsavel"])),
      obs: safeText(firstValue(r, ["obs", "observacao", "observação", "detalhes"]))
    };

    row.margem = row.valorEmpresa - row.valorMotorista;
    row.margemPercentual = row.valorEmpresa > 0
      ? (row.margem / row.valorEmpresa) * 100
      : 0;
    row.rota = routeName(row);

    return row;
  }

  /* =========================================================
     FILTROS
  ========================================================= */

  function fillSelect(el, values, placeholder) {
    if (!el) return;

    const current = el.value;
    const unique = [...new Set(values.filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), "pt-BR")
    );

    el.innerHTML = `<option value="">${placeholder}</option>`;

    unique.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      el.appendChild(option);
    });

    if ([...el.options].some((o) => o.value === current)) {
      el.value = current;
    }
  }

  function loadCommonFilterOptions(rows) {
    fillSelect($("#fFilial"), rows.map((r) => r.filial), "Todas as filiais");
    fillSelect($("#fCliente"), rows.map((r) => r.cliente), "Todos os clientes");
    fillSelect($("#fStatus"), rows.map((r) => r.status), "Todos os status");
  }

  function loadCommercialFilterOptions(rows) {
    fillSelect($("#fOrigem"), rows.map((r) => r.origem), "Todas as origens");
    fillSelect($("#fDestino"), rows.map((r) => r.destino), "Todos os destinos");
    fillSelect($("#fProduto"), rows.map((r) => r.produto), "Todos os produtos");
  }

  function applyCommonFilters(rows) {
    const filial = upper($("#fFilial")?.value);
    const cliente = upper($("#fCliente")?.value);
    const status = upper($("#fStatus")?.value);
    const origemDados = upper($("#fOrigemDados")?.value);
    const busca = upper($("#fBusca")?.value);

    return rows.filter((row) => {
      if (filial && row.filial !== filial) return false;
      if (cliente && row.cliente !== cliente) return false;
      if (status && row.status !== status) return false;
      if (origemDados && row.origemDados !== origemDados) return false;

      if (busca) {
        const blob = [
          row.filial, row.cliente, row.origem, row.destino, row.produto,
          row.contato, row.descarga, row.obs, row.origemDados, row.status
        ].join(" ");

        if (!upper(blob).includes(busca)) return false;
      }

      return true;
    });
  }

  function getCurrentFilteredRows() {
    return applyCommonFilters(STATE.atualRows);
  }

  function getHistoricalFilteredRows() {
    const { inicio, fim } = getPeriod();
    return applyCommonFilters(STATE.historicoRows).filter((row) =>
      inPeriod(row.dataReferencia, inicio, fim)
    );
  }

  function getCommercialFilteredRows() {
    const filial = upper($("#fFilial")?.value);
    const cliente = upper($("#fCliente")?.value);
    const status = upper($("#fStatus")?.value);
    const origemDados = upper($("#fOrigemDados")?.value);
    const busca = upper($("#fBusca")?.value);
    const origem = upper($("#fOrigem")?.value);
    const destino = upper($("#fDestino")?.value);
    const produto = upper($("#fProduto")?.value);
    const tipoEvento = upper($("#fTipoEvento")?.value);
    const { inicio, fim } = getPeriod();

    const rows = STATE.comercialRows.filter((row) => {
      if (!inPeriod(row.dataEvento || row.dataReferencia, inicio, fim)) return false;
      if (filial && row.filial !== filial) return false;
      if (cliente && row.cliente !== cliente) return false;
      if (status && row.status !== status) return false;
      if (origemDados && row.origemDados !== origemDados) return false;
      if (origem && row.origem !== origem) return false;
      if (destino && row.destino !== destino) return false;
      if (produto && row.produto !== produto) return false;
      if (tipoEvento && row.evento !== tipoEvento) return false;

      if (busca) {
        const blob = [
          row.filial, row.cliente, row.origem, row.destino, row.produto,
          row.origemDados, row.status, row.evento, row.obs
        ].join(" ");
        if (!upper(blob).includes(busca)) return false;
      }

      return row.valorEmpresa > 0 || row.valorMotorista > 0;
    });

    return removeDuplicatePriceEvents(rows);
  }

  function removeDuplicatePriceEvents(rows) {
    const sorted = [...rows].sort((a, b) =>
      safeText(a.dataEvento).localeCompare(safeText(b.dataEvento))
    );

    const lastByFrete = new Map();
    const output = [];

    sorted.forEach((row) => {
      const key = row.idFrete || [
        row.rota, row.cliente, row.produto, row.filial
      ].join("|");

      const previous = lastByFrete.get(key);
      const samePrice = previous &&
        previous.valorEmpresa === row.valorEmpresa &&
        previous.valorMotorista === row.valorMotorista;

      const isPriceEvent =
        row.evento === "CRIADO" ||
        row.evento === "ATUALIZADO" ||
        row.alterouValor;

      if (!isPriceEvent) return;
      if (samePrice && row.evento !== "CRIADO") return;

      output.push(row);
      lastByFrete.set(key, row);
    });

    return output.sort((a, b) =>
      safeText(a.dataEvento).localeCompare(safeText(b.dataEvento))
    );
  }

  /* =========================================================
     RESUMOS OPERACIONAIS
  ========================================================= */

  function calcOperationalKPIs(rows) {
    const porta = rows.reduce((acc, row) => acc + num(row.porta), 0);
    const transito = rows.reduce((acc, row) => acc + num(row.transito), 0);
    const totalVeiculos = porta + transito;
    const volumeInformado = rows.reduce((acc, row) => acc + num(row.volume), 0);
    const volume = volumeInformado > 0 ? volumeInformado : totalVeiculos * PESO_MEDIO;

    const valid = rows.filter((row) => row.valorEmpresa > 0);
    const freteMedio = average(valid.map((row) => row.valorEmpresa));
    const margemMedia = average(valid.map((row) => row.valorEmpresa - row.valorMotorista));

    return { porta, transito, totalVeiculos, volume, freteMedio, margemMedia };
  }

  function buildResumoFilial(rows) {
    const map = groupBy(rows, "filial");
    const result = [];

    map.forEach((list, filial) => {
      const k = calcOperationalKPIs(list);
      result.push({ filial, ...k });
    });

    return result.sort((a, b) =>
      b.totalVeiculos - a.totalVeiculos || a.filial.localeCompare(b.filial)
    );
  }

  function buildResumoCliente(rows) {
    const map = groupBy(rows, "cliente");
    const result = [];

    map.forEach((list, cliente) => {
      const k = calcOperationalKPIs(list);
      result.push({
        cliente,
        veiculos: k.totalVeiculos,
        margemMedia: k.margemMedia
      });
    });

    return result.sort((a, b) =>
      b.veiculos - a.veiculos || a.cliente.localeCompare(b.cliente)
    );
  }

  function buildEvolucaoDiaria(rows) {
    const map = new Map();

    rows.forEach((row) => {
      const data = dateKey(row.dataReferencia);
      if (!data) return;

      if (!map.has(data)) {
        map.set(data, { data, porta: 0, transito: 0, veiculos: 0, volume: 0 });
      }

      const item = map.get(data);
      item.porta += row.porta;
      item.transito += row.transito;
      item.veiculos += row.porta + row.transito;
      item.volume += row.volume > 0 ? row.volume : (row.porta + row.transito) * PESO_MEDIO;
    });

    return [...map.values()].sort((a, b) => a.data.localeCompare(b.data));
  }

  /* =========================================================
     CHARTS
  ========================================================= */

  function destroyChart(id) {
    const chart = STATE.charts[id];
    if (chart && typeof chart.destroy === "function") chart.destroy();
    delete STATE.charts[id];
  }

  function destroyCharts(ids = null) {
    const targets = ids || Object.keys(STATE.charts);
    targets.forEach(destroyChart);
  }

  function makeChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === "undefined") return;
    destroyChart(id);
    STATE.charts[id] = new Chart(canvas, config);
  }

  function chartBaseOptions(extra = {}) {
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#334155", font: { weight: "700" } }
        },
        tooltip: {
          callbacks: {}
        }
      },
      scales: {
        x: {
          ticks: { color: "#475569" },
          grid: { color: "rgba(148,163,184,.12)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#475569" },
          grid: { color: "rgba(148,163,184,.18)" }
        }
      }
    };

    return deepMerge(base, extra);
  }

  function deepMerge(target, source) {
    const out = { ...target };
    Object.keys(source || {}).forEach((key) => {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        out[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        out[key] = source[key];
      }
    });
    return out;
  }

  /* =========================================================
     RENDER OPERAÇÃO ATUAL
  ========================================================= */

  function renderCurrent() {
    const rows = getCurrentFilteredRows();
    const k = calcOperationalKPIs(rows);

    setText("#kpiPorta", intBR(k.porta));
    setText("#kpiTransito", intBR(k.transito));
    setText("#kpiVeiculos", intBR(k.totalVeiculos));
    setText("#kpiVolume", `${intBR(k.volume)} t`);
    setText("#kpiFreteMedio", moneyBR(k.freteMedio));
    setText("#kpiMargemMedia", moneyBR(k.margemMedia));

    renderIndicativoFilial(rows);
    renderCurrentCharts(rows);
  }

  function renderIndicativoFilial(rows) {
    const tbody = $("#tbodyIndicativo");
    if (!tbody) return;

    const resumo = buildResumoFilial(rows);
    if (!resumo.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">Nenhum registro encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = resumo.map((row) => `
      <tr>
        <td>${escapeHtml(row.filial)}</td>
        <td class="num">${intBR(row.porta)}</td>
        <td class="num">${intBR(row.transito)}</td>
        <td class="num">${intBR(row.totalVeiculos)}</td>
        <td class="num">${intBR(row.volume)} t</td>
        <td class="num">${moneyBR(row.freteMedio)}</td>
        <td class="num">${moneyBR(row.margemMedia)}</td>
      </tr>
    `).join("");
  }

  function renderCurrentCharts(rows) {
    const resumoFilial = buildResumoFilial(rows);
    const resumoCliente = buildResumoCliente(rows);
    const evolucao = buildEvolucaoDiaria(rows);

    makeChart("chartVeiculosFilial", {
      type: "bar",
      data: {
        labels: resumoFilial.map((r) => r.filial),
        datasets: [{
          label: "Veículos",
          data: resumoFilial.map((r) => r.totalVeiculos),
          backgroundColor: "rgba(59,130,246,.65)",
          borderColor: "#3b82f6",
          borderWidth: 1.5,
          borderRadius: 8
        }]
      },
      options: chartBaseOptions()
    });

    makeChart("chartVeiculosCliente", {
      type: "doughnut",
      data: {
        labels: resumoCliente.map((r) => r.cliente),
        datasets: [{
          data: resumoCliente.map((r) => r.veiculos),
          backgroundColor: [
            "#3b82f6", "#16a34a", "#8b5cf6", "#f59e0b", "#ec4899",
            "#0ea5e9", "#14b8a6", "#ef4444", "#84cc16", "#6366f1"
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#334155", font: { weight: "700" } }
          }
        }
      }
    });

    makeChart("chartVolumeFilial", {
      type: "bar",
      data: {
        labels: resumoFilial.map((r) => r.filial),
        datasets: [{
          label: "Volume (t)",
          data: resumoFilial.map((r) => r.volume),
          backgroundColor: "rgba(22,163,74,.65)",
          borderColor: "#16a34a",
          borderWidth: 1.5,
          borderRadius: 10
        }]
      },
      options: chartBaseOptions()
    });

    makeChart("chartPortaTransito", {
      type: "bar",
      data: {
        labels: resumoFilial.map((r) => r.filial),
        datasets: [
          {
            label: "Porta",
            data: resumoFilial.map((r) => r.porta),
            backgroundColor: "rgba(59,130,246,.62)",
            borderColor: "#3b82f6",
            borderWidth: 1.2,
            borderRadius: 8
          },
          {
            label: "Trânsito",
            data: resumoFilial.map((r) => r.transito),
            backgroundColor: "rgba(22,163,74,.52)",
            borderColor: "#16a34a",
            borderWidth: 1.2,
            borderRadius: 8
          }
        ]
      },
      options: chartBaseOptions()
    });

    makeChart("chartMargemCliente", {
      type: "polarArea",
      data: {
        labels: resumoCliente.map((r) => r.cliente),
        datasets: [{
          data: resumoCliente.map((r) => Number(r.margemMedia.toFixed(2))),
          backgroundColor: [
            "rgba(59,130,246,.50)", "rgba(22,163,74,.50)",
            "rgba(139,92,246,.50)", "rgba(245,158,11,.50)",
            "rgba(236,72,153,.50)", "rgba(14,165,233,.50)",
            "rgba(20,184,166,.50)", "rgba(239,68,68,.50)"
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#334155", font: { weight: "700" } }
          }
        }
      }
    });

    makeChart("chartEvolucaoDiaria", {
      type: "line",
      data: {
        labels: evolucao.map((r) => formatDateBR(r.data)),
        datasets: [
          {
            label: "Porta",
            data: evolucao.map((r) => r.porta),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,.15)",
            tension: .25,
            fill: false
          },
          {
            label: "Trânsito",
            data: evolucao.map((r) => r.transito),
            borderColor: "#16a34a",
            backgroundColor: "rgba(22,163,74,.15)",
            tension: .25,
            fill: false
          },
          {
            label: "Total",
            data: evolucao.map((r) => r.veiculos),
            borderColor: "#8b5cf6",
            backgroundColor: "rgba(139,92,246,.12)",
            tension: .25,
            fill: false
          }
        ]
      },
      options: chartBaseOptions()
    });
  }

  /* =========================================================
     RENDER HISTÓRICO OPERACIONAL
  ========================================================= */

  function renderHistorical() {
    const rows = getHistoricalFilteredRows();
    const evolucao = buildEvolucaoDiaria(rows);
    const dias = evolucao.length;

    const mediaVeiculos = average(evolucao.map((r) => r.veiculos));
    const mediaPorta = average(evolucao.map((r) => r.porta));
    const mediaTransito = average(evolucao.map((r) => r.transito));
    const volume = evolucao.reduce((sum, r) => sum + r.volume, 0);
    const pico = evolucao.reduce((best, current) =>
      !best || current.veiculos > best.veiculos ? current : best
    , null);

    setText("#kpiHistMediaVeiculos", decimalBR(mediaVeiculos, 1));
    setText("#kpiHistPicoVeiculos", intBR(pico?.veiculos || 0));
    setText("#kpiHistPicoData", pico ? `Em ${formatDateBR(pico.data)}` : "Sem dados");
    setText("#kpiHistVolume", `${intBR(volume)} t`);
    setText("#kpiHistPorta", decimalBR(mediaPorta, 1));
    setText("#kpiHistTransito", decimalBR(mediaTransito, 1));
    setText("#kpiHistDias", intBR(dias));

    renderHistoricalCharts(rows, evolucao);
  }

  function renderHistoricalCharts(rows, evolucao) {
    makeChart("chartHistoricoOperacao", {
      type: "line",
      data: {
        labels: evolucao.map((r) => formatDateBR(r.data)),
        datasets: [
          {
            label: "Porta",
            data: evolucao.map((r) => r.porta),
            borderColor: "#2563eb",
            backgroundColor: "rgba(37,99,235,.12)",
            fill: true,
            tension: .28
          },
          {
            label: "Trânsito",
            data: evolucao.map((r) => r.transito),
            borderColor: "#16a34a",
            backgroundColor: "rgba(22,163,74,.10)",
            fill: true,
            tension: .28
          },
          {
            label: "Total",
            data: evolucao.map((r) => r.veiculos),
            borderColor: "#7c3aed",
            backgroundColor: "rgba(124,58,237,.08)",
            fill: false,
            tension: .28
          }
        ]
      },
      options: chartBaseOptions()
    });

    const filialMap = groupBy(rows, "filial");
    const filialResumo = [...filialMap.entries()].map(([filial, list]) => ({
      filial,
      volume: list.reduce((sum, row) =>
        sum + (row.volume > 0 ? row.volume : (row.porta + row.transito) * PESO_MEDIO), 0)
    })).sort((a, b) => b.volume - a.volume);

    makeChart("chartHistoricoFilial", {
      type: "bar",
      data: {
        labels: filialResumo.map((r) => r.filial),
        datasets: [{
          label: "Volume acumulado (t)",
          data: filialResumo.map((r) => r.volume),
          backgroundColor: "rgba(8,145,178,.62)",
          borderColor: "#0891b2",
          borderWidth: 1.3,
          borderRadius: 8
        }]
      },
      options: chartBaseOptions()
    });

    const clienteMap = groupBy(rows, "cliente");
    const clienteResumo = [...clienteMap.entries()].map(([cliente, list]) => ({
      cliente,
      veiculos: list.reduce((sum, row) => sum + row.porta + row.transito, 0)
    })).sort((a, b) => b.veiculos - a.veiculos).slice(0, 12);

    makeChart("chartHistoricoCliente", {
      type: "doughnut",
      data: {
        labels: clienteResumo.map((r) => r.cliente),
        datasets: [{
          data: clienteResumo.map((r) => r.veiculos),
          backgroundColor: [
            "#2563eb", "#16a34a", "#7c3aed", "#f59e0b",
            "#ec4899", "#0891b2", "#14b8a6", "#dc2626",
            "#84cc16", "#6366f1", "#f97316", "#64748b"
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#334155", font: { weight: "700" } }
          }
        }
      }
    });
  }

  /* =========================================================
     INTELIGÊNCIA COMERCIAL
  ========================================================= */

  function summarizeCommercial(rows) {
    const empresaValues = rows.map((r) => r.valorEmpresa).filter((v) => v > 0);
    const motoristaValues = rows.map((r) => r.valorMotorista).filter((v) => v > 0);
    const margens = rows.map((r) => r.margem).filter(Number.isFinite);
    const margensPercentuais = rows
      .filter((r) => r.valorEmpresa > 0)
      .map((r) => r.margemPercentual);

    return {
      count: rows.length,
      empresaAvg: average(empresaValues),
      empresaMedian: median(empresaValues),
      empresaMin: minValue(empresaValues),
      empresaMax: maxValue(empresaValues),
      motoristaAvg: average(motoristaValues),
      motoristaMedian: median(motoristaValues),
      motoristaMin: minValue(motoristaValues),
      motoristaMax: maxValue(motoristaValues),
      margemAvg: average(margens),
      margemPercentAvg: average(margensPercentuais),
      alteracoes: rows.filter((r) => r.evento === "ATUALIZADO" || r.alterouValor).length
    };
  }

  function renderCommercial() {
    const rows = getCommercialFilteredRows();
    STATE.comercialFiltradas = rows;

    const summary = summarizeCommercial(rows);
    renderCommercialHeader(rows, summary);
    renderCommercialInsights(rows, summary);
    renderCommercialCharts(rows);
    renderCommercialTable(rows);
    renderCommercialRankings(rows);
  }

  function renderCommercialHeader(rows, summary) {
    const origem = upper($("#fOrigem")?.value);
    const destino = upper($("#fDestino")?.value);
    const rota = origem || destino
      ? `${origem || "TODAS AS ORIGENS"} → ${destino || "TODOS OS DESTINOS"}`
      : "Todas as rotas";

    const { inicio, fim } = getPeriod();
    const periodo = inicio || fim
      ? `Período: ${inicio ? formatDateBR(inicio) : "início aberto"} até ${fim ? formatDateBR(fim) : "hoje"}`
      : "Período completo disponível";

    setText("#rotaSelecionada", rota);
    setText("#periodoSelecionado", `${periodo} • ${summary.count} registros encontrados`);

    setText("#kpiComEmpresaMedio", moneyBR(summary.empresaAvg));
    setText(
      "#kpiComEmpresaFaixa",
      `Mín. ${moneyBR(summary.empresaMin)} | Máx. ${moneyBR(summary.empresaMax)}`
    );

    setText("#kpiComMotoristaMedio", moneyBR(summary.motoristaAvg));
    setText(
      "#kpiComMotoristaFaixa",
      `Mín. ${moneyBR(summary.motoristaMin)} | Máx. ${moneyBR(summary.motoristaMax)}`
    );

    setText("#kpiComMargemMedia", moneyBR(summary.margemAvg));
    setText("#kpiComMargemPercentual", percentBR(summary.margemPercentAvg));
    setText("#kpiComNegociacoes", intBR(summary.count));
    setText("#kpiComAlteracoes", `${intBR(summary.alteracoes)} alterações reais`);
    setText("#badgeResultados", `${intBR(summary.count)} registros`);
  }

  function buildCommercialSeries(rows) {
    const agrupamento = upper($("#fAgrupamentoComercial")?.value || "EVENTO");

    if (agrupamento === "EVENTO") {
      return rows.map((row, index) => ({
        key: `${formatDateBR(row.dataEvento)} #${index + 1}`,
        empresa: row.valorEmpresa,
        motorista: row.valorMotorista,
        margem: row.margem
      }));
    }

    const map = new Map();

    rows.forEach((row) => {
      const d = parseDate(row.dataEvento);
      if (!d) return;

      let key;
      if (agrupamento === "MES") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      } else if (agrupamento === "SEMANA") {
        const monday = new Date(d);
        const day = monday.getDay() || 7;
        monday.setDate(monday.getDate() - day + 1);
        key = isoDate(monday);
      } else {
        key = isoDate(d);
      }

      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, list]) => ({
        key: agrupamento === "MES"
          ? key.split("-").reverse().join("/")
          : formatDateBR(key),
        empresa: average(list.map((r) => r.valorEmpresa).filter((v) => v > 0)),
        motorista: average(list.map((r) => r.valorMotorista).filter((v) => v > 0)),
        margem: average(list.map((r) => r.margem))
      }));
  }

  function renderCommercialCharts(rows) {
    const series = buildCommercialSeries(rows);

    makeChart("chartEvolucaoValores", {
      type: "line",
      data: {
        labels: series.map((r) => r.key),
        datasets: [
          {
            label: "Valor Empresa",
            data: series.map((r) => r.empresa),
            borderColor: "#2563eb",
            backgroundColor: "rgba(37,99,235,.12)",
            tension: .25,
            fill: false,
            pointRadius: 3
          },
          {
            label: "Valor Motorista",
            data: series.map((r) => r.motorista),
            borderColor: "#16a34a",
            backgroundColor: "rgba(22,163,74,.12)",
            tension: .25,
            fill: false,
            pointRadius: 3
          }
        ]
      },
      options: chartBaseOptions({
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${moneyBR(ctx.raw)}`
            }
          }
        },
        scales: {
          y: {
            ticks: {
              color: "#475569",
              callback: (value) => moneyBR(value)
            }
          }
        }
      })
    });

    makeChart("chartMargemPeriodo", {
      type: "bar",
      data: {
        labels: series.map((r) => r.key),
        datasets: [{
          label: "Margem média",
          data: series.map((r) => r.margem),
          backgroundColor: series.map((r) =>
            r.margem >= 0 ? "rgba(22,163,74,.62)" : "rgba(220,38,38,.62)"
          ),
          borderColor: series.map((r) =>
            r.margem >= 0 ? "#16a34a" : "#dc2626"
          ),
          borderWidth: 1.2,
          borderRadius: 7
        }]
      },
      options: chartBaseOptions({
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `Margem: ${moneyBR(ctx.raw)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              color: "#475569",
              callback: (value) => moneyBR(value)
            }
          }
        }
      })
    });

    const distribution = buildDistribution(rows);
    makeChart("chartDistribuicaoValores", {
      type: "bar",
      data: {
        labels: distribution.map((r) => r.label),
        datasets: [
          {
            label: "Empresa",
            data: distribution.map((r) => r.empresa),
            backgroundColor: "rgba(37,99,235,.62)",
            borderColor: "#2563eb",
            borderWidth: 1
          },
          {
            label: "Motorista",
            data: distribution.map((r) => r.motorista),
            backgroundColor: "rgba(22,163,74,.56)",
            borderColor: "#16a34a",
            borderWidth: 1
          }
        ]
      },
      options: chartBaseOptions()
    });

    const routeRanking = buildRouteRanking(rows).slice(0, 10);
    makeChart("chartRankingRotas", {
      type: "bar",
      data: {
        labels: routeRanking.map((r) => r.rota),
        datasets: [{
          label: "Valor médio empresa",
          data: routeRanking.map((r) => r.empresaAvg),
          backgroundColor: "rgba(124,58,237,.62)",
          borderColor: "#7c3aed",
          borderWidth: 1.2,
          borderRadius: 7
        }]
      },
      options: chartBaseOptions({
        indexAxis: "y",
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `Empresa: ${moneyBR(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              color: "#475569",
              callback: (value) => moneyBR(value)
            }
          }
        }
      })
    });

    const clientRanking = buildClientRanking(rows).slice(0, 10);
    makeChart("chartRankingClientes", {
      type: "bar",
      data: {
        labels: clientRanking.map((r) => r.cliente),
        datasets: [{
          label: "Margem média",
          data: clientRanking.map((r) => r.margemAvg),
          backgroundColor: "rgba(245,158,11,.62)",
          borderColor: "#f59e0b",
          borderWidth: 1.2,
          borderRadius: 7
        }]
      },
      options: chartBaseOptions({
        indexAxis: "y",
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `Margem: ${moneyBR(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: "#475569",
              callback: (value) => moneyBR(value)
            }
          }
        }
      })
    });
  }

  function buildDistribution(rows) {
    const values = rows
      .flatMap((r) => [r.valorEmpresa, r.valorMotorista])
      .filter((v) => v > 0);

    if (!values.length) return [];

    const min = Math.floor(Math.min(...values));
    const max = Math.ceil(Math.max(...values));
    const interval = Math.max(1, Math.ceil((max - min || 1) / 6));
    const buckets = [];

    for (let start = min; start <= max; start += interval) {
      buckets.push({
        start,
        end: start + interval - 1,
        label: `${moneyBR(start)} a ${moneyBR(start + interval - 1)}`,
        empresa: 0,
        motorista: 0
      });
    }

    rows.forEach((r) => {
      if (r.valorEmpresa > 0) {
        const index = Math.min(
          Math.floor((r.valorEmpresa - min) / interval),
          buckets.length - 1
        );
        buckets[index].empresa += 1;
      }

      if (r.valorMotorista > 0) {
        const index = Math.min(
          Math.floor((r.valorMotorista - min) / interval),
          buckets.length - 1
        );
        buckets[index].motorista += 1;
      }
    });

    return buckets;
  }

  function buildRouteRanking(rows) {
    const map = groupBy(rows, (r) => r.rota);

    return [...map.entries()].map(([rota, list]) => ({
      rota,
      empresaAvg: average(list.map((r) => r.valorEmpresa).filter((v) => v > 0)),
      motoristaAvg: average(list.map((r) => r.valorMotorista).filter((v) => v > 0)),
      margemAvg: average(list.map((r) => r.margem)),
      margemPercentAvg: average(list.map((r) => r.margemPercentual)),
      count: list.length
    })).sort((a, b) =>
      b.empresaAvg - a.empresaAvg || b.margemAvg - a.margemAvg
    );
  }

  function buildClientRanking(rows) {
    const map = groupBy(rows, "cliente");

    return [...map.entries()].map(([cliente, list]) => ({
      cliente,
      empresaAvg: average(list.map((r) => r.valorEmpresa).filter((v) => v > 0)),
      motoristaAvg: average(list.map((r) => r.valorMotorista).filter((v) => v > 0)),
      margemAvg: average(list.map((r) => r.margem)),
      margemPercentAvg: average(list.map((r) => r.margemPercentual)),
      count: list.length
    })).sort((a, b) =>
      b.margemAvg - a.margemAvg || b.empresaAvg - a.empresaAvg
    );
  }

  function buildRouteVariations(rows) {
    const map = groupBy(rows, (r) => r.rota);
    const output = [];

    map.forEach((list, rota) => {
      const sorted = [...list]
        .filter((r) => r.valorEmpresa > 0)
        .sort((a, b) => safeText(a.dataEvento).localeCompare(safeText(b.dataEvento)));

      if (!sorted.length) return;

      const first = sorted[0].valorEmpresa;
      const last = sorted[sorted.length - 1].valorEmpresa;
      const variation = first > 0 ? ((last - first) / first) * 100 : 0;

      output.push({ rota, first, last, variation, count: sorted.length });
    });

    return output.sort((a, b) =>
      Math.abs(b.variation) - Math.abs(a.variation)
    );
  }

  function renderCommercialInsights(rows, summary) {
    if (!rows.length) {
      setText("#insightTendencia", "Nenhum valor encontrado com os filtros selecionados.");
      setText("#insightMelhorCliente", "Sem dados suficientes.");
      setText("#insightMelhorMargem", "Sem dados suficientes.");
      setText("#insightAlerta", "Amplie o período ou retire algum filtro.");
      return;
    }

    const sorted = [...rows]
      .filter((r) => r.valorEmpresa > 0)
      .sort((a, b) => safeText(a.dataEvento).localeCompare(safeText(b.dataEvento)));

    const firstSlice = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 3)));
    const lastSlice = sorted.slice(-Math.max(1, Math.ceil(sorted.length / 3)));
    const firstAvg = average(firstSlice.map((r) => r.valorEmpresa));
    const lastAvg = average(lastSlice.map((r) => r.valorEmpresa));
    const trend = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;

    let trendText;
    if (trend > 2) {
      trendText = `Valorização de ${percentBR(trend)} entre o início e o fim do período.`;
    } else if (trend < -2) {
      trendText = `Queda de ${percentBR(Math.abs(trend))} entre o início e o fim do período.`;
    } else {
      trendText = `Mercado estável, com variação aproximada de ${percentBR(trend)}.`;
    }
    setText("#insightTendencia", trendText);

    const clients = buildClientRanking(rows);
    const bestClient = [...clients].sort((a, b) => b.empresaAvg - a.empresaAvg)[0];
    setText(
      "#insightMelhorCliente",
      bestClient
        ? `${bestClient.cliente} apresentou média empresa de ${moneyBR(bestClient.empresaAvg)} em ${bestClient.count} registros.`
        : "Sem dados suficientes."
    );

    const bestMargin = clients[0];
    setText(
      "#insightMelhorMargem",
      bestMargin
        ? `${bestMargin.cliente} teve margem média de ${moneyBR(bestMargin.margemAvg)} (${percentBR(bestMargin.margemPercentAvg)}).`
        : "Sem dados suficientes."
    );

    const negative = rows.filter((r) => r.margem < 0);
    const lowMargin = rows.filter((r) => r.valorEmpresa > 0 && r.margemPercentual < 5);
    const highSpread = summary.empresaMax > 0 && summary.empresaMin > 0
      ? ((summary.empresaMax - summary.empresaMin) / summary.empresaMin) * 100
      : 0;

    let alertText = "Nenhum alerta comercial relevante.";
    if (negative.length) {
      alertText = `${negative.length} registro(s) apresentam margem negativa. Revisão imediata recomendada.`;
    } else if (lowMargin.length) {
      alertText = `${lowMargin.length} registro(s) ficaram abaixo de 5% de margem.`;
    } else if (highSpread > 20) {
      alertText = `A faixa de valores varia ${percentBR(highSpread)}. Pode haver oportunidades de padronização comercial.`;
    }

    setText("#insightAlerta", alertText);
  }

  function renderCommercialTable(rows) {
    const tbody = $("#tbodyHistoricoValores");
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="13" class="empty">Nenhum valor encontrado no período selecionado.</td></tr>`;
      return;
    }

    const sorted = [...rows].sort((a, b) =>
      safeText(b.dataEvento).localeCompare(safeText(a.dataEvento))
    );

    tbody.innerHTML = sorted.map((row) => `
      <tr>
        <td>${escapeHtml(formatDateTimeBR(row.dataEvento))}</td>
        <td><span class="badge ${row.evento === "ATUALIZADO" ? "up" : "neutral"}">${escapeHtml(row.evento)}</span></td>
        <td>${escapeHtml(row.origemDados || "-")}</td>
        <td>${escapeHtml(row.filial || "-")}</td>
        <td>${escapeHtml(row.origem || "-")}</td>
        <td>${escapeHtml(row.destino || "-")}</td>
        <td>${escapeHtml(row.cliente || "-")}</td>
        <td>${escapeHtml(row.produto || "-")}</td>
        <td class="num">${moneyBR(row.valorEmpresa)}</td>
        <td class="num">${moneyBR(row.valorMotorista)}</td>
        <td class="num">${moneyBR(row.margem)}</td>
        <td class="num">${percentBR(row.margemPercentual)}</td>
        <td>${escapeHtml(row.status || "-")}</td>
      </tr>
    `).join("");
  }

  function renderCommercialRankings(rows) {
    const routes = buildRouteRanking(rows);
    const clients = buildClientRanking(rows);
    const variations = buildRouteVariations(rows);

    const tbodyRoutes = $("#tbodyRotasRentaveis");
    if (tbodyRoutes) {
      tbodyRoutes.innerHTML = routes.length
        ? routes.slice(0, 12).map((r) => `
            <tr>
              <td>${escapeHtml(r.rota)}</td>
              <td class="num">${moneyBR(r.empresaAvg)}</td>
              <td class="num">${moneyBR(r.margemAvg)}</td>
              <td class="num">${intBR(r.count)}</td>
            </tr>
          `).join("")
        : `<tr><td colspan="4" class="empty">Sem dados.</td></tr>`;
    }

    const tbodyClients = $("#tbodyClientesPagamMelhor");
    if (tbodyClients) {
      tbodyClients.innerHTML = clients.length
        ? [...clients]
            .sort((a, b) => b.empresaAvg - a.empresaAvg)
            .slice(0, 12)
            .map((r) => `
              <tr>
                <td>${escapeHtml(r.cliente)}</td>
                <td class="num">${moneyBR(r.empresaAvg)}</td>
                <td class="num">${moneyBR(r.motoristaAvg)}</td>
                <td class="num">${moneyBR(r.margemAvg)}</td>
              </tr>
            `).join("")
        : `<tr><td colspan="4" class="empty">Sem dados.</td></tr>`;
    }

    const tbodyVariations = $("#tbodyVariacoesRelevantes");
    if (tbodyVariations) {
      tbodyVariations.innerHTML = variations.length
        ? variations.slice(0, 12).map((r) => `
            <tr>
              <td>${escapeHtml(r.rota)}</td>
              <td class="num">${moneyBR(r.first)}</td>
              <td class="num">${moneyBR(r.last)}</td>
              <td class="num">
                <span class="badge ${r.variation > 0 ? "up" : r.variation < 0 ? "down" : "neutral"}">
                  ${r.variation > 0 ? "+" : ""}${percentBR(r.variation)}
                </span>
              </td>
            </tr>
          `).join("")
        : `<tr><td colspan="4" class="empty">Sem dados.</td></tr>`;
    }
  }

  function exportCommercialCsv() {
    const rows = STATE.comercialFiltradas;
    if (!rows.length) {
      alert("Não há registros comerciais para exportar.");
      return;
    }

    const headers = [
      "Data", "Evento", "Base", "Filial", "Origem", "Destino",
      "Cliente", "Produto", "Valor Empresa", "Valor Motorista",
      "Margem R$", "Margem %", "Status"
    ];

    const csvRows = rows.map((r) => [
      formatDateTimeBR(r.dataEvento),
      r.evento,
      r.origemDados,
      r.filial,
      r.origem,
      r.destino,
      r.cliente,
      r.produto,
      decimalBR(r.valorEmpresa, 2),
      decimalBR(r.valorMotorista, 2),
      decimalBR(r.margem, 2),
      decimalBR(r.margemPercentual, 2),
      r.status
    ]);

    const csv = [headers, ...csvRows]
      .map((row) => row.map(csvEscape).join(";"))
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico_valores_${isoDate(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const text = safeText(value).replace(/"/g, '""');
    return `"${text}"`;
  }

  /* =========================================================
     CARREGAMENTO
  ========================================================= */

  async function loadCurrentRows() {
    const [fretesRes, fretes2Res] = await Promise.all([
      apiGet({ action: "fretes_list" }),
      apiGet({ action: "fretes2_list" })
    ]);

    return [
      ...extractRows(fretesRes).map((r) => normalizeCurrentRow(r, "FRETES")),
      ...extractRows(fretes2Res).map((r) => normalizeCurrentRow(r, "FRETES2"))
    ];
  }

  async function loadHistoricalRows() {
    const { inicio, fim } = getPeriod();

    const res = await apiGet({
      action: "historico_diario_list",
      dataInicio: inicio,
      dataFim: fim
    });

    return extractRows(res).map((r) => normalizeCurrentRow(r));
  }

  async function loadCommercialRows() {
    const { inicio, fim } = getPeriod();

    const res = await apiGet({
      action: "historico_fretes_list",
      dataInicio: inicio,
      dataFim: fim
    });

    return extractRows(res).map(normalizeCommercialRow);
  }

  async function ensureModeData(mode, force = false) {
    if (mode === "ATUAL") {
      if (force || !STATE.atualRows.length) {
        STATE.atualRows = await loadCurrentRows();
      }
      loadCommonFilterOptions(STATE.atualRows);
      return;
    }

    if (mode === "HISTORICO") {
      if (force || !STATE.historicoRows.length) {
        STATE.historicoRows = await loadHistoricalRows();
      }
      loadCommonFilterOptions(STATE.historicoRows);
      return;
    }

    if (mode === "COMERCIAL") {
      if (force || !STATE.comercialRows.length) {
        STATE.comercialRows = await loadCommercialRows();
      }
      loadCommonFilterOptions(STATE.comercialRows);
      loadCommercialFilterOptions(STATE.comercialRows);
    }
  }

  async function loadData(showStatus = true, force = true) {
    if (STATE.isLoading) return;

    const mode = getMode();

    try {
      STATE.isLoading = true;
      STATE.modo = mode;

      if (showStatus) setStatus("🔄 Carregando...", true);

      await ensureModeData(mode, force);
      renderMode(mode);

      const count =
        mode === "ATUAL" ? STATE.atualRows.length :
        mode === "HISTORICO" ? STATE.historicoRows.length :
        STATE.comercialRows.length;

      if (!count) {
        setStatus(
          mode === "ATUAL"
            ? "⚠️ Sem dados em Fretes/Fretes2"
            : mode === "HISTORICO"
              ? "⚠️ Sem snapshots no período"
              : "⚠️ Sem histórico comercial no período",
          false
        );
      } else {
        const agora = new Date().toLocaleTimeString("pt-BR");
        const label =
          mode === "ATUAL" ? "Operação atual" :
          mode === "HISTORICO" ? "Histórico diário" :
          "Análise comercial";

        setStatus(`✅ ${label} carregada às ${agora}`, true);
      }
    } catch (error) {
      console.error("[bi] erro ao carregar:", error);
      setStatus("❌ Falha ao carregar", false);
      if (showStatus) {
        alert("Erro ao carregar o B.I.: " + (error.message || "Erro desconhecido"));
      }
    } finally {
      STATE.isLoading = false;
    }
  }

  function renderMode(mode = getMode()) {
    if (mode === "ATUAL") renderCurrent();
    else if (mode === "HISTORICO") renderHistorical();
    else if (mode === "COMERCIAL") renderCommercial();
  }

  /* =========================================================
     EVENTOS
  ========================================================= */

  function updateDateAvailability() {
    const mode = getMode();
    const enabled = mode === "HISTORICO" || mode === "COMERCIAL";

    if ($("#fDataInicio")) $("#fDataInicio").disabled = !enabled;
    if ($("#fDataFim")) $("#fDataFim").disabled = !enabled;
  }

  function clearFilters() {
    [
      "#fFilial", "#fCliente", "#fStatus", "#fOrigemDados", "#fBusca",
      "#fOrigem", "#fDestino", "#fProduto", "#fTipoEvento"
    ].forEach((selector) => {
      const el = $(selector);
      if (el) el.value = "";
    });

    renderMode();
  }

  function startAutoRefresh() {
    if (STATE.autoRefreshTimer) clearInterval(STATE.autoRefreshTimer);

    STATE.autoRefreshTimer = setInterval(() => {
      if (document.visibilityState === "visible" && getMode() === "ATUAL") {
        loadData(false, true);
      }
    }, AUTO_REFRESH_MS);
  }

  function bindEvents() {
    $("#btnAtualizar")?.addEventListener("click", () => loadData(true, true));
    $("#btnLimpar")?.addEventListener("click", clearFilters);
    $("#btnConsultarMercado")?.addEventListener("click", () => loadData(true, true));
    $("#btnExportarComercial")?.addEventListener("click", exportCommercialCsv);

    window.addEventListener("bi:modechange", async (event) => {
      const mode = upper(event.detail?.mode || getMode());
      STATE.modo = mode;
      updateDateAvailability();
      await loadData(true, false);
    });

    ["#fFilial", "#fCliente", "#fStatus", "#fOrigemDados"].forEach((selector) => {
      $(selector)?.addEventListener("change", () => renderMode());
    });

    $("#fBusca")?.addEventListener("input", () => renderMode());

    ["#fOrigem", "#fDestino", "#fProduto", "#fTipoEvento"].forEach((selector) => {
      $(selector)?.addEventListener("change", () => {
        if (getMode() === "COMERCIAL") renderCommercial();
      });
    });

    $("#fAgrupamentoComercial")?.addEventListener("change", () => {
      if (getMode() === "COMERCIAL") renderCommercialCharts(STATE.comercialFiltradas);
    });

    $("#fDataInicio")?.addEventListener("change", () => {
      const mode = getMode();
      if (mode === "HISTORICO" || mode === "COMERCIAL") loadData(true, true);
    });

    $("#fDataFim")?.addEventListener("change", () => {
      const mode = getMode();
      if (mode === "HISTORICO" || mode === "COMERCIAL") loadData(true, true);
    });
  }

  function init() {
    setDefaultDates();
    STATE.modo = getMode();
    updateDateAvailability();
    bindEvents();
    loadData(true, true);
    startAutoRefresh();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
