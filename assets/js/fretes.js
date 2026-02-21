/* fretes.js | NOVA FROTA (AJUSTADO + PISO S/N + MODAL + SELECTS + MAIÚSCULAS) */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzQv34T2Oi_hs5Re91N81XM1lH_5mZSkNJw8_8I6Ij4HZNFb97mcL8fNmob1Bg8ZGI6/exec";

  // ======================================================
  // ✅ CADASTRO LOCAL (dentro do GitHub)
  // - Aqui você mantém Regional/Filiais/Clientes/Contatos e Telefones
  // - Contato salva só o NOME (ex: "ARIEL")
  // - Telefone fica aqui e o WhatsApp usa isso automaticamente
  // ======================================================
  const DIRECTORY = {
    regionais: ["GOIAS", "MINAS"],
    filiaisPorRegional: {
      GOIAS: ["ITUMBIARA", "RIO VERDE", "MONTIVIDIU", "ANAPOLIS"],
      MINAS: ["UBERLANDIA", "ARAGUARI"],
    },
    clientes: ["LDC", "COFCO", "OURO SAFRA", "CARGILL"],
    // Responsável por FILIAL + telefone separado
    contatosPorFilial: {
      ITUMBIARA: [
        { nome: "ARIEL", fone: "5564992277537" },
        { nome: "SERGIO", fone: "5564999999999" },
      ],
      "RIO VERDE": [{ nome: "JHONATAN", fone: "5564998887777" }],
      MONTIVIDIU: [{ nome: "SERGIO", fone: "5564988887777" }],
      ANAPOLIS: [{ nome: "ARIEL", fone: "5564987776666" }],
      UBERLANDIA: [{ nome: "SERGIO", fone: "5534991112222" }],
      ARAGUARI: [{ nome: "JHONATAN", fone: "5534993334444" }],
    },
  };

  // Mapa rápido: NOME -> TELEFONE (pra WhatsApp)
  const CONTACT_PHONE = (() => {
    const map = {};
    Object.values(DIRECTORY.contatosPorFilial || {}).forEach((arr) => {
      (arr || []).forEach((c) => {
        if (c?.nome && c?.fone) map[String(c.nome).toUpperCase().trim()] = String(c.fone).trim();
      });
    });
    return map;
  })();

  // ----------------------------
  // DOM helpers
  // ----------------------------
  const $ = (sel) => document.querySelector(sel);

  function getTbody() {
    return document.querySelector("#tbody") || document.querySelector("tbody");
  }

  function setStatus(text) {
    const el =
      document.querySelector("[data-sync-status]") ||
      document.querySelector("#syncStatus") ||
      document.querySelector("#status") ||
      document.querySelector(".syncStatus");
    if (el) el.textContent = text;
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  // ----------------------------
  // Parse número pt-BR (ex: "1.234,56" -> 1234.56)
  // ----------------------------
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

  // ----------------------------
  // WhatsApp helper
  // - se tiver número no texto, usa ele
  // - se for só nome (ex: "ARIEL"), busca no CONTACT_PHONE
  // ----------------------------
  function extractPhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";

    // 1) tenta extrair dígitos do texto
    let digits = s.replace(/\D/g, "");
    if (digits) {
      if (digits.startsWith("55")) return digits;
      if (digits.length === 10 || digits.length === 11) return "55" + digits;
    }

    // 2) fallback: se for nome, busca no mapa local
    const nameKey = s.toUpperCase().trim();
    const phone = CONTACT_PHONE[nameKey] || "";
    if (!phone) return "";

    const p = phone.replace(/\D/g, "");
    if (!p) return "";
    return p.startsWith("55") ? p : "55" + p;
  }

  function whatsappLinkFromContato(contato) {
    const phone = extractPhoneBR(contato);
    return phone ? "https://wa.me/" + phone : "";
  }

  // ----------------------------
  // API (JSON + JSONP)
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
      err.url = url.toString();
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
        try {
          data = inner ? JSON.parse(inner) : null;
        } catch {
          const err = new Error("Falha ao interpretar JSONP da API.");
          err.url = url.toString();
          err.preview = t.slice(0, 260);
          throw err;
        }
      } else {
        const err = new Error("Falha ao interpretar JSON da API.");
        err.url = url.toString();
        err.preview = t.slice(0, 260);
        throw err;
      }
    }

    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.httpStatus = res.status;
      err.data = data;
      err.url = url.toString();
      throw err;
    }

    return data;
  }

  async function fetchRows() {
    const tries = [{ action: "list" }, { action: "rows" }, {}];
    let lastErr = null;

    for (const p of tries) {
      try {
        const data = await apiGet(p);
        const rows =
          data?.data ||
          data?.rows ||
          data?.fretes ||
          data?.result ||
          (Array.isArray(data) ? data : null);

        if (Array.isArray(rows)) return rows;
        lastErr = new Error("Resposta sem array de linhas (params: " + JSON.stringify(p) + ")");
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Falha ao buscar dados.");
  }

  // ----------------------------
  // COLUNAS (na ordem do HTML)
  // ----------------------------
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
    { key: "porta", label: "Porta" },
    { key: "transito", label: "Trânsito" },
    { key: "status", label: "Status" },
    { key: "obs", label: "Observações" },
    { key: "__acoes", label: "Ações", isAcoes: true },
  ];

  function valueFromRow(row, key, index) {
    if (Array.isArray(row)) return safeText(row[index] ?? "");

    if (row && typeof row === "object") {
      const map = {
        regional: ["regional"],
        filial: ["filial"],
        cliente: ["cliente"],
        origem: ["origem"],
        coleta: ["coleta"],
        contato: ["contato", "contatos", "telefone", "fone"],
        destino: ["destino"],
        uf: ["uf", "estado"],
        descarga: ["descarga"],
        volume: ["volume"],
        valorEmpresa: ["valorEmpresa", "vlrEmpresa", "empresa"],
        valorMotorista: ["valorMotorista", "vlrMotorista", "motorista"],
        km: ["km"],
        pedagioEixo: ["pedagioEixo", "pedagio", "pedagio_por_eixo"],
        e5: ["e5", "5e"],
        e6: ["e6", "6e"],
        e7: ["e7", "7e"],
        e4: ["e4", "4e"],
        e9: ["e9", "9e"],
        produto: ["produto"],
        icms: ["icms"],
        pedidoSat: ["pedidoSat", "pedidoSAT", "pedido", "sat"],
        porta: ["porta"],
        transito: ["transito", "trânsito", "transitoDias"],
        status: ["status"],
        obs: ["obs", "observacao", "observações", "observacoes"],
      };

      const candidates = map[key] || [key];
      for (const c of candidates) {
        if (c in row) return safeText(row[c]);
      }
    }
    return "";
  }

  function buildContatoCell(contatoText) {
    const td = document.createElement("td");

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "6px";
    wrap.style.minWidth = "0";

    const span = document.createElement("span");
    span.textContent = contatoText || "";
    span.style.whiteSpace = "nowrap";
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";
    span.style.minWidth = "0";
    wrap.appendChild(span);

    const wpp = whatsappLinkFromContato(contatoText);
    if (wpp) {
      const a = document.createElement("a");
      a.href = wpp;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Chamar no WhatsApp";
      a.className = "waIcon";

      const img = document.createElement("img");
      img.src = "../assets/img/whatsapp.png";
      img.alt = "WhatsApp";
      img.onerror = () => {
        a.textContent = "📞";
        a.style.background = "#EEF2F7";
      };

      a.appendChild(img);
      wrap.appendChild(a);
    }

    td.appendChild(wrap);
    return td;
  }

  function buildAcoesCell(row) {
    const td = document.createElement("td");
    td.className = "num";

    const id = row?.id ? String(row.id) : "";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btnTiny ghost";
    btnEdit.textContent = "Editar";
    btnEdit.style.marginRight = "6px";
    btnEdit.addEventListener("click", () => {
      console.log("[fretes] editar", id, row);
      // se quiser, dá pra implementar edição depois (reaproveita o mesmo modal)
    });

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btnTiny";
    btnDel.textContent = "Excluir";
    btnDel.addEventListener("click", async () => {
      if (!id) return alert("Sem ID para excluir.");
      if (!confirm("Excluir este frete?")) return;

      try {
        setStatus("🗑 Excluindo...");
        const data = await apiGet({ action: "delete", id });
        if (data?.ok) {
          setStatus("✅ Excluído");
          await atualizar();
        } else {
          setStatus("❌ Falha ao excluir");
          alert(data?.error || "Falha ao excluir.");
        }
      } catch (e) {
        console.error("[fretes] erro delete:", e);
        setStatus("❌ Erro ao excluir");
      }
    });

    td.appendChild(btnEdit);
    td.appendChild(btnDel);
    return td;
  }

  function buildPillSNCell(val) {
    const td = document.createElement("td");
    td.className = "num";

    const v = safeText(val).toUpperCase();
    const span = document.createElement("span");
    span.className = "pillSN " + (v === "S" ? "s" : v === "N" ? "n" : "empty");
    span.textContent = v || "-";

    td.appendChild(span);
    return td;
  }

  // ======================================================
  // ✅ PISO MÍNIMO (S/N) baseado na sua página do piso
  // ======================================================
  const PISO_PARAMS = {
    e9: { eixos: 9, rkm: 8.53, custoCC: 877.83, weightInputId: "w9", defaultPeso: 47 },
    e4: { eixos: 4, rkm: 7.4505, custoCC: 792.3, weightInputId: "w4", defaultPeso: 39 },
    e7: { eixos: 7, rkm: 7.4505, custoCC: 792.3, weightInputId: "w7", defaultPeso: 36 },
    e6: { eixos: 6, rkm: 6.8058, custoCC: 656.76, weightInputId: "w6", defaultPeso: 31 },
    e5: { eixos: 5, rkm: 6.1859, custoCC: 642.1, weightInputId: "w5", defaultPeso: 26 },
  };

  function getPesoFromUI(id, fallback) {
    const el = document.getElementById(id);
    const v = parsePtNumber(el?.value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  function calcMinRPorTon(param, km, pedagioPorEixo) {
    const peso = getPesoFromUI(param.weightInputId, param.defaultPeso);
    const numerador = param.rkm * km + param.custoCC + pedagioPorEixo * param.eixos;
    const base = numerador / peso; // R$/ton
    return ceil0(base);
  }

  function sn(valueMotoristaTon, minTon) {
    if (!Number.isFinite(valueMotoristaTon) || !Number.isFinite(minTon)) return "";
    return valueMotoristaTon >= minTon ? "S" : "N";
  }

  function applyPisoSN(rows) {
    return (rows || []).map((r) => {
      const km = parsePtNumber(valueFromRow(r, "km")) || 0;
      const ped = parsePtNumber(valueFromRow(r, "pedagioEixo")) || 0;
      const vm = parsePtNumber(valueFromRow(r, "valorMotorista")); // R$/ton

      const min5 = calcMinRPorTon(PISO_PARAMS.e5, km, ped);
      const min6 = calcMinRPorTon(PISO_PARAMS.e6, km, ped);
      const min7 = calcMinRPorTon(PISO_PARAMS.e7, km, ped);
      const min4 = calcMinRPorTon(PISO_PARAMS.e4, km, ped);
      const min9 = calcMinRPorTon(PISO_PARAMS.e9, km, ped);

      return { ...r, e5: sn(vm, min5), e6: sn(vm, min6), e7: sn(vm, min7), e4: sn(vm, min4), e9: sn(vm, min9) };
    });
  }

  // ----------------------------
  // RENDER (agrupa por filial, ordena por cliente)
  // ----------------------------
  function render(rowsRaw) {
    const tbody = getTbody();
    if (!tbody) return;

    tbody.innerHTML = "";
    if (!rowsRaw || !rowsRaw.length) return;

    const rows = applyPisoSN(rowsRaw);

    rows.sort((a, b) => {
      const fa = safeText(a?.filial).localeCompare(safeText(b?.filial));
      if (fa !== 0) return fa;
      const ca = safeText(a?.cliente).localeCompare(safeText(b?.cliente));
      if (ca !== 0) return ca;
      const oa = safeText(a?.origem).localeCompare(safeText(b?.origem));
      if (oa !== 0) return oa;
      return safeText(a?.destino).localeCompare(safeText(b?.destino));
    });

    let filialAtual = "";

    rows.forEach((row) => {
      const filialRow = safeText(row?.filial);
      if (filialRow !== filialAtual) {
        filialAtual = filialRow;

        const trGroup = document.createElement("tr");
        trGroup.className = "groupRow";
        const td = document.createElement("td");
        td.colSpan = COLS.length;
        td.textContent = filialAtual || "SEM FILIAL";
        trGroup.appendChild(td);
        tbody.appendChild(trGroup);
      }

      const tr = document.createElement("tr");

      COLS.forEach((col, idx) => {
        if (col.isContato) {
          const contatoText = valueFromRow(row, "contato", idx);
          tr.appendChild(buildContatoCell(contatoText));
          return;
        }

        if (col.isAcoes) {
          tr.appendChild(buildAcoesCell(row));
          return;
        }

        // ✅ pílulas S/N
        if (["e5", "e6", "e7", "e4", "e9"].includes(col.key)) {
          tr.appendChild(buildPillSNCell(valueFromRow(row, col.key, idx)));
          return;
        }

        const td = document.createElement("td");
        td.textContent = valueFromRow(row, col.key, idx);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ----------------------------
  // MODAL: utilitários
  // ----------------------------
  const MODAL = {
    wrap: () => document.getElementById("modal"),
    title: () => document.getElementById("modalTitle"),
    btnClose: () => document.getElementById("btnCloseModal"),
    btnCancel: () => document.getElementById("btnCancel"),
    btnSave: () => document.getElementById("btnSave"),

    // campos (IDs do seu fretes.html)
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

  function modalShow(show) {
    const el = MODAL.wrap();
    if (!el) return;
    el.style.display = show ? "flex" : "none";
    el.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function setSelectOptions(selectEl, options, placeholderText) {
    if (!selectEl) return;
    const isSelect = selectEl.tagName === "SELECT";
    if (!isSelect) return;

    selectEl.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholderText || "SELECIONE...";
    selectEl.appendChild(ph);

    (options || []).forEach((opt) => {
      const o = document.createElement("option");
      o.value = String(opt).toUpperCase().trim();
      o.textContent = String(opt).toUpperCase().trim();
      selectEl.appendChild(o);
    });
  }

  function forceUppercaseInput(el) {
    if (!el) return;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      // não mexe em números
      const type = (el.getAttribute("type") || "").toLowerCase();
      const isNumeric = type === "number" || el.inputMode === "decimal" || el.inputMode === "numeric";
      if (isNumeric) return;

      el.addEventListener("input", () => {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        el.value = String(el.value || "").toUpperCase();
        try {
          el.setSelectionRange(start, end);
        } catch {}
      });
    }
  }

  function initModalUppercase() {
    [
      MODAL.origem(),
      MODAL.coleta(),
      MODAL.destino(),
      MODAL.uf(),
      MODAL.descarga(),
      MODAL.produto(),
      MODAL.sat(),
      MODAL.porta(),
      MODAL.obs(),
    ].forEach(forceUppercaseInput);
  }

  // ----------------------------
  // MODAL: popula selects (Regional/Filial/Cliente/Contato)
  // ----------------------------
  function fillModalSelectors() {
    const rSel = MODAL.regional();
    const fSel = MODAL.filial();
    const cSel = MODAL.cliente();
    const ctSel = MODAL.contato();

    setSelectOptions(rSel, DIRECTORY.regionais || [], "SELECIONE A REGIONAL");
    setSelectOptions(cSel, DIRECTORY.clientes || [], "SELECIONE O CLIENTE");

    // inicial vazio
    setSelectOptions(fSel, [], "SELECIONE A FILIAL");
    setSelectOptions(ctSel, [], "SELECIONE O CONTATO");

    if (rSel) {
      rSel.addEventListener("change", () => {
        const reg = safeText(rSel.value).toUpperCase();
        const filiais = (DIRECTORY.filiaisPorRegional?.[reg] || []).map((x) => String(x).toUpperCase());
        setSelectOptions(fSel, filiais, "SELECIONE A FILIAL");

        // limpa contato ao trocar regional
        setSelectOptions(ctSel, [], "SELECIONE O CONTATO");
        if (fSel) fSel.value = "";
      });
    }

    if (fSel) {
      fSel.addEventListener("change", () => {
        const filial = safeText(fSel.value).toUpperCase();
        const contatos = (DIRECTORY.contatosPorFilial?.[filial] || []).map((c) => String(c.nome).toUpperCase());
        setSelectOptions(ctSel, contatos, "SELECIONE O CONTATO");

        // se só tiver 1 contato, auto-seleciona
        if (ctSel && contatos.length === 1) ctSel.value = contatos[0];
      });
    }
  }

  function clearModalFields() {
    const fields = [
      MODAL.origem(),
      MODAL.coleta(),
      MODAL.destino(),
      MODAL.uf(),
      MODAL.descarga(),
      MODAL.produto(),
      MODAL.km(),
      MODAL.ped(),
      MODAL.volume(),
      MODAL.icms(),
      MODAL.empresa(),
      MODAL.motorista(),
      MODAL.sat(),
      MODAL.porta(),
      MODAL.transito(),
      MODAL.obs(),
    ];
    fields.forEach((el) => {
      if (!el) return;
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") el.value = "";
    });

    const status = MODAL.status();
    if (status) status.value = "LIBERADO";

    // selects
    if (MODAL.regional()) MODAL.regional().value = "";
    if (MODAL.filial()) MODAL.filial().value = "";
    if (MODAL.cliente()) MODAL.cliente().value = "";
    if (MODAL.contato()) MODAL.contato().value = "";
  }

  // ----------------------------
  // SAVE: envia para Apps Script
  // - tenta várias actions para bater com seu backend sem você me mandar ele
  // ----------------------------
  function collectModalPayload() {
    const regional = safeText(MODAL.regional()?.value).toUpperCase();
    const filial = safeText(MODAL.filial()?.value).toUpperCase();
    const cliente = safeText(MODAL.cliente()?.value).toUpperCase();
    const contato = safeText(MODAL.contato()?.value).toUpperCase(); // só nome

    const payload = {
      regional,
      filial,
      cliente,
      contato,

      origem: safeText(MODAL.origem()?.value).toUpperCase(),
      coleta: safeText(MODAL.coleta()?.value).toUpperCase(),
      destino: safeText(MODAL.destino()?.value).toUpperCase(),
      uf: safeText(MODAL.uf()?.value).toUpperCase(),
      descarga: safeText(MODAL.descarga()?.value).toUpperCase(),
      produto: safeText(MODAL.produto()?.value).toUpperCase(),
      pedidoSat: safeText(MODAL.sat()?.value).toUpperCase(),
      porta: safeText(MODAL.porta()?.value).toUpperCase(),
      status: safeText(MODAL.status()?.value).toUpperCase(),
      obs: safeText(MODAL.obs()?.value).toUpperCase(),

      km: safeText(MODAL.km()?.value),
      pedagioEixo: safeText(MODAL.ped()?.value),
      volume: safeText(MODAL.volume()?.value),
      icms: safeText(MODAL.icms()?.value),
      valorEmpresa: safeText(MODAL.empresa()?.value),
      valorMotorista: safeText(MODAL.motorista()?.value),
      transito: safeText(MODAL.transito()?.value),
    };

    return payload;
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

  async function saveNewFrete(payload) {
    const actions = ["create", "add", "new", "save", "upsert"];
    let lastErr = null;

    for (const action of actions) {
      try {
        const data = await apiGet({ action, ...payload });
        if (data?.ok) return data;
        // alguns backends retornam {success:true}
        if (data?.success) return { ok: true, data };
        lastErr = new Error("Resposta sem ok (action=" + action + ")");
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Não consegui salvar (action create/add/new/save/upsert).");
  }

  function openNewModal() {
    const modal = MODAL.wrap();
    if (!modal) {
      alert("Modal não encontrado no fretes.html (id='modal').");
      return;
    }
    if (MODAL.title()) MODAL.title().textContent = "Novo Frete";
    clearModalFields();
    modalShow(true);
  }

  function closeModal() {
    modalShow(false);
  }

  async function handleSave() {
    const payload = collectModalPayload();
    if (!validateModalPayload(payload)) return;

    try {
      setStatus("💾 Salvando...");
      await saveNewFrete(payload);
      setStatus("✅ Salvo");
      closeModal();
      await atualizar();
    } catch (e) {
      console.error("[fretes] erro salvar:", e);
      setStatus("❌ Erro ao salvar");
      alert("Não consegui salvar no Sheets. Veja o console (F12) para detalhes.");
    }
  }

  function bindModalEvents() {
    const modal = MODAL.wrap();
    if (!modal) return;

    // fecha por botões
    MODAL.btnClose()?.addEventListener("click", closeModal);
    MODAL.btnCancel()?.addEventListener("click", closeModal);
    MODAL.btnSave()?.addEventListener("click", handleSave);

    // fecha clicando fora do card
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // ESC fecha
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // ----------------------------
  // AÇÕES
  // ----------------------------
  async function atualizar() {
    try {
      setStatus("🔄 Carregando...");
      const rows = await fetchRows();
      render(rows);
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[fretes] erro ao atualizar:", e);
      if (String(e?.message || "").includes("retornou HTML")) {
        setStatus("❌ Erro ao sincronizar (deploy/permissão)");
        console.warn("[fretes] Trecho retorno:", e.preview || "");
      } else {
        setStatus("❌ Erro ao sincronizar");
      }
    }
  }

  function bindButtons() {
    const btnAtualizar = $("#btnReloadFromSheets");
    const btnNovo = $("#btnNew");

    if (btnAtualizar) btnAtualizar.addEventListener("click", atualizar);

    // ✅ NOVO agora abre o modal de verdade
    if (btnNovo) {
      btnNovo.addEventListener("click", () => {
        openNewModal();
      });
    }

    // ✅ quando pesos mudarem, recalcula S/N
    ["#w9", "#w4", "#w7", "#w6", "#w5"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", () => atualizar());
    });
  }

  function init() {
    bindButtons();

    // modal
    fillModalSelectors();
    initModalUppercase();
    bindModalEvents();

    atualizar();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
