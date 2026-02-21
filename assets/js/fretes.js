/* fretes.js | NOVA FROTA (AJUSTADO + PISO S/N + MODAL + SELECTS) */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzQv34T2Oi_hs5Re91N81XM1lH_5mZSkNJw8_8I6Ij4HZNFb97mcL8fNmob1Bg8ZGI6/exec";

  // ----------------------------
  // DOM helpers
  // ----------------------------
  const $ = (sel) => document.querySelector(sel);

  function getTbody() {
    return document.querySelector("#tbody") || document.querySelector("tbody");
  }

  function setStatus(text) {
    const el =
      document.querySelector("[data-sync-status]") ||
      document.querySelector("#syncStatus") ||
      document.querySelector("#status") ||
      document.querySelector(".syncStatus");
    if (el) el.textContent = text;
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function upper(v) {
    return safeText(v).toUpperCase();
  }

  function uniqSorted(arr) {
    return Array.from(new Set((arr || []).map((x) => safeText(x)).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function setSelectOptions(selectEl, items, placeholder = "SELECIONE") {
    if (!selectEl) return;
    const cur = selectEl.value;
    selectEl.innerHTML = "";
    const op0 = document.createElement("option");
    op0.value = "";
    op0.textContent = placeholder;
    selectEl.appendChild(op0);

    (items || []).forEach((it) => {
      const op = document.createElement("option");
      op.value = it;
      op.textContent = it;
      selectEl.appendChild(op);
    });

    // tenta preservar seleção se ainda existir
    if (cur && items.includes(cur)) selectEl.value = cur;
  }

  // ----------------------------
  // Parse número pt-BR (ex: "1.234,56" -> 1234.56)
  // ----------------------------
  function parsePtNumber(value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;

    let s = String(value).trim();
    if (!s) return NaN;

    s = s.replace(/\s+/g, "").replace(/[^\d.,-]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function ceil0(n) {
    return Math.ceil(n);
  }

  // ----------------------------
  // WhatsApp helper
  // ----------------------------
  function extractPhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";
    let digits = s.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return "";
  }

  function whatsappLinkFromContato(contato) {
    const phone = extractPhoneBR(contato);
    return phone ? "https://wa.me/" + phone : "";
  }

  // ----------------------------
  // API (JSON + JSONP)
  // ----------------------------
  async function apiGet(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const rawText = await res.text().catch(() => "");

    const looksHtml =
      ct.includes("text/html") || /^\s*<!doctype html/i.test(rawText) || /^\s*<html/i.test(rawText);

    if (looksHtml) {
      const err = new Error("API retornou HTML (deploy/permissão do Apps Script).");
      err.httpStatus = res.status;
      err.url = url.toString();
      err.preview = rawText.slice(0, 260);
      throw err;
    }

    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      const t = String(rawText || "").trim();
      const p1 = t.indexOf("(");
      const p2 = t.lastIndexOf(")");

      const looksJsonp = p1 > 0 && p2 > p1 && /^[a-zA-Z_$][\w$]*\s*\(/.test(t);

      if (looksJsonp) {
        const inner = t.slice(p1 + 1, p2).trim();
        try {
          data = inner ? JSON.parse(inner) : null;
        } catch {
          const err = new Error("Falha ao interpretar JSONP da API.");
          err.url = url.toString();
          err.preview = t.slice(0, 260);
          throw err;
        }
      } else {
        const err = new Error("Falha ao interpretar JSON da API.");
        err.url = url.toString();
        err.preview = t.slice(0, 260);
        throw err;
      }
    }

    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.httpStatus = res.status;
      err.data = data;
      err.url = url.toString();
      throw err;
    }

    return data;
  }

  async function fetchRows() {
    const tries = [{ action: "list" }, { action: "rows" }, {}];
    let lastErr = null;

    for (const p of tries) {
      try {
        const data = await apiGet(p);
        const rows =
          data?.data ||
          data?.rows ||
          data?.fretes ||
          data?.result ||
          (Array.isArray(data) ? data : null);

        if (Array.isArray(rows)) return rows;
        lastErr = new Error("Resposta sem array de linhas (params: " + JSON.stringify(p) + ")");
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Falha ao buscar dados.");
  }

  // ----------------------------
  // COLUNAS (na ordem do HTML)
  // ----------------------------
  const COLS = [
    { key: "regional", label: "Regional" },
    { key: "filial", label: "Filial" },
    { key: "cliente", label: "Cliente" },
    { key: "origem", label: "Origem" },
    { key: "coleta", label: "Coleta" },

    { key: "contato", label: "Contato", isContato: true },

    { key: "destino", label: "Destino" },
    { key: "uf", label: "UF" },
    { key: "descarga", label: "Descarga" },
    { key: "volume", label: "Volume" },

    { key: "valorEmpresa", label: "Vlr Empresa" },
    { key: "valorMotorista", label: "Vlr Motorista" },

    { key: "km", label: "KM" },
    { key: "pedagioEixo", label: "Pedágio/Eixo" },

    { key: "e5", label: "5E" },
    { key: "e6", label: "6E" },
    { key: "e7", label: "7E" },
    { key: "e4", label: "4E" },
    { key: "e9", label: "9E" },

    { key: "produto", label: "Produto" },
    { key: "icms", label: "ICMS" },

    { key: "pedidoSat", label: "Pedido SAT" },

    { key: "porta", label: "Porta" },
    { key: "transito", label: "Trânsito" },
    { key: "status", label: "Status" },
    { key: "obs", label: "Observações" },

    { key: "__acoes", label: "Ações", isAcoes: true },
  ];

  function valueFromRow(row, key, index) {
    if (Array.isArray(row)) return safeText(row[index] ?? "");

    if (row && typeof row === "object") {
      const map = {
        regional: ["regional"],
        filial: ["filial"],
        cliente: ["cliente"],
        origem: ["origem"],
        coleta: ["coleta"],
        contato: ["contato", "contatos", "telefone", "fone"],
        destino: ["destino"],
        uf: ["uf", "estado"],
        descarga: ["descarga"],
        volume: ["volume"],

        valorEmpresa: ["valorEmpresa", "vlrEmpresa", "empresa"],
        valorMotorista: ["valorMotorista", "vlrMotorista", "motorista"],

        km: ["km"],
        pedagioEixo: ["pedagioEixo", "pedagio", "pedagio_por_eixo"],

        e5: ["e5", "5e"],
        e6: ["e6", "6e"],
        e7: ["e7", "7e"],
        e4: ["e4", "4e"],
        e9: ["e9", "9e"],

        produto: ["produto"],
        icms: ["icms"],

        pedidoSat: ["pedidoSat", "pedidoSAT", "pedido", "sat"],

        porta: ["porta"],
        transito: ["transito", "trânsito", "transitoDias"],
        status: ["status"],
        obs: ["obs", "observacao", "observações", "observacoes"],
      };

      const candidates = map[key] || [key];
      for (const c of candidates) {
        if (c in row) return safeText(row[c]);
      }
    }
    return "";
  }

  function buildContatoCell(contatoText) {
    const td = document.createElement("td");

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "6px";
    wrap.style.minWidth = "0";

    const span = document.createElement("span");
    span.textContent = contatoText || "";
    span.style.whiteSpace = "nowrap";
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";
    span.style.minWidth = "0";
    wrap.appendChild(span);

    const wpp = whatsappLinkFromContato(contatoText);
    if (wpp) {
      const a = document.createElement("a");
      a.href = wpp;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Chamar no WhatsApp";
      a.className = "waIcon";

      const img = document.createElement("img");
      img.src = "../assets/img/whatsapp.png";
      img.alt = "WhatsApp";
      img.onerror = () => {
        a.textContent = "📞";
        a.style.background = "#EEF2F7";
      };

      a.appendChild(img);
      wrap.appendChild(a);
    }

    td.appendChild(wrap);
    return td;
  }

  function buildAcoesCell(row) {
    const td = document.createElement("td");
    td.className = "num";

    const id = row?.id ? String(row.id) : "";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btnTiny ghost";
    btnEdit.textContent = "Editar";
    btnEdit.style.marginRight = "6px";
    btnEdit.addEventListener("click", () => {
      openModal("edit", row);
    });

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btnTiny";
    btnDel.textContent = "Excluir";
    btnDel.addEventListener("click", async () => {
      if (!id) return alert("Sem ID para excluir.");
      if (!confirm("Excluir este frete?")) return;

      try {
        setStatus("🗑 Excluindo...");
        const data = await apiGet({ action: "delete", id });
        if (data?.ok) {
          setStatus("✅ Excluído");
          await atualizar();
        } else {
          setStatus("❌ Falha ao excluir");
          alert(data?.error || "Falha ao excluir.");
        }
      } catch (e) {
        console.error("[fretes] erro delete:", e);
        setStatus("❌ Erro ao excluir");
      }
    });

    td.appendChild(btnEdit);
    td.appendChild(btnDel);
    return td;
  }

  // ======================================================
  // ✅ PISO MÍNIMO (S/N)
  // ======================================================
  const PISO_PARAMS = {
    e9: { eixos: 9, rkm: 8.53, custoCC: 877.83, weightInputId: "w9", defaultPeso: 47 },
    e4: { eixos: 4, rkm: 7.4505, custoCC: 792.3, weightInputId: "w4", defaultPeso: 39 },
    e7: { eixos: 7, rkm: 7.4505, custoCC: 792.3, weightInputId: "w7", defaultPeso: 36 },
    e6: { eixos: 6, rkm: 6.8058, custoCC: 656.76, weightInputId: "w6", defaultPeso: 31 },
    e5: { eixos: 5, rkm: 6.1859, custoCC: 642.1, weightInputId: "w5", defaultPeso: 26 },
  };

  function getPesoFromUI(id, fallback) {
    const el = document.getElementById(id);
    const v = parsePtNumber(el?.value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  function calcMinRPorTon(param, km, pedagioPorEixo) {
    const peso = getPesoFromUI(param.weightInputId, param.defaultPeso);
    const numerador = param.rkm * km + param.custoCC + pedagioPorEixo * param.eixos;
    const base = numerador / peso;
    return ceil0(base);
  }

  function sn(valueMotoristaTon, minTon) {
    if (!Number.isFinite(valueMotoristaTon) || !Number.isFinite(minTon)) return "";
    return valueMotoristaTon >= minTon ? "S" : "N";
  }

  function applyPisoSN(rows) {
    return (rows || []).map((r) => {
      const km = parsePtNumber(valueFromRow(r, "km")) || 0;
      const ped = parsePtNumber(valueFromRow(r, "pedagioEixo")) || 0;
      const vm = parsePtNumber(valueFromRow(r, "valorMotorista"));

      const min5 = calcMinRPorTon(PISO_PARAMS.e5, km, ped);
      const min6 = calcMinRPorTon(PISO_PARAMS.e6, km, ped);
      const min7 = calcMinRPorTon(PISO_PARAMS.e7, km, ped);
      const min4 = calcMinRPorTon(PISO_PARAMS.e4, km, ped);
      const min9 = calcMinRPorTon(PISO_PARAMS.e9, km, ped);

      return {
        ...r,
        e5: sn(vm, min5),
        e6: sn(vm, min6),
        e7: sn(vm, min7),
        e4: sn(vm, min4),
        e9: sn(vm, min9),
      };
    });
  }

  // ======================================================
  // ✅ CACHE (para repopular selects sem bater na API toda hora)
  // ======================================================
  let ROWS_CACHE = [];

  // ======================================================
  // ✅ SELECTS DO MODAL (regional/filial/contato)
  // ======================================================
  function getModalEls() {
    return {
      modal: document.getElementById("modal"),
      title: document.getElementById("modalTitle"),
      btnClose: document.getElementById("btnCloseModal"),
      btnCancel: document.getElementById("btnCancel"),
      btnSave: document.getElementById("btnSave"),

      mRegional: document.getElementById("mRegional"),
      mFilial: document.getElementById("mFilial"),
      mContato: document.getElementById("mContato"),

      mCliente: document.getElementById("mCliente"),
      mOrigem: document.getElementById("mOrigem"),
      mColeta: document.getElementById("mColeta"),
      mDestino: document.getElementById("mDestino"),
      mUF: document.getElementById("mUF"),
      mDescarga: document.getElementById("mDescarga"),
      mProduto: document.getElementById("mProduto"),
      mKM: document.getElementById("mKM"),
      mPed: document.getElementById("mPed"),
      mVolume: document.getElementById("mVolume"),
      mICMS: document.getElementById("mICMS"),
      mEmpresa: document.getElementById("mEmpresa"),
      mMotorista: document.getElementById("mMotorista"),
      mSat: document.getElementById("mSat"),
      mPorta: document.getElementById("mPorta"),
      mTransito: document.getElementById("mTransito"),
      mStatus: document.getElementById("mStatus"),
      mObs: document.getElementById("mObs"),
    };
  }

  let MODAL_MODE = "new"; // new | edit
  let EDIT_ID = ""; // id do registro em edição (se existir)

  function enforceUppercaseOnInput(el) {
    if (!el) return;
    el.addEventListener("input", () => {
      // não mexe em números
      if (el.type === "number") return;
      if (el.tagName === "SELECT") return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = upper(el.value);
      try {
        el.setSelectionRange(start, end);
      } catch {}
    });
  }

  function bindUppercaseModal() {
    const m = getModalEls();
    [
      m.mCliente,
      m.mOrigem,
      m.mColeta,
      m.mDestino,
      m.mUF,
      m.mDescarga,
      m.mProduto,
      m.mSat,
      m.mPorta,
      m.mTransito,
      m.mObs,
    ].forEach(enforceUppercaseOnInput);

    // também pode forçar uppercase nos selects se você digitar opção manual no futuro
  }

  function modalShow(show) {
    const m = getModalEls();
    if (!m.modal) return;
    m.modal.style.display = show ? "flex" : "none";
    m.modal.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function clearModalFields() {
    const m = getModalEls();
    EDIT_ID = "";
    [
      m.mCliente,
      m.mOrigem,
      m.mColeta,
      m.mDestino,
      m.mUF,
      m.mDescarga,
      m.mProduto,
      m.mKM,
      m.mPed,
      m.mVolume,
      m.mICMS,
      m.mEmpresa,
      m.mMotorista,
      m.mSat,
      m.mPorta,
      m.mTransito,
      m.mObs,
    ].forEach((el) => {
      if (el) el.value = "";
    });
    if (m.mStatus) m.mStatus.value = "LIBERADO";
  }

  function populateModalSelectsFromRows(rows) {
    const m = getModalEls();
    if (!m.mRegional || !m.mFilial || !m.mContato) return;

    const all = rows || [];

    const regionais = uniqSorted(all.map((r) => valueFromRow(r, "regional")));
    setSelectOptions(m.mRegional, regionais);

    // filial e contato começam vazios até escolher regional
    setSelectOptions(m.mFilial, []);
    setSelectOptions(m.mContato, []);
  }

  function updateFiliaisByRegional(regional) {
    const m = getModalEls();
    if (!m.mFilial) return;

    const reg = safeText(regional);
    const filiais = uniqSorted(
      ROWS_CACHE.filter((r) => safeText(valueFromRow(r, "regional")) === reg).map((r) =>
        valueFromRow(r, "filial")
      )
    );

    setSelectOptions(m.mFilial, filiais);
    setSelectOptions(m.mContato, []);
  }

  function updateContatosByFilial(regional, filial) {
    const m = getModalEls();
    if (!m.mContato) return;

    const reg = safeText(regional);
    const fil = safeText(filial);

    const contatos = uniqSorted(
      ROWS_CACHE.filter((r) => {
        return (
          safeText(valueFromRow(r, "regional")) === reg &&
          safeText(valueFromRow(r, "filial")) === fil
        );
      }).map((r) => valueFromRow(r, "contato"))
    );

    setSelectOptions(m.mContato, contatos);
  }

  function openModal(mode, row) {
    const m = getModalEls();
    if (!m.modal) return;

    MODAL_MODE = mode === "edit" ? "edit" : "new";
    clearModalFields();

    // garante selects populados
    populateModalSelectsFromRows(ROWS_CACHE);

    if (MODAL_MODE === "new") {
      if (m.title) m.title.textContent = "Novo Frete";
    } else {
      if (m.title) m.title.textContent = "Editar Frete";
      // preenche campos com base na linha
      EDIT_ID = row?.id ? String(row.id) : "";

      // selects: regional/filial/contato em cascata
      const reg = safeText(valueFromRow(row, "regional"));
      const fil = safeText(valueFromRow(row, "filial"));
      const con = safeText(valueFromRow(row, "contato"));

      if (m.mRegional) m.mRegional.value = reg;
      updateFiliaisByRegional(reg);
      if (m.mFilial) m.mFilial.value = fil;
      updateContatosByFilial(reg, fil);
      if (m.mContato) m.mContato.value = con;

      if (m.mCliente) m.mCliente.value = upper(valueFromRow(row, "cliente"));
      if (m.mOrigem) m.mOrigem.value = upper(valueFromRow(row, "origem"));
      if (m.mColeta) m.mColeta.value = upper(valueFromRow(row, "coleta"));
      if (m.mDestino) m.mDestino.value = upper(valueFromRow(row, "destino"));
      if (m.mUF) m.mUF.value = upper(valueFromRow(row, "uf"));
      if (m.mDescarga) m.mDescarga.value = upper(valueFromRow(row, "descarga"));
      if (m.mProduto) m.mProduto.value = upper(valueFromRow(row, "produto"));

      if (m.mKM) m.mKM.value = valueFromRow(row, "km");
      if (m.mPed) m.mPed.value = valueFromRow(row, "pedagioEixo");
      if (m.mVolume) m.mVolume.value = valueFromRow(row, "volume");
      if (m.mICMS) m.mICMS.value = valueFromRow(row, "icms");
      if (m.mEmpresa) m.mEmpresa.value = valueFromRow(row, "valorEmpresa");
      if (m.mMotorista) m.mMotorista.value = valueFromRow(row, "valorMotorista");

      if (m.mSat) m.mSat.value = upper(valueFromRow(row, "pedidoSat"));
      if (m.mPorta) m.mPorta.value = upper(valueFromRow(row, "porta"));
      if (m.mTransito) m.mTransito.value = upper(valueFromRow(row, "transito"));

      if (m.mStatus) m.mStatus.value = upper(valueFromRow(row, "status") || "LIBERADO");
      if (m.mObs) m.mObs.value = upper(valueFromRow(row, "obs"));
    }

    modalShow(true);
  }

  function closeModal() {
    modalShow(false);
  }

  function modalPayload() {
    const m = getModalEls();

    // tudo em maiúsculo (exceto números)
    const payload = {
      id: EDIT_ID || "",
      regional: upper(m.mRegional?.value),
      filial: upper(m.mFilial?.value),
      cliente: upper(m.mCliente?.value),
      origem: upper(m.mOrigem?.value),
      coleta: upper(m.mColeta?.value),
      contato: upper(m.mContato?.value),
      destino: upper(m.mDestino?.value),
      uf: upper(m.mUF?.value),
      descarga: upper(m.mDescarga?.value),
      volume: safeText(m.mVolume?.value),
      valorEmpresa: safeText(m.mEmpresa?.value),
      valorMotorista: safeText(m.mMotorista?.value),
      km: safeText(m.mKM?.value),
      pedagioEixo: safeText(m.mPed?.value),
      produto: upper(m.mProduto?.value),
      icms: safeText(m.mICMS?.value),
      pedidoSat: upper(m.mSat?.value),
      porta: upper(m.mPorta?.value),
      transito: upper(m.mTransito?.value),
      status: upper(m.mStatus?.value),
      obs: upper(m.mObs?.value),
    };

    return payload;
  }

  function validatePayload(p) {
    // mínimos essenciais
    if (!p.regional) return "Informe a REGIONAL.";
    if (!p.filial) return "Informe a FILIAL.";
    if (!p.cliente) return "Informe o CLIENTE.";
    if (!p.origem) return "Informe a ORIGEM.";
    if (!p.destino) return "Informe o DESTINO.";
    if (!p.valorMotorista) return "Informe VLR MOTORISTA.";
    if (!p.km) return "Informe KM.";
    return "";
  }

  async function saveModal() {
    const p = modalPayload();
    const msg = validatePayload(p);
    if (msg) return alert(msg);

    try {
      setStatus("💾 Salvando...");
      // tenta upsert, se backend não suportar, tenta create
      let data = await apiGet({ action: "upsert", ...p }).catch(() => null);
      if (!data) data = await apiGet({ action: "create", ...p });

      if (data?.ok) {
        setStatus("✅ Salvo");
        closeModal();
        await atualizar();
      } else {
        setStatus("❌ Falha ao salvar");
        alert(data?.error || "Falha ao salvar. Verifique sua API (action upsert/create).");
      }
    } catch (e) {
      console.error("[fretes] erro save:", e);
      setStatus("❌ Erro ao salvar");
      alert("Erro ao salvar. Confira o console e a action do Apps Script.");
    }
  }

  // ======================================================
  // ✅ RENDER (agrupa por filial, ordena por cliente)
  // ======================================================
  function buildSNCell(val) {
    const td = document.createElement("td");
    td.className = "num";
    const v = safeText(val).toUpperCase();

    const span = document.createElement("span");
    span.className = "pillSN " + (v === "S" ? "s" : v === "N" ? "n" : "empty");
    span.textContent = v || "-";

    td.appendChild(span);
    return td;
  }

  function isSNKey(k) {
    return k === "e5" || k === "e6" || k === "e7" || k === "e4" || k === "e9";
  }

  function render(rowsRaw) {
    const tbody = getTbody();
    if (!tbody) return;

    tbody.innerHTML = "";
    if (!rowsRaw || !rowsRaw.length) return;

    const rows = applyPisoSN(rowsRaw);

    rows.sort((a, b) => {
      const fa = safeText(a?.filial).localeCompare(safeText(b?.filial));
      if (fa !== 0) return fa;

      const ca = safeText(a?.cliente).localeCompare(safeText(b?.cliente));
      if (ca !== 0) return ca;

      const oa = safeText(a?.origem).localeCompare(safeText(b?.origem));
      if (oa !== 0) return oa;

      return safeText(a?.destino).localeCompare(safeText(b?.destino));
    });

    let filialAtual = "";

    rows.forEach((row) => {
      const filialRow = safeText(row?.filial);
      if (filialRow !== filialAtual) {
        filialAtual = filialRow;

        const trGroup = document.createElement("tr");
        trGroup.className = "groupRow";

        const td = document.createElement("td");
        td.colSpan = COLS.length;
        td.textContent = filialAtual || "SEM FILIAL";

        trGroup.appendChild(td);
        tbody.appendChild(trGroup);
      }

      const tr = document.createElement("tr");

      COLS.forEach((col, idx) => {
        if (col.isContato) {
          const contatoText = valueFromRow(row, "contato", idx);
          tr.appendChild(buildContatoCell(contatoText));
          return;
        }

        if (col.isAcoes) {
          tr.appendChild(buildAcoesCell(row));
          return;
        }

        if (isSNKey(col.key)) {
          tr.appendChild(buildSNCell(valueFromRow(row, col.key, idx)));
          return;
        }

        const td = document.createElement("td");
        td.textContent = valueFromRow(row, col.key, idx);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ----------------------------
  // AÇÕES
  // ----------------------------
  async function atualizar() {
    try {
      setStatus("🔄 Carregando...");
      const rows = await fetchRows();
      ROWS_CACHE = Array.isArray(rows) ? rows : [];
      render(ROWS_CACHE);
      // garante selects do modal atualizados
      populateModalSelectsFromRows(ROWS_CACHE);
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[fretes] erro ao atualizar:", e);

      if (String(e?.message || "").includes("retornou HTML")) {
        setStatus("❌ Erro ao sincronizar (deploy/permissão)");
        console.warn("[fretes] Trecho retorno:", e.preview || "");
      } else {
        setStatus("❌ Erro ao sincronizar");
      }
    }
  }

  function bindButtons() {
    const btnAtualizar = $("#btnReloadFromSheets");
    const btnNovo = $("#btnNew");

    if (btnAtualizar) btnAtualizar.addEventListener("click", atualizar);

    // ✅ abre modal NOVO
    if (btnNovo) {
      btnNovo.addEventListener("click", () => {
        openModal("new");
      });
    }

    // ✅ modal binds
    const m = getModalEls();

    if (m.btnClose) m.btnClose.addEventListener("click", closeModal);
    if (m.btnCancel) m.btnCancel.addEventListener("click", closeModal);

    // fechar clicando fora
    if (m.modal) {
      m.modal.addEventListener("click", (ev) => {
        if (ev.target && ev.target.id === "modal") closeModal();
      });
    }

    if (m.btnSave) m.btnSave.addEventListener("click", saveModal);

    // ✅ cascata selects
    if (m.mRegional) {
      m.mRegional.addEventListener("change", () => {
        updateFiliaisByRegional(m.mRegional.value);
      });
    }
    if (m.mFilial) {
      m.mFilial.addEventListener("change", () => {
        const reg = getModalEls().mRegional?.value || "";
        updateContatosByFilial(reg, m.mFilial.value);
      });
    }

    // ✅ pesos mudaram -> recalcula S/N (sem dor)
    ["#w9", "#w4", "#w7", "#w6", "#w5"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", () => {
        // re-render do cache (sem API) se já temos dados
        if (ROWS_CACHE.length) render(ROWS_CACHE);
        else atualizar();
      });
    });

    // ✅ enforce uppercase nos inputs do modal
    bindUppercaseModal();
  }

  function init() {
    bindButtons();
    atualizar();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
