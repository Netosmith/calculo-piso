/* administrativo.js | NOVA FROTA (cards + tabs + filtros + sheets cheques) */
(function () {
  "use strict";

  // ======================================================
  // ✅ COLE AQUI A URL DO SEU WEB APP (Apps Script /exec)
  // (mesma pegada do fretes.js)
  // ======================================================
  const API_URL =
    "COLE_AQUI_SUA_URL_DO_APPS_SCRIPT_EXEC";

  // ======================================================
  // ✅ PLACEHOLDER: depois você coloca o ID do Drive
  // ======================================================
  const DRIVE_FOLDER_ID = "COLOQUE_AQUI_DEPOIS";

  // ======================================================
  // ✅ FILIAIS (na ordem que você passou)
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
  // ✅ DADOS (frota/solicitacoes ainda mock por enquanto)
  // ✅ cheques vem do Sheets via API
  // ======================================================
  const DATA = {
    frota: [
      { placa: "ABC1D23", condutor: "Pedro Santos", filial: "ITUMBIARA", status: "OK", mes: "MAR/2026" },
      { placa: "XYZ2E34", condutor: "Lucas Silva", filial: "RIO VERDE", status: "PENDENTE", mes: "ABR/2026" },
      { placa: "DEF4G66", condutor: "João Souza", filial: "JATAI", status: "ATRASADO", mes: "FEV/2026" },
      { placa: "GHISJ78", condutor: "Marcela Persista", filial: "CHAPADAO DO CEU", status: "OK", mes: "MAR/2026" },
      { placa: "XMN7Z12", condutor: "João Almeida", filial: "MONTIVIDIU", status: "OK", mes: "MAR/2026" },
    ],
    cheques: [], // <- vem do Sheets
    solicitacoes: [
      { filial: "ITUMBIARA", qtd: 10, prevista: "26/02/2026", status: "ABERTA" },
      { filial: "RIO VERDE", qtd: 20, prevista: "27/02/2026", status: "PENDENTE" },
    ],
  };

  // ----------------------------
  // helpers DOM
  // ----------------------------
  const $ = (sel) => document.querySelector(sel);

  function upper(v) {
    return String(v ?? "").trim().toUpperCase();
  }

  function safeText(v) {
    return String(v ?? "").trim();
  }

  function setStatus(text) {
    const el = $("#adminSyncStatus") || $("#syncStatus") || $("#status");
    if (el) el.textContent = text;
  }

  // ----------------------------
  // API helpers (GET/POST JSON)
  // ----------------------------
  async function apiGet(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const rawText = await res.text().catch(() => "");

    // bloqueia HTML (erro de deploy/permissão)
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
      // tenta JSONP callback(...)
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
  // ✅ CHEQUES: carregar do Sheets e manter histórico
  // ======================================================
  function normalizeChequeRow(r) {
    // listCheques devolve objetos com chaves do header:
    // id, createdAt, filial, data, sequencia, responsavel, status, termoUrl, termoNome, updatedAt
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

  function sortCheques(list) {
    // tenta ordenar por data (dd/mm/yyyy) e depois seq
    function parseBRDate(s) {
      const t = String(s || "").trim();
      const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return 0;
      const dd = Number(m[1]), mm = Number(m[2]), yy = Number(m[3]);
      return new Date(yy, mm - 1, dd).getTime();
    }

    return (list || []).slice().sort((a, b) => {
      const ta = parseBRDate(a.data);
      const tb = parseBRDate(b.data);
      if (tb !== ta) return tb - ta; // mais recente primeiro

      const sa = String(a.sequencia || "");
      const sb = String(b.sequencia || "");
      return sb.localeCompare(sa);
    });
  }

  async function loadChequesFromSheets() {
    if (!API_URL || API_URL.includes("COLE_AQUI")) {
      console.warn("[admin] API_URL não configurada");
      return;
    }
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

  // ----------------------------
  // tabs + filtros
  // ----------------------------
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
        tab === "cheques" ? "Cheques" : "Solicitações";
    }

    const inp = $("#fBuscaAdmin");
    if (inp) inp.value = "";
    renderAll();
  }

  function fillFiliaisSelect() {
    const sel = $("#fFilialAdmin");
    if (!sel) return;

    // limpa e recria
    sel.innerHTML = `<option value="">Todas as filiais</option>`;
    FILIAIS.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      sel.appendChild(opt);
    });
  }

  function pillClass(status) {
    const s = upper(status);
    if (s === "OK") return "ok";
    if (s === "PENDENTE") return "pendente";
    if (s === "ATRASADO") return "atrasado";
    if (s === "ATIVO") return "ok";
    if (s === "ENTREGUE") return "ok";
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

  // ----------------------------
  // render cards
  // ----------------------------
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
          <span class="pill ${pillClass(it.status)}">${upper(it.mes)} ${upper(it.status)}</span>
          <button class="linkBtn" type="button" data-upload="checklist" data-placa="${upper(it.placa)}">Upload checklist mensal</button>
        </div>
      `;

      wrap.appendChild(card);
    });
  }

  function renderCheques(list) {
    const wrap = $("#gridCheques");
    if (!wrap) return;
    wrap.innerHTML = "";

    // ✅ agora mostra HISTÓRICO (vários cards por filial)
    list.forEach((it) => {
      const hasTermo = !!it.termoUrl;
      const termoLabel = hasTermo ? "TERMO ASSINADO" : "PENDENTE TERMO";

      const card = document.createElement("div");
      card.className = "adminCard";
      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">💳</div>
          <div class="adminMain">
            <div class="big">${upper(it.filial)}</div>
            <div class="smallLine">DATA: ${safeText(it.data)} | SEQ: ${upper(it.sequencia)}</div>
            <div class="tagLine">RESP: ${upper(it.responsavel)} | ${upper(it.status || "")}</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${hasTermo ? "ok" : "pendente"}">${termoLabel}</span>
          <button class="linkBtn" type="button"
            data-upload="termo"
            data-id="${safeText(it.id)}"
            data-filial="${upper(it.filial)}"
            data-seq="${upper(it.sequencia)}"
          >Upload termo</button>
        </div>
      `;

      wrap.appendChild(card);
    });
  }

  function renderSolic(list) {
    const wrap = $("#gridSolic");
    if (!wrap) return;
    wrap.innerHTML = "";

    list.forEach((it) => {
      const card = document.createElement("div");
      card.className = "adminCard";
      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">📋</div>
          <div class="adminMain">
            <div class="big">${upper(it.filial)}</div>
            <div class="smallLine">QTD: ${safeText(it.qtd)} | PREVISTA: ${safeText(it.prevista)}</div>
            <div class="tagLine">STATUS: ${upper(it.status)}</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill pendente">SOLICITAÇÃO</span>
          <button class="linkBtn" type="button" data-action="marcar" data-filial="${upper(it.filial)}">Marcar como enviada</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  function renderAll() {
    // KPIs: frota e solicit ainda do mock, cheques do sheets
    $("#kpiFrota").textContent = String(DATA.frota.length);
    $("#kpiCheques").textContent = String(DATA.cheques.length);
    $("#kpiSolic").textContent = String(DATA.solicitacoes.length);

    const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";

    if (tab === "frota") {
      renderFrota(applyFilters(DATA.frota));
    } else if (tab === "cheques") {
      renderCheques(applyFilters(DATA.cheques));
    } else {
      renderSolic(applyFilters(DATA.solicitacoes));
    }
  }

  // ----------------------------
  // actions
  // ----------------------------
  async function reloadAll() {
    try {
      setStatus("🔄 Atualizando...");
      await loadChequesFromSheets();
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

  async function handleNovoCheque() {
    // ✅ cria um cheque real no Sheets (histórico)
    const filial = upper(prompt("Filial (ex: ITUMBIARA):", "ITUMBIARA") || "");
    if (!filial) return;

    const data = safeText(prompt("Data (dd/mm/aaaa):", "") || "");
    if (!data) return;

    const sequencia = safeText(prompt("Sequência (ex: 000123):", "") || "");
    if (!sequencia) return;

    const responsavel = upper(prompt("Responsável (ex: ARIEL):", "") || "");
    if (!responsavel) return;

    try {
      setStatus("💾 Salvando cheque...");
      await createChequeOnSheets({ filial, data, sequencia, responsavel, status: "ATIVO" });
      await reloadAll();
    } catch (e) {
      console.error("[admin] novo cheque erro:", e);
      setStatus("❌ Falha ao salvar");
      alert(e?.data?.error || e?.message || "Falha ao salvar cheque.");
    }
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
      if (tab === "cheques") return handleNovoCheque();
      alert("Por enquanto o +Novo está ativo apenas em CHEQUES (histórico).");
    });

    // delegação: botões dos cards
    document.addEventListener("click", (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLElement)) return;

      // Upload checklist/termo (placeholder)
      if (el.matches("[data-upload]")) {
        const type = el.getAttribute("data-upload");
        const placa = el.getAttribute("data-placa") || "";
        const seq = el.getAttribute("data-seq") || "";
        const id = el.getAttribute("data-id") || "";
        const ref = placa || seq || id || "ITEM";

        // por enquanto só abre file picker (sem subir)
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,application/pdf";
        input.onchange = () => {
          const file = input.files && input.files[0];
          if (!file) return;

          alert(
            `ARQUIVO SELECIONADO ✅\n\nTipo: ${type}\nRef: ${ref}\nArquivo: ${file.name}\n\nDrive Folder ID: ${DRIVE_FOLDER_ID}\n\n(Próxima etapa: subir pro Drive e salvar termoUrl no Sheets)`
          );
        };
        input.click();
        return;
      }

      // ação solicitação (placeholder)
      if (el.matches("[data-action='marcar']")) {
        const filial = el.getAttribute("data-filial");
        alert(`Marcar como enviada: ${filial}\n\n(na próxima etapa conecto isso ao Google Sheets)`);
      }
    });
  }

  function initHeader() {
    const uf = (window.getSelectedState?.() || "").toUpperCase();
    const user = (window.getUser?.() || "");
    const sub = $("#adminSub");
    if (sub) sub.textContent = `Acesso liberado para ${user} | Estado: ${uf} | Drive: (definir depois)`;
  }

  function init() {
    initHeader();
    fillFiliaisSelect();
    bindTabs();
    bindFilters();
    bindActions();

    // começa renderizando mock (pra não ficar vazio)
    renderAll();

    // puxa cheques do Sheets
    reloadAll();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
