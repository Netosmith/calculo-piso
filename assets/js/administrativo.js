/* administrativo.js | NOVA FROTA
   (tabs + filtros + cheques por filial em barra + tabela + termoAssinado SIM/NÃO editável)
*/
(function () {
  "use strict";

  // ======================================================
  // ✅ URL DO SEU WEB APP (Apps Script /exec)
  // ======================================================
  const API_URL =
    "https://script.google.com/macros/s/AKfycbyWSvivxCp4GslWhGRxfvg6gcE72hNATplIqdVG2tp46DtrdxWzKLqirm-BgcSv2tlw/exec";

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
  // ✅ STORAGE (Solicitações/Patrimônio/EPIs/Frota local)
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
  // ======================================================
  const DATA = {
    frota: loadLS(LS_KEYS.frota, [
      { id: uid(), placa: "ABC1D23", condutor: "PEDRO SANTOS", filial: "ITUMBIARA", status: "OK", mes: "MAR/2026", telefone: "(64) 99999-1111", tipoVeiculo: "HATCH" },
      { id: uid(), placa: "XYZ2E34", condutor: "LUCAS SILVA", filial: "RIO VERDE", status: "PENDENTE", mes: "ABR/2026", telefone: "(64) 99999-2222", tipoVeiculo: "SEDAN" },
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
  // ======================================================
  function normalizeChequeRow(r) {
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      data: safeText(r?.data),
      sequencia: safeText(r?.sequencia),
      responsavel: upper(r?.responsavel),
      status: upper(r?.status || "ATIVO"),
      // ✅ campo obrigatório no Sheet: termoAssinado
      termoAssinado: upper(r?.termoAssinado || "NÃO"),
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
    const url = buildUrl({ action: "cheques_list" });
    const res = await jsonp(url);
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
      termoAssinado: upper(payload.termoAssinado || "NÃO"),
    };

    const url = buildUrl(params);
    const res = await jsonp(url);
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

    const url = buildUrl(params);
    const res = await jsonp(url);
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_update");
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

    const inp = $("#fBuscaAdmin");
    if (inp) inp.value = "";

    // ✅ se abriu cheques, garante uma filial selecionada
    if (tab === "cheques" && !chequesSelectedFilial) {
      const sel = upper($("#fFilialAdmin")?.value || "");
      chequesSelectedFilial = sel || FILIAIS[0];
    }

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
  // ✅ Frota (mais infos no card)
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
            <div class="tagLine">${upper(it.filial)} • ${safeText(it.telefone || "")} • ${upper(it.tipoVeiculo || "")}</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${pillClassFromStatus(it.status)}">${upper(it.mes)} ${upper(it.status)}</span>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  // ======================================================
  // ✅ Cheques (barra de filiais + tabela)
  // ======================================================
  let chequesSelectedFilial = "";

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

  function ensureChequesLayout(wrap) {
    // injeta layout dentro do #gridCheques, sem depender de alterar HTML
    wrap.innerHTML = `
      <div class="nf-cheques">
        <div class="nf-cheques-head">
          <div class="nf-cheques-title">
            <div class="nf-cheques-h1">Filiais</div>
            <div class="nf-cheques-h2" id="nfChequesHint"></div>
          </div>

          <div class="nf-cheques-actions">
            <button class="btnAdmin ghost" id="btnChequesNovoInline" type="button">+ Novo (filial)</button>
          </div>
        </div>

        <div class="nf-cheques-bar" id="nfChequesBar"></div>

        <div class="nf-cheques-tableWrap">
          <table class="nf-table">
            <thead>
              <tr>
                <th>Filial</th>
                <th>Data</th>
                <th>Sequência</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Termo assinado</th>
              </tr>
            </thead>
            <tbody id="nfChequesTbody"></tbody>
          </table>

          <div class="nf-empty" id="nfChequesEmpty" style="display:none;">
            Nenhum cheque nesta filial. Use <b>+ Novo</b> para cadastrar a primeira sequência.
          </div>
        </div>
      </div>
    `;

    // estilos premium/minimalistas (injeção segura)
    if (!document.getElementById("nfChequesStyle")) {
      const st = document.createElement("style");
      st.id = "nfChequesStyle";
      st.textContent = `
        .nf-cheques{ display:flex; flex-direction:column; gap:12px; }
        .nf-cheques-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .nf-cheques-title{ display:flex; flex-direction:column; gap:2px; }
        .nf-cheques-h1{ font-weight:900; letter-spacing:.2px; }
        .nf-cheques-h2{ font-size:12px; opacity:.85; }

        .nf-cheques-bar{
          display:flex;
          gap:8px;
          overflow:auto;
          padding-bottom:4px;
          -webkit-overflow-scrolling: touch;
        }
        .nf-chip{
          border:1px solid rgba(255,255,255,.14);
          background: rgba(10,14,24,.28);
          color:#fff;
          padding:8px 10px;
          border-radius:999px;
          display:flex;
          align-items:center;
          gap:8px;
          cursor:pointer;
          white-space:nowrap;
          user-select:none;
          transition: transform .08s ease, background .15s ease, border-color .15s ease;
          font-weight:800;
          font-size:12px;
        }
        .nf-chip:active{ transform: scale(.99); }
        .nf-chip:hover{ border-color: rgba(255,255,255,.22); background: rgba(10,14,24,.38); }
        .nf-chip.isActive{
          border-color: rgba(255,255,255,.35);
          background: rgba(255,255,255,.10);
        }
        .nf-chip .dot{
          width:8px; height:8px; border-radius:999px;
          background: rgba(46,204,113,.9);
          box-shadow: 0 0 0 3px rgba(46,204,113,.12);
        }
        .nf-chip .dot.warn{
          background: rgba(241,196,15,.95);
          box-shadow: 0 0 0 3px rgba(241,196,15,.14);
        }

        .nf-cheques-tableWrap{
          border:1px solid rgba(255,255,255,.10);
          background: rgba(10,14,24,.22);
          border-radius:16px;
          overflow:hidden;
        }
        .nf-table{
          width:100%;
          border-collapse: collapse;
        }
        .nf-table thead th{
          text-align:left;
          font-size:12px;
          opacity:.9;
          padding:12px 12px;
          background: rgba(255,255,255,.06);
          border-bottom: 1px solid rgba(255,255,255,.08);
          white-space:nowrap;
        }
        .nf-table tbody td{
          padding:12px 12px;
          border-bottom: 1px solid rgba(255,255,255,.06);
          font-size:13px;
          white-space:nowrap;
        }
        .nf-table tbody tr:hover td{
          background: rgba(255,255,255,.04);
        }
        .nf-select{
          border:1px solid rgba(255,255,255,.16);
          background: rgba(0,0,0,.15);
          color:#fff;
          border-radius: 10px;
          padding:7px 10px;
          font-weight:900;
          outline:none;
        }
        .nf-empty{
          padding:14px 12px;
          opacity:.9;
        }
      `;
      document.head.appendChild(st);
    }
  }

  function renderCheques(list) {
    const wrap = $("#gridCheques");
    if (!wrap) return;

    ensureChequesLayout(wrap);

    const selGlobal = upper($("#fFilialAdmin")?.value || "");
    if (selGlobal) chequesSelectedFilial = selGlobal;
    if (!chequesSelectedFilial) chequesSelectedFilial = FILIAIS[0];

    const filteredAll = applyFilters(list);
    const byFilial = groupChequesByFilial(filteredAll);

    const bar = $("#nfChequesBar");
    const tbody = $("#nfChequesTbody");
    const empty = $("#nfChequesEmpty");
    const hint = $("#nfChequesHint");

    if (!bar || !tbody) return;

    // barra de filiais (chips)
    bar.innerHTML = "";
    FILIAIS.forEach((filial) => {
      const hist = byFilial.get(filial) || [];
      const pend = hist.filter(x => upper(x.termoAssinado) !== "SIM").length;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nf-chip" + (filial === chequesSelectedFilial ? " isActive" : "");
      btn.setAttribute("data-cheque-filial", filial);

      const dotClass = pend ? "dot warn" : "dot";
      btn.innerHTML = `
        <span class="${dotClass}"></span>
        <span>${filial}</span>
        <span style="opacity:.8;font-weight:900;">(${hist.length})</span>
      `;
      bar.appendChild(btn);
    });

    // dica topo
    const histSel = byFilial.get(chequesSelectedFilial) || [];
    const pendSel = histSel.filter(x => upper(x.termoAssinado) !== "SIM").length;
    if (hint) {
      hint.textContent = `Selecionado: ${chequesSelectedFilial} • Total: ${histSel.length} • Pendentes: ${pendSel}`;
    }

    // tabela
    tbody.innerHTML = "";
    const ordered = sortCheques(histSel);

    if (!ordered.length) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    ordered.forEach((it) => {
      const termo = upper(it.termoAssinado || "NÃO");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escapeHtml(upper(it.filial))}</b></td>
        <td>${escapeHtml(safeText(it.data))}</td>
        <td><b>${escapeHtml(safeText(it.sequencia))}</b></td>
        <td>${escapeHtml(safeText(it.responsavel))}</td>
        <td>${escapeHtml(safeText(it.status || "ATIVO"))}</td>
        <td>
          <select class="nf-select" data-termo-select="${escapeHtml(it.id)}" data-termo-old="${termo}">
            <option value="NÃO" ${termo === "NÃO" ? "selected" : ""}>NÃO</option>
            <option value="SIM" ${termo === "SIM" ? "selected" : ""}>SIM</option>
          </select>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // botão + novo (filial selecionada)
    $("#btnChequesNovoInline")?.addEventListener("click", () => {
      openNew("cheques", { filial: chequesSelectedFilial, status: "ATIVO", data: todayBR(), termoAssinado: "NÃO" });
    }, { once: true });
  }

  async function setTermoAssinado(chequeId, novo) {
    try {
      setStatus("🧾 Salvando termo...");
      await updateChequeOnSheets({ id: chequeId, termoAssinado: upper(novo) });
      await reloadAll(false);
      setStatus("✅ Termo atualizado");
    } catch (e) {
      console.error(e);
      setStatus("❌ Falha");
      alert(e?.message || "Falha ao atualizar termo");
    }
  }

  // ======================================================
  // ✅ Render das outras abas (mantidas)
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

    const abertas = DATA.solicitacoes.filter((s) => upper(s.status) === "ABERTA").length;
    const badge = $("#badgeTopSolic");
    if (badge) badge.textContent = String(abertas);
  }

  function renderAll() {
    updateKpis();
    const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";

    if (tab === "frota") renderFrota(DATA.frota);
    if (tab === "cheques") renderCheques(DATA.cheques);
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
          { value: "NÃO", label: "NÃO" },
          { value: "SIM", label: "SIM" },
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

    // frota
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
      telefone: getVal("mTel"),
      tipoVeiculo: getVal("mTipoV"),
      mes: upper(getVal("mMes")),
      status: upper(getVal("mStatus") || "OK"),
    };
  }

  function openNew(tab, preset) {
    modal.ctx = { mode: "new", tab, id: "" };
    const schema = schemaFor(tab);

    const initial =
      preset ||
      (tab === "cheques"
        ? { filial: chequesSelectedFilial || "", status: "ATIVO", data: todayBR(), termoAssinado: "NÃO" }
        : { filial: "" });

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
        setStatus("💾 Salvando cheque...");
        await createChequeOnSheets(payload);
        closeModal();
        await reloadAll(false);
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
      alert(e?.message || "Falha ao salvar.");
    }
  }

  function persistLocal() {
    saveLS(LS_KEYS.frota, DATA.frota);
    saveLS(LS_KEYS.solicit, DATA.solicitacoes);
    saveLS(LS_KEYS.patrimonio, DATA.patrimonio);
    saveLS(LS_KEYS.epis, DATA.epis);
  }

  async function reloadAll(showAlert = true) {
    try {
      setStatus("🔄 Atualizando...");
      await loadChequesFromSheets();
      updateKpis();
      renderAll();
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[admin] reload erro:", e);
      setStatus("❌ Erro ao atualizar");
      if (showAlert) alert(e?.message || "Erro ao atualizar cheques.");
    }
  }

  // ======================================================
  // Delegações (chips cheques + select termo + editar)
  // ======================================================
  function bindDelegation() {
    document.addEventListener("click", (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLElement)) return;

      // troca filial (chip)
      if (el.closest?.("[data-cheque-filial]")) {
        const btn = el.closest("[data-cheque-filial]");
        const filial = btn?.getAttribute("data-cheque-filial") || "";
        if (filial) {
          chequesSelectedFilial = upper(filial);
          renderAll();
        }
        return;
      }

      // editar cards
      if (el.matches("[data-edit]")) {
        const tab = el.getAttribute("data-edit") || "";
        const id = el.getAttribute("data-id") || "";
        if (tab && id) openEdit(tab, id);
        return;
      }
    });

    // termo assinado (select)
    document.addEventListener("change", (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLSelectElement)) return;

      if (el.matches("[data-termo-select]")) {
        const id = el.getAttribute("data-termo-select") || "";
        const novo = upper(el.value || "NÃO");
        if (id) setTermoAssinado(id, novo);
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

    // ✅ botão topo solicitações (se existir)
    const btn = $("#btnTopSolic");
    if (btn) btn.addEventListener("click", () => setActiveTab("solicitacoes"));
  }

  function bindFilters() {
    const sel = $("#fFilialAdmin");
    const inp = $("#fBuscaAdmin");
    if (sel) sel.addEventListener("change", () => {
      // se estiver na aba cheques e escolher filial no filtro, já seleciona
      const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "";
      if (tab === "cheques") {
        const f = upper(sel.value || "");
        if (f) chequesSelectedFilial = f;
      }
      renderAll();
    });
    if (inp) inp.addEventListener("input", renderAll);
  }

  function bindActions() {
    const btnReload = $("#btnAdminReload");
    if (btnReload) btnReload.addEventListener("click", () => reloadAll(true));

    const btnNovo = $("#btnAdminNovo");
    if (btnNovo) btnNovo.addEventListener("click", () => {
      const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";
      openNew(tab);
    });

    // modal
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
    reloadAll(false);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
