/* administrativo.js | NOVA FROTA (cheques via JSONP + upload via iframe POST + salvar termoUrl) */
(function () {
  "use strict";

  // ======================================================
  // ✅ URL DO WEB APP (Apps Script /exec)
  // ======================================================
  const API_URL =
    "https://script.google.com/macros/s/AKfycbwEYA_DcUb3CwyM49yaJJLYn9aun27YMBQC6ejHMb-HSz1ibke2JmTIalNPnhC2OnTk/exec";

  // ======================================================
  // ✅ DRIVE (RAIZ) - Pasta ADMINISTRATIVO
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

  // ======================================================
  // ✅ JSONP helper (pros cheques)
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
        s.remove();
      }

      window[cb] = (data) => { cleanup(); resolve(data); };

      s.src = url + sep + "callback=" + encodeURIComponent(cb);
      s.onerror = () => { cleanup(); reject(new Error("Erro ao carregar script (JSONP)")); };

      document.head.appendChild(s);
    });
  }

  function buildUrl(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }

  // ======================================================
  // ✅ CHEQUES via JSONP
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
    const url = buildUrl({ action: "cheques_list" });
    const res = await jsonp(url);
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_list");
    const arr = res.data || [];
    DATA.cheques = sortCheques(arr.map(normalizeChequeRow));
  }

  async function createChequeOnSheets(payload) {
    const url = buildUrl({
      action: "cheques_add",
      filial: upper(payload.filial),
      data: safeText(payload.data),
      sequencia: safeText(payload.sequencia),
      responsavel: upper(payload.responsavel),
      status: upper(payload.status || "ATIVO"),
    });
    const res = await jsonp(url);
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_add");
    return res.data;
  }

  async function updateChequeOnSheets(payload) {
    const params = { action: "cheques_update", id: safeText(payload.id) };
    if (payload.status != null) params.status = upper(payload.status);
    if (payload.termoUrl != null) params.termoUrl = safeText(payload.termoUrl);
    if (payload.termoNome != null) params.termoNome = safeText(payload.termoNome);

    const url = buildUrl(params);
    const res = await jsonp(url);
    if (!res || res.ok === false) throw new Error(res?.error || "Erro cheques_update");
    return res.data;
  }

  // ======================================================
  // ✅ UPLOAD sem CORS: POST via FORM + IFRAME + postMessage
  // (sem base64 no URL, vai no body)
  // ======================================================
  function fileToBase64_(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.onload = () => {
        const result = String(reader.result || "");
        const idx = result.indexOf("base64,");
        resolve(idx >= 0 ? result.slice(idx + 7) : result);
      };
      reader.readAsDataURL(file);
    });
  }

  function postFormViaIframe_(fields, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      const frameName = "upf_" + Math.random().toString(36).slice(2);
      const iframe = document.createElement("iframe");
      iframe.name = frameName;
      iframe.style.display = "none";

      const form = document.createElement("form");
      form.method = "POST";
      form.action = API_URL;
      form.target = frameName;

      Object.entries(fields || {}).forEach(([k, v]) => {
        const inp = document.createElement("input");
        inp.type = "hidden";
        inp.name = k;
        inp.value = String(v ?? "");
        form.appendChild(inp);
      });

      const timer = setTimeout(() => cleanup(new Error("Timeout no upload")), timeoutMs);

      function cleanup(err) {
        clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        try { form.remove(); } catch {}
        try { iframe.remove(); } catch {}
        if (err) reject(err);
      }

      function onMsg(ev) {
        // Aceita msg do googleusercontent (apps script) e do seu domínio.
        // Se quiser travar mais, me diga o domínio exato do deploy.
        const data = ev && ev.data;
        if (!data || data.__nf_upload__ !== true) return;

        cleanup(); // remove listeners e nós

        if (data.ok === false) {
          reject(new Error(data.error || "Falha no upload"));
          return;
        }
        resolve(data.data);
      }

      window.addEventListener("message", onMsg);

      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();
    });
  }

  async function uploadFileToDrive(file, meta) {
    const b64 = await fileToBase64_(file);

    const fields = {
      action: "drive_upload",
      folderId: DRIVE_FOLDER_ID,
      filial: upper(meta.filial || ""),
      type: String(meta.type || ""),  // "termo" | "checklist"
      ref: String(meta.ref || ""),
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      data: b64,
    };

    const res = await postFormViaIframe_(fields, 180000);
    // res esperado: { fileId, name, url, folderFilial, folderTipo }
    return res;
  }

  // ======================================================
  // ✅ UI: tabs + filtros
  // ======================================================
  function setActiveTab(tab) {
    document.querySelectorAll(".tabBtn").forEach((b) => b.classList.toggle("isActive", b.dataset.tab === tab));
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
          <div class="avatar">${upper(it.placa).slice(0, 2)}</div>
          <div class="adminMain">
            <div class="big">${upper(it.placa)}</div>
            <div class="smallLine">${safeText(it.condutor)}</div>
            <div class="tagLine">${upper(it.filial)}</div>
          </div>
        </div>
        <div class="adminCardFoot">
          <span class="pill ${pillClassFromStatus(it.status)}">${upper(it.mes)} ${upper(it.status)}</span>
          <button class="linkBtn" type="button"
            data-upload="checklist"
            data-placa="${upper(it.placa)}"
            data-filial="${upper(it.filial)}"
          >Upload checklist mensal</button>
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
        total === 0 ? "Sem registros ainda" : `Total: ${total} | Termo pendente: ${pendentes}`;

      const listHtml = hist.slice(0, 10).map((it) => {
        const hasTermo = !!it.termoUrl;
        const termoTxt = hasTermo ? "Reenviar termo" : "Upload termo";
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
      alert(e?.message || "Falha ao salvar.");
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
      alert(e?.message || "Erro ao atualizar cheques.");
    }
  }

  // ======================================================
  // ✅ Delegation (upload termo/checklist)
  // ======================================================
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
        const type = el.getAttribute("data-upload"); // "termo" | "checklist"
        const placa = el.getAttribute("data-placa") || "";
        const seq = el.getAttribute("data-seq") || "";
        const chequeId = el.getAttribute("data-id") || "";
        let filial = upper(el.getAttribute("data-filial") || "");

        const ref = placa || seq || chequeId || "ITEM";

        // fallback: se for checklist e não veio filial, tenta achar na frota
        if (!filial && type === "checklist" && placa) {
          const found = DATA.frota.find((x) => upper(x.placa) === upper(placa));
          filial = upper(found?.filial || "");
        }

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,application/pdf";

        input.onchange = async () => {
          const file = input.files && input.files[0];
          if (!file) return;

          if (!filial) {
            alert("Não achei a FILIAL para salvar no Drive. (precisa vir data-filial no botão)");
            return;
          }

          try {
            setStatus("☁️ Enviando para o Drive...");

            const up = await uploadFileToDrive(file, {
              filial,
              type,
              ref,
            });

            // termo: grava no Sheets
            if (type === "termo") {
              if (!chequeId) {
                setStatus("⚠️ Upload OK (sem vínculo)");
                alert("Upload OK, mas não encontrei o ID do cheque para salvar o termoUrl.");
                return;
              }

              setStatus("🧾 Salvando link do termo...");
              await updateChequeOnSheets({
                id: chequeId,
                termoUrl: up.url,
                termoNome: up.name,
              });

              await reloadAll();
              setStatus("✅ Termo enviado e vinculado");
              return;
            }

            // checklist: só envia
            setStatus("✅ Checklist enviado");
            alert(`Checklist enviado ✅\n\nFilial: ${up.folderFilial}\nPasta: ${up.folderTipo}\nArquivo: ${up.name}`);
          } catch (err) {
            console.error(err);
            setStatus("❌ Falha no upload");
            alert(`Não foi possível enviar para o Drive.\n\nErro: ${err?.message || "Falha"}`);
          }
        };

        input.click();
        return;
      }
    });
  }

  // ======================================================
  // binds
  // ======================================================
  function bindTabs() {
    document.querySelectorAll(".tabBtn").forEach((b) => b.addEventListener("click", () => setActiveTab(b.dataset.tab)));
    document.querySelectorAll(".sumCard").forEach((c) => c.addEventListener("click", () => setActiveTab(c.dataset.tab)));
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

    modal.el.addEventListener("click", (ev) => { if (ev.target === modal.el) closeModal(); });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && modal.el.classList.contains("isOpen")) closeModal(); });
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
