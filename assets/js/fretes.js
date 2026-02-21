/* fretes.js | NOVA FROTA (AJUSTADO + PISO S/N + CONTATO POR FILIAL + WPP POR NOME) */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzQv34T2Oi_hs5Re91N81XM1lH_5mZSkNJw8_8I6Ij4HZNFb97mcL8fNmob1Bg8ZGI6/exec";

  // ======================================================
  // ✅ LISTAS FIXAS (NO GITHUB)
  // - Contato é o RESPONSÁVEL DA FILIAL (nome)
  // - Telefone fica aqui e o ícone do WhatsApp usa isso
  // ======================================================
  const REGIONAIS = ["GOIAS", "MINAS"];

  const FILIAIS = {
    ITUMBIARA: { regional: "GOIAS", responsavel: "ARIEL" },
    "RIO VERDE": { regional: "GOIAS", responsavel: "JHONATAN" },
    MONTIVIDIU: { regional: "GOIAS", responsavel: "SERGIO" },
    ANAPOLIS: { regional: "GOIAS", responsavel: "ARIEL" }, // exemplo
  };

  const CLIENTES = ["LDC", "COFCO", "OURO SAFRA", "CARGILL"];

  // ✅ aqui você cadastra telefone por NOME do responsável
  // Pode ser com ou sem DDD, o código normaliza para 55 + número.
  const CONTATOS = {
    ARIEL: "64999999999",
    JHONATAN: "64988888888",
    SERGIO: "64977777777",
  };

  // ======================================================
  // DOM helpers
  // ======================================================
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

  function onlyLettersUpper(v) {
    // remove emoji/símbolos e deixa só letras/números/espaço
    return upper(v).replace(/[^\wÀ-ÿ ]/g, "").replace(/\s+/g, " ").trim();
  }

  // ======================================================
  // Parse número pt-BR (ex: "1.234,56" -> 1234.56)
  // ======================================================
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

  // ======================================================
  // WhatsApp helper (agora: por NOME do responsável)
  // ======================================================
  function normalizePhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";
    let digits = s.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return "";
  }

  function phoneFromContatoName(contatoName) {
    const name = onlyLettersUpper(contatoName);
    const raw = CONTATOS[name] || "";
    return normalizePhoneBR(raw);
  }

  function whatsappLinkFromName(contatoName) {
    const phone = phoneFromContatoName(contatoName);
    return phone ? "https://wa.me/" + phone : "";
  }

  // ======================================================
  // API (JSON + JSONP)
  // ======================================================
  async function apiGet(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const rawText = await res.text().catch(() => "");

    const looksHtml =
      ct.includes("text/html") ||
      /^\s*<!doctype html/i.test(rawText) ||
      /^\s*<html/i.test(rawText);

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
        data = inner ? JSON.parse(inner) : null;
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

  // ======================================================
  // COLUNAS (na ordem do HTML)
  // ======================================================
  const COLS = [
    { key: "regional" },
    { key: "filial" },
    { key: "cliente" },
    { key: "origem" },
    { key: "coleta" },

    { key: "contato", isContato: true },

    { key: "destino" },
    { key: "uf" },
    { key: "descarga" },
    { key: "volume" },

    { key: "valorEmpresa" },
    { key: "valorMotorista" },

    { key: "km" },
    { key: "pedagioEixo" },

    { key: "e5", isSN: true },
    { key: "e6", isSN: true },
    { key: "e7", isSN: true },
    { key: "e4", isSN: true },
    { key: "e9", isSN: true },

    { key: "produto" },
    { key: "icms" },

    { key: "pedidoSat" },

    { key: "porta" },
    { key: "transito" },
    { key: "status" },
    { key: "obs" },

    { key: "__acoes", isAcoes: true },
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

  // ======================================================
  // ✅ Contato: mostra nome + ícone e abre WhatsApp pelo telefone salvo em CONTATOS
  // ======================================================
  function buildContatoCell(contatoText) {
    const td = document.createElement("td");

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "6px";
    wrap.style.minWidth = "0";

    const name = onlyLettersUpper(contatoText || "");

    const span = document.createElement("span");
    span.textContent = name ? `${name} 📲` : "";
    span.style.whiteSpace = "nowrap";
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";
    span.style.minWidth = "0";
    wrap.appendChild(span);

    const wpp = name ? whatsappLinkFromName(name) : "";
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

  function buildSNCell(v) {
    const td = document.createElement("td");
    td.className = "num";
    const vv = safeText(v).toUpperCase();
    const span = document.createElement("span");
    span.className = "pillSN " + (vv === "S" ? "s" : vv === "N" ? "n" : "empty");
    span.textContent = vv || "-";
    td.appendChild(span);
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
    btnEdit.addEventListener("click", () => openModal("edit", row));

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
    e4: { eixos: 4, rkm: 7.4505, custoCC: 792.30, weightInputId: "w4", defaultPeso: 39 },
    e7: { eixos: 7, rkm: 7.4505, custoCC: 792.30, weightInputId: "w7", defaultPeso: 36 },
    e6: { eixos: 6, rkm: 6.8058, custoCC: 656.76, weightInputId: "w6", defaultPeso: 31 },
    e5: { eixos: 5, rkm: 6.1859, custoCC: 642.10, weightInputId: "w5", defaultPeso: 26 },
  };

  function getPesoFromUI(id, fallback) {
    const el = document.getElementById(id);
    const v = parsePtNumber(el?.value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  function calcMinRPorTon(param, km, pedagioPorEixo) {
    const peso = getPesoFromUI(param.weightInputId, param.defaultPeso);
    const numerador = (param.rkm * km) + param.custoCC + (pedagioPorEixo * param.eixos);
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

      return {
        ...r,
        e5: sn(vm, calcMinRPorTon(PISO_PARAMS.e5, km, ped)),
        e6: sn(vm, calcMinRPorTon(PISO_PARAMS.e6, km, ped)),
        e7: sn(vm, calcMinRPorTon(PISO_PARAMS.e7, km, ped)),
        e4: sn(vm, calcMinRPorTon(PISO_PARAMS.e4, km, ped)),
        e9: sn(vm, calcMinRPorTon(PISO_PARAMS.e9, km, ped)),
      };
    });
  }

  // ======================================================
  // ✅ MODAL (Novo/Editar)
  // - Regional, Filial, Cliente: escolhe da lista fixa
  // - Contato: autopreenche pelo responsável da filial
  // ======================================================
  const MODAL = {
    el: () => document.getElementById("modal"),
    title: () => document.getElementById("modalTitle"),
    btnClose: () => document.getElementById("btnCloseModal"),
    btnCancel: () => document.getElementById("btnCancel"),
    btnSave: () => document.getElementById("btnSave"),

    regional: () => document.getElementById("mRegional"),
    filial: () => document.getElementById("mFilial"),
    cliente: () => document.getElementById("mCliente"),
    contato: () => document.getElementById("mContato"),

    origem: () => document.getElementById("mOrigem"),
    coleta: () => document.getElementById("mColeta"),
    destino: () => document.getElementById("mDestino"),
    uf: () => document.getElementById("mUF"),
    descarga: () => document.getElementById("mDescarga"),
    produto: () => document.getElementById("mProduto"),
    km: () => document.getElementById("mKM"),
    ped: () => document.getElementById("mPed"),
    volume: () => document.getElementById("mVolume"),
    icms: () => document.getElementById("mICMS"),
    empresa: () => document.getElementById("mEmpresa"),
    motorista: () => document.getElementById("mMotorista"),
    sat: () => document.getElementById("mSat"),
    porta: () => document.getElementById("mPorta"),
    transito: () => document.getElementById("mTransito"),
    status: () => document.getElementById("mStatus"),
    obs: () => document.getElementById("mObs"),
  };

  function showModal(show) {
    const m = MODAL.el();
    if (!m) return;
    m.style.display = show ? "flex" : "none";
    m.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function closeModal() {
    showModal(false);
  }

  function applyUppercaseLive(inputEl) {
    if (!inputEl) return;
    inputEl.style.textTransform = "uppercase";
    inputEl.addEventListener("input", () => {
      inputEl.value = upper(inputEl.value);
    });
    inputEl.addEventListener("blur", () => {
      inputEl.value = upper(inputEl.value);
    });
  }

  function ensureDatalist(id) {
    let dl = document.getElementById(id);
    if (!dl) {
      dl = document.createElement("datalist");
      dl.id = id;
      document.body.appendChild(dl);
    }
    return dl;
  }

  function fillDatalist(id, items) {
    const dl = ensureDatalist(id);
    dl.innerHTML = "";
    (items || [])
      .map(upper)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        dl.appendChild(opt);
      });
  }

  function setupModalLists() {
    const reg = MODAL.regional();
    const fil = MODAL.filial();
    const cli = MODAL.cliente();
    const con = MODAL.contato();

    if (reg) reg.setAttribute("list", "dl_regional");
    if (fil) fil.setAttribute("list", "dl_filial");
    if (cli) cli.setAttribute("list", "dl_cliente");

    fillDatalist("dl_regional", REGIONAIS);
    fillDatalist("dl_filial", Object.keys(FILIAIS));
    fillDatalist("dl_cliente", CLIENTES);

    // Contato é automático pela filial
    if (con) {
      con.readOnly = true;
      con.placeholder = "RESPONSÁVEL DA FILIAL";
    }

    [reg, fil, cli].forEach(applyUppercaseLive);

    // Quando muda filial: seta regional + responsável
    fil?.addEventListener("input", () => {
      const filial = upper(fil.value);
      const info = FILIAIS[filial];
      if (info) {
        if (reg) reg.value = info.regional;
        if (con) con.value = info.responsavel; // salva só o nome
      } else {
        if (con) con.value = "";
      }
    });
  }

  let modalMode = "new";
  let editingRow = null;

  function clearModal() {
    [
      "mRegional","mFilial","mCliente","mContato","mOrigem","mColeta","mDestino","mUF","mDescarga","mProduto",
      "mKM","mPed","mVolume","mICMS","mEmpresa","mMotorista","mSat","mPorta","mTransito","mObs"
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = "";
    });
    const st = MODAL.status();
    if (st) st.value = "LIBERADO";
  }

  function fillModalFromRow(row) {
    const setU = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = upper(v);
    };
    const setR = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = safeText(v);
    };

    setU("mRegional", valueFromRow(row, "regional"));
    setU("mFilial", valueFromRow(row, "filial"));
    setU("mCliente", valueFromRow(row, "cliente"));
    setU("mContato", valueFromRow(row, "contato"));

    setU("mOrigem", valueFromRow(row, "origem"));
    setU("mColeta", valueFromRow(row, "coleta"));
    setU("mDestino", valueFromRow(row, "destino"));
    setU("mUF", valueFromRow(row, "uf"));
    setU("mDescarga", valueFromRow(row, "descarga"));
    setU("mProduto", valueFromRow(row, "produto"));

    setR("mKM", valueFromRow(row, "km"));
    setR("mPed", valueFromRow(row, "pedagioEixo"));
    setR("mVolume", valueFromRow(row, "volume"));
    setR("mICMS", valueFromRow(row, "icms"));
    setR("mEmpresa", valueFromRow(row, "valorEmpresa"));
    setR("mMotorista", valueFromRow(row, "valorMotorista"));

    setU("mSat", valueFromRow(row, "pedidoSat"));
    setU("mPorta", valueFromRow(row, "porta"));
    setR("mTransito", valueFromRow(row, "transito"));

    const st = MODAL.status();
    if (st) st.value = upper(valueFromRow(row, "status")) || "LIBERADO";

    const obs = MODAL.obs();
    if (obs) obs.value = safeText(valueFromRow(row, "obs"));
  }

  function openModal(mode, row) {
    modalMode = mode === "edit" ? "edit" : "new";
    editingRow = row || null;

    const title = MODAL.title();
    if (title) title.textContent = modalMode === "edit" ? "Editar Frete" : "Novo Frete";

    setupModalLists();

    if (modalMode === "new") clearModal();
    else fillModalFromRow(row);

    showModal(true);
    setTimeout(() => MODAL.filial()?.focus(), 50);
  }

  function readModalPayload() {
    const payload = {
      regional: upper(MODAL.regional()?.value),
      filial: upper(MODAL.filial()?.value),
      cliente: upper(MODAL.cliente()?.value),
      contato: onlyLettersUpper(MODAL.contato()?.value), // salva só nome

      origem: upper(MODAL.origem()?.value),
      coleta: upper(MODAL.coleta()?.value),
      destino: upper(MODAL.destino()?.value),
      uf: upper(MODAL.uf()?.value),
      descarga: upper(MODAL.descarga()?.value),
      produto: upper(MODAL.produto()?.value),

      km: safeText(MODAL.km()?.value),
      pedagioEixo: safeText(MODAL.ped()?.value),
      volume: safeText(MODAL.volume()?.value),
      icms: safeText(MODAL.icms()?.value),
      valorEmpresa: safeText(MODAL.empresa()?.value),
      valorMotorista: safeText(MODAL.motorista()?.value),

      pedidoSat: upper(MODAL.sat()?.value),
      porta: upper(MODAL.porta()?.value),
      transito: safeText(MODAL.transito()?.value),
      status: upper(MODAL.status()?.value),
      obs: safeText(MODAL.obs()?.value),
    };
    return payload;
  }

  async function saveModal() {
    const payload = readModalPayload();

    if (!payload.filial) return alert("Informe a FILIAL.");
    if (!payload.cliente) return alert("Informe o CLIENTE.");

    // garante que contato bate com filial (se existir no mapa)
    const info = FILIAIS[payload.filial];
    if (info) {
      payload.regional = info.regional;
      payload.contato = info.responsavel;
    }

    try {
      setStatus("💾 Salvando...");

      const id = editingRow?.id ? String(editingRow.id) : "";

      const tries = modalMode === "edit"
        ? [
            { action: "update", id, ...payload },
            { action: "edit", id, ...payload },
            { action: "upsert", id, ...payload },
            { action: "save", id, ...payload },
          ]
        : [
            { action: "create", ...payload },
            { action: "add", ...payload },
            { action: "insert", ...payload },
            { action: "upsert", ...payload },
            { action: "save", ...payload },
          ];

      let last = null;
      for (const p of tries) {
        try {
          const data = await apiGet(p);
          if (data?.ok) {
            setStatus("✅ Salvo");
            closeModal();
            await atualizar();
            return;
          }
          last = data;
        } catch (e) {
          last = e;
        }
      }

      console.error("[fretes] falha save tries:", last);
      setStatus("❌ Falha ao salvar");
      alert("Não consegui salvar no Apps Script. Se você me mandar o doGet/doPost do Apps Script, eu amarro a action certa.");
    } catch (e) {
      console.error("[fretes] erro salvar:", e);
      setStatus("❌ Erro ao salvar");
      alert("Erro ao salvar. Veja o console (F12).");
    }
  }

  function bindModalButtons() {
    MODAL.btnClose()?.addEventListener("click", closeModal);
    MODAL.btnCancel()?.addEventListener("click", closeModal);
    MODAL.btnSave()?.addEventListener("click", saveModal);

    MODAL.el()?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "modal") closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && MODAL.el()?.style.display === "flex") closeModal();
    });
  }

  // ======================================================
  // RENDER (agrupa por filial, ordena por cliente)
  // ======================================================
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

        if (col.isSN) {
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

  // ======================================================
  // AÇÕES
  // ======================================================
  async function atualizar() {
    try {
      setStatus("🔄 Carregando...");
      const rows = await fetchRows();
      render(rows);
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

    if (btnNovo) {
      btnNovo.addEventListener("click", () => openModal("new", null));
    }

    ["#w9", "#w4", "#w7", "#w6", "#w5"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", () => atualizar());
    });

    bindModalButtons();
  }

  function init() {
    bindButtons();
    atualizar();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
