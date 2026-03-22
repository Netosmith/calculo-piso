/* administrativo.js | NOVA FROTA */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbx1HOSvYNb1fvckq3hlDz2p4nN8J1_8-4Ggza8D00a-tGwxyxb-QcLgCi7buwHYcLGX/exec";

  const FILIAIS = [
    "ITUMBIARA","RIO VERDE","JATAI","MINEIROS","CHAPADAO DO CEU","MONTIVIDIU",
    "INDIARA","BOM JESUS DE GO","VIANOPOLIS","ANAPOLIS","URUAÇU","FORMOSA","ARAGUARI","CATALAO",
  ];

  const $ = (sel) => document.querySelector(sel);

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

  function escapeHtml(s) {
    const t = String(s ?? "");
    return t
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const DATA = {
    frota: [],
    cheques: [],
    materiais: [],
    solicitacoes: [],
    patrimonio: [],
    epis: [],
  };

  const STATE = {
    currentChequeUploadId: "",
    uploadingChequeId: "",
  };

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

  async function apiGet(paramsObj) {
    const res = await jsonp(buildUrl(paramsObj));
    if (!res || res.ok === false) throw new Error(res?.error || "Falha na API");
    return res;
  }

  async function apiPostJSON(payload) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload || {}),
    });

    if (!res.ok) {
      throw new Error("Falha na comunicação com o servidor");
    }

    const data = await res.json();
    if (!data || data.ok === false) {
      throw new Error(data?.error || "Falha na API");
    }
    return data;
  }

  function parseBRDate(s) {
    const t = String(s || "").trim();
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return 0;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yy = Number(m[3]);
    return new Date(yy, mm - 1, dd).getTime();
  }

  function sortByDateDesc(list, field = "data") {
    return (list || []).slice().sort((a, b) => {
      const ta = parseBRDate(a[field]);
      const tb = parseBRDate(b[field]);
      if (tb !== ta) return tb - ta;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }

  function extractSequenceRange(seqText) {
    const s = upper(seqText)
      .replace(/\s+/g, " ")
      .replace(/ATÉ/g, "A")
      .replace(/ATE/g, "A")
      .replace(/AO/g, "A");

    const m = s.match(/(\d+)\s*(?:A|-|\/)\s*(\d+)/);
    if (!m) return null;

    const ini = Number(m[1]);
    const fim = Number(m[2]);

    if (!Number.isFinite(ini) || !Number.isFinite(fim)) return null;

    return {
      ini: Math.min(ini, fim),
      fim: Math.max(ini, fim)
    };
  }

  function normalizeFrota(r) {
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      placa: upper(r?.placa || ""),
      condutor: upper(r?.condutor || ""),
      telefone: safeText(r?.telefone || ""),
      tipoVeiculo: upper(r?.tipoVeiculo || ""),
      mes: upper(r?.mes || ""),
      status: upper(r?.status || "OK"),
      createdAt: Number(r?.createdAt || 0) || 0,
      updatedAt: Number(r?.updatedAt || 0) || 0,
    };
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
      termoArquivoNome: safeText(r?.termoArquivoNome || ""),
      termoArquivoUrl: safeText(r?.termoArquivoUrl || ""),
      termoArquivoId: safeText(r?.termoArquivoId || ""),
      createdAt: Number(r?.createdAt || 0) || 0,
      updatedAt: Number(r?.updatedAt || 0) || 0,
    };
  }

  function normalizeMaterialRow(r) {
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      data: safeText(r?.data),
      descricao: safeText(r?.descricao),
      responsavel: upper(r?.responsavel),
      status: upper(r?.status || "ATIVO"),
      recebido: upper(r?.recebido || "NÃO"),
      createdAt: Number(r?.createdAt || 0) || 0,
      updatedAt: Number(r?.updatedAt || 0) || 0,
    };
  }

  function normalizeSolic(r) {
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

  function normalizePat(r) {
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

  function normalizeEpi(r) {
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

  async function loadFrotaFromSheets() {
    const res = await apiGet({ action: "frotaleve_list" });
    DATA.frota = (res.data || []).map(normalizeFrota);
  }

  async function loadChequesFromSheets() {
    const res = await apiGet({ action: "cheques_list" });
    DATA.cheques = sortByDateDesc((res.data || []).map(normalizeChequeRow), "data");
  }

  async function loadMateriaisFromSheets() {
    const res = await apiGet({ action: "materiais_list" });
    DATA.materiais = sortByDateDesc((res.data || []).map(normalizeMaterialRow), "data");
  }

  async function loadSolicFromSheets() {
    const res = await apiGet({ action: "solicit_list" });
    DATA.solicitacoes = sortByDateDesc((res.data || []).map(normalizeSolic), "data");
  }

  async function loadPatFromSheets() {
    const res = await apiGet({ action: "patrimonio_list" });
    DATA.patrimonio = (res.data || []).map(normalizePat);
  }

  async function loadEpisFromSheets() {
    const res = await apiGet({ action: "epis_list" });
    DATA.epis = (res.data || []).map(normalizeEpi);
  }

  async function createFrotaOnSheets(payload) {
    const res = await apiGet({
      action: "frotaleve_add",
      filial: upper(payload.filial),
      placa: upper(payload.placa || ""),
      condutor: upper(payload.condutor || ""),
      telefone: safeText(payload.telefone || ""),
      tipoVeiculo: upper(payload.tipoVeiculo || ""),
      mes: upper(payload.mes || ""),
      status: upper(payload.status || "OK"),
    });
    return res.data;
  }

  async function updateFrotaOnSheets(payload) {
    const res = await apiGet({
      action: "frotaleve_update",
      id: safeText(payload.id),
      filial: payload.filial != null ? upper(payload.filial) : "",
      placa: payload.placa != null ? upper(payload.placa) : "",
      condutor: payload.condutor != null ? upper(payload.condutor) : "",
      telefone: payload.telefone != null ? safeText(payload.telefone) : "",
      tipoVeiculo: payload.tipoVeiculo != null ? upper(payload.tipoVeiculo) : "",
      mes: payload.mes != null ? upper(payload.mes) : "",
      status: payload.status != null ? upper(payload.status) : "",
    });
    return res.data;
  }

  async function createChequeOnSheets(payload) {
    const res = await apiGet({
      action: "cheques_add",
      filial: upper(payload.filial),
      data: safeText(payload.data),
      sequencia: safeText(payload.sequencia),
      responsavel: upper(payload.responsavel),
      status: upper(payload.status || "ATIVO"),
      termoAssinado: upper(payload.termoAssinado || "NÃO"),
      termoArquivoNome: safeText(payload.termoArquivoNome || ""),
      termoArquivoUrl: safeText(payload.termoArquivoUrl || ""),
      termoArquivoId: safeText(payload.termoArquivoId || ""),
    });
    return res.data;
  }

  async function updateChequeOnSheets(payload) {
    const res = await apiGet({
      action: "cheques_update",
      id: safeText(payload.id),
      status: payload.status != null ? upper(payload.status) : "",
      termoAssinado: payload.termoAssinado != null ? upper(payload.termoAssinado) : "",
      termoArquivoNome: payload.termoArquivoNome != null ? safeText(payload.termoArquivoNome) : "",
      termoArquivoUrl: payload.termoArquivoUrl != null ? safeText(payload.termoArquivoUrl) : "",
      termoArquivoId: payload.termoArquivoId != null ? safeText(payload.termoArquivoId) : "",
    });
    return res.data;
  }

  async function createMaterialOnSheets(payload) {
    const res = await apiGet({
      action: "materiais_add",
      filial: upper(payload.filial),
      data: safeText(payload.data),
      descricao: upper(payload.descricao || ""),
      responsavel: upper(payload.responsavel || ""),
      status: upper(payload.status || "ATIVO"),
      recebido: upper(payload.recebido || "NÃO"),
    });
    return res.data;
  }

  async function updateMaterialOnSheets(payload) {
    const res = await apiGet({
      action: "materiais_update",
      id: safeText(payload.id),
      filial: payload.filial != null ? upper(payload.filial) : "",
      data: payload.data != null ? safeText(payload.data) : "",
      descricao: payload.descricao != null ? upper(payload.descricao) : "",
      responsavel: payload.responsavel != null ? upper(payload.responsavel) : "",
      status: payload.status != null ? upper(payload.status) : "",
      recebido: payload.recebido != null ? upper(payload.recebido) : "",
    });
    return res.data;
  }

  async function createSolicOnSheets(payload) {
    const res = await apiGet({
      action: "solicit_add",
      filial: upper(payload.filial),
      tipo: upper(payload.tipo || "GERAL"),
      data: safeText(payload.data || todayBR()),
      status: upper(payload.status || "ABERTA"),
      observacao: safeText(payload.observacao || ""),
      solicitante: upper(payload.solicitante || (window.getUser?.() || "USUÁRIO")),
    });
    return res.data;
  }

  async function updateSolicOnSheets(payload) {
    const res = await apiGet({
      action: "solicit_update",
      id: safeText(payload.id),
      filial: payload.filial != null ? upper(payload.filial) : "",
      tipo: payload.tipo != null ? upper(payload.tipo) : "",
      data: payload.data != null ? safeText(payload.data) : "",
      status: payload.status != null ? upper(payload.status) : "",
      observacao: payload.observacao != null ? safeText(payload.observacao) : "",
      solicitante: payload.solicitante != null ? upper(payload.solicitante) : "",
    });
    return res.data;
  }

  async function createPatOnSheets(payload) {
    const res = await apiGet({
      action: "patrimonio_add",
      filial: upper(payload.filial),
      equipamento: upper(payload.equipamento || ""),
      numeroPatrimonio: upper(payload.numeroPatrimonio || ""),
      posse: upper(payload.posse || ""),
      status: upper(payload.status || "ATIVO"),
      observacao: safeText(payload.observacao || ""),
    });
    return res.data;
  }

  async function updatePatOnSheets(payload) {
    const res = await apiGet({
      action: "patrimonio_update",
      id: safeText(payload.id),
      filial: payload.filial != null ? upper(payload.filial) : "",
      equipamento: payload.equipamento != null ? upper(payload.equipamento) : "",
      numeroPatrimonio: payload.numeroPatrimonio != null ? upper(payload.numeroPatrimonio) : "",
      posse: payload.posse != null ? upper(payload.posse) : "",
      status: payload.status != null ? upper(payload.status) : "",
      observacao: payload.observacao != null ? safeText(payload.observacao) : "",
    });
    return res.data;
  }

  async function createEpiOnSheets(payload) {
    const res = await apiGet({
      action: "epis_add",
      filial: upper(payload.filial),
      colaborador: upper(payload.colaborador || ""),
      epi: upper(payload.epi || ""),
      qtd: safeText(payload.qtd || ""),
      dataEntrega: safeText(payload.dataEntrega || todayBR()),
      validade: safeText(payload.validade || ""),
      observacao: safeText(payload.observacao || ""),
    });
    return res.data;
  }

  async function updateEpiOnSheets(payload) {
    const res = await apiGet({
      action: "epis_update",
      id: safeText(payload.id),
      filial: payload.filial != null ? upper(payload.filial) : "",
      colaborador: payload.colaborador != null ? upper(payload.colaborador) : "",
      epi: payload.epi != null ? upper(payload.epi) : "",
      qtd: payload.qtd != null ? safeText(payload.qtd) : "",
      dataEntrega: payload.dataEntrega != null ? safeText(payload.dataEntrega) : "",
      validade: payload.validade != null ? safeText(payload.validade) : "",
      observacao: payload.observacao != null ? safeText(payload.observacao) : "",
    });
    return res.data;
  }

  async function uploadChequeTermoOnServer(chequeId, file, extra = {}) {
    const base64 = await readFileAsBase64(file);

    const res = await apiPostJSON({
      action: "cheques_upload_termo",
      id: safeText(chequeId),
      fileName: safeText(file.name),
      mimeType: safeText(file.type || "application/octet-stream"),
      base64: base64,
      filial: upper(extra.filial || ""),
      sequencia: safeText(extra.sequencia || ""),
    });

    return res.data;
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };

      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });
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
    const qRaw = safeText($("#fBuscaAdmin")?.value || "");
    const q = upper(qRaw);
    const qNumRaw = String(qRaw).replace(/\D/g, "");
    const qNum = qNumRaw ? Number(qNumRaw) : NaN;

    return (list || []).filter((it) => {
      if (selFilial && upper(it.filial || "") !== selFilial) return false;

      if (!q) return true;

      if (Number.isFinite(qNum) && qNum > 0 && it.sequencia) {
        const range = extractSequenceRange(it.sequencia);
        if (range && qNum >= range.ini && qNum <= range.fim) {
          return true;
        }
      }

      const blob = upper(JSON.stringify(it));
      return blob.includes(q);
    });
  }

  let selectedChequeFilial = "";
  let selectedMaterialFilial = "";

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
        tab === "materiais" ? "Materiais" :
        tab === "solicitacoes" ? "Solicitações" :
        tab === "patrimonio" ? "Patrimônio" : "Controle de EPIs";
    }

    if (tab === "cheques" && !selectedChequeFilial) selectedChequeFilial = FILIAIS[0];
    if (tab === "materiais" && !selectedMaterialFilial) selectedMaterialFilial = FILIAIS[0];

    renderAll();
  }

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

  function groupByFilial(list) {
    const map = new Map();
    (list || []).forEach((c) => {
      const f = upper(c.filial);
      if (!map.has(f)) map.set(f, []);
      map.get(f).push(c);
    });
    return map;
  }

  function maybeAutoSelectChequeFilialBySearch() {
    const qRaw = safeText($("#fBuscaAdmin")?.value || "");
    const qNumRaw = qRaw.replace(/\D/g, "");
    const qNum = qNumRaw ? Number(qNumRaw) : NaN;

    if (!Number.isFinite(qNum) || qNum <= 0) return;

    const match = applyFilters(DATA.cheques).find((it) => {
      const range = extractSequenceRange(it.sequencia);
      return range && qNum >= range.ini && qNum <= range.fim;
    });

    if (match?.filial) {
      selectedChequeFilial = upper(match.filial);
    }
  }

  function renderFilialButtons() {
    const bar = $("#filialBar");
    if (!bar) return;

    bar.innerHTML = "";
    maybeAutoSelectChequeFilialBySearch();

    const filtered = applyFilters(DATA.cheques);
    const byFilial = groupByFilial(filtered);

    if (!selectedChequeFilial) selectedChequeFilial = FILIAIS[0];

    FILIAIS.forEach((filial) => {
      const rows = byFilial.get(filial) || [];
      const pend = rows.filter((x) => upper(x.termoAssinado) !== "SIM").length;

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

      btn.addEventListener("click", () => {
        selectedChequeFilial = filial;
        renderChequesArea();
      });

      bar.appendChild(btn);
    });

    renderChequesArea();
  }

  function renderChequesArea() {
    const meta = $("#chequesMeta");
    const tbody = $("#chequesTbody");
    const bar = $("#filialBar");

    if (!meta || !tbody || !bar) return;

    bar.querySelectorAll(".filialBtn").forEach((b) => {
      b.classList.toggle("isSelected", b.getAttribute("data-filial") === selectedChequeFilial);
    });

    const filtered = applyFilters(DATA.cheques).filter((c) => upper(c.filial) === selectedChequeFilial);
    const ordered = sortByDateDesc(filtered, "data");

    const total = ordered.length;
    const pend = ordered.filter((x) => upper(x.termoAssinado) !== "SIM").length;

    meta.textContent = `Selecionado: ${selectedChequeFilial} • Total: ${total} • Pendentes: ${pend}`;

    tbody.innerHTML = "";

    if (!ordered.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8" style="opacity:.85">Nenhum cheque cadastrado nesta filial. Use + Novo para lançar.</td>`;
      tbody.appendChild(tr);
      return;
    }

    ordered.forEach((it) => {
      const termo = upper(it.termoAssinado || "NÃO");
      const hasFile = !!safeText(it.termoArquivoUrl);
      const isUploading = STATE.uploadingChequeId === it.id;

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
        <td>
          <button class="linkBtn" type="button"
            data-upload-cheque="${escapeHtml(it.id)}"
            ${isUploading ? "disabled" : ""}
          >${isUploading ? "ENVIANDO..." : (hasFile ? "TROCAR" : "UPLOAD")}</button>
        </td>
        <td>
          ${hasFile
            ? `<a class="linkBtn" href="${escapeHtml(it.termoArquivoUrl)}" target="_blank" rel="noopener">ABRIR</a>`
            : `<span style="opacity:.65">—</span>`
          }
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderMaterialButtons() {
    const bar = $("#materialBar");
    if (!bar) return;

    bar.innerHTML = "";
    const filtered = applyFilters(DATA.materiais);
    const byFilial = groupByFilial(filtered);

    if (!selectedMaterialFilial) selectedMaterialFilial = FILIAIS[0];

    FILIAIS.forEach((filial) => {
      const rows = byFilial.get(filial) || [];
      const pend = rows.filter((x) => upper(x.recebido) !== "SIM").length;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filialBtn" + (selectedMaterialFilial === filial ? " isSelected" : "");
      btn.setAttribute("data-material-filial", filial);

      const dotColor = pend ? "rgba(250,204,21,.95)" : "rgba(34,197,94,.90)";
      btn.innerHTML = `
        <span class="filialDot" style="background:${dotColor}; box-shadow:0 0 0 3px ${pend ? "rgba(250,204,21,.14)" : "rgba(34,197,94,.14)"};"></span>
        <span>${filial}</span>
        <span class="filialCount">(${rows.length})</span>
      `;

      btn.addEventListener("click", () => {
        selectedMaterialFilial = filial;
        renderMateriaisArea();
      });

      bar.appendChild(btn);
    });

    renderMateriaisArea();
  }

  function renderMateriaisArea() {
    const meta = $("#materiaisMeta");
    const tbody = $("#materiaisTbody");
    const bar = $("#materialBar");

    if (!meta || !tbody || !bar) return;

    bar.querySelectorAll(".filialBtn").forEach((b) => {
      b.classList.toggle("isSelected", b.getAttribute("data-material-filial") === selectedMaterialFilial);
    });

    const filtered = applyFilters(DATA.materiais).filter((c) => upper(c.filial) === selectedMaterialFilial);
    const ordered = sortByDateDesc(filtered, "data");

    const total = ordered.length;
    const pend = ordered.filter((x) => upper(x.recebido) !== "SIM").length;

    meta.textContent = `Selecionado: ${selectedMaterialFilial} • Total: ${total} • Pendentes: ${pend}`;

    tbody.innerHTML = "";

    if (!ordered.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" style="opacity:.85">Nenhum material cadastrado nesta filial. Use + Novo para lançar.</td>`;
      tbody.appendChild(tr);
      return;
    }

    ordered.forEach((it) => {
      const recebido = upper(it.recebido || "NÃO");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.filial)}</td>
        <td>${escapeHtml(it.data)}</td>
        <td><b>${escapeHtml(it.descricao)}</b></td>
        <td>${escapeHtml(it.responsavel)}</td>
        <td>${escapeHtml(it.status)}</td>
        <td>
          <button class="linkBtn" type="button"
            data-toggle-material="${escapeHtml(it.id)}"
            data-recebido-atual="${recebido}"
          >${recebido}</button>
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
      renderChequesArea();
      setStatus("✅ Termo atualizado");
    } catch (e) {
      console.error(e);
      setStatus("❌ Falha");
      alert(e?.message || "Falha ao atualizar termo");
    }
  }

  async function toggleRecebido(materialId, atual) {
    const novo = upper(atual) === "SIM" ? "NÃO" : "SIM";
    try {
      setStatus("📦 Atualizando material...");
      await updateMaterialOnSheets({ id: materialId, recebido: novo });
      await reloadAll(false);
      renderMateriaisArea();
      setStatus("✅ Material atualizado");
    } catch (e) {
      console.error(e);
      setStatus("❌ Falha");
      alert(e?.message || "Falha ao atualizar material");
    }
  }

  async function handleChequeUploadClick(chequeId) {
    const input = $("#chequeFileInput");
    if (!input) {
      alert("Input de upload não encontrado no HTML.");
      return;
    }

    STATE.currentChequeUploadId = safeText(chequeId);
    input.value = "";
    input.click();
  }

  async function handleChequeFileSelected(file) {
    const chequeId = safeText(STATE.currentChequeUploadId);
    if (!chequeId || !file) return;

    const cheque = DATA.cheques.find((x) => x.id === chequeId);
    if (!cheque) {
      alert("Cheque não encontrado para upload.");
      return;
    }

    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];

    const extOk = /\.(pdf|png|jpe?g|webp)$/i.test(file.name || "");
    if (!allowed.includes(file.type) && !extOk) {
      alert("Envie somente PDF, JPG, JPEG, PNG ou WEBP.");
      return;
    }

    try {
      STATE.uploadingChequeId = chequeId;
      renderChequesArea();
      setStatus("📤 Enviando termo assinado...");

      await uploadChequeTermoOnServer(chequeId, file, {
        filial: cheque.filial,
        sequencia: cheque.sequencia,
      });

      await reloadAll(false);
      renderChequesArea();
      setStatus("✅ Termo enviado com sucesso");
    } catch (e) {
      console.error("[admin] upload cheque erro:", e);
      setStatus("❌ Falha no upload");
      alert(
        e?.message ||
        "Falha ao enviar arquivo. Confira se o Apps Script já possui a ação cheques_upload_termo em doPost."
      );
    } finally {
      STATE.uploadingChequeId = "";
      STATE.currentChequeUploadId = "";
      renderChequesArea();
    }
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
    $("#kpiMateriais").textContent = String(DATA.materiais.length);
    $("#kpiSolic").textContent = String(DATA.solicitacoes.filter((s) => upper(s.status) === "ABERTA").length);
    $("#kpiPatrimonio").textContent = String(DATA.patrimonio.length);
    $("#kpiEpis").textContent = String(DATA.epis.length);

    const badge = $("#badgeTopSolic");
    if (badge) {
      badge.textContent = String(DATA.solicitacoes.filter((s) => upper(s.status) === "ABERTA").length);
    }
  }

  function renderAll() {
    updateKpis();
    const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";

    if (tab === "frota") renderFrota(DATA.frota);
    if (tab === "cheques") renderFilialButtons();
    if (tab === "materiais") renderMaterialButtons();
    if (tab === "solicitacoes") renderSolic(DATA.solicitacoes);
    if (tab === "patrimonio") renderPatrimonio(DATA.patrimonio);
    if (tab === "epis") renderEpis(DATA.epis);
  }

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
      if (f.readonly) input.readOnly = true;

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
    return el ? safeText(el.value) : "";
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

    if (tab === "materiais") {
      return [
        { id: "mFilial", name: "filial", label: "Filial", type: "select", options: filialOpts },
        { id: "mData", name: "data", label: "Data (dd/mm/aaaa)", placeholder: todayBR(), type: "text" },
        { id: "mDesc", name: "descricao", label: "Material", placeholder: "EX: PAPEL A4 / TONER / CANETA", type: "text" },
        { id: "mResp", name: "responsavel", label: "Responsável", placeholder: "ARIEL", type: "text" },
        { id: "mStatus", name: "status", label: "Status", type: "select", options: [
          { value: "ATIVO", label: "ATIVO" },
          { value: "ENCERRADO", label: "ENCERRADO" },
        ]},
        { id: "mReceb", name: "recebido", label: "Recebido", type: "select", options: [
          { value: "NÃO", label: "NÃO" },
          { value: "SIM", label: "SIM" },
        ]},
      ];
    }

    if (tab === "solicitacoes") {
      const user = upper(window.getUser?.() || "USUÁRIO");
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
        { id: "mSolic", name: "solicitante", label: "Solicitante", type: "text", readonly: true, full: true, placeholder: user },
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

    if (tab === "materiais") {
      return {
        filial: upper(getVal("mFilial")),
        data: getVal("mData"),
        descricao: upper(getVal("mDesc")),
        responsavel: upper(getVal("mResp")),
        status: upper(getVal("mStatus") || "ATIVO"),
        recebido: upper(getVal("mReceb") || "NÃO"),
      };
    }

    if (tab === "solicitacoes") {
      const user = upper(window.getUser?.() || "USUÁRIO");
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
      tipoVeiculo: upper(getVal("mTipoV")),
      mes: upper(getVal("mMes")),
      status: upper(getVal("mStatus") || "OK"),
    };
  }

  function labelTab(tab) {
    if (tab === "cheques") return "Cheques";
    if (tab === "materiais") return "Materiais";
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
        : tab === "materiais"
          ? { filial: selectedMaterialFilial || FILIAIS[0], status: "ATIVO", data: todayBR(), recebido: "NÃO" }
          : tab === "solicitacoes"
            ? { filial: "", status: "ABERTA", data: todayBR(), solicitante: upper(window.getUser?.() || "USUÁRIO") }
            : { filial: "" };

    openModal(`Novo - ${labelTab(tab)}`, schema, initial);
  }

  function openEdit(tab, id) {
    modal.ctx = { mode: "edit", tab, id };
    const schema = schemaFor(tab);

    const list =
      tab === "frota" ? DATA.frota :
      tab === "cheques" ? DATA.cheques :
      tab === "materiais" ? DATA.materiais :
      tab === "solicitacoes" ? DATA.solicitacoes :
      tab === "patrimonio" ? DATA.patrimonio :
      tab === "epis" ? DATA.epis :
      [];

    const item = list.find((x) => x.id === id);
    if (!item) return;

    openModal(`Editar - ${labelTab(tab)}`, schema, item);
  }

  async function saveModal() {
    const tab = modal.ctx.tab;
    const payload = valuesFromModal(tab);

    if (!payload.filial) {
      alert("Selecione uma filial.");
      return;
    }

    try {
      if (tab === "cheques") {
        if (!payload.data || !payload.sequencia || !payload.responsavel) {
          alert("Preencha: Data, Sequência e Responsável.");
          return;
        }
        setStatus("💾 Salvando cheque...");
        if (modal.ctx.mode === "edit") {
          await updateChequeOnSheets({ id: modal.ctx.id, ...payload });
        } else {
          await createChequeOnSheets(payload);
        }
        closeModal();
        await reloadAll(false);
        return;
      }

      if (tab === "materiais") {
        if (!payload.data || !payload.descricao || !payload.responsavel) {
          alert("Preencha: Data, Material e Responsável.");
          return;
        }
        setStatus("💾 Salvando material...");
        if (modal.ctx.mode === "edit") {
          await updateMaterialOnSheets({ id: modal.ctx.id, ...payload });
        } else {
          await createMaterialOnSheets(payload);
        }
        closeModal();
        await reloadAll(false);
        return;
      }

      if (tab === "solicitacoes") {
        setStatus("💾 Salvando solicitação...");
        if (modal.ctx.mode === "edit") {
          await updateSolicOnSheets({ id: modal.ctx.id, ...payload });
        } else {
          await createSolicOnSheets(payload);
        }
        closeModal();
        await reloadAll(false);
        return;
      }

      if (tab === "patrimonio") {
        setStatus("💾 Salvando patrimônio...");
        if (modal.ctx.mode === "edit") {
          await updatePatOnSheets({ id: modal.ctx.id, ...payload });
        } else {
          await createPatOnSheets(payload);
        }
        closeModal();
        await reloadAll(false);
        return;
      }

      if (tab === "epis") {
        setStatus("💾 Salvando EPI...");
        if (modal.ctx.mode === "edit") {
          await updateEpiOnSheets({ id: modal.ctx.id, ...payload });
        } else {
          await createEpiOnSheets(payload);
        }
        closeModal();
        await reloadAll(false);
        return;
      }

      if (tab === "frota") {
        setStatus("💾 Salvando frota...");
        if (modal.ctx.mode === "edit") {
          await updateFrotaOnSheets({ id: modal.ctx.id, ...payload });
        } else {
          await createFrotaOnSheets(payload);
        }
        closeModal();
        await reloadAll(false);
        return;
      }

    } catch (e) {
      console.error("[admin] save erro:", e);
      setStatus("❌ Falha");
      alert(e?.message || "Falha ao salvar.");
    }
  }

  async function reloadAll(showAlert = true) {
    try {
      setStatus("🔄 Atualizando...");

      const results = await Promise.allSettled([
        loadFrotaFromSheets(),
        loadChequesFromSheets(),
        loadMateriaisFromSheets(),
        loadSolicFromSheets(),
        loadPatFromSheets(),
        loadEpisFromSheets(),
      ]);

      const errors = results
        .filter((r) => r.status === "rejected")
        .map((r) => r.reason?.message || "Erro desconhecido");

      updateKpis();
      renderAll();

      if (errors.length) {
        console.error("[admin] reload erros:", errors);
        setStatus("⚠️ Atualizado com pendências");
        if (showAlert) alert(errors.join("\n"));
      } else {
        setStatus("✅ Atualizado");
      }
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

      if (el.matches("[data-toggle-material]")) {
        const id = el.getAttribute("data-toggle-material") || "";
        const atual = el.getAttribute("data-recebido-atual") || "NÃO";
        if (id) toggleRecebido(id, atual);
        return;
      }

      if (el.matches("[data-upload-cheque]")) {
        const id = el.getAttribute("data-upload-cheque") || "";
        if (id) handleChequeUploadClick(id);
        return;
      }

      if (el.matches("[data-edit]")) {
        const tab = el.getAttribute("data-edit") || "";
        const id = el.getAttribute("data-id") || "";
        if (tab && id) openEdit(tab, id);
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

    const btnTop = $("#btnTopSolic");
    if (btnTop) btnTop.addEventListener("click", () => setActiveTab("solicitacoes"));
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

    const btnNovo = $("#btnAdminNovo");
    if (btnNovo) {
      btnNovo.addEventListener("click", () => {
        const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";
        openNew(tab);
      });
    }

    modal.el = $("#modalAdmin");
    modal.title = $("#modalTitleAdmin");
    modal.fields = $("#modalFieldsAdmin");
    modal.btnClose = $("#btnCloseModalAdmin");
    modal.btnCancel = $("#btnCancelModalAdmin");
    modal.btnSave = $("#btnSaveModalAdmin");

    modal.btnClose?.addEventListener("click", closeModal);
    modal.btnCancel?.addEventListener("click", closeModal);
    modal.btnSave?.addEventListener("click", saveModal);

    modal.el?.addEventListener("click", (ev) => {
      if (ev.target === modal.el) closeModal();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && modal.el?.classList.contains("isOpen")) closeModal();
    });

    const fileInput = $("#chequeFileInput");
    if (fileInput) {
      fileInput.addEventListener("change", async (ev) => {
        const input = ev.target;
        const file = input?.files?.[0];
        if (file) {
          await handleChequeFileSelected(file);
        }
        input.value = "";
      });
    }
  }

  function initHeader() {
    const uf = upper(window.getSelectedState?.() || "");
    const user = safeText(window.getUser?.() || "");
    const sub = $("#adminSub");
    if (sub) sub.textContent = `Acesso liberado para ${user} | Estado: ${uf}`;
  }

  function init() {
    initHeader();
    fillFiliaisSelect();
    bindTabs();
    bindFilters();
    bindActions();
    bindDelegation();

    selectedChequeFilial = FILIAIS[0];
    selectedMaterialFilial = FILIAIS[0];

    renderAll();
    reloadAll(false);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
