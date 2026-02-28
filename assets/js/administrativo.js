/* administrativo.js | NOVA FROTA (tabs + filtros + cheques por filial em botões + Sheets: cheques/solicit/patrimonio/epis) */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyWSvivxCp4GslWhGRxfvg6gcE72hNATplIqdVG2tp46DtrdxWzKLqirm-BgcSv2tlw/exec";

  const FILIAIS = [
    "ITUMBIARA","RIO VERDE","JATAI","MINEIROS","CHAPADAO DO CEU","MONTIVIDIU",
    "INDIARA","BOM JESUS DE GO","VIANOPOLIS","ANAPOLIS","URUAÇU",
  ];

  const LS_KEYS = { frota: "nf_admin_frota_v1" };

  function loadLS(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }
  function saveLS(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr || [])); } catch {} }

  const DATA = {
    frota: loadLS(LS_KEYS.frota, [
      { id: uid(), placa: "ABC1D23", condutor: "PEDRO SANTOS", filial: "ITUMBIARA", status: "OK", mes: "MAR/2026", telefone: "(64) 99999-1111", tipoVeiculo: "HATCH" },
      { id: uid(), placa: "XYZ2E34", condutor: "LUCAS SILVA", filial: "RIO VERDE", status: "PENDENTE", mes: "ABR/2026", telefone: "(64) 99999-2222", tipoVeiculo: "SEDAN" },
    ]),
    cheques: [],
    solicitacoes: [],
    patrimonio: [],
    epis: [],
  };

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

  function jsonp(url, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";

      const t = setTimeout(() => { cleanup(); reject(new Error("Timeout (JSONP)")); }, timeoutMs);

      function cleanup() {
        clearTimeout(t);
        try { delete window[cb]; } catch {}
        try { s.remove(); } catch {}
      }

      window[cb] = (data) => { cleanup(); resolve(data); };

      s.src = url + sep + "callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
      s.onerror = () => { cleanup(); reject(new Error("Erro ao carregar script (JSONP)")); };
      document.head.appendChild(s);
    });
  }

  function buildUrl(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }

  function parseBRDate(s) {
    const t = String(s || "").trim();
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return 0;
    const dd = Number(m[1]), mm = Number(m[2]), yy = Number(m[3]);
    return new Date(yy, mm - 1, dd).getTime();
  }

  function sortByDateDesc(list, field="data"){
    return (list||[]).slice().sort((a,b)=>{
      const ta = parseBRDate(a[field]);
      const tb = parseBRDate(b[field]);
      if(tb !== ta) return tb - ta;
      return String(b.id||"").localeCompare(String(a.id||""));
    });
  }

  function normalizeChequeRow(r) {
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      data: safeText(r?.data),
      sequencia: safeText(r?.sequencia),
      responsavel: upper(r?.responsavel),
      status: upper(r?.status || "ATIVO"),
      termoAssinado: upper(r?.termoAssinado || "NÃO"),
      createdAt: Number(r?.createdAt || 0) || 0,
      updatedAt: Number(r?.updatedAt || 0) || 0,
    };
  }

  function normalizeSolic(r){
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      tipo: upper(r?.tipo || "GERAL"),
      data: safeText(r?.data || ""),
      status: upper(r?.status || "ABERTA"),
      observacao: safeText(r?.observacao || ""),
      solicitante: upper(r?.solicitante || ""),
      createdAt: Number(r?.createdAt || 0) || 0,
      updatedAt: Number(r?.updatedAt || 0) || 0,
    };
  }

  function normalizePat(r){
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      equipamento: upper(r?.equipamento || ""),
      numeroPatrimonio: upper(r?.numeroPatrimonio || ""),
      posse: upper(r?.posse || ""),
      status: upper(r?.status || "ATIVO"),
      observacao: safeText(r?.observacao || ""),
      createdAt: Number(r?.createdAt || 0) || 0,
      updatedAt: Number(r?.updatedAt || 0) || 0,
    };
  }

  function normalizeEpi(r){
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      colaborador: upper(r?.colaborador || ""),
      epi: upper(r?.epi || ""),
      qtd: safeText(r?.qtd || ""),
      dataEntrega: safeText(r?.dataEntrega || ""),
      validade: safeText(r?.validade || ""),
      observacao: safeText(r?.observacao || ""),
      createdAt: Number(r?.createdAt || 0) || 0,
      updatedAt: Number(r?.updatedAt || 0) || 0,
    };
  }

  async function loadChequesFromSheets() {
    const res = await jsonp(buildUrl({ action: "cheques_list" }));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_list");
    DATA.cheques = sortByDateDesc((res.data||[]).map(normalizeChequeRow), "data");
  }

  async function loadSolicFromSheets(){
    const res = await jsonp(buildUrl({ action:"solicit_list" }));
    if(!res || res.ok === false) throw new Error(res?.error || "Erro solicit_list");
    DATA.solicitacoes = sortByDateDesc((res.data||[]).map(normalizeSolic), "data");
  }

  async function loadPatFromSheets(){
    const res = await jsonp(buildUrl({ action:"patrimonio_list" }));
    if(!res || res.ok === false) throw new Error(res?.error || "Erro patrimonio_list");
    DATA.patrimonio = (res.data||[]).map(normalizePat);
  }

  async function loadEpisFromSheets(){
    const res = await jsonp(buildUrl({ action:"epis_list" }));
    if(!res || res.ok === false) throw new Error(res?.error || "Erro epis_list");
    DATA.epis = (res.data||[]).map(normalizeEpi);
  }

  async function createChequeOnSheets(payload) {
    const res = await jsonp(buildUrl({
      action: "cheques_add",
      filial: upper(payload.filial),
      data: safeText(payload.data),
      sequencia: safeText(payload.sequencia),
      responsavel: upper(payload.responsavel),
      status: upper(payload.status || "ATIVO"),
      termoAssinado: upper(payload.termoAssinado || "NÃO"),
    }));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_add");
    return res.data;
  }

  async function updateChequeOnSheets(payload) {
    const params = {
      action: "cheques_update",
      id: safeText(payload.id),
      status: payload.status != null ? upper(payload.status) : "",
      termoAssinado: payload.termoAssinado != null ? upper(payload.termoAssinado) : "",
    };
    Object.keys(params).forEach((k) => {
      if (params[k] === "" && k !== "action" && k !== "id") delete params[k];
    });

    const res = await jsonp(buildUrl(params));
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_update");
    return res.data;
  }

  async function createSolicOnSheets(payload){
    const res = await jsonp(buildUrl({
      action:"solicit_add",
      filial: upper(payload.filial),
      tipo: upper(payload.tipo || "GERAL"),
      data: safeText(payload.data || todayBR()),
      status: upper(payload.status || "ABERTA"),
      observacao: safeText(payload.observacao || ""),
      solicitante: upper(payload.solicitante || (window.getUser?.()||"USUÁRIO")),
    }));
    if(!res || res.ok === false) throw new Error(res?.error || "Erro solicit_add");
    return res.data;
  }

  async function updateSolicOnSheets(payload){
    const res = await jsonp(buildUrl({
      action:"solicit_update",
      id: safeText(payload.id),
      status: payload.status != null ? upper(payload.status) : "",
      tipo: payload.tipo != null ? upper(payload.tipo) : "",
      data: payload.data != null ? safeText(payload.data) : "",
      observacao: payload.observacao != null ? safeText(payload.observacao) : "",
      solicitante: payload.solicitante != null ? upper(payload.solicitante) : "",
      filial: payload.filial != null ? upper(payload.filial) : "",
    }));
    if(!res || res.ok === false) throw new Error(res?.error || "Erro solicit_update");
    return res.data;
  }

  async function createPatOnSheets(payload){
    const res = await jsonp(buildUrl({
      action:"patrimonio_add",
      filial: upper(payload.filial),
      equipamento: upper(payload.equipamento || ""),
      numeroPatrimonio: upper(payload.numeroPatrimonio || ""),
      posse: upper(payload.posse || ""),
      status: upper(payload.status || "ATIVO"),
      observacao: safeText(payload.observacao || ""),
    }));
    if(!res || res.ok === false) throw new Error(res?.error || "Erro patrimonio_add");
    return res.data;
  }

  async function updatePatOnSheets(payload){
    const res = await jsonp(buildUrl({
      action:"patrimonio_update",
      id: safeText(payload.id),
      filial: payload.filial != null ? upper(payload.filial) : "",
      equipamento: payload.equipamento != null ? upper(payload.equipamento) : "",
      numeroPatrimonio: payload.numeroPatrimonio != null ? upper(payload.numeroPatrimonio) : "",
      posse: payload.posse != null ? upper(payload.posse) : "",
      status: payload.status != null ? upper(payload.status) : "",
      observacao: payload.observacao != null ? safeText(payload.observacao) : "",
    }));
    if(!res || res.ok === false) throw new Error(res?.error || "Erro patrimonio_update");
    return res.data;
  }

  async function createEpiOnSheets(payload){
    const res = await jsonp(buildUrl({
      action:"epis_add",
      filial: upper(payload.filial),
      colaborador: upper(payload.colaborador || ""),
      epi: upper(payload.epi || ""),
      qtd: safeText(payload.qtd || ""),
      dataEntrega: safeText(payload.dataEntrega || todayBR()),
      validade: safeText(payload.validade || ""),
      observacao: safeText(payload.observacao || ""),
    }));
    if(!res || res.ok === false) throw new Error(res?.error || "Erro epis_add");
    return res.data;
  }

  async function updateEpiOnSheets(payload){
    const res = await jsonp(buildUrl({
      action:"epis_update",
      id: safeText(payload.id),
      filial: payload.filial != null ? upper(payload.filial) : "",
      colaborador: payload.colaborador != null ? upper(payload.colaborador) : "",
      epi: payload.epi != null ? upper(payload.epi) : "",
      qtd: payload.qtd != null ? safeText(payload.qtd) : "",
      dataEntrega: payload.dataEntrega != null ? safeText(payload.dataEntrega) : "",
      validade: payload.validade != null ? safeText(payload.validade) : "",
      observacao: payload.observacao != null ? safeText(payload.observacao) : "",
    }));
    if(!res || res.ok === false) throw new Error(res?.error || "Erro epis_update");
    return res.data;
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
      if (selFilial && upper(it.filial || "") !== selFilial) return false;
      if (q) {
        const blob = upper(JSON.stringify(it));
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }

  // ===== Tabs
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

    const inp = $("#fBuscaAdmin");
    if (inp) inp.value = "";

    // ✅ quando entra em Cheques, garante filial selecionada
    if(tab === "cheques" && !selectedChequeFilial){
      selectedChequeFilial = FILIAIS[0];
    }

    renderAll();
  }

  // ===== Frota
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
            <div class="tagLine">${upper(it.filial)} • ${safeText(it.telefone || "")} • ${upper(it.tipoVeiculo || "")}</div>
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

  // ===== Cheques (botões + tabela)
  let selectedChequeFilial = "";

  function groupChequesByFilial(list){
    const map = new Map();
    (list||[]).forEach(c=>{
      const f = upper(c.filial);
      if(!map.has(f)) map.set(f, []);
      map.get(f).push(c);
    });
    return map;
  }

  function renderFilialButtons(){
    const bar = $("#filialBar");
    const meta = $("#chequesMeta");
    const tbody = $("#chequesTbody");
    if(!bar || !meta || !tbody) return;

    bar.innerHTML = "";

    const filtered = applyFilters(DATA.cheques);
    const byFilial = groupChequesByFilial(filtered);

    // ✅ se não tiver selecionada, pega a primeira existente
    if(!selectedChequeFilial) selectedChequeFilial = FILIAIS[0];

    FILIAIS.forEach(filial=>{
      const rows = byFilial.get(filial) || [];
      const pend = rows.filter(x => upper(x.termoAssinado) !== "SIM").length;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filialBtn" + (selectedChequeFilial === filial ? " isSelected" : "");
      btn.setAttribute("data-filial", filial);

      const dotColor = pend ? "rgba(250,204,21,.95)" : "rgba(34,197,94,.90)";
      btn.innerHTML = `
        <span class="filialDot" style="background:${dotColor}; box-shadow:0 0 0 3px ${pend ? "rgba(250,204,21,.14)" : "rgba(34,197,94,.14)"};"></span>
        <span>${filial}</span>
        <span class="filialCount">(${rows.length})</span>
      `;
      btn.addEventListener("click", ()=>{
        selectedChequeFilial = filial;
        renderChequesArea();
      });

      bar.appendChild(btn);
    });

    renderChequesArea();
  }

  function renderChequesArea(){
    const meta = $("#chequesMeta");
    const tbody = $("#chequesTbody");
    const bar = $("#filialBar");
    if(!meta || !tbody || !bar) return;

    // marca selecionado
    bar.querySelectorAll(".filialBtn").forEach(b=>{
      b.classList.toggle("isSelected", b.getAttribute("data-filial") === selectedChequeFilial);
    });

    const filtered = applyFilters(DATA.cheques).filter(c => upper(c.filial) === selectedChequeFilial);
    const ordered = sortByDateDesc(filtered, "data");

    const total = ordered.length;
    const pend = ordered.filter(x => upper(x.termoAssinado) !== "SIM").length;

    meta.textContent = `Selecionado: ${selectedChequeFilial} • Total: ${total} • Pendentes: ${pend}`;

    tbody.innerHTML = "";

    if(!ordered.length){
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" style="opacity:.85">Nenhum cheque cadastrado nesta filial. Use + Novo para lançar.</td>`;
      tbody.appendChild(tr);
      return;
    }

    ordered.forEach(it=>{
      const termo = upper(it.termoAssinado || "NÃO");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.filial)}</td>
        <td>${escapeHtml(it.data)}</td>
        <td><b>${escapeHtml(it.sequencia)}</b></td>
        <td>${escapeHtml(it.responsavel)}</td>
        <td>${escapeHtml(it.status)}</td>
        <td>
          <button class="linkBtn" type="button"
            data-toggle-termo="${escapeHtml(it.id)}"
            data-termo-atual="${termo}"
          >${termo}</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function toggleTermo(chequeId, termoAtual) {
    const novo = upper(termoAtual) === "SIM" ? "NÃO" : "SIM";
    try {
      setStatus("🧾 Atualizando termo...");
      await updateChequeOnSheets({ id: chequeId, termoAssinado: novo });
      await reloadAll(false);
      setStatus("✅ Termo atualizado");
      renderChequesArea();
    } catch (e) {
      console.error(e);
      setStatus("❌ Falha");
      alert(e?.message || "Falha ao atualizar termo");
    }
  }

  // ===== Solicitações
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
            <div class="tagLine">DATA: ${escapeHtml(it.data || "")} • SOLICITANTE: ${escapeHtml(it.solicitante || "")}</div>
          </div>
        </div>
        <div style="padding: 0 14px 14px; opacity:.92">
          <div style="font-weight:900; margin-bottom:6px;">OBS:</div>
          <div style="opacity:.85">${escapeHtml(it.observacao || "—")}</div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${pillClassFromStatus(it.status)}">${upper(it.status)}</span>
          <button class="linkBtn" type="button" data-edit="solicitacoes" data-id="${it.id}">Editar</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  // ===== Patrimônio
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

  // ===== EPIs
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
            <div class="smallLine">${upper(it.epi)} • QTD: ${escapeHtml(it.qtd)}</div>
            <div class="tagLine">${upper(it.filial)} • ENTREGA: ${escapeHtml(it.dataEntrega || "")}</div>
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

    const abertas = DATA.solicitacoes.filter((s) => upper(s.status) === "ABERTA").length;
    const badge = $("#badgeTopSolic");
    if (badge) badge.textContent = String(abertas);
  }

  function renderAll() {
    updateKpis();
    const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";
    if (tab === "frota") renderFrota(DATA.frota);
    if (tab === "cheques") renderFilialButtons();
    if (tab === "solicitacoes") renderSolic(DATA.solicitacoes);
    if (tab === "patrimonio") renderPatrimonio(DATA.patrimonio);
    if (tab === "epis") renderEpis(DATA.epis);
  }

  // ===== Modal
  const modal = {
    el: null, title: null, fields: null,
    btnClose: null, btnCancel: null, btnSave: null,
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
      if(f.readonly) input.readOnly = true;

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
          { value: "NÃO", label: "NÃO" },
          { value: "SIM", label: "SIM" },
        ]},
      ];
    }

    if (tab === "solicitacoes") {
      const user = (window.getUser?.() || "USUÁRIO").toUpperCase();
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
        { id: "mSolic", name: "solicitante", label: "Solicitante", type: "text", readonly:true, full:true, placeholder:user },
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
      { id: "mTel", name: "telefone", label: "Filial Telefone", placeholder: "(64) 99999-0000", type: "text" },
      { id: "mTipoV", name: "tipoVeiculo", label: "Tipo do veículo", placeholder: "HATCH / SEDAN / PICKUP", type: "text" },
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
        termoAssinado: upper(getVal("mTermo") || "NÃO"),
      };
    }
    if (tab === "solicitacoes") {
      const user = (window.getUser?.() || "USUÁRIO").toUpperCase();
      return {
        filial: upper(getVal("mFilial")),
        tipo: upper(getVal("mTipo")),
        data: getVal("mData") || todayBR(),
        status: upper(getVal("mStatus") || "ABERTA"),
        observacao: getVal("mObs"),
        solicitante: upper(getVal("mSolic") || user),
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
      telefone: getVal("mTel"),
      tipoVeiculo: getVal("mTipoV"),
      mes: upper(getVal("mMes")),
      status: upper(getVal("mStatus") || "OK"),
    };
  }

  function labelTab(tab) {
    if (tab === "cheques") return "Cheques";
    if (tab === "solicitacoes") return "Solicitações";
    if (tab === "patrimonio") return "Patrimônio";
    if (tab === "epis") return "EPIs";
    return "Frota";
  }

  function openNew(tab) {
    modal.ctx = { mode: "new", tab, id: "" };
    const schema = schemaFor(tab);

    const initial =
      tab === "cheques"
        ? { filial: selectedChequeFilial || FILIAIS[0], status: "ATIVO", data: todayBR(), termoAssinado: "NÃO" }
        : tab === "solicitacoes"
          ? { filial: "", status:"ABERTA", data: todayBR(), solicitante: (window.getUser?.()||"USUÁRIO").toUpperCase() }
          : { filial: "" };

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

  async function saveModal() {
    const tab = modal.ctx.tab;
    const payload = valuesFromModal(tab);

    if (!payload.filial) return alert("Selecione uma filial.");

    try {
      // ✅ CHEQUES (Sheets)
      if (tab === "cheques") {
        if (!payload.data || !payload.sequencia || !payload.responsavel) {
          return alert("Preencha: Data, Sequência e Responsável.");
        }
        setStatus("💾 Salvando cheque...");
        await createChequeOnSheets(payload);
        closeModal();
        await reloadAll(false);
        return;
      }

      // ✅ SOLICITAÇÕES (Sheets)
      if(tab === "solicitacoes"){
        setStatus("💾 Salvando solicitação...");
        if(modal.ctx.mode === "edit"){
          await updateSolicOnSheets({ id: modal.ctx.id, ...payload });
        }else{
          await createSolicOnSheets(payload);
        }
        closeModal();
        await reloadAll(false);
        return;
      }

      // ✅ PATRIMÔNIO (Sheets)
      if(tab === "patrimonio"){
        setStatus("💾 Salvando patrimônio...");
        if(modal.ctx.mode === "edit"){
          await updatePatOnSheets({ id: modal.ctx.id, ...payload });
        }else{
          await createPatOnSheets(payload);
        }
        closeModal();
        await reloadAll(false);
        return;
      }

      // ✅ EPIs (Sheets)
      if(tab === "epis"){
        setStatus("💾 Salvando EPI...");
        if(modal.ctx.mode === "edit"){
          await updateEpiOnSheets({ id: modal.ctx.id, ...payload });
        }else{
          await createEpiOnSheets(payload);
        }
        closeModal();
        await reloadAll(false);
        return;
      }

      // ✅ FROTA (Local)
      const list = DATA.frota;
      if (modal.ctx.mode === "edit") {
        const idx = list.findIndex((x) => x.id === modal.ctx.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...payload };
      } else {
        list.unshift({ id: uid(), ...payload });
      }
      saveLS(LS_KEYS.frota, DATA.frota);
      closeModal();
      renderAll();
      setStatus("✅ Salvo");
    } catch (e) {
      console.error("[admin] save erro:", e);
      setStatus("❌ Falha");
      alert(e?.message || "Falha ao salvar.");
    }
  }

  async function reloadAll(showAlert = true) {
    try {
      setStatus("🔄 Atualizando...");
      await Promise.all([
        loadChequesFromSheets(),
        loadSolicFromSheets(),
        loadPatFromSheets(),
        loadEpisFromSheets(),
      ]);
      updateKpis();
      renderAll();
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[admin] reload erro:", e);
      setStatus("❌ Erro ao atualizar");
      if (showAlert) alert(e?.message || "Erro ao atualizar.");
    }
  }

  function bindDelegation() {
    document.addEventListener("click", (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLElement)) return;

      if (el.matches("[data-toggle-termo]")) {
        const id = el.getAttribute("data-toggle-termo") || "";
        const atual = el.getAttribute("data-termo-atual") || "NÃO";
        if (id) toggleTermo(id, atual);
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

    const btn = $("#btnTopSolic");
    if (btn) btn.addEventListener("click", () => setActiveTab("solicitacoes"));
  }

  function bindFilters() {
    const sel = $("#fFilialAdmin");
    const inp = $("#fBuscaAdmin");
    if (sel) sel.addEventListener("change", renderAll);
    if (inp) inp.addEventListener("input", renderAll);
  }

  function bindActions() {
    const btnReload = $("#btnAdminReload");
    if (btnReload) btnReload.addEventListener("click", () => reloadAll(true));

    // ✅ FIX: + Novo cria conforme TAB ATIVA
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

    // ✅ default filial cheques
    selectedChequeFilial = FILIAIS[0];

    renderAll();
    reloadAll(false);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
