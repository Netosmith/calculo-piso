/* fretes.js | NOVA FROTA (COMPLETO AJUSTADO) */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyOfN1PHdk_C4D5z1SFEEVEg7wWKnc7SberIARP4p6gt38fcrNeiNDjbq2vYrE9ryL0/exec";

  const DIRECTORY = {
    regionais: ["GOIAS", "MINAS"],
    filiaisPorRegional: {
      GOIAS: ["ITUMBIARA", "RIO VERDE", "MONTIVIDIU", "ANAPOLIS", "MINEIROS", "JATAI", "CHAP CEU", "VIANOPOLIS", "URUAÇU", "INDIARA", "BOM JESUS", "CRISTALINA", "FORMOSA", "CATALÃO"],
      MINAS: ["UBERLANDIA", "ARAGUARI"],
    },
    clientes: ["CARGILL", "VITERRA", "COFCO", "NOVA AGRI", "JBS SEARA", "BRF", "MOSAIC", "AMAGGI", "INGREDION", "LDC", "BRADO", "C VALE", "OLAM BRASIL", "SODRU", "BOM JESUS", "SOYBRASIL", "LAVORO", "AGRIBRASIL", "BOM FUTURO", "CHS", "CIBRAFERTIL", "CJ TRADE", "FERT TOCANTINS", "GAVILON", "GRUPO SCHEFFER", "INPASA", "AGRICOLA ALVORADA", "ABJ AGROPECUARIA", "ADM", "FIAGRIL", "FS", "ALPHAGRAIN", "FERTIMIG", "FERTIPAR", "GIRASSOL", "GRUPO ATTO", "ADUBRAS", "CARAMURU", "YUKAER AGRO", "DUAL", "AGRONELLI", "BELAGRO", "COOPERNORT", "SIPAL", "H A PIMENTA", "SAFRAS", "SINAGRO", "CAMPO REAL", "AGROSOYA", "COPAGRI", "VMC", "GENERAL MILLS", "CUTRALE", "AGREX", "YARA", "HEDGE", "ALZ", "MARUBENI", "MDNORTE", "FS TRADING", "SJC", "CJ SELECTA", "COOXUPE", "BTG PACTUAL", "FENIX", "FERTIGRAN", "RIFERTIL", "SEMENTES SAO FRANCISCO", "SEMPRE SEMENTES", "GOIASA", "SAO MARTINHO", "AGRO CLUB", "MILHAO ALIMENTOS", "TRATO", "BREJEIRO", "GEN", "ARAGUAIA", "NUTRIEN", "KOWALSKI LDC", "BIORGANICA", "RICARDO MARTINS", "SERGIO GALVAO", "AGROMEN", "PROSOLLO", "USINA DECAL", "COOPERVASS", "SOAMI", "RAFIRA", "CONCEITO AGRICOLA", "AGROBOM", "MOINHO VITORIA", "MMJV GRAOS", "BOA SAFRA", "NOVA GALIA", "CEREAL", "SOMAI ALIMENTOS", "SITARI", "ALENCAR", "AGROMERCANTIL", "OURO SAFRA", "FUTURO", "GRAN MILHO", "HERINGER", "CEREAL OURO", "EUROCHEM", "GRANOL", "AGROAMAZONIA", "AGROMAVE", "CERTANO", "SEEDCORP", "BAUMINAS", "JALLES MACHADO", "ALIMENTOS N1", "ROAN ALIMENTOS", "CERRADINHO", "FAZENDAO AGRO", "IACO", "JATAI CEREAIS", "USINA SERRANOPOLIS", "FAST FRETE", "RIO DOCE", "INTEGRA", "RENATO CARVALHO", "COMIVA", "COMERX", "SCALON E CERHI", "3 TENTOS", "BIOMA", "AGROLESTE", "EDSON CROCHIQUIA", "COPAIBA", "ATVOS", "JRCA"],
    contatosPorFilial: {
"MINEIROS": [{ nome: "KIEWERSON", fone: "5564999794586" }],
  "ARAGUARI": [{ nome: "ALFREDO", fone: "5534997911299" }],
  "ANAPOLIS": [{ nome: "SERGIO", fone: "5564992669136" }],
  "BOM JESUS DE GOIAS": [{ nome: "MATEUS", fone: "5564993070738" }],
  "MONTIVIDIU": [{ nome: "ROBSON", fone: "5564999628005" }],
  "RIO VERDE": [{ nome: "ARIEL", fone: "5564992277537" }],
  "INDIARA": [{ nome: "RAFAEL", fone: "5564999108790" }],
  "ITUMBIARA": [{ nome: "JHONATAN", fone: "5564992251214" }],
  "JATAI": [{ nome: "RONE", fone: "5564996264511" }],
  "CHAPADAO DO CEU": [{ nome: "RICARDO", fone: "5564999913512" }],
  "CRISTALINA": [{ nome: "EVERALDO", fone: "5561996924906" }],
  "RIO VERDE FERT": [{ nome: "NARCISO", fone: "5564999365343" }],
  "VIANOPOLIS": [{ nome: "FHELLIPE", fone: "5562999307778" }],
  "FORMOSA": [{ nome: "FABIOLA", fone: "5562996017658" }],
  "CATALAO": [{ nome: "EVERALDO JR", fone: "556492373735" }],
  "URUACU": [{ nome: "GUILHERME", fone: "5562996978707" }],
    },
  };

  const CONTACT_PHONE = (() => {
    const map = {};
    Object.values(DIRECTORY.contatosPorFilial || {}).forEach((arr) => {
      (arr || []).forEach((c) => {
        if (c?.nome && c?.fone) map[String(c.nome).toUpperCase().trim()] = String(c.fone).trim();
      });
    });
    return map;
  })();

  const $ = (sel) => document.querySelector(sel);

  const STATE = {
    rows: [],
    editingId: "",
    inlineSaving: new Set(),
  };

  const COLS = [
    { key: "regional", label: "Regional" },
    { key: "filial", label: "Filial" },
    { key: "cliente", label: "Cliente" },
    { key: "origem", label: "Origem" },
    { key: "coleta", label: "Coleta" },
    { key: "contato", label: "Contato", isContato: true },
    { key: "destino", label: "Destino" },
    { key: "uf", label: "UF" },
    { key: "descarga", label: "Descarga" },
    { key: "volume", label: "Volume" },
    { key: "valorEmpresa", label: "Vlr Empresa" },
    { key: "valorMotorista", label: "Vlr Motorista" },
    { key: "km", label: "KM" },
    { key: "pedagioEixo", label: "Pedágio/Eixo" },
    { key: "e5", label: "5E" },
    { key: "e6", label: "6E" },
    { key: "e7", label: "7E" },
    { key: "e4", label: "4E" },
    { key: "e9", label: "9E" },
    { key: "produto", label: "Produto" },
    { key: "icms", label: "ICMS" },
    { key: "pedidoSat", label: "Pedido SAT" },
    { key: "porta", label: "Porta", isInlineEditable: true },
    { key: "transito", label: "Trânsito", isInlineEditable: true },
    { key: "status", label: "Status" },
    { key: "obs", label: "Observações" },
    { key: "__acoes", label: "Ações", isAcoes: true },
  ];

  const MODAL = {
    wrap: () => document.getElementById("modal"),
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

  function safeText(v) {
    return String(v ?? "").trim();
  }

  function upper(v) {
    return safeText(v).toUpperCase();
  }

  function setStatus(text) {
    const el =
      document.querySelector("[data-sync-status]") ||
      document.querySelector("#syncStatus");
    if (el) el.textContent = text;
  }

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

  function extractPhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";

    let digits = s.replace(/\D/g, "");
    if (digits) {
      if (digits.startsWith("55")) return digits;
      if (digits.length === 10 || digits.length === 11) return "55" + digits;
    }

    const phone = CONTACT_PHONE[upper(s)] || "";
    if (!phone) return "";

    const p = phone.replace(/\D/g, "");
    return p.startsWith("55") ? p : "55" + p;
  }

  function whatsappLinkFromContato(contato) {
    const phone = extractPhoneBR(contato);
    return phone ? "https://wa.me/" + phone : "";
  }

  function jsonp(url, timeoutMs = 30000) {
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
    Object.entries(paramsObj || {}).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
    return url.toString();
  }

  async function apiGet(paramsObj) {
    const res = await jsonp(buildUrl(paramsObj), 35000);
    if (!res || res.ok === false) {
      throw new Error(res?.error || "Falha na API");
    }
    return res;
  }

  const PISO_PARAMS = {
    e9: { eixos: 9, rkm: 8.9995, custoCC: 877.83, weightInputId: "w9", defaultPeso: 47 },
    e4: { eixos: 4, rkm: 7.8555, custoCC: 792.3, weightInputId: "w4", defaultPeso: 39 },
    e7: { eixos: 7, rkm: 7.8555, custoCC: 792.3, weightInputId: "w7", defaultPeso: 36 },
    e6: { eixos: 6, rkm: 7.2108, custoCC: 656.76, weightInputId: "w6", defaultPeso: 31 },
    e5: { eixos: 5, rkm: 6.5381, custoCC: 642.1, weightInputId: "w5", defaultPeso: 26 },
  };

  function getPesoFromUI(id, fallback) {
    const el = document.getElementById(id);
    const v = parsePtNumber(el?.value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  function calcMinRPorTon(param, km, pedagioPorEixo) {
    const peso = getPesoFromUI(param.weightInputId, param.defaultPeso);
    const numerador = param.rkm * km + param.custoCC + pedagioPorEixo * param.eixos;
    const base = numerador / peso;
    return ceil0(base);
  }

  function sn(valueMotoristaTon, minTon) {
    if (!Number.isFinite(valueMotoristaTon) || !Number.isFinite(minTon)) return "";
    return valueMotoristaTon >= minTon ? "S" : "N";
  }

  function applyPisoSN(rows) {
    return (rows || []).map((r) => {
      const km = parsePtNumber(r.km) || 0;
      const ped = parsePtNumber(r.pedagioEixo) || 0;
      const vm = parsePtNumber(r.valorMotorista);

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

  function buildContatoCell(contatoText) {
    const td = document.createElement("td");

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "6px";

    const span = document.createElement("span");
    span.textContent = contatoText || "";
    wrap.appendChild(span);

    const wpp = whatsappLinkFromContato(contatoText);
    if (wpp) {
      const a = document.createElement("a");
      a.href = wpp;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "waIcon";
      a.title = "Chamar no WhatsApp";

      const img = document.createElement("img");
      img.src = "../assets/img/whatsapp.png";
      img.alt = "WhatsApp";
      img.onerror = () => { a.textContent = "📞"; };

      a.appendChild(img);
      wrap.appendChild(a);
    }

    td.appendChild(wrap);
    return td;
  }

  function buildPillSNCell(val) {
    const td = document.createElement("td");
    td.className = "num";

    const v = upper(val);
    const span = document.createElement("span");
    span.className = "pillSN " + (v === "S" ? "s" : v === "N" ? "n" : "empty");
    span.textContent = v || "-";

    td.appendChild(span);
    return td;
  }

  function buildInlineEditableCell(row, key) {
    const td = document.createElement("td");
    td.className = "num";

    const wrap = document.createElement("div");
    wrap.className = "inlineCellWrap";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "inlineCellInput";
    input.value = safeText(row[key] || "");
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "off");

    const saveId = `${safeText(row.id)}::${key}`;

    let originalValue = safeText(row[key] || "");
    let isSaving = false;

    async function commit() {
      const newValue = safeText(input.value);

      if (isSaving) return;
      if (newValue === originalValue) return;
      if (!safeText(row.id)) return;

      isSaving = true;
      STATE.inlineSaving.add(saveId);
      wrap.classList.add("isSaving");
      input.disabled = true;

      try {
        setStatus(`💾 Salvando ${key === "porta" ? "porta" : "trânsito"}...`);

        await apiGet({
          action: "fretes_update",
          id: safeText(row.id),
          [key]: newValue
        });

        const idx = STATE.rows.findIndex((r) => safeText(r.id) === safeText(row.id));
        if (idx >= 0) {
          STATE.rows[idx][key] = newValue;
        }

        originalValue = newValue;
        setStatus("✅ Atualizado");
      } catch (e) {
        console.error(`[fretes] erro ao salvar ${key}:`, e);
        input.value = originalValue;
        setStatus("❌ Erro ao atualizar");
        alert(e.message || `Falha ao salvar ${key}.`);
      } finally {
        isSaving = false;
        STATE.inlineSaving.delete(saveId);
        wrap.classList.remove("isSaving");
        input.disabled = false;
      }
    }

    input.addEventListener("blur", commit);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }

      if (e.key === "Escape") {
        input.value = originalValue;
        input.blur();
      }
    });

    wrap.appendChild(input);
    td.appendChild(wrap);
    return td;
  }

  function buildAcoesCell(row) {
    const td = document.createElement("td");
    td.className = "num";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btnTiny ghost";
    btnEdit.textContent = "Editar";
    btnEdit.style.marginRight = "6px";
    btnEdit.addEventListener("click", () => openEditModal(row));

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btnTiny";
    btnDel.textContent = "Excluir";
    btnDel.addEventListener("click", async () => {
      if (!row.id) return;
      if (!confirm("Excluir este frete?")) return;

      try {
        setStatus("🗑 Excluindo...");
        await apiGet({ action: "fretes_delete", id: row.id });
        await atualizar();
        setStatus("✅ Excluído");
      } catch (e) {
        console.error("[fretes] erro ao excluir:", e);
        setStatus("❌ Falha ao excluir");
        alert(e.message || "Falha ao excluir.");
      }
    });

    td.appendChild(btnEdit);
    td.appendChild(btnDel);
    return td;
  }

  function render(rowsRaw) {
    const tbody = $("#tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (!rowsRaw || !rowsRaw.length) return;

    const rows = applyPisoSN(rowsRaw).slice().sort((a, b) => {
      const fa = safeText(a.filial).localeCompare(safeText(b.filial));
      if (fa !== 0) return fa;
      const ca = safeText(a.cliente).localeCompare(safeText(b.cliente));
      if (ca !== 0) return ca;
      return safeText(a.destino).localeCompare(safeText(b.destino));
    });

    let filialAtual = "";

    rows.forEach((row) => {
      if (safeText(row.filial) !== filialAtual) {
        filialAtual = safeText(row.filial);

        const trGroup = document.createElement("tr");
        trGroup.className = "groupRow";
        const td = document.createElement("td");
        td.colSpan = COLS.length;
        td.textContent = filialAtual || "SEM FILIAL";
        trGroup.appendChild(td);
        tbody.appendChild(trGroup);
      }

      const tr = document.createElement("tr");

      COLS.forEach((col) => {
        if (col.isContato) {
          tr.appendChild(buildContatoCell(row.contato || ""));
          return;
        }

        if (col.isAcoes) {
          tr.appendChild(buildAcoesCell(row));
          return;
        }

        if (["e5","e6","e7","e4","e9"].includes(col.key)) {
          tr.appendChild(buildPillSNCell(row[col.key]));
          return;
        }

        if (col.isInlineEditable) {
          tr.appendChild(buildInlineEditableCell(row, col.key));
          return;
        }

        const td = document.createElement("td");
        if (["volume","valorEmpresa","valorMotorista","km","pedagioEixo","pedidoSat","porta","transito"].includes(col.key)) {
          td.className = "num";
        }
        td.textContent = safeText(row[col.key]);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  function getFilteredRows() {
    const regional = upper($("#fRegional")?.value || "");
    const filial = upper($("#fFilial")?.value || "");
    const contato = upper($("#fContato")?.value || "");
    const busca = upper($("#fBusca")?.value || "");

    return STATE.rows.filter((row) => {
      if (regional && upper(row.regional) !== regional) return false;
      if (filial && upper(row.filial) !== filial) return false;
      if (contato && upper(row.contato) !== contato) return false;

      if (busca) {
        const blob = upper(JSON.stringify(row));
        if (!blob.includes(busca)) return false;
      }

      return true;
    });
  }

  function applyFilters() {
    render(getFilteredRows());
  }

  function setSelectOptions(selectEl, options, placeholderText) {
    if (!selectEl) return;
    const current = selectEl.value;

    selectEl.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholderText;
    selectEl.appendChild(ph);

    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      selectEl.appendChild(o);
    });

    if ([...selectEl.options].some((o) => o.value === current)) {
      selectEl.value = current;
    }
  }

  function fillTopFilters(rows) {
    const regionais = [...new Set(rows.map((r) => upper(r.regional)).filter(Boolean))].sort();
    const filiais = [...new Set(rows.map((r) => upper(r.filial)).filter(Boolean))].sort();
    const contatos = [...new Set(rows.map((r) => upper(r.contato)).filter(Boolean))].sort();

    setSelectOptions($("#fRegional"), regionais, "Todas as regionais");
    setSelectOptions($("#fFilial"), filiais, "Todas as filiais");
    setSelectOptions($("#fContato"), contatos, "Todos os contatos");
  }

  function modalShow(show) {
    const el = MODAL.wrap();
    if (!el) return;
    el.style.display = show ? "flex" : "none";
    el.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function clearModalFields() {
    STATE.editingId = "";
    if (MODAL.title()) MODAL.title().textContent = "Novo Frete";

    [
      MODAL.origem(), MODAL.coleta(), MODAL.destino(), MODAL.uf(), MODAL.descarga(),
      MODAL.produto(), MODAL.km(), MODAL.ped(), MODAL.volume(), MODAL.icms(),
      MODAL.empresa(), MODAL.motorista(), MODAL.sat(), MODAL.porta(),
      MODAL.transito(), MODAL.obs()
    ].forEach((el) => { if (el) el.value = ""; });

    if (MODAL.status()) MODAL.status().value = "LIBERADO";
    if (MODAL.regional()) MODAL.regional().value = "";
    if (MODAL.filial()) MODAL.filial().value = "";
    if (MODAL.cliente()) MODAL.cliente().value = "";
    if (MODAL.contato()) MODAL.contato().value = "";
  }

  function fillModalSelectors() {
    setSelectOptions(MODAL.regional(), DIRECTORY.regionais.map(upper), "SELECIONE A REGIONAL");
    setSelectOptions(MODAL.cliente(), DIRECTORY.clientes.map(upper), "SELECIONE O CLIENTE");
    setSelectOptions(MODAL.filial(), [], "SELECIONE A FILIAL");
    setSelectOptions(MODAL.contato(), [], "SELECIONE O CONTATO");

    MODAL.regional()?.addEventListener("change", () => {
      const reg = upper(MODAL.regional()?.value);
      const filiais = (DIRECTORY.filiaisPorRegional?.[reg] || []).map(upper);
      setSelectOptions(MODAL.filial(), filiais, "SELECIONE A FILIAL");
      setSelectOptions(MODAL.contato(), [], "SELECIONE O CONTATO");
    });

    MODAL.filial()?.addEventListener("change", () => {
      const filial = upper(MODAL.filial()?.value);
      const contatos = (DIRECTORY.contatosPorFilial?.[filial] || []).map((c) => upper(c.nome));
      setSelectOptions(MODAL.contato(), contatos, "SELECIONE O CONTATO");
      if (contatos.length === 1 && MODAL.contato()) MODAL.contato().value = contatos[0];
    });
  }

  function fillModalFromRow(row) {
    STATE.editingId = safeText(row.id);
    if (MODAL.title()) MODAL.title().textContent = "Editar Frete";

    if (MODAL.regional()) MODAL.regional().value = upper(row.regional);
    MODAL.regional()?.dispatchEvent(new Event("change"));

    if (MODAL.filial()) MODAL.filial().value = upper(row.filial);
    MODAL.filial()?.dispatchEvent(new Event("change"));

    if (MODAL.cliente()) MODAL.cliente().value = upper(row.cliente);
    if (MODAL.contato()) MODAL.contato().value = upper(row.contato);

    if (MODAL.origem()) MODAL.origem().value = safeText(row.origem);
    if (MODAL.coleta()) MODAL.coleta().value = safeText(row.coleta);
    if (MODAL.destino()) MODAL.destino().value = safeText(row.destino);
    if (MODAL.uf()) MODAL.uf().value = safeText(row.uf);
    if (MODAL.descarga()) MODAL.descarga().value = safeText(row.descarga);
    if (MODAL.produto()) MODAL.produto().value = safeText(row.produto);
    if (MODAL.km()) MODAL.km().value = safeText(row.km);
    if (MODAL.ped()) MODAL.ped().value = safeText(row.pedagioEixo);
    if (MODAL.volume()) MODAL.volume().value = safeText(row.volume);
    if (MODAL.icms()) MODAL.icms().value = safeText(row.icms);
    if (MODAL.empresa()) MODAL.empresa().value = safeText(row.valorEmpresa);
    if (MODAL.motorista()) MODAL.motorista().value = safeText(row.valorMotorista);
    if (MODAL.sat()) MODAL.sat().value = safeText(row.pedidoSat);
    if (MODAL.porta()) MODAL.porta().value = safeText(row.porta);
    if (MODAL.transito()) MODAL.transito().value = safeText(row.transito);
    if (MODAL.status()) MODAL.status().value = upper(row.status) || "LIBERADO";
    if (MODAL.obs()) MODAL.obs().value = safeText(row.obs);
  }

  function collectModalPayload() {
    return {
      regional: upper(MODAL.regional()?.value),
      filial: upper(MODAL.filial()?.value),
      cliente: upper(MODAL.cliente()?.value),
      contato: upper(MODAL.contato()?.value),
      origem: upper(MODAL.origem()?.value),
      coleta: upper(MODAL.coleta()?.value),
      destino: upper(MODAL.destino()?.value),
      uf: upper(MODAL.uf()?.value),
      descarga: upper(MODAL.descarga()?.value),
      volume: safeText(MODAL.volume()?.value),
      valorEmpresa: safeText(MODAL.empresa()?.value),
      valorMotorista: safeText(MODAL.motorista()?.value),
      km: safeText(MODAL.km()?.value),
      pedagioEixo: safeText(MODAL.ped()?.value),
      produto: upper(MODAL.produto()?.value),
      icms: safeText(MODAL.icms()?.value),
      pedidoSat: upper(MODAL.sat()?.value),
      porta: safeText(MODAL.porta()?.value),
      transito: safeText(MODAL.transito()?.value),
      status: upper(MODAL.status()?.value),
      obs: upper(MODAL.obs()?.value),
    };
  }

  function validateModalPayload(p) {
    const missing = [];
    if (!p.regional) missing.push("REGIONAL");
    if (!p.filial) missing.push("FILIAL");
    if (!p.cliente) missing.push("CLIENTE");
    if (!p.contato) missing.push("CONTATO");
    if (!p.origem) missing.push("ORIGEM");
    if (!p.destino) missing.push("DESTINO");
    if (!p.uf) missing.push("UF");
    if (!p.km) missing.push("KM");
    if (!p.valorMotorista) missing.push("VLR MOTORISTA");

    if (missing.length) {
      alert("Preencha: " + missing.join(", "));
      return false;
    }
    return true;
  }

  function ensureLoading() {
    if (document.getElementById("freteLoading")) return;

    const el = document.createElement("div");
    el.id = "freteLoading";
    el.innerHTML = `
      <div class="freteLoadingBox">
        <div class="freteSpinner"></div>
        <div class="freteLoadingText">SALVANDO FRETE...</div>
      </div>
    `;
    document.body.appendChild(el);

    const style = document.createElement("style");
    style.textContent = `
      #freteLoading{
        position:fixed;
        inset:0;
        display:none;
        align-items:center;
        justify-content:center;
        background:rgba(3,8,20,.45);
        backdrop-filter:blur(8px);
        z-index:10050;
      }
      #freteLoading.isOpen{display:flex}
      .freteLoadingBox{
        width:min(280px,90vw);
        padding:28px 20px;
        border-radius:22px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(17,26,51,.95);
        box-shadow:0 24px 60px rgba(0,0,0,.45);
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:16px;
      }
      .freteSpinner{
        width:58px;
        height:58px;
        border-radius:999px;
        border:5px solid rgba(255,255,255,.10);
        border-top-color:rgba(79,209,255,.95);
        border-right-color:rgba(79,209,255,.65);
        animation:freteSpin .8s linear infinite;
      }
      .freteLoadingText{
        color:#e9eefc;
        font-size:15px;
        font-weight:800;
        text-align:center;
      }
      @keyframes freteSpin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
  }

  function showLoading() {
    ensureLoading();
    document.getElementById("freteLoading")?.classList.add("isOpen");
  }

  function hideLoading() {
    document.getElementById("freteLoading")?.classList.remove("isOpen");
  }

  async function saveFrete(payload) {
    if (STATE.editingId) {
      return await apiGet({ action: "fretes_update", id: STATE.editingId, ...payload });
    }
    return await apiGet({ action: "fretes_add", ...payload });
  }

  async function handleSave() {
    const payload = collectModalPayload();
    if (!validateModalPayload(payload)) return;

    const btn = MODAL.btnSave();

    try {
      if (btn) btn.disabled = true;
      showLoading();
      setStatus("💾 Salvando...");

      await saveFrete(payload);

      closeModal();
      await atualizar();
      setStatus("✅ Salvo");
    } catch (e) {
      console.error("[fretes] erro salvar:", e);
      setStatus("❌ Erro ao salvar");
      alert(e.message || "Falha ao salvar.");
    } finally {
      hideLoading();
      if (btn) btn.disabled = false;
    }
  }

  function openNewModal() {
    clearModalFields();
    modalShow(true);
  }

  function openEditModal(row) {
    clearModalFields();
    fillModalFromRow(row);
    modalShow(true);
  }

  function closeModal() {
    modalShow(false);
  }

  async function atualizar() {
    try {
      setStatus("🔄 Carregando...");
      const res = await apiGet({ action: "fretes_list" });
      STATE.rows = Array.isArray(res.data) ? res.data : [];
      fillTopFilters(STATE.rows);
      applyFilters();
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[fretes] erro ao atualizar:", e);
      setStatus("❌ Erro ao sincronizar");
    }
  }

  function bindFilters() {
    $("#fRegional")?.addEventListener("change", applyFilters);
    $("#fFilial")?.addEventListener("change", applyFilters);
    $("#fContato")?.addEventListener("change", applyFilters);
    $("#fBusca")?.addEventListener("input", applyFilters);
  }

  function bindButtons() {
    $("#btnReloadFromSheets")?.addEventListener("click", atualizar);
    $("#btnNew")?.addEventListener("click", openNewModal);
    $("#btnCloseModal")?.addEventListener("click", closeModal);
    $("#btnCancel")?.addEventListener("click", closeModal);
    $("#btnSave")?.addEventListener("click", handleSave);

    MODAL.wrap()?.addEventListener("click", (e) => {
      if (e.target === MODAL.wrap()) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    ["#w9", "#w4", "#w7", "#w6", "#w5"].forEach((sel) => {
      document.querySelector(sel)?.addEventListener("input", applyFilters);
    });

    $("#btnResetWeights")?.addEventListener("click", () => {
      if ($("#w9")) $("#w9").value = "47";
      if ($("#w4")) $("#w4").value = "39";
      if ($("#w7")) $("#w7").value = "36";
      if ($("#w6")) $("#w6").value = "31";
      if ($("#w5")) $("#w5").value = "26";
      applyFilters();
    });

    $("#btnSaveWeights")?.addEventListener("click", () => {
      applyFilters();
      alert("Pesos recalculados ✅");
    });
  }

  function initUppercaseFields() {
    [
      MODAL.origem(), MODAL.coleta(), MODAL.destino(), MODAL.uf(),
      MODAL.descarga(), MODAL.produto(), MODAL.sat(), MODAL.obs()
    ].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", () => {
        el.value = upper(el.value);
      });
    });
  }

  function init() {
    ensureLoading();
    fillModalSelectors();
    initUppercaseFields();
    bindButtons();
    bindFilters();
    atualizar();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
