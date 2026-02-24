/* administrativo.js | NOVA FROTA (cards + tabs + filtros + mock data) */
(function () {
  "use strict";

  // ======================================================
  // ✅ PLACEHOLDER: aqui você coloca depois o ID do Drive
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
  // ✅ DADOS EXEMPLO (você troca depois ou conecta na planilha)
  // ======================================================
  const DATA = {
    frota: [
      { placa: "ABC1D23", condutor: "Pedro Santos", filial: "ITUMBIARA", status: "OK", mes: "MAR/2026" },
      { placa: "XYZ2E34", condutor: "Lucas Silva", filial: "RIO VERDE", status: "PENDENTE", mes: "ABR/2026" },
      { placa: "DEF4G66", condutor: "João Souza", filial: "JATAI", status: "ATRASADO", mes: "FEV/2026" },
      { placa: "GHISJ78", condutor: "Marcela Persista", filial: "CHAPADAO DO CEU", status: "OK", mes: "MAR/2026" },
      { placa: "XMN7Z12", condutor: "João Almeida", filial: "MONTIVIDIU", status: "OK", mes: "MAR/2026" },
    ],
    cheques: [
      { filial: "ITUMBIARA", data: "24/02/2026", sequencia: "000123", responsavel: "ARIEL", status: "ATIVO" },
      { filial: "RIO VERDE", data: "24/02/2026", sequencia: "000124", responsavel: "JHONATAN", status: "ATIVO" },
      { filial: "JATAI", data: "23/02/2026", sequencia: "000125", responsavel: "SERGIO", status: "ATIVO" },
    ],
    solicitacoes: [
      { filial: "ITUMBIARA", qtd: 10, prevista: "26/02/2026", status: "ABERTA" },
      { filial: "RIO VERDE", qtd: 20, prevista: "27/02/2026", status: "PENDENTE" },
    ],
  };

  // ----------------------------
  // helpers
  // ----------------------------
  const $ = (sel) => document.querySelector(sel);

  function upper(v) {
    return String(v ?? "").trim().toUpperCase();
  }

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
    // limpa busca ao trocar de aba
    const inp = $("#fBuscaAdmin");
    if (inp) inp.value = "";
    renderAll();
  }

  function fillFiliaisSelect() {
    const sel = $("#fFilialAdmin");
    if (!sel) return;
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
    return "pendente";
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
            <div class="smallLine">${it.condutor}</div>
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

    list.forEach((it) => {
      const card = document.createElement("div");
      card.className = "adminCard";
      card.innerHTML = `
        <div class="adminCardTop">
          <div class="avatar">💳</div>
          <div class="adminMain">
            <div class="big">${upper(it.filial)}</div>
            <div class="smallLine">DATA: ${it.data} | SEQ: ${upper(it.sequencia)}</div>
            <div class="tagLine">RESP: ${upper(it.responsavel)} | ${upper(it.status)}</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill pendente">TERMO ASSINADO</span>
          <button class="linkBtn" type="button" data-upload="termo" data-seq="${upper(it.sequencia)}">Upload termo</button>
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
            <div class="smallLine">QTD: ${it.qtd} | PREVISTA: ${it.prevista}</div>
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

  function applyFilters(tab, list) {
    const selFilial = upper($("#fFilialAdmin")?.value || "");
    const q = upper($("#fBuscaAdmin")?.value || "");

    return (list || []).filter((it) => {
      // filtro filial
      if (selFilial) {
        const f = upper(it.filial || "");
        if (f !== selFilial) return false;
      }

      // filtro busca
      if (q) {
        const blob = upper(JSON.stringify(it));
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }

  function renderAll() {
    // kpis
    $("#kpiFrota").textContent = String(DATA.frota.length);
    $("#kpiCheques").textContent = String(DATA.cheques.length);
    $("#kpiSolic").textContent = String(DATA.solicitacoes.length);

    const tab =
      document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";

    if (tab === "frota") {
      renderFrota(applyFilters("frota", DATA.frota));
    } else if (tab === "cheques") {
      renderCheques(applyFilters("cheques", DATA.cheques));
    } else {
      renderSolic(applyFilters("solicitacoes", DATA.solicitacoes));
    }
  }

  // ----------------------------
  // binds
  // ----------------------------
  function bindTabs() {
    document.querySelectorAll(".tabBtn").forEach((b) => {
      b.addEventListener("click", () => setActiveTab(b.dataset.tab));
    });

    // cards KPI clicáveis
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
    if (btnReload) btnReload.addEventListener("click", () => {
      // quando conectar com planilha/drive, aqui vira fetch
      renderAll();
    });

    const btnNovo = $("#btnAdminNovo");
    if (btnNovo) btnNovo.addEventListener("click", () => {
      alert("Em breve: modal Novo (vamos fazer na próxima etapa).");
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

        // Aqui depois vamos integrar Apps Script p/ enviar pro Drive.
        const ref = placa || seq || "ITEM";
        alert(
          `UPLOAD (${type}) - ${ref}\n\nDrive Folder ID: ${DRIVE_FOLDER_ID}\n\n(placeholder: vamos conectar depois ao Google Drive)`
        );
        return;
      }

      // Exemplo ação solicitação
      if (el.matches("[data-action='marcar']")) {
        const filial = el.getAttribute("data-filial");
        alert(`Marcar como enviada: ${filial}\n\n(na próxima etapa eu conecto isso ao Google Sheets/Drive)`);
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
    renderAll();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
