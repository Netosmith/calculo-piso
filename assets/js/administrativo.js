/* administrativo.js | NOVA FROTA
   - Cheques: filiais em BOTÕES (2 linhas) + tabela abaixo
   - Remove drawer antigo (sem "FILIAL / Fechar")
   - Termo assinado: SIM/NÃO editável (toggle)
   - Frota: botão Editar no card
*/
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyWSvivxCp4GslWhGRxfvg6gcE72hNATplIqdVG2tp46DtrdxWzKLqirm-BgcSv2tlw/exec";

  const FILIAIS = [
    "ITUMBIARA","RIO VERDE","JATAI","MINEIROS","CHAPADAO DO CEU","MONTIVIDIU",
    "INDIARA","BOM JESUS DE GO","VIANOPOLIS","ANAPOLIS","URUAÇU",
  ];

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
    } catch { return fallback; }
  }
  function saveLS(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr || [])); } catch {}
  }

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

  // =========================
  // JSONP
  // =========================
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

  // =========================
  // CHEQUES (Sheets)
  // =========================
  function normalizeChequeRow(r) {
    return {
      id: safeText(r?.id),
      filial: upper(r?.filial),
      data: safeText(r?.data),
      sequencia: safeText(r?.sequencia),
      responsavel: upper(r?.responsavel),
      status: upper(r?.status || "ATIVO"),
      termoAssinado: upper(r?.termoAssinado || "NÃO"),
    };
  }

  function parseBRDate(s) {
    const t = String(s || "").trim();
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return 0;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
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
    DATA.cheques = sortCheques((res.data || []).map(normalizeChequeRow));
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

  // =========================
  // UI: tabs + filtros
  // =========================
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

  // =========================
  // Frota (com botão Editar)
  // =========================
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
          <span class="pill ${pillClassFromStatus(it.status)}">${upper(it.status)}</span>
          <button class="linkBtn" type="button" data-edit="frota" data-id="${it.id}">Editar</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  // =========================
  // Cheques (BOTÕES 2 LINHAS + TABELA ABAIXO)
  // =========================
  let selectedChequeFilial = "";

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

  function pickDefaultFilial(byFilial){
    if (selectedChequeFilial && FILIAIS.includes(selectedChequeFilial)) return selectedChequeFilial;
    const firstWith = FILIAIS.find(f => (byFilial.get(f) || []).length > 0);
    selectedChequeFilial = firstWith || "ITUMBIARA";
    return selectedChequeFilial;
  }

  function renderChequeButtons() {
    const wrap = document.getElementById("chequesFilialPills");
    if (!wrap) return;

    const filtered = applyFilters(DATA.cheques);
    const byFilial = groupChequesByFilial(filtered);
    pickDefaultFilial(byFilial);

    wrap.innerHTML = "";

    FILIAIS.forEach((filial) => {
      const total = (byFilial.get(filial) || []).length;
      const pend = (byFilial.get(filial) || []).filter(x => upper(x.termoAssinado) !== "SIM").length;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pillFilial" + (filial === selectedChequeFilial ? " isActive" : "");
      btn.setAttribute("data-cheque-filial", filial);
      btn.innerHTML = `
        <span class="dot ${pend ? "warn" : "ok"}"></span>
        <span class="name">${filial}</span>
        <span class="count">(${total})</span>
      `;
      wrap.appendChild(btn);
    });

    const listSel = byFilial.get(selectedChequeFilial) || [];
    const pendSel = listSel.filter(x => upper(x.termoAssinado) !== "SIM").length;
    const meta = document.getElementById("chequesMeta");
    if (meta) meta.textContent = `Selecionado: ${selectedChequeFilial} • Total: ${listSel.length} • Pendentes: ${pendSel}`;
  }

  function renderChequesTable() {
    const tbody = document.getElementById("chequesTbody");
    const hint = document.getElementById("chequesHint");
    if (!tbody) return;

    const filtered = applyFilters(DATA.cheques);
    const list = sortCheques(filtered.filter(c => upper(c.filial) === selectedChequeFilial));

    tbody.innerHTML = "";
    if (hint) hint.textContent = "";

    if (!list.length) {
      if (hint) hint.textContent = "Nenhum cheque nesta filial. Use + Novo para cadastrar a primeira sequência.";
      return;
    }

    list.forEach((it) => {
      const termo = upper(it.termoAssinado || "NÃO");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(upper(it.filial))}</td>
        <td>${escapeHtml(safeText(it.data))}</td>
        <td><b>${escapeHtml(safeText(it.sequencia))}</b></td>
        <td>${escapeHtml(safeText(it.responsavel))}</td>
        <td>${escapeHtml(safeText(it.status || "ATIVO"))}</td>
        <td>
          <button class="btnMini ${termo === "SIM" ? "ok" : "warn"}" type="button"
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
      renderChequeButtons();
      renderChequesTable();
      setStatus("✅ Termo atualizado");
    } catch (e) {
      setStatus("❌ Falha");
      alert(e?.message || "Falha ao atualizar termo");
    }
  }

  function renderCheques() {
    renderChequeButtons();
    renderChequesTable();
  }

  // =========================
  // Outras abas (mantidas)
  // =========================
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
    if (tab === "cheques") renderCheques();
    if (tab === "solicitacoes") renderSolic(DATA.solicitacoes);
    if (tab === "patrimonio") renderPatrimonio(DATA.patrimonio);
    if (tab === "epis") renderEpis(DATA.epis);
  }

  // =========================
  // Modal (novo/editar) - usado por cheques e frota
  // =========================
  const modal = { el:null,title:null,fields:null,btnClose:null,btnCancel:null,btnSave:null, ctx:{mode:"new",tab:"frota",id:""} };

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
    return el ? safeText(el.value) : "";
  }

  function schemaFor(tab) {
    const filialOpts = [{ value: "", label: "Selecione..." }].concat(FILIAIS.map(f=>({value:f,label:f})));

    if (tab === "cheques") {
      return [
        { id:"mFilial", name:"filial", label:"Filial", type:"select", options: filialOpts },
        { id:"mData", name:"data", label:"Data (dd/mm/aaaa)", placeholder: todayBR(), type:"text" },
        { id:"mSeq", name:"sequencia", label:"Sequência", placeholder:"000123", type:"text" },
        { id:"mResp", name:"responsavel", label:"Responsável", placeholder:"ARIEL", type:"text" },
        { id:"mStatus", name:"status", label:"Status", type:"select", options:[{value:"ATIVO",label:"ATIVO"},{value:"ENCERRADO",label:"ENCERRADO"}]},
        { id:"mTermo", name:"termoAssinado", label:"Termo assinado", type:"select", options:[{value:"NÃO",label:"NÃO"},{value:"SIM",label:"SIM"}]},
      ];
    }

    return [
      { id:"mFilial", name:"filial", label:"Filial", type:"select", options: filialOpts },
      { id:"mPlaca", name:"placa", label:"Placa", placeholder:"ABC1D23", type:"text" },
      { id:"mCond", name:"condutor", label:"Condutor", placeholder:"NOME", type:"text" },
      { id:"mTel", name:"telefone", label:"Filial Telefone", placeholder:"(64) 99999-0000", type:"text" },
      { id:"mTipoV", name:"tipoVeiculo", label:"Tipo do veículo", placeholder:"HATCH / SEDAN / PICKUP", type:"text" },
      { id:"mMes", name:"mes", label:"Mês ref.", placeholder:"MAR/2026", type:"text" },
      { id:"mStatus", name:"status", label:"Status", type:"select", options:[{value:"OK",label:"OK"},{value:"PENDENTE",label:"PENDENTE"},{value:"ATRASADO",label:"ATRASADO"}]},
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

  function openNew(tab) {
    modal.ctx = { mode:"new", tab, id:"" };
    const schema = schemaFor(tab);
    const initial = (tab === "cheques")
      ? { filial: selectedChequeFilial || "ITUMBIARA", status:"ATIVO", data: todayBR(), termoAssinado:"NÃO" }
      : { filial:"" };
    openModal(`Novo - ${tab === "cheques" ? "Cheques" : "Frota"}`, schema, initial);
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
        renderCheques();
        return;
      }

      if (modal.ctx.mode === "edit") {
        const idx = DATA.frota.findIndex((x) => x.id === modal.ctx.id);
        if (idx >= 0) DATA.frota[idx] = { ...DATA.frota[idx], ...payload };
      } else {
        DATA.frota.unshift({ id: uid(), ...payload });
      }
      saveLS(LS_KEYS.frota, DATA.frota);
      closeModal();
      renderAll();
      setStatus("✅ Salvo");
    } catch (e) {
      setStatus("❌ Falha");
      alert(e?.message || "Falha ao salvar.");
    }
  }

  async function reloadAll(showAlert = true) {
    try {
      setStatus("🔄 Atualizando...");
      await loadChequesFromSheets();
      renderAll();
      setStatus("✅ Atualizado");
    } catch (e) {
      setStatus("❌ Erro ao atualizar");
      if (showAlert) alert(e?.message || "Erro ao atualizar cheques.");
    }
  }

  // =========================
  // Delegação de cliques
  // =========================
  function bindDelegation() {
    document.addEventListener("click", (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLElement)) return;

      // clique nos botões de filial
      const pill = el.closest?.("[data-cheque-filial]");
      if (pill) {
        selectedChequeFilial = upper(pill.getAttribute("data-cheque-filial") || "");
        renderCheques();
        return;
      }

      // toggle termo
      if (el.matches("[data-toggle-termo]")) {
        const id = el.getAttribute("data-toggle-termo") || "";
        const atual = el.getAttribute("data-termo-atual") || "NÃO";
        if (id) toggleTermo(id, atual);
        return;
      }

      // editar frota
      if (el.matches("[data-edit='frota']")) {
        const id = el.getAttribute("data-id") || "";
        modal.ctx = { mode:"edit", tab:"frota", id };
        const schema = schemaFor("frota");
        const item = DATA.frota.find(x => x.id === id);
        if (item) openModal("Editar - Frota", schema, item);
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
    $("#btnTopSolic")?.addEventListener("click", () => setActiveTab("solicitacoes"));
  }

  function bindFilters() {
    $("#fFilialAdmin")?.addEventListener("change", renderAll);
    $("#fBuscaAdmin")?.addEventListener("input", renderAll);
  }

  function bindActions() {
    $("#btnAdminReload")?.addEventListener("click", () => reloadAll(true));

    $("#btnAdminNovo")?.addEventListener("click", () => {
      const tab = document.querySelector(".tabBtn.isActive")?.dataset.tab || "frota";
      if (tab === "cheques") return openNew("cheques");
      return openNew("frota");
    });

    modal.el = $("#modalAdmin");
    modal.title = $("#modalTitleAdmin");
    modal.fields = $("#modalFieldsAdmin");
    modal.btnClose = $("#btnCloseModalAdmin");
    modal.btnCancel = $("#btnCancelModalAdmin");
    modal.btnSave = $("#btnSaveModalAdmin");

    modal.btnClose?.addEventListener("click", closeModal);
    modal.btnCancel?.addEventListener("click", closeModal);
    modal.btnSave?.addEventListener("click", saveModal);

    modal.el?.addEventListener("click", (ev) => { if (ev.target === modal.el) closeModal(); });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && modal.el?.classList.contains("isOpen")) closeModal(); });
  }

  function initHeader() {
    const uf = (window.getSelectedState?.() || "").toUpperCase();
    const user = (window.getUser?.() || "");
    const sub = $("#adminSub");
    if (sub) sub.textContent = `Acesso liberado para ${user} | Estado: ${uf}`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
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
    renderAll();
    reloadAll(false);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
