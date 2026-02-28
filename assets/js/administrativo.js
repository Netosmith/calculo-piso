/* administrativo.js | NOVA FROTA (sem upload) */
(function () {
  "use strict";

  // ======================================================
  // ✅ URL DO SEU WEB APP (Apps Script /exec)
  // ======================================================
  const API_URL =
    "https://script.google.com/macros/s/AKfycbybrlPoP0unvz7RCThBL8BeuM7kNrWOpzjJD337zgngYHkc82eb9hnuQsfCwa67N3FZ/exec";

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
  // ✅ STORAGE (fallback local para Frota/Patrimônio/EPIs)
  //    Solicitações agora vai pro Sheets (multi-usuário)
  // ======================================================
  const LS_KEYS = {
    patrimonio: "nf_admin_patrimonio_v1",
    epis: "nf_admin_epis_v1",
    frota: "nf_admin_frota_v2",
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
    try {
      localStorage.setItem(key, JSON.stringify(arr || []));
    } catch {}
  }

  // ======================================================
  // ✅ DADOS
  // ======================================================
  const DATA = {
    frota: loadLS(LS_KEYS.frota, [
      {
        id: uid(),
        placa: "ABC1D23",
        condutor: "PEDRO SANTOS",
        filial: "ITUMBIARA",
        filialTelefone: "(64) 99999-9999",
        tipoVeiculo: "CARRO",
        status: "OK",
        mes: "MAR/2026",
      },
      {
        id: uid(),
        placa: "XYZ2E34",
        condutor: "LUCAS SILVA",
        filial: "RIO VERDE",
        filialTelefone: "(64) 98888-8888",
        tipoVeiculo: "MOTO",
        status: "PENDENTE",
        mes: "ABR/2026",
      },
    ]),
    cheques: [],
    solicitacoes: [], // agora vem do Sheets
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

  // ======================================================
  // ✅ JSONP helper (resolve CORS)
  // ======================================================
  function jsonp(url, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";

      const t = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout (JSONP)"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(t);
        try { delete window[cb]; } catch {}
        try { s.remove(); } catch {}
      }

      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };

      // cache-bust ajuda quando o iOS “segura” script antigo
      s.src = url + sep + "callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
      s.onerror = () => {
        cleanup();
        reject(new Error("Erro ao carregar script (JSONP)"));
      };

      document.head.appendChild(s);
    });
  }

  function buildUrl(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }

  // ======================================================
  // ✅ CHEQUES (Sheets) via JSONP
  // Colunas esperadas no Sheet CHEQUES:
  // id | createdAt | filial | data | sequencia | responsavel | status | termoAssinado | updatedAt
  // ======================================================
  function normalizeChequeRow(r) {
    const termoRaw = safeText(r?.termoAssinado);
    const termoAssinado =
      upper(termoRaw) === "SIM" || termoRaw === "1" || upper(termoRaw) === "TRUE";

    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      data: safeText(r?.data),
      sequencia: safeText(r?.sequencia),
      responsavel: upper(r?.responsavel),
      status: upper(r?.status || "ATIVO"),
      termoAssinado,
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
    const res = await jsonp(buildUrl({ action: "cheques_list" }));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_list");
    const arr = res.data || [];
    DATA.cheques = sortCheques(arr.map(normalizeChequeRow));
  }

  async function createChequeOnSheets(payload) {
    const params = {
      action: "cheques_add",
      filial: upper(payload.filial),
      data: safeText(payload.data),
      sequencia: safeText(payload.sequencia),
      responsavel: upper(payload.responsavel),
      status: upper(payload.status || "ATIVO"),
      termoAssinado: payload.termoAssinado ? "SIM" : "NAO",
    };
    const res = await jsonp(buildUrl(params));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_add");
    return res.data;
  }

  async function updateChequeOnSheets(payload) {
    const params = {
      action: "cheques_update",
      id: safeText(payload.id),
      status: payload.status != null ? upper(payload.status) : "",
      termoAssinado: payload.termoAssinado != null ? (payload.termoAssinado ? "SIM" : "NAO") : "",
    };

    Object.keys(params).forEach((k) => {
      if (params[k] === "" && k !== "action" && k !== "id") delete params[k];
    });

    const res = await jsonp(buildUrl(params));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_update");
    return res.data;
  }

  // ======================================================
  // ✅ SOLICITAÇÕES (Sheets) via JSONP
  // Colunas no Sheet SOLICITACOES:
  // id | createdAt | filial | tipo | observacao | status | data | updatedAt
  // status: ABERTA | RESOLVIDA
  // ======================================================
  function normalizeSolicRow(r) {
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      tipo: upper(r?.tipo),
      observacao: safeText(r?.observacao),
      status: upper(r?.status || "ABERTA"),
      data: safeText(r?.data) || todayBR(),
      createdAt: Number(r?.createdAt || 0) || 0,
      updatedAt: Number(r?.updatedAt || 0) || 0,
    };
  }

  async function loadSolicFromSheets() {
    const res = await jsonp(buildUrl({ action: "solicit_list" }));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro solicit_list");
    DATA.solicitacoes = (res.data || []).map(normalizeSolicRow).sort((a, b) => (b.createdAt - a.createdAt));
  }

  async function addSolicOnSheets(payload) {
    const params = {
      action: "solicit_add",
      filial: upper(payload.filial),
      tipo: upper(payload.tipo),
      observacao: safeText(payload.observacao),
      data: safeText(payload.data || todayBR()),
    };
    const res = await jsonp(buildUrl(params));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro solicit_add");
    return res.data;
  }

  async function updateSolicOnSheets(payload) {
    const params = {
      action: "solicit_update",
      id: safeText(payload.id),
      status: payload.status != null ? upper(payload.status) : "",
      tipo: payload.tipo != null ? upper(payload.tipo) : "",
      observacao: payload.observacao != null ? safeText(payload.observacao) : "",
      data: payload.data != null ? safeText(payload.data) : "",
    };
    Object.keys(params).forEach((k) => {
      if (params[k] === "" && k !== "action" && k !== "id") delete params[k];
    });
    const res = await jsonp(buildUrl(params));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro solicit_update");
    return res.data;
  }

  async function deleteSolicOnSheets(id) {
    const res = await jsonp(buildUrl({ action: "solicit_delete", id: safeText(id) }));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro solicit_delete");
    return res.data;
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
        tab === "cheques" ? "Cheques" :
        tab === "solicitacoes" ? "Solicitações" :
        tab === "patrimonio" ? "Patrimônio" : "Controle de EPIs";
    }

    // quando muda de tab, reseta detalhe dos cheques
    if (tab !== "cheques") closeChequesDetail();

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
    if (s === "RESOLVIDA") return "finalizada";
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
  // ✅ Render: Frota (mais infos)
  // ======================================================
  function renderFrota(list) {
    const wrap = $("#gridFrota");
    if (!wrap) return;
    wrap.innerHTML = "";

    applyFilters(list).forEach((it) => {
      const card = document.createElement("div");
      card.className = "adminCard";
      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">${upper(it.placa).slice(0, 2)}</div>
          <div class="adminMain">
            <div class="big">${upper(it.placa)}</div>
            <div class="smallLine">${safeText(it.condutor)}</div>
            <div class="tagLine">${upper(it.filial)} • ${escapeHtml(safeText(it.filialTelefone || "—"))}</div>
            <div class="tagLine">TIPO: ${upper(it.tipoVeiculo || "—")}</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${pillClassFromStatus(it.status)}">${upper(it.mes)} ${upper(it.status)}</span>
          <button class="linkBtn" type="button" data-edit="frota" data-id="${it.id}">Editar</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  // ======================================================
  // ✅ Render: Cheques (cards selecionáveis + detalhe em tabela)
  // ======================================================
  let CHEQUES_SELECTED_FILIAL = "";

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

  function renderChequesFiliaisCards(list) {
    const wrap = $("#gridCheques");
    if (!wrap) return;
    wrap.innerHTML = "";

    const filtered = applyFilters(list);
    const byFilial = groupChequesByFilial(filtered);

    FILIAIS.forEach((filial) => {
      const hist = byFilial.get(filial) || [];
      const total = hist.length;
      const pendTermo = hist.filter((x) => !x.termoAssinado).length;

      const card = document.createElement("button");
      card.type = "button";
      card.className = "adminCard adminCardSelect " + (CHEQUES_SELECTED_FILIAL === filial ? "isSelected" : "");
      card.setAttribute("data-open-filial", filial);

      const subtitle =
        total === 0
          ? "Sem registros"
          : `Total: ${total} • Termo pendente: ${pendTermo}`;

      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">💳</div>
          <div class="adminMain">
            <div class="big">${filial}</div>
            <div class="smallLine">${subtitle}</div>
            <div class="tagLine">Clique para abrir</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${pendTermo ? "pendente" : "ok"}">${pendTermo ? "PENDÊNCIAS" : "OK"}</span>
          <span class="linkBtn" style="pointer-events:none;">Abrir</span>
        </div>
      `;

      wrap.appendChild(card);
    });
  }

  function openChequesDetail(filial) {
    CHEQUES_SELECTED_FILIAL = upper(filial || "");
    const box = $("#chequesDetail");
    if (!box) return;

    box.setAttribute("aria-hidden", "false");
    box.classList.add("isOpen");

    $("#chequesDetailTitle").textContent = CHEQUES_SELECTED_FILIAL;
    const total = DATA.cheques.filter((x) => upper(x.filial) === CHEQUES_SELECTED_FILIAL).length;
    $("#chequesDetailSub").textContent = total ? `Histórico: ${total} registros` : "Nenhum registro ainda";

    renderChequesDetailTable();
    renderChequesFiliaisCards(DATA.cheques);
  }

  function closeChequesDetail() {
    CHEQUES_SELECTED_FILIAL = "";
    const box = $("#chequesDetail");
    if (!box) return;
    box.classList.remove("isOpen");
    box.setAttribute("aria-hidden", "true");
    renderChequesFiliaisCards(DATA.cheques);
  }

  function renderChequesDetailTable() {
    const body = $("#chequesDetailBody");
    if (!body) return;
    body.innerHTML = "";

    const rows = sortCheques(DATA.cheques.filter((x) => upper(x.filial) === CHEQUES_SELECTED_FILIAL));

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" style="opacity:.8;padding:14px;">Sem cheques cadastrados para esta filial. Use “+ Novo nesta filial”.</td>`;
      body.appendChild(tr);
      return;
    }

    rows.forEach((it) => {
      const tr = document.createElement("tr");

      const termoTxt = it.termoAssinado ? "SIM" : "NÃO";
      const termoCls = it.termoAssinado ? "pill ok" : "pill pendente";

      tr.innerHTML = `
        <td>${escapeHtml(it.filial)}</td>
        <td>${escapeHtml(it.data)}</td>
        <td>${escapeHtml(it.sequencia)}</td>
        <td>${escapeHtml(it.responsavel)}</td>
        <td><span class="pill ${pillClassFromStatus(it.status)}">${escapeHtml(it.status)}</span></td>
        <td>
          <button type="button" class="${termoCls}" data-toggle-termo="${escapeHtml(it.id)}">${termoTxt}</button>
        </td>
        <td style="white-space:nowrap;">
          <button type="button" class="btnMini" data-edit-cheque="${escapeHtml(it.id)}">Editar</button>
        </td>
      `;
      body.appendChild(tr);
    });
  }

  // ======================================================
  // ✅ Render: Solicitações (resolver/excluir)
  // ======================================================
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
            <div class="tagLine">DATA: ${escapeHtml(safeText(it.data || ""))}</div>
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

          ${
            upper(it.status) === "ABERTA"
              ? `<button class="linkBtn" type="button" data-solic-resolver="${escapeHtml(it.id)}">Marcar resolvido</button>`
              : `<button class="linkBtn" type="button" data-solic-reabrir="${escapeHtml(it.id)}">Reabrir</button>`
          }

          <button class="linkBtn" type="button" data-solic-excluir="${escapeHtml(it.id)}">Excluir</button>
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
    if (tab === "cheques") {
      renderChequesFiliaisCards(DATA.cheques);
      if (CHEQUES_SELECTED_FILIAL) renderChequesDetailTable();
    }
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
        { id: "mData", name: "data", label: "Data (dd/mm/aaaa)", placeholder: todayBR(), type: "text" },
        { id: "mSeq", name: "sequencia", label: "Sequência", placeholder: "000123", type: "text" },
        { id: "mResp", name: "responsavel", label: "Responsável", placeholder: "ARIEL", type: "text" },
        { id: "mStatus", name: "status", label: "Status", type: "select", options: [
          { value: "ATIVO", label: "ATIVO" },
          { value: "ENCERRADO", label: "ENCERRADO" },
        ]},
        { id: "mTermo", name: "termoAssinado", label: "Termo assinado", type: "select", options: [
          { value: "NAO", label: "NÃO" },
          { value: "SIM", label: "SIM" },
        ]},
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

    // frota (AGORA COM TELEFONE + TIPO VEÍCULO)
    return [
      { id: "mFilial", name: "filial", label: "Filial", type: "select", options: filialOpts },
      { id: "mPlaca", name: "placa", label: "Placa", placeholder: "ABC1D23", type: "text" },
      { id: "mCond", name: "condutor", label: "Condutor", placeholder: "NOME", type: "text" },
      { id: "mFone", name: "filialTelefone", label: "Filial Telefone", placeholder: "(64) 99999-9999", type: "text" },
      { id: "mTipo", name: "tipoVeiculo", label: "Tipo do veículo", placeholder: "CARRO / MOTO / CAMINHONETE", type: "text" },
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
        termoAssinado: upper(getVal("mTermo")) === "SIM",
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
      filialTelefone: getVal("mFone"),
      tipoVeiculo: upper(getVal("mTipo")),
      mes: upper(getVal("mMes")),
      status: upper(getVal("mStatus") || "OK"),
    };
  }

  function openNew(tab, preset) {
    modal.ctx = { mode: "new", tab, id: "" };
    const schema = schemaFor(tab);

    let initial = preset || {};
    if (tab === "cheques") {
      initial = { filial: "", status: "ATIVO", data: todayBR(), termoAssinado: "NAO", ...preset };
    }

    openModal(`Novo - ${labelTab(tab)}`, schema, initial);
  }

  function openEdit(tab, id) {
    modal.ctx = { mode: "edit", tab, id };
    const schema = schemaFor(tab);

    // cheques vem do Sheets, mas editaremos via modal também (status/termo)
    if (tab === "cheques") {
      const item = DATA.cheques.find((x) => x.id === id);
      if (!item) return;
      openModal(`Editar - Cheques`, schema, {
        ...item,
        termoAssinado: item.termoAssinado ? "SIM" : "NAO"
      });
      return;
    }

    const list = tab === "patrimonio" ? DATA.patrimonio :
      tab === "epis" ? DATA.epis :
      DATA.frota;

    const item = list.find((x) => x.id === id);
    if (!item) return;

    openModal(`Editar - ${labelTab(tab)}`, schema, item);
  }

  function labelTab(tab) {
    if (tab === "cheques") return "Cheques";
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

        setStatus("💾 Salvando cheque...");
        if (modal.ctx.mode === "edit") {
          await updateChequeOnSheets({
            id: modal.ctx.id,
            status: payload.status,
            termoAssinado: payload.termoAssinado,
          });
        } else {
          await createChequeOnSheets(payload);
        }
        closeModal();
        await reloadAll();
        if (payload.filial) openChequesDetail(payload.filial);
        return;
      }

      const list = tab === "patrimonio" ? DATA.patrimonio :
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
      alert(e?.message || "Falha ao salvar.");
    }
  }

  function persistLocal() {
    saveLS(LS_KEYS.frota, DATA.frota);
    saveLS(LS_KEYS.patrimonio, DATA.patrimonio);
    saveLS(LS_KEYS.epis, DATA.epis);
  }

  async function reloadAll() {
    try {
      setStatus("🔄 Atualizando...");
      await Promise.all([
        loadChequesFromSheets(),
        loadSolicFromSheets(),
      ]);
      updateKpis();
      renderAll();
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[admin] reload erro:", e);
      setStatus("❌ Erro ao atualizar");
      alert(e?.message || "Erro ao atualizar.");
    }
  }

  // ======================================================
  // Delegações (cheques abrir filial, toggle termo, editar cheque, solicitações resolver/excluir, editar itens)
  // ======================================================
  function bindDelegation() {
    document.addEventListener("click", async (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLElement)) return;

      // abrir filial cheques
      if (el.matches("[data-open-filial]")) {
        openChequesDetail(el.getAttribute("data-open-filial") || "");
        return;
      }
      const parentOpen = el.closest?.("[data-open-filial]");
      if (parentOpen instanceof HTMLElement) {
        openChequesDetail(parentOpen.getAttribute("data-open-filial") || "");
        return;
      }

      // toggle termo assinado SIM/NÃO
      if (el.matches("[data-toggle-termo]")) {
        const id = el.getAttribute("data-toggle-termo") || "";
        const item = DATA.cheques.find((x) => x.id === id);
        if (!item) return;
        try {
          setStatus("💾 Atualizando termo...");
          await updateChequeOnSheets({ id, termoAssinado: !item.termoAssinado });
          await reloadAll();
          if (CHEQUES_SELECTED_FILIAL) openChequesDetail(CHEQUES_SELECTED_FILIAL);
          setStatus("✅ Atualizado");
        } catch (e) {
          console.error(e);
          setStatus("❌ Falha");
          alert(e?.message || "Falha ao atualizar termo.");
        }
        return;
      }

      // editar cheque (abre modal)
      if (el.matches("[data-edit-cheque]")) {
        const id = el.getAttribute("data-edit-cheque") || "";
        if (id) openEdit("cheques", id);
        return;
      }

      // solicitações: resolver / reabrir / excluir
      if (el.matches("[data-solic-resolver]")) {
        const id = el.getAttribute("data-solic-resolver") || "";
        try {
          setStatus("💾 Marcando resolvida...");
          await updateSolicOnSheets({ id, status: "RESOLVIDA" });
          await reloadAll();
          setStatus("✅ OK");
        } catch (e) {
          console.error(e);
          setStatus("❌ Falha");
          alert(e?.message || "Falha ao resolver.");
        }
        return;
      }

      if (el.matches("[data-solic-reabrir]")) {
        const id = el.getAttribute("data-solic-reabrir") || "";
        try {
          setStatus("💾 Reabrindo...");
          await updateSolicOnSheets({ id, status: "ABERTA" });
          await reloadAll();
          setStatus("✅ OK");
        } catch (e) {
          console.error(e);
          setStatus("❌ Falha");
          alert(e?.message || "Falha ao reabrir.");
        }
        return;
      }

      if (el.matches("[data-solic-excluir]")) {
        const id = el.getAttribute("data-solic-excluir") || "";
        if (!confirm("Excluir esta solicitação?")) return;
        try {
          setStatus("🗑️ Excluindo...");
          await deleteSolicOnSheets(id);
          await reloadAll();
          setStatus("✅ Excluída");
        } catch (e) {
          console.error(e);
          setStatus("❌ Falha");
          alert(e?.message || "Falha ao excluir.");
        }
        return;
      }

      // editar frota/patrimonio/epis
      if (el.matches("[data-edit]")) {
        const tab = el.getAttribute("data-edit") || "";
        const id = el.getAttribute("data-id") || "";
        if (tab && id) openEdit(tab, id);
        return;
      }
    });
  }

  // ======================================================
  // Binds
  // ======================================================
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

    // cheques detail buttons
    const btnClose = $("#btnCloseChequesDetail");
    if (btnClose) btnClose.addEventListener("click", closeChequesDetail);

    const btnNovoFilial = $("#btnNovoChequeFilial");
    if (btnNovoFilial) btnNovoFilial.addEventListener("click", () => {
      if (!CHEQUES_SELECTED_FILIAL) return;
      openNew("cheques", { filial: CHEQUES_SELECTED_FILIAL, data: todayBR(), status: "ATIVO", termoAssinado: "NAO" });
    });

    // modal
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
    if (sub) sub.textContent = `Acesso liberado para ${user} | Estado: ${uf}`;
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
