/* administrativo.js | NOVA FROTA (tabs + filtros + cheques por filial + novas abas + modal) */
(function () {
  "use strict";

  // ======================================================
  // ✅ COLE AQUI A URL DO SEU WEB APP (Apps Script /exec)
  // ======================================================
  const API_URL = "https://script.google.com/macros/s/AKfycbzQv34T2Oi_hs5Re91N81XM1lH_5mZSkNJw8_8I6Ij4HZNFb97mcL8fNmob1Bg8ZGI6/exec";

  // ======================================================
  // ✅ DRIVE (RAIZ) - Pasta ADMINISTRATIVO
  // Link: https://drive.google.com/drive/u/0/folders/1pXzVZWQrkgJb2E9JJeKP72h1cANovXhl
  // ======================================================
  const DRIVE_FOLDER_ID = "1pXzVZWQrkgJb2E9JJeKP72h1cANovXhl";

  // ======================================================
  // ✅ FILIAIS (ordem fixa)
  // ======================================================
  const FILIAIS = [
    "ITUMBIARA",
    "RIO VERDE",
    "JATAI",
    "MINEIROS",
    "CHAPADAO DO CEU",
    "MONTIVIDIU",
    "INDIARA",
    "BOM JESUS DE GO",
    "VIANOPOLIS",
    "ANAPOLIS",
    "URUAÇU",
  ];

  // ======================================================
  // ✅ STORAGE (para Solicitações/Patrimônio/EPIs enquanto não liga no Sheets)
  // ======================================================
  const LS_KEYS = {
    solicit: "nf_admin_solicitacoes_v1",
    patrimonio: "nf_admin_patrimonio_v1",
    epis: "nf_admin_epis_v1",
    frota: "nf_admin_frota_v1",
  };

  function loadLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : fallback;
    } catch {
      return fallback;
    }
  }
  function saveLS(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr || [])); } catch {}
  }

  // ======================================================
  // ✅ DADOS
  // - cheques vem do Sheets via API
  // - outros ficam locais (já funcionando)
  // ======================================================
  const DATA = {
    frota: loadLS(LS_KEYS.frota, [
      { id: uid(), placa: "ABC1D23", condutor: "PEDRO SANTOS", filial: "ITUMBIARA", status: "OK", mes: "MAR/2026" },
      { id: uid(), placa: "XYZ2E34", condutor: "LUCAS SILVA", filial: "RIO VERDE", status: "PENDENTE", mes: "ABR/2026" },
    ]),
    cheques: [],
    solicitacoes: loadLS(LS_KEYS.solicit, [
      { id: uid(), filial: "ITUMBIARA", tipo: "CHEQUES", observacao: "PRECISO DE MAIS 2 TALÕES", status: "ABERTA", data: todayBR() },
    ]),
    patrimonio: loadLS(LS_KEYS.patrimonio, [
      { id: uid(), filial: "ITUMBIARA", equipamento: "NOTEBOOK", numeroPatrimonio: "NF-001", posse: "ARIEL", status: "ATIVO", observacao: "" },
    ]),
    epis: loadLS(LS_KEYS.epis, [
      { id: uid(), filial: "RIO VERDE", colaborador: "JOÃO", epi: "BOTA", qtd: "1", dataEntrega: todayBR(), validade: "", observacao: "" },
    ]),
  };

  // ----------------------------
  // helpers DOM
  // ----------------------------
  const $ = (sel) => document.querySelector(sel);

  function uid() {
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }
  function upper(v) { return String(v ?? "").trim().toUpperCase(); }
  function safeText(v) { return String(v ?? "").trim(); }
  function todayBR() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  function setStatus(text) {
    const el = $("#adminSyncStatus");
    if (el) el.textContent = text;
  }

  // ----------------------------
  // API helpers
  // ----------------------------
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
        err.preview = t.slice(0, 260);
        throw err;
      }
    }

    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.httpStatus = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  async function apiPost(jsonObj) {
    const res = await fetch(API_URL, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonObj || {}),
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const rawText = await res.text().catch(() => "");

    const looksHtml =
      ct.includes("text/html") ||
      /^\s*<!doctype html/i.test(rawText) ||
      /^\s*<html/i.test(rawText);

    if (looksHtml) {
      const err = new Error("API retornou HTML (deploy/permissão do Apps Script).");
      err.httpStatus = res.status;
      err.preview = rawText.slice(0, 260);
      throw err;
    }

    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      const err = new Error("Falha ao interpretar JSON da API (POST).");
      err.preview = String(rawText || "").slice(0, 260);
      throw err;
    }

    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.httpStatus = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // ======================================================
  // ✅ CHEQUES: lista do Sheets + render fixo por filial
  // ======================================================
  function normalizeChequeRow(r) {
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      data: safeText(r?.data),
      sequencia: safeText(r?.sequencia),
      responsavel: upper(r?.responsavel),
      status: upper(r?.status || "ATIVO"),
      termoUrl: safeText(r?.termoUrl),
      termoNome: safeText(r?.termoNome),
      createdAt: Number(r?.createdAt || 0) || 0,
      updatedAt: Number(r?.updatedAt || 0) || 0,
    };
  }

  function parseBRDate(s) {
    const t = String(s || "").trim();
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return 0;
    const dd = Number(m[1]), mm = Number(m[2]), yy = Number(m[3]);
    return new Date(yy, mm - 1, dd).getTime();
  }

  function sortCheques(list) {
    return (list || []).slice().sort((a, b) => {
      const ta = parseBRDate(a.data);
      const tb = parseBRDate(b.data);
      if (tb !== ta) return tb - ta;
      return String(b.sequencia || "").localeCompare(String(a.sequencia || ""));
    });
  }

  async function loadChequesFromSheets() {
    if (!API_URL || API_URL.includes("COLE_AQUI")) return;

    const res = await apiGet({ action: "cheques_list" });
    const arr = res?.data || [];
    DATA.cheques = sortCheques(arr.map(normalizeChequeRow));
  }

  async function createChequeOnSheets(payload) {
    const body = {
      action: "cheques_add",
      filial: upper(payload.filial),
      data: safeText(payload.data),
      sequencia: safeText(payload.sequencia),
      responsavel: upper(payload.responsavel),
      status: upper(payload.status || "ATIVO"),
    };
    return apiPost(body);
  }

  // ======================================================
  // ✅ UI: tabs + filtros
  // ======================================================
  function setActiveTab(tab) {
    document.querySelectorAll(".tabBtn").forEach((b) => {
      b.classList.toggle("isActive", b.dataset.tab === tab);
    });
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("isActive"));
    const view = document.getElementById("view-" + tab);
    if (view) view.classList.add("isActive");

    const title = $("#panelTitle");
    if (title) {
      title.textContent =
        tab === "frota" ? "Frota Leve" :
        tab === "cheques" ? "Cheques em circulação" :
        tab === "solicitacoes" ? "Solicitações" :
        tab === "patrimonio" ? "Patrimônio" : "Controle de EPIs";
    }

    const inp = $("#fBuscaAdmin");
    if (inp) inp.value = "";
    renderAll();
  }

  function fillFiliaisSelect() {
    const sel = $("#fFilialAdmin");
    if (!sel) return;
    sel.innerHTML = `<option value="">Todas as filiais</option>`;
    FILIAIS.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      sel.appendChild(opt);
    });
  }

  function pillClassFromStatus(status) {
    const s = upper(status);
    if (s === "OK" || s === "ATIVO") return "ok";
    if (s === "ATRASADO") return "atrasado";
    if (s === "ABERTA") return "aberta";
    if (s === "EM ANDAMENTO") return "andamento";
    if (s === "FINALIZADA") return "finalizada";
    return "pendente";
  }

  function applyFilters(list) {
    const selFilial = upper($("#fFilialAdmin")?.value || "");
    const q = upper($("#fBuscaAdmin")?.value || "");

    return (list || []).filter((it) => {
      if (selFilial) {
        const f = upper(it.filial || "");
        if (f !== selFilial) return false;
      }
      if (q) {
        const blob = upper(JSON.stringify(it));
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }

  // ======================================================
  // ✅ Render
  // ======================================================
  function renderFrota(list) {
    const wrap = $("#gridFrota");
    if (!wrap) return;
    wrap.innerHTML = "";

    list.forEach((it) => {
      const card = document.createElement("div");
      card.className = "adminCard";
      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">${upper(it.placa).slice(0,2)}</div>
          <div class="adminMain">
            <div class="big">${upper(it.placa)}</div>
            <div class="smallLine">${safeText(it.condutor)}</div>
            <div class="tagLine">${upper(it.filial)}</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${pillClassFromStatus(it.status)}">${upper(it.mes)} ${upper(it.status)}</span>
          <button class="linkBtn" type="button" data-upload="checklist" data-placa="${upper(it.placa)}">Upload checklist mensal</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  function groupChequesByFilial(list) {
    const map = new Map();
    (list || []).forEach((c) => {
      const f = upper(c.filial);
      if (!map.has(f)) map.set(f, []);
      map.get(f).push(c);
    });
    for (const [k, arr] of map.entries()) map.set(k, sortCheques(arr));
    return map;
  }

  function renderChequesFixedByFilial(list) {
    const wrap = $("#gridCheques");
    if (!wrap) return;
    wrap.innerHTML = "";

    const filtered = applyFilters(list);
    const byFilial = groupChequesByFilial(filtered);

    FILIAIS.forEach((filial) => {
      const hist = byFilial.get(filial) || [];
      const total = hist.length;
      const pendentes = hist.filter((x) => !x.termoUrl).length;

      const card = document.createElement("div");
      card.className = "adminCard";

      const subtitle =
        total === 0
          ? "Sem registros ainda"
          : `Total: ${total} | Termo pendente: ${pendentes}`;

      const listHtml = hist.slice(0, 10).map((it) => {
        const hasTermo = !!it.termoUrl;
        const termoTxt = hasTermo ? "Upload termo" : "Upload termo";
        const termoCls = hasTermo ? "ok" : "warn";

        return `
          <div class="chequeRow">
            <div class="chequeLeft">
              <div class="l1">SEQ: ${upper(it.sequencia)} <span style="opacity:.75">•</span> ${safeText(it.data)}</div>
              <div class="l2">RESP: ${upper(it.responsavel)} | ${upper(it.status || "ATIVO")}</div>
            </div>
            <div class="chequeActions">
              ${hasTermo ? `<button class="btnMini ok" type="button" data-open-termo="${escapeHtml(it.termoUrl)}">Ver termo</button>` : ""}
              <button class="btnMini ${termoCls}" type="button"
                data-upload="termo"
                data-id="${safeText(it.id)}"
                data-filial="${upper(it.filial)}"
                data-seq="${upper(it.sequencia)}"
              >${termoTxt}</button>
            </div>
          </div>
        `;
      }).join("");

      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">💳</div>
          <div class="adminMain">
            <div class="big">${filial}</div>
            <div class="smallLine">${subtitle}</div>
            <div class="tagLine">HISTÓRICO (últimos ${Math.min(10, total)})</div>
          </div>
        </div>
        <div class="chequeList">
          ${total ? listHtml : `<div class="chequeRow"><div class="chequeLeft"><div class="l1">Nenhum cheque registrado</div><div class="l2">Use o botão + Novo para cadastrar a primeira sequência.</div></div></div>`}
        </div>
        <div class="adminCardFoot">
          <span class="pill ${pendentes ? "pendente" : "ok"}">${pendentes ? "PENDENTE TERMO" : "TERMOS OK"}</span>
          <button class="linkBtn" type="button" data-new-cheque="${filial}">+ Novo nesta filial</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  function renderSolic(list) {
    const wrap = $("#gridSolic");
    if (!wrap) return;
    wrap.innerHTML = "";

    applyFilters(list).forEach((it) => {
      const card = document.createElement("div");
      card.className = "adminCard";
      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">📋</div>
          <div class="adminMain">
            <div class="big">${upper(it.filial)}</div>
            <div class="smallLine">TIPO: ${upper(it.tipo || "")}</div>
            <div class="tagLine">DATA: ${safeText(it.data || "")}</div>
          </div>
        </div>
        <div class="chequeList">
          <div class="chequeRow">
            <div class="chequeLeft">
              <div class="l1">OBS:</div>
              <div class="l2">${escapeHtml(safeText(it.observacao || "—"))}</div>
            </div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${pillClassFromStatus(it.status)}">${upper(it.status)}</span>
          <button class="linkBtn" type="button" data-edit="solicit" data-id="${it.id}">Editar</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  function renderPatrimonio(list) {
    const wrap = $("#gridPatrimonio");
    if (!wrap) return;
    wrap.innerHTML = "";

    applyFilters(list).forEach((it) => {
      const card = document.createElement("div");
      card.className = "adminCard";
      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">🏷️</div>
          <div class="adminMain">
            <div class="big">${upper(it.equipamento)}</div>
            <div class="smallLine">PATRIMÔNIO: ${upper(it.numeroPatrimonio)}</div>
            <div class="tagLine">${upper(it.filial)} • POSSE: ${upper(it.posse)}</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${pillClassFromStatus(it.status)}">${upper(it.status)}</span>
          <button class="linkBtn" type="button" data-edit="patrimonio" data-id="${it.id}">Editar</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  function renderEpis(list) {
    const wrap = $("#gridEpis");
    if (!wrap) return;
    wrap.innerHTML = "";

    applyFilters(list).forEach((it) => {
      const card = document.createElement("div");
      card.className = "adminCard";
      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">🦺</div>
          <div class="adminMain">
            <div class="big">${upper(it.colaborador)}</div>
            <div class="smallLine">${upper(it.epi)} • QTD: ${safeText(it.qtd)}</div>
            <div class="tagLine">${upper(it.filial)} • ENTREGA: ${safeText(it.dataEntrega || "")}</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${it.validade ? "pendente" : "ok"}">${it.validade ? "VALIDADE: " + escapeHtml(it.validade) : "SEM VALIDADE"}</span>
          <button class="linkBtn" type="button" data-edit="epis" data-id="${it.id}">Editar</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  function updateKpis() {
    $("#kpiFrota").textContent = String(DATA.frota.length);
    $("#kpiCheques").textContent = String(DATA.cheques.length);
    $("#kpiSolic").textContent = String(DATA.solicitacoes.filter((s) => upper(s.status) === "ABERTA").length);
    $("#kpiPatrimonio").textContent = String(DATA.patrimonio.length);
    $("#kpiEpis").textContent = String(DATA.epis.length);
  }

  function renderAll() {
    updateKpis();
    const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";
    if (tab === "frota") renderFrota(DATA.frota);
    if (tab === "cheques") renderChequesFixedByFilial(DATA.cheques);
    if (tab === "solicitacoes") renderSolic(DATA.solicitacoes);
    if (tab === "patrimonio") renderPatrimonio(DATA.patrimonio);
    if (tab === "epis") renderEpis(DATA.epis);
  }

  // ======================================================
  // ✅ Modal (Novo/Editar)
  // ======================================================
  const modal = {
    el: null,
    title: null,
    fields: null,
    btnClose: null,
    btnCancel: null,
    btnSave: null,
    ctx: { mode: "new", tab: "frota", id: "" },
  };

  function openModal(title, schema, initialValues) {
    modal.el.classList.add("isOpen");
    modal.title.textContent = title;

    modal.fields.innerHTML = "";
    schema.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.style.gridColumn = f.full ? "1 / -1" : "";

      const label = document.createElement("label");
      label.textContent = f.label;
      wrap.appendChild(label);

      let input;
      if (f.type === "select") {
        input = document.createElement("select");
        (f.options || []).forEach((opt) => {
          const o = document.createElement("option");
          o.value = opt.value;
          o.textContent = opt.label;
          input.appendChild(o);
        });
      } else if (f.type === "textarea") {
        input = document.createElement("textarea");
      } else {
        input = document.createElement("input");
        input.type = f.type || "text";
      }

      input.id = f.id;
      input.value = safeText(initialValues?.[f.name] ?? "");
      input.placeholder = f.placeholder || "";
      wrap.appendChild(input);

      modal.fields.appendChild(wrap);
    });
  }

  function closeModal() {
    modal.el.classList.remove("isOpen");
    modal.ctx = { mode: "new", tab: "frota", id: "" };
  }

  function getVal(id) {
    const el = document.getElementById(id);
    if (!el) return "";
    return safeText(el.value);
  }

  function schemaFor(tab) {
    const filialOpts = [{ value: "", label: "Selecione..." }].concat(
      FILIAIS.map((f) => ({ value: f, label: f }))
    );

    if (tab === "cheques") {
      return [
        { id: "mFilial", name: "filial", label: "Filial", type: "select", options: filialOpts },
        { id: "mData", name: "data", label: "Data (dd/mm/aaaa)", placeholder: "24/02/2026", type: "text" },
        { id: "mSeq", name: "sequencia", label: "Sequência", placeholder: "000123", type: "text" },
        { id: "mResp", name: "responsavel", label: "Responsável", placeholder: "ARIEL", type: "text" },
        { id: "mStatus", name: "status", label: "Status", type: "select", options: [
          { value: "ATIVO", label: "ATIVO" },
          { value: "ENCERRADO", label: "ENCERRADO" },
        ]},
      ];
    }

    if (tab === "solicitacoes") {
      return [
        { id: "mFilial", name: "filial", label: "Filial", type: "select", options: filialOpts },
        { id: "mTipo", name: "tipo", label: "Tipo (editável)", placeholder: "Ex: CHEQUES / MANUTENÇÃO / TONER...", type: "text" },
        { id: "mData", name: "data", label: "Data", placeholder: todayBR(), type: "text" },
        { id: "mStatus", name: "status", label: "Status", type: "select", options: [
          { value: "ABERTA", label: "ABERTA" },
          { value: "EM ANDAMENTO", label: "EM ANDAMENTO" },
          { value: "FINALIZADA", label: "FINALIZADA" },
        ]},
        { id: "mObs", name: "observacao", label: "Observação", type: "textarea", full: true },
      ];
    }

    if (tab === "patrimonio") {
      return [
        { id: "mFilial", name: "filial", label: "Filial", type: "select", options: filialOpts },
        { id: "mEquip", name: "equipamento", label: "Equipamento", placeholder: "NOTEBOOK / CELULAR / IMPRESSORA", type: "text" },
        { id: "mNum", name: "numeroPatrimonio", label: "Número Patrimônio", placeholder: "NF-001", type: "text" },
        { id: "mPosse", name: "posse", label: "Em posse de", placeholder: "ARIEL", type: "text" },
        { id: "mStatus", name: "status", label: "Status", type: "select", options: [
          { value: "ATIVO", label: "ATIVO" },
          { value: "MANUTENCAO", label: "MANUTENÇÃO" },
          { value: "BAIXADO", label: "BAIXADO" },
        ]},
        { id: "mObs", name: "observacao", label: "Observação", type: "textarea", full: true },
      ];
    }

    if (tab === "epis") {
      return [
        { id: "mFilial", name: "filial", label: "Filial", type: "select", options: filialOpts },
        { id: "mColab", name: "colaborador", label: "Colaborador", placeholder: "NOME", type: "text" },
        { id: "mEpi", name: "epi", label: "EPI", placeholder: "BOTA / LUVA / ÓCULOS", type: "text" },
        { id: "mQtd", name: "qtd", label: "Qtd", placeholder: "1", type: "text" },
        { id: "mEntrega", name: "dataEntrega", label: "Data entrega", placeholder: todayBR(), type: "text" },
        { id: "mVal", name: "validade", label: "Validade / Próxima troca", placeholder: "Ex: 30/04/2026", type: "text" },
        { id: "mObs", name: "observacao", label: "Observação", type: "textarea", full: true },
      ];
    }

    return [
      { id: "mFilial", name: "filial", label: "Filial", type: "select", options: filialOpts },
      { id: "mPlaca", name: "placa", label: "Placa", placeholder: "ABC1D23", type: "text" },
      { id: "mCond", name: "condutor", label: "Condutor", placeholder: "NOME", type: "text" },
      { id: "mMes", name: "mes", label: "Mês ref.", placeholder: "MAR/2026", type: "text" },
      { id: "mStatus", name: "status", label: "Status", type: "select", options: [
        { value: "OK", label: "OK" },
        { value: "PENDENTE", label: "PENDENTE" },
        { value: "ATRASADO", label: "ATRASADO" },
      ]},
    ];
  }

  function valuesFromModal(tab) {
    if (tab === "cheques") {
      return {
        filial: upper(getVal("mFilial")),
        data: getVal("mData"),
        sequencia: getVal("mSeq"),
        responsavel: upper(getVal("mResp")),
        status: upper(getVal("mStatus") || "ATIVO"),
      };
    }
    if (tab === "solicitacoes") {
      return {
        filial: upper(getVal("mFilial")),
        tipo: upper(getVal("mTipo")),
        data: getVal("mData") || todayBR(),
        status: upper(getVal("mStatus") || "ABERTA"),
        observacao: getVal("mObs"),
      };
    }
    if (tab === "patrimonio") {
      return {
        filial: upper(getVal("mFilial")),
        equipamento: upper(getVal("mEquip")),
        numeroPatrimonio: upper(getVal("mNum")),
        posse: upper(getVal("mPosse")),
        status: upper(getVal("mStatus") || "ATIVO"),
        observacao: getVal("mObs"),
      };
    }
    if (tab === "epis") {
      return {
        filial: upper(getVal("mFilial")),
        colaborador: upper(getVal("mColab")),
        epi: upper(getVal("mEpi")),
        qtd: getVal("mQtd"),
        dataEntrega: getVal("mEntrega") || todayBR(),
        validade: getVal("mVal"),
        observacao: getVal("mObs"),
      };
    }
    return {
      filial: upper(getVal("mFilial")),
      placa: upper(getVal("mPlaca")),
      condutor: upper(getVal("mCond")),
      mes: upper(getVal("mMes")),
      status: upper(getVal("mStatus") || "OK"),
    };
  }

  function openNew(tab, preset) {
    modal.ctx = { mode: "new", tab, id: "" };
    const schema = schemaFor(tab);
    const initial = preset || (tab === "cheques" ? { filial: "", status: "ATIVO", data: todayBR() } : { filial: "" });
    openModal(`Novo - ${labelTab(tab)}`, schema, initial);
  }

  function openEdit(tab, id) {
    modal.ctx = { mode: "edit", tab, id };
    const schema = schemaFor(tab);

    const list = tab === "solicitacoes" ? DATA.solicitacoes :
                 tab === "patrimonio" ? DATA.patrimonio :
                 tab === "epis" ? DATA.epis :
                 DATA.frota;

    const item = list.find((x) => x.id === id);
    if (!item) return;

    openModal(`Editar - ${labelTab(tab)}`, schema, item);
  }

  function labelTab(tab) {
    if (tab === "cheques") return "Cheques";
    if (tab === "solicitacoes") return "Solicitações";
    if (tab === "patrimonio") return "Patrimônio";
    if (tab === "epis") return "EPIs";
    return "Frota";
  }

  async function saveModal() {
    const tab = modal.ctx.tab;
    const payload = valuesFromModal(tab);

    if (!payload.filial) return alert("Selecione uma filial.");

    try {
      if (tab === "cheques") {
        if (!payload.data || !payload.sequencia || !payload.responsavel) {
          return alert("Preencha: Data, Sequência e Responsável.");
        }

        if (!API_URL || API_URL.includes("COLE_AQUI")) {
          return alert("Cole a API_URL do Apps Script no administrativo.js para salvar cheques no Sheets.");
        }

        setStatus("💾 Salvando cheque...");
        await createChequeOnSheets(payload);
        closeModal();
        await reloadAll();
        return;
      }

      const list = tab === "solicitacoes" ? DATA.solicitacoes :
                   tab === "patrimonio" ? DATA.patrimonio :
                   tab === "epis" ? DATA.epis :
                   DATA.frota;

      if (modal.ctx.mode === "edit") {
        const idx = list.findIndex((x) => x.id === modal.ctx.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...payload };
      } else {
        list.unshift({ id: uid(), ...payload });
      }

      persistLocal();
      closeModal();
      renderAll();
      setStatus("✅ Salvo");
    } catch (e) {
      console.error("[admin] save erro:", e);
      setStatus("❌ Falha");
      alert(e?.data?.error || e?.message || "Falha ao salvar.");
    }
  }

  function persistLocal() {
    saveLS(LS_KEYS.frota, DATA.frota);
    saveLS(LS_KEYS.solicit, DATA.solicitacoes);
    saveLS(LS_KEYS.patrimonio, DATA.patrimonio);
    saveLS(LS_KEYS.epis, DATA.epis);
  }

  async function reloadAll() {
    try {
      setStatus("🔄 Atualizando...");
      await loadChequesFromSheets();
      updateKpis();
      renderAll();
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[admin] reload erro:", e);
      setStatus("❌ Erro ao atualizar");
      if (String(e?.message || "").includes("retornou HTML")) {
        alert("Erro de deploy/permissão do Apps Script (retornou HTML).");
      }
    }
  }

  function bindDelegation() {
    document.addEventListener("click", (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLElement)) return;

      if (el.matches("[data-open-termo]")) {
        const url = el.getAttribute("data-open-termo") || "";
        if (url) window.open(url, "_blank", "noopener");
        return;
      }

      if (el.matches("[data-new-cheque]")) {
        const filial = el.getAttribute("data-new-cheque") || "";
        openNew("cheques", { filial, data: todayBR(), status: "ATIVO" });
        return;
      }

      if (el.matches("[data-upload]")) {
        const type = el.getAttribute("data-upload");
        const placa = el.getAttribute("data-placa") || "";
        const seq = el.getAttribute("data-seq") || "";
        const id = el.getAttribute("data-id") || "";
        const ref = placa || seq || id || "ITEM";

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,application/pdf";
        input.onchange = () => {
          const file = input.files && input.files[0];
          if (!file) return;

          alert(
            `ARQUIVO SELECIONADO ✅\n\nTipo: ${type}\nRef: ${ref}\nArquivo: ${file.name}\n\nDrive Folder ID (ADMINISTRATIVO): ${DRIVE_FOLDER_ID}\n\n(Próxima etapa: subir pro Drive e salvar URL no Sheets)`
          );
        };
        input.click();
        return;
      }

      if (el.matches("[data-edit]")) {
        const tab = el.getAttribute("data-edit") || "";
        const id = el.getAttribute("data-id") || "";
        if (tab && id) openEdit(tab, id);
        return;
      }
    });
  }

  function bindTabs() {
    document.querySelectorAll(".tabBtn").forEach((b) => {
      b.addEventListener("click", () => setActiveTab(b.dataset.tab));
    });

    document.querySelectorAll(".sumCard").forEach((c) => {
      c.addEventListener("click", () => setActiveTab(c.dataset.tab));
    });
  }

  function bindFilters() {
    const sel = $("#fFilialAdmin");
    const inp = $("#fBuscaAdmin");
    if (sel) sel.addEventListener("change", renderAll);
    if (inp) inp.addEventListener("input", renderAll);
  }

  function bindActions() {
    const btnReload = $("#btnAdminReload");
    if (btnReload) btnReload.addEventListener("click", reloadAll);

    const btnNovo = $("#btnAdminNovo");
    if (btnNovo) btnNovo.addEventListener("click", () => {
      const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";
      openNew(tab);
    });

    modal.el = $("#modalAdmin");
    modal.title = $("#modalTitleAdmin");
    modal.fields = $("#modalFieldsAdmin");
    modal.btnClose = $("#btnCloseModalAdmin");
    modal.btnCancel = $("#btnCancelModalAdmin");
    modal.btnSave = $("#btnSaveModalAdmin");

    modal.btnClose.addEventListener("click", closeModal);
    modal.btnCancel.addEventListener("click", closeModal);
    modal.btnSave.addEventListener("click", saveModal);

    modal.el.addEventListener("click", (ev) => {
      if (ev.target === modal.el) closeModal();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && modal.el.classList.contains("isOpen")) closeModal();
    });
  }

  function initHeader() {
    const uf = (window.getSelectedState?.() || "").toUpperCase();
    const user = (window.getUser?.() || "");
    const sub = $("#adminSub");
    if (sub) sub.textContent = `Acesso liberado para ${user} | Estado: ${uf} | Drive: ${DRIVE_FOLDER_ID}`;
  }

  function escapeHtml(s) {
    const t = String(s ?? "");
    return t
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function init() {
    initHeader();
    fillFiliaisSelect();
    bindTabs();
    bindFilters();
    bindActions();
    bindDelegation();

    persistLocal();
    renderAll();
    reloadAll();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
