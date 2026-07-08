/* fretes.js | NOVA FROTA - MODO RAIO DIVULGAÇÃO */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyIeygrlaQVPq0puz1uxztLHSg0bsjxBcGFuZ9IR4CXqB2DqWMf3gPPFVk4FI0B-i45/exec";

  const DIRECTORY = {
    regionais: ["GOIAS", "MINAS", "SAO PAULO"],
    filiaisPorRegional: {
      GOIAS: [
        "ITUMBIARA", "RIO VERDE", "RIO VERDE FERT", "MONTIVIDIU", "ANAPOLIS",
        "MINEIROS", "JATAI", "CHAP CEU", "VIANOPOLIS", "URUAÇU", "INDIARA",
        "BOM JESUS", "CRISTALINA", "FORMOSA", "CATALÃO"
      ],
      MINAS: ["UBERLANDIA", "ARAGUARI"],
      "SAO PAULO": ["SOROCABA"],
    },
    clientes: [
      "CARGILL", "TERRA ROXA", "COMIGO", "CONCREBEL", "VITERRA", "GD AGRONEGOCIOS", "COFCO", "NOVA AGRI",
      "JBS SEARA", "BRF", "MOSAIC", "AMAGGI", "INGREDION", "LDC", "BRADO",
      "C VALE", "OLAM BRASIL", "SODRU", "BOM JESUS", "OLFAR", "SOYBRASIL", "LAVORO",
      "AGRIBRASIL", "BOM FUTURO", "CHS", "CIBRAFERTIL", "CJ TRADE",
      "FERT TOCANTINS", "GAVILON", "GRUPO SCHEFFER", "INPASA",
      "AGRICOLA ALVORADA", "ABJ AGROPECUARIA", "ADM", "FIAGRIL", "FS",
      "ALPHAGRAIN", "FERTIMIG", "FERTIPAR", "GIRASSOL", "GRUPO ATTO",
      "ADUBRAS", "CARAMURU", "YUKAER AGRO", "DUAL", "AGRONELLI", "BELAGRO",
      "COOPERNORT", "SIPAL", "H A PIMENTA", "SAFRAS", "SINAGRO", "CAMPO REAL",
      "AGROSOYA", "COPAGRI", "VMC", "GENERAL MILLS", "CUTRALE", "AGREX",
      "YARA", "HEDGE", "ALZ", "MARUBENI", "MDNORTE", "FS TRADING", "SJC",
      "CJ SELECTA", "COOXUPE", "BTG PACTUAL", "FENIX", "FERTIGRAN",
      "RIFERTIL", "SEMENTES SAO FRANCISCO", "SEMPRE SEMENTES", "GOIASA",
      "SAO MARTINHO", "AGRO CLUB", "MILHAO ALIMENTOS", "TRATO", "BREJEIRO",
      "GEN", "ARAGUAIA", "NUTRIEN", "KOWALSKI LDC", "BIORGANICA",
      "RICARDO MARTINS", "SERGIO GALVAO", "AGROMEN", "PROSOLLO", "USINA DECAL",
      "COOPERVASS", "SOAMI", "RAFIRA", "CONCEITO AGRICOLA", "AGROBOM",
      "MOINHO VITORIA", "MMJV GRAOS", "BOA SAFRA", "NOVA GALIA", "CEREAL",
      "SOMAI ALIMENTOS", "SITARI", "ALENCAR", "AGROMERCANTIL", "OURO SAFRA",
      "FUTURO", "GRAN MILHO", "HERINGER", "CEREAL OURO", "EUROCHEM", "GRANOL",
      "AGROAMAZONIA", "AGROMAVE", "CERTANO", "SEEDCORP", "BAUMINAS",
      "JALLES MACHADO", "ALIMENTOS N1", "ROAN ALIMENTOS", "CERRADINHO",
      "FAZENDAO AGRO", "IACO", "JATAI CEREAIS", "USINA SERRANOPOLIS",
      "FAST FRETE", "RIO DOCE", "INTEGRA", "RENATO CARVALHO", "COMIVA",
      "COMERX", "SCALON E CERHI", "3 TENTOS", "BIOMA", "AGROLESTE",
      "EDSON CROCHIQUIA", "COPAIBA", "ATVOS", "JRCA"
    ],
    contatosPorFilial: {
      MINEIROS: [{ nome: "KIEWERSON", fone: "5564999794586" }],
      ARAGUARI: [{ nome: "GUILHERME", fone: "5564992177636" }],
      ANAPOLIS: [{ nome: "WILHANS", fone: "5566996733683" }],
      "BOM JESUS": [{ nome: "MATEUS", fone: "5564993070738" }],
      MONTIVIDIU: [{ nome: "ROBSON", fone: "5564999628005" }],
      "RIO VERDE": [{ nome: "ARIEL", fone: "5564992277537" }],
      INDIARA: [{ nome: "RAFAEL", fone: "5564999108790" }],
      ITUMBIARA: [{ nome: "JHONATAN", fone: "5564992251214" }],
      JATAI: [{ nome: "RONE", fone: "5564996264511" }],
      "CHAP CEU": [{ nome: "RICARDO", fone: "5564999913512" }],
      CRISTALINA: [{ nome: "EVERALDO", fone: "5561996924906" }],
      "RIO VERDE FERT": [{ nome: "NARCISO", fone: "5564999365343" }],
      VIANOPOLIS: [{ nome: "FHELLIPE", fone: "5562999307778" }],
      FORMOSA: [{ nome: "FABIOLA", fone: "5562996017658" }],
      CATAlÃO: [{ nome: "EVERALDO JR", fone: "556492373735" }],
      "CATALÃO": [{ nome: "EVERALDO JR", fone: "556492373735" }],
      "URUAÇU": [{ nome: "GUILHERME", fone: "5562996978707" }],
      SOROCABA: [{ nome: "DIOGO", fone: "5515992784842" }],
    },
  };

  const FILIAIS_CONTATOS_ARTE = {
    RIOVERDE: [
      "ARIEL (64) 99227-7537",
      "GAUXIM (64) 99300-5771",
      "UANDER (64) 98114-4642",
      "RODRIGO (64) 99603-1200"
    ],
    FERTILIZANTE: [
      "NARCISO (64) 99936-5343",
      "NIVAIR (64) 99284-4955",
      "",
      ""
    ],
    BOMJESUS: [
      "MATEUS (64) 99307-0738",
      "EDUARDO (64) 99208-5655",
      "",
      ""
    ],
    MONTIVIDIU: [
      "ROBSON (64) 99962-8005",
      "MARCELO (64) 99653-2847",
      "",
      ""
    ],
    MINEIROS: [
      "KIEWERSON (64) 99979-4586",
      "VINICIUS (64) 99939-9946",
      "",
      ""
    ],
    INDIARA: [
      "RAFAEL P (64) 99910-8790",
      "RAFAEL (64) 99937-0131",
      "",
      ""
    ],
    FORMOSA: [
      "FABIOLA (62) 99601-7658",
      "JOAMAR (61) 99628-1922",
      "",
      ""
    ],
    CRISTALINA: [
      "EVERALDO (61) 99692-4906",
      "RAFAELA (61) 99319-6153",
      "",
      ""
    ],
    CATALAO: [
      "EVERALDO JR (64) 99237-3735",
      "",
      "",
      ""
    ],
    ANAPOLIS: [
      "WILHANS (66) 99673-3683",
      "DANILO (62) 99315-5713",
      "LUCAS (62) 99318-9816",
      "EDSON (62) 99340-5792"
    ],
    URUACU: [
      "GUILHERME (62) 99697-8707",
      "GABRIEL (61) 99846-3585",
      "",
      ""
    ],
    SAOPAULO: [
      "DIOGO (15) 99278-4842",
      "",
      "",
      ""
    ],
    ITUMBIARA: [
      "JEFERSON (64) 99263-5363",
      "NATAL (64) 99322-6440",
      "GUILHERME (64) 99217-7636",
      "MAYKON (64) 99254-4094"
    ],
    VIANOPOLIS: [
      "FHELLIPE (62) 99930-7778",
      "",
      "",
      ""
    ],
    CHAPEU: [
      "RICARDO (64) 99991-3512",
      "JONAS (64) 99607-2391",
      "",
      ""
    ],
    ARAGUARI: [
      "GUILHERME (64) 99217-7636",
      "ADRIELLY (34) 99156-6198",
      "",
      ""
    ],
    JATAI: [
      "TRIPA (64) 99982-9980",
      "HUDSON (64) 99906-2674",
      "PAULO (64) 99228-4439",
      "RONE (64) 99626-4511"
    ]
  };

  const CONTACT_PHONE = (() => {
    const map = {};
    Object.values(DIRECTORY.contatosPorFilial || {}).forEach((arr) => {
      (arr || []).forEach((c) => {
        if (c?.nome && c?.fone) {
          map[String(c.nome).toUpperCase().trim()] = String(c.fone).trim();
        }
      });
    });
    return map;
  })();

  const STATE = {
    rows: [],
    editingId: "",
    inlineSaving: new Set(),
    floatingBarReady: false,
    floatingSyncing: false,
    selectedIds: new Set(),
    previewRow: null,
    modalBusy: false,
  };

  const $ = (sel) => document.querySelector(sel);

  const COLS = [
    { key: "__select", label: "", isSelect: true },
    { key: "regional", label: "Regional" },
    { key: "filial", label: "Filial" },
    { key: "cliente", label: "Cliente", isColorTag: "cliente" },
    { key: "origem", label: "Origem" },
    { key: "coleta", label: "Coleta" },
    { key: "contato", label: "Contato", isContato: true, isColorTag: "contato" },
    { key: "destino", label: "Destino" },
    { key: "uf", label: "UF" },
    { key: "descarga", label: "Descarga" },
    { key: "volume", label: "Volume" },
    { key: "valorEmpresa", label: "Vlr Empresa", isMoney: true },
    { key: "valorMotorista", label: "Vlr Motorista", isMoney: true },
    { key: "km", label: "KM" },
    { key: "pedagioEixo", label: "Pedágio/Eixo" },
    { key: "e5", label: "5E" },
    { key: "e6", label: "6E" },
    { key: "e7", label: "7E" },
    { key: "e4", label: "4E" },
    { key: "e9", label: "9E" },
    { key: "produto", label: "Produto", isColorTag: "produto" },
    { key: "icms", label: "ICMS" },
    { key: "pedidoSat", label: "Pedido SAT" },
    { key: "porta", label: "Porta", isInlineEditable: true },
    { key: "transito", label: "Trânsito", isInlineEditable: true },
    { key: "status", label: "Status" },
    { key: "obs", label: "Observações" },
    { key: "__ultimaAlteracao", label: "Última Alteração", isUltimaAlteracao: true },
    { key: "__acoes", label: "Ações", isAcoes: true },
  ];

  const MODAL = {
    wrap: () => document.getElementById("modal"),
    title: () => document.getElementById("modalTitle"),
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
    btnSave: () => document.getElementById("btnSave"),
  };

  const FIXED_CLIENT_COLORS = {
    LDC: { bg: "#DBEAFE", fg: "#1D4ED8" },
    "OURO SAFRA": { bg: "#FEF3C7", fg: "#B45309" },
    CARAMURU: { bg: "#DCFCE7", fg: "#15803D" },
    CARGILL: { bg: "#FDE68A", fg: "#92400E" },
    COFCO: { bg: "#EDE9FE", fg: "#6D28D9" },
    MOSAIC: { bg: "#E0F2FE", fg: "#0369A1" },
    AMAGGI: { bg: "#FFE4E6", fg: "#BE123C" },
    CHS: { bg: "#ECFCCB", fg: "#4D7C0F" },
    BRF: { bg: "#F3E8FF", fg: "#7E22CE" },
    "JBS SEARA": { bg: "#FCE7F3", fg: "#BE185D" },
    "NOVA AGRI": { bg: "#D1FAE5", fg: "#047857" },
    CONCREBEL: { bg: "#E2E8F0", fg: "#334155" },
  };

  const FIXED_CONTACT_COLORS = {
    ARIEL: { bg: "#DBEAFE", fg: "#1D4ED8" },
    ROBSON: { bg: "#DCFCE7", fg: "#15803D" },
    SERGIO: { bg: "#FEF3C7", fg: "#B45309" },
    EVERALDO: { bg: "#EDE9FE", fg: "#6D28D9" },
    FABIOLA: { bg: "#FCE7F3", fg: "#BE185D" },
    RAFAEL: { bg: "#E0F2FE", fg: "#0369A1" },
    JHONATAN: { bg: "#FFE4E6", fg: "#BE123C" },
    KIEWERSON: { bg: "#ECFCCB", fg: "#4D7C0F" },
    RONE: { bg: "#F3E8FF", fg: "#7E22CE" },
    RICARDO: { bg: "#FDE68A", fg: "#92400E" },
    GUILHERME: { bg: "#D1FAE5", fg: "#047857" },
    NARCISO: { bg: "#E2E8F0", fg: "#334155" },
    ALFREDO: { bg: "#FEE2E2", fg: "#B91C1C" },
    MATEUS: { bg: "#CCFBF1", fg: "#0F766E" },
    FHELLIPE: { bg: "#F5D0FE", fg: "#A21CAF" },
    "EVERALDO JR": { bg: "#CFFAFE", fg: "#0E7490" },
    DIOGO: { bg: "#DCFCE7", fg: "#15803D" },
  };

  const FIXED_PRODUCT_COLORS = {
    SOJA: { bg: "#FEF3C7", fg: "#B45309" },
    MILHO: { bg: "#DBEAFE", fg: "#1D4ED8" },
    FERTILIZANTE: { bg: "#DCFCE7", fg: "#15803D" },
    ADUBO: { bg: "#FCE7F3", fg: "#BE185D" },
    AÇUCAR: { bg: "#EDE9FE", fg: "#6D28D9" },
    ACUCAR: { bg: "#EDE9FE", fg: "#6D28D9" },
    SORGO: { bg: "#FFE4E6", fg: "#BE123C" },
    FARELO: { bg: "#E0F2FE", fg: "#0369A1" },
    DDG: { bg: "#ECFCCB", fg: "#4D7C0F" },
    ETANOL: { bg: "#FDE68A", fg: "#92400E" },
    SEMENTE: { bg: "#D1FAE5", fg: "#047857" },
    SEMENTES: { bg: "#D1FAE5", fg: "#047857" },
    CALCÁRIO: { bg: "#E2E8F0", fg: "#334155" },
    CALCARIO: { bg: "#E2E8F0", fg: "#334155" },
    GESSO: { bg: "#F5D0FE", fg: "#A21CAF" },
    SAL: { bg: "#CFFAFE", fg: "#0E7490" },
  };

  const PRODUCT_BG_MAP_NF = {
    SOJA: "../assets/img/SOJATESTE.png",
    MILHO: "../assets/img/MILHOTESTE.png",
    ACUCAR: "../assets/img/ACUCARTESTE.png",
    CALCARIO: "../assets/img/CALCARIOTESTE.png",
    FARELODESOJA: "../assets/img/FARELODESOJA.png",
    SORGO: "../assets/img/SORGOTESTE.png",
    FERTILIZANTE: "../assets/img/FERTILIZANTE.png",
  };

  const PISO_PARAMS = {
    e9: { eixos: 9, rkm: 9.2662, custoCC: 877.83, weightInputId: "w9", defaultPeso: 47 },
    e4: { eixos: 4, rkm: 8.0855, custoCC: 792.3, weightInputId: "w4", defaultPeso: 39 },
    e7: { eixos: 7, rkm: 8.0855, custoCC: 792.3, weightInputId: "w7", defaultPeso: 36 },
    e6: { eixos: 6, rkm: 7.4408, custoCC: 656.76, weightInputId: "w6", defaultPeso: 31 },
    e5: { eixos: 5, rkm: 6.7381, custoCC: 642.1, weightInputId: "w5", defaultPeso: 26 },
  };

  function safeText(v) {
    return String(v ?? "").trim();
  }

  function upper(v) {
    return safeText(v).toUpperCase();
  }

  function upperKeepSpaces(v) {
    return String(v ?? "").toUpperCase();
  }

  function normalizeKeyNF(v) {
    return String(v || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "");
  }

  function setStatus(text) {
    const el = document.querySelector("[data-sync-status]") || document.querySelector("#syncStatus");
    if (el) el.textContent = text;
  }

  function normalizeFreteStatus(value) {
    const s = upper(value);
    if (s === "EM ANALISE") return "FINALIZANDO";
    if (s === "BLOQUEADO") return "SUSPENSO";
    return s;
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

  function formatMoneyBR(value) {
    const n = parsePtNumber(value);
    if (!Number.isFinite(n)) return safeText(value);
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
function formatDateTimeBR(value) {
    const raw = safeText(value);
    if (!raw) return "";

    // A partir de agora, o Apps Script deve gravar a coluna ultimaAlteracao
    // já formatada como dd/MM/yyyy HH:mm. Então, quando vier nesse padrão,
    // apenas mostramos o texto como está.
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(raw)) return raw;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw;
    if (/^\d{2}\/\d{2}\/\d{2}/.test(raw)) return raw;

    // Evita mostrar timestamps antigos do updatedAt/Date.now como números soltos.
    if (/^\d{12,}$/.test(raw)) return "";

    // Compatibilidade: se algum retorno vier como ISO, exibe em pt-BR.
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;

    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = String(d.getFullYear());
    const hora = String(d.getHours()).padStart(2, "0");
    const minuto = String(d.getMinutes()).padStart(2, "0");

    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  }

  function getUltimaAlteracao(row) {
    if (!row) return "";

    const possibleKeys = [
      "ultimaAlteracao",
      "ultima_alteracao",
      "UltimaAlteracao",
      "Ultima Alteracao",
      "Última Alteração",
      "dataAlteracao",
      "data_alteracao",
      "Data Alteracao",
      "Data Alteração",
      "dataAtualizacao",
      "data_atualizacao",
      "Data Atualizacao",
      "Data Atualização"
    ];

    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && safeText(row[key])) {
        return formatDateTimeBR(row[key]);
      }
    }

    return "";
  }

  function buildUltimaAlteracaoCell(row) {
    const td = document.createElement("td");
    td.className = "num";
    td.textContent = getUltimaAlteracao(row) || "-";
    return td;
  }


  function nowUltimaAlteracaoBR() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    return [
      pad(d.getDate()),
      pad(d.getMonth() + 1),
      d.getFullYear()
    ].join("/") + " " + [
      pad(d.getHours()),
      pad(d.getMinutes())
    ].join(":");
  }

  function normalizeMoneyInput(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";

    const numeric = parsePtNumber(text);
    if (!Number.isFinite(numeric)) return text.toUpperCase();

    return numeric.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ceil0(n) {
    return Math.ceil(n);
  }

  function jsonp(url, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";

      const t = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout JSONP"));
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
        reject(new Error("Erro ao carregar JSONP"));
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
    const res = await jsonp(buildUrl(paramsObj), 35000);
    if (!res || res.ok === false) throw new Error(res?.error || "Falha na API");
    return res;
  }

  function getPesoFromUI(id, fallback) {
    const el = document.getElementById(id);
    const v = parsePtNumber(el?.value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  function calcMinRPorTon(param, km, pedagioPorEixo) {
    const peso = getPesoFromUI(param.weightInputId, param.defaultPeso);
    const numerador = param.rkm * km + param.custoCC + pedagioPorEixo * param.eixos;
    return ceil0(numerador / peso);
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

  function getFixedColorConfig(value, kind) {
    const key = upper(value);
    if (kind === "cliente" && FIXED_CLIENT_COLORS[key]) return FIXED_CLIENT_COLORS[key];
    if (kind === "contato" && FIXED_CONTACT_COLORS[key]) return FIXED_CONTACT_COLORS[key];
    if (kind === "produto" && FIXED_PRODUCT_COLORS[key]) return FIXED_PRODUCT_COLORS[key];
    return { bg: "#F1F5F9", fg: "#334155" };
  }

  function createColorTag(text, kind) {
    const span = document.createElement("span");
    const value = safeText(text);

    if (!value) {
      span.textContent = "";
      return span;
    }

    const c = getFixedColorConfig(value, kind);
    span.textContent = value;
    span.style.display = "inline-flex";
    span.style.alignItems = "center";
    span.style.maxWidth = "100%";
    span.style.padding = "2px 8px";
    span.style.borderRadius = "999px";
    span.style.fontWeight = "800";
    span.style.fontSize = "11px";
    span.style.lineHeight = "1.2";
    span.style.background = c.bg;
    span.style.color = c.fg;
    span.style.border = `1px solid ${c.fg}22`;
    span.style.whiteSpace = "nowrap";

    return span;
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

  function buildContatoCell(contatoText) {
    const td = document.createElement("td");
    const wrap = document.createElement("div");

    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "6px";

    const labelWrap = document.createElement("div");
    labelWrap.style.minWidth = "0";
    labelWrap.appendChild(createColorTag(contatoText || "", "contato"));
    wrap.appendChild(labelWrap);

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

  function buildStatusCell(value) {
    const td = document.createElement("td");
    const status = normalizeFreteStatus(value);
    const span = document.createElement("span");

    span.textContent = status || "-";
    span.style.display = "inline-flex";
    span.style.alignItems = "center";
    span.style.justifyContent = "center";
    span.style.minWidth = "96px";
    span.style.height = "22px";
    span.style.padding = "0 10px";
    span.style.borderRadius = "999px";
    span.style.fontWeight = "900";
    span.style.fontSize = "10px";
    span.style.color = "#fff";

    if (status === "LIBERADO") span.style.background = "#15803D";
    else if (status === "FINALIZANDO") span.style.background = "#1D4ED8";
    else if (status === "SUSPENSO") span.style.background = "#B91C1C";
    else span.style.background = "#64748B";

    td.appendChild(span);
    return td;
  }

  function buildInlineEditableCell(row, key) {
    const td = document.createElement("td");
    td.className = "num";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "inlineCellInput";
    input.value = safeText(row[key] || "");
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "off");

    let originalValue = safeText(row[key] || "");
    let isSaving = false;

    async function commit() {
      const newValue = safeText(input.value);
      if (isSaving || newValue === originalValue || !safeText(row.id)) return;

      isSaving = true;
      input.disabled = true;

      try {
        setStatus(`💾 Salvando ${key}...`);

        const ultimaAlteracao = nowUltimaAlteracaoBR();
        const res = await apiGet({
          action: "fretes_update",
          id: safeText(row.id),
          [key]: newValue
        });

        const idx = STATE.rows.findIndex((r) => safeText(r.id) === safeText(row.id));
        if (idx >= 0) {
          STATE.rows[idx][key] = newValue;
          STATE.rows[idx].ultimaAlteracao = res?.data?.ultimaAlteracao || ultimaAlteracao;
          STATE.rows[idx].updatedAt = res?.data?.updatedAt || STATE.rows[idx].updatedAt;
        }

        row[key] = newValue;
        row.ultimaAlteracao = res?.data?.ultimaAlteracao || ultimaAlteracao;

        originalValue = newValue;
        applyFilters();
        setStatus("✅ Atualizado");
      } catch (e) {
        input.value = originalValue;
        setStatus("❌ Erro ao atualizar");
        alert(e.message || `Falha ao salvar ${key}.`);
      } finally {
        isSaving = false;
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

    td.appendChild(input);
    return td;
  }

  function buildSelectCell(row) {
    const td = document.createElement("td");
    td.className = "num";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "nfRowCheck";
    cb.checked = STATE.selectedIds.has(safeText(row.id));
    cb.title = "Selecionar para pacote de divulgação";

    cb.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = safeText(row.id);
      if (!id) return;

      if (cb.checked) STATE.selectedIds.add(id);
      else STATE.selectedIds.delete(id);

      updateBulkUI();
      renderPreview(row);
    });

    td.appendChild(cb);
    return td;
  }

  function buildAcoesCell(row) {
    const td = document.createElement("td");
    td.className = "num";

    const wrap = document.createElement("div");
    wrap.className = "nfActionGroup";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btnTiny ghost";
    btnEdit.textContent = "Editar";
    btnEdit.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(row);
    });

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btnTiny";
    btnDel.textContent = "Excluir";
    btnDel.addEventListener("click", async (e) => {
      e.stopPropagation();

      if (!row.id) return;
      if (!confirm("Excluir este frete?")) return;

      try {
        setStatus("🗑 Excluindo...");
        await apiGet({ action: "fretes_delete", id: row.id });
        await atualizar();
        setStatus("✅ Excluído");
      } catch (e) {
        setStatus("❌ Falha ao excluir");
        alert(e.message || "Falha ao excluir.");
      }
    });

    wrap.appendChild(btnEdit);
    wrap.appendChild(btnDel);

    td.appendChild(wrap);
    return td;
  }

  function render(rowsRaw) {
    const tbody = $("#tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!rowsRaw || !rowsRaw.length) {
      syncFloatingHorizontalBar();
      return;
    }

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
        if (col.isSelect) {
          tr.appendChild(buildSelectCell(row));
          return;
        }

        if (col.isContato) {
          tr.appendChild(buildContatoCell(row.contato || ""));
          return;
        }

        if (col.isUltimaAlteracao) {
          tr.appendChild(buildUltimaAlteracaoCell(row));
          return;
        }

        if (col.isAcoes) {
          tr.appendChild(buildAcoesCell(row));
          return;
        }

        
        if (["e5", "e6", "e7", "e4", "e9"].includes(col.key)) {
          tr.appendChild(buildPillSNCell(row[col.key]));
          return;
        }

        if (col.key === "status") {
          tr.appendChild(buildStatusCell(row[col.key]));
          return;
        }

        if (col.isInlineEditable) {
          tr.appendChild(buildInlineEditableCell(row, col.key));
          return;
        }

        const td = document.createElement("td");

        if (["volume", "valorEmpresa", "valorMotorista", "km", "pedagioEixo", "pedidoSat", "porta", "transito"].includes(col.key)) {
          td.className = "num";
        }

        if (col.isColorTag) {
          td.appendChild(createColorTag(row[col.key], col.isColorTag));
        } else if (col.isMoney) {
          td.textContent = safeText(row[col.key]) ? formatMoneyBR(row[col.key]) : "";
        } else {
          td.textContent = safeText(row[col.key]);
        }

        tr.appendChild(td);
      });

      tr.addEventListener("click", () => renderPreview(row));
      tbody.appendChild(tr);
    });

    syncFloatingHorizontalBar();
    updateBulkUI();
    renderStats(getFilteredRows());
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
    renderPreview(getFilteredRows()[0] || STATE.rows[0]);
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

  function productFamilyNF(produto) {
    const n = normalizeKeyNF(produto);

    if (n.includes("FARELO") && n.includes("SOJA")) return "FARELODESOJA";
    if (n.includes("SOJA")) return "SOJA";
    if (n.includes("MILHO")) return "MILHO";
    if (n.includes("ACUCAR")) return "ACUCAR";
    if (n.includes("CALCARIO")) return "CALCARIO";
    if (n.includes("SORGO")) return "SORGO";
    if (n.includes("FERT") || n.includes("ADUBO")) return "FERTILIZANTE";

    return "SOJA";
  }

  function normalizeFilialKeyNF(filial) {
    const k = normalizeKeyNF(filial);

    if (k === "RIOVERDE") return "RIOVERDE";
    if (k === "RIOVERDEFERT") return "FERTILIZANTE";
    if (k === "SAOPAULO" || k === "SOROCABA") return "SAOPAULO";
    if (k === "CHAPCEU" || k === "CHAPEU") return "CHAPEU";
    if (k === "CATALAO") return "CATALAO";
    if (k === "URUAÇU" || k === "URUACU") return "URUACU";
    if (k === "BOMJESUS") return "BOMJESUS";

    return k;
  }

  function formatPhoneNF(phone) {
    const d = String(phone || "").replace(/\D/g, "");
    const p = d.startsWith("55") ? d.slice(2) : d;

    if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
    if (p.length === 10) return `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`;

    return phone || "";
  }

  function contactsFromFilial(row) {
    const filialKey = normalizeFilialKeyNF(row.filial);
    const lista = FILIAIS_CONTATOS_ARTE[filialKey];

    if (lista && lista.length) return lista.slice(0, 4);

    const contato = safeText(row.contato);
    const phone = CONTACT_PHONE[upper(contato)] || "";

    return [
      contato ? `${contato} ${formatPhoneNF(phone)}` : "",
      "",
      "",
      ""
    ];
  }

  function cityUf(row, cityKey, ufKey) {
    const city = safeText(row[cityKey]);
    const uf = safeText(row[ufKey]);

    if (!city) return "";
    if (city.includes("-")) return upper(city);

    return uf ? `${upper(city)}-${upper(uf)}` : upper(city);
  }

  function divulgacaoDataFromRow(row) {
  const produto = upper(row.produto || "SOJA");
  const family = productFamilyNF(produto);
  const contatos = contactsFromFilial(row);

  const valor = safeText(row.valorMotorista)
    ? formatMoneyBR(row.valorMotorista)
    : "A COMBINAR";

  return {
    // COLETA = SOMENTE ORIGEM
    coletaCidade: upper(row.origem || ""),

    coletaLocal: upper(row.coleta || ""),

    // DESCARGA = DESTINO + UF
    descargaCidade: cityUf(row, "destino", "uf"),

    descargaLocal: upper(row.descarga || ""),

    produto,
    productFamily: family,

    bg: PRODUCT_BG_MAP_NF[family] || PRODUCT_BG_MAP_NF.SOJA,

    valor,

    obs: upper(row.obs || ""),

    contatos,

    contatoPrincipal: upper(row.contato || ""),

    phone: extractPhoneBR(row.contato),

    filename:
      `${family}_` +
      `${normalizeKeyNF(row.origem)}_` +
      `${normalizeKeyNF(row.destino)}_` +
      `${normalizeKeyNF(valor)}.jpg`
  };
}

  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt || "";
  }

  function renderPreview(row) {
    if (!row) row = STATE.previewRow || getFilteredRows()[0] || STATE.rows[0];
    if (!row) return;

    STATE.previewRow = row;
    const d = divulgacaoDataFromRow(row);

    const bg = document.getElementById("nfArtBg");
    if (bg) bg.src = d.bg;

    const badge = document.getElementById("nfPreviewProdutoBadge");
    if (badge) badge.textContent = d.productFamily;

    setText("nfArtColetaCidade", d.coletaCidade);
    setText("nfArtColetaLocal", d.coletaLocal);
    setText("nfArtDescargaCidade", d.descargaCidade);
    setText("nfArtDescargaLocal", d.descargaLocal);
    setText("nfArtProduto", d.produto);
    setText("nfArtValor", d.valor);
    setText("nfArtObs", d.obs);

    setText("nfArtContato1", d.contatos[0] || "");
    setText("nfArtContato2", d.contatos[1] || "");
    setText("nfArtContato3", d.contatos[2] || "");
    setText("nfArtContato4", d.contatos[3] || "");

    const msg = document.getElementById("nfMensagemPronta");
    if (msg) msg.value = buildMessage(row);
  }

  function buildFreteBloco(row) {
  const origem = upper(row.origem || "");
  const coleta = upper(row.coleta || "");
  const destino = cityUf(row, "destino", "uf");
  const descarga = upper(row.descarga || "");
  const produto = upper(row.produto || "");

  const valor = safeText(row.valorMotorista)
    ? formatMoneyBR(row.valorMotorista)
    : "A COMBINAR";

  return [
    `🏷️ ${origem}${coleta ? ` (${coleta})` : ""}`,
    `🏁 ${destino}${descarga ? ` (${descarga})` : ""}`,
    `💢 ${produto}`,
    `💰${valor}`
  ].join("\n");
}

function buildMessage(row) {
  const selected = getSelectedRows();

  const rows = selected.length
    ? selected
    : row
      ? [row]
      : STATE.previewRow
        ? [STATE.previewRow]
        : [];

  if (!rows.length) return "";

  return [
    "🇸🇱🇸🇱🇸🇱 NOVA FROTA 🇸🇱🇸🇱🇸🇱",
    "✅ FRETES LIBERADOS",
    "",
    rows.map(buildFreteBloco).join("\n🟰🟰🟰🟰🟰🟰🟰🟰🟰\n")
  ].join("\n");
}


  function loadHtml2CanvasNF() {
    return new Promise((resolve, reject) => {
      if (typeof window.html2canvas === "function") {
        resolve(window.html2canvas);
        return;
      }

      const existing = document.querySelector('script[data-nf-html2canvas="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.html2canvas), { once: true });
        existing.addEventListener("error", () => reject(new Error("Falha ao carregar html2canvas.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.async = true;
      script.defer = true;
      script.dataset.nfHtml2canvas = "1";

      script.onload = () => {
        if (typeof window.html2canvas === "function") resolve(window.html2canvas);
        else reject(new Error("html2canvas carregou, mas não ficou disponível."));
      };

      script.onerror = () => reject(new Error("Não foi possível carregar html2canvas. Verifique internet/CDN."));
      document.head.appendChild(script);
    });
  }

  function waitForImage(img) {
    if (!img) return Promise.resolve();
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();

    return new Promise((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      setTimeout(done, 2500);
    });
  }

  async function canvasFromPreview(row) {
    renderPreview(row);

    const card = document.getElementById("nfArtCard");
    const img = document.getElementById("nfArtBg");

    if (!card) {
      alert("Prévia da divulgação não encontrada na página.");
      return null;
    }

    try {
      setStatus("🖼️ Gerando imagem...");
      const html2canvasLib = await loadHtml2CanvasNF();

      await waitForImage(img);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      return await html2canvasLib(card, {
        backgroundColor: null,
        scale: 4,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 8000
      });
    } catch (e) {
      console.error("[fretes] erro ao gerar canvas:", e);
      alert(e.message || "Não foi possível gerar a imagem. Tente baixar novamente.");
      return null;
    }
  }

  async function downloadDivulgacaoJPG(row) {
    const chosenRow = row || STATE.previewRow || getFilteredRows()[0];
    if (!chosenRow) {
      alert("Selecione um frete para baixar a imagem.");
      return;
    }

    const d = divulgacaoDataFromRow(chosenRow);
    const canvas = await canvasFromPreview(chosenRow);

    if (!canvas) return;

    try {
      const link = document.createElement("a");
      link.download = d.filename || "divulgacao-frete.jpg";
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus("✅ JPG baixado");
    } catch (e) {
      console.error("[fretes] erro ao baixar JPG:", e);
      alert("Não foi possível baixar o JPG neste navegador.");
    }
  }

  async function copyPreviewImage(row) {
    const chosenRow = row || STATE.previewRow || getFilteredRows()[0];
    if (!chosenRow) {
      alert("Selecione um frete para copiar a imagem.");
      return;
    }

    try {
      const canvas = await canvasFromPreview(chosenRow);
      if (!canvas) return;

      if (!navigator.clipboard || !window.ClipboardItem) {
        throw new Error("Clipboard indisponível neste navegador.");
      }

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Não foi possível gerar o PNG para copiar.");

      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("✅ Imagem copiada");
    } catch (e) {
      console.warn("[fretes] copiar imagem falhou:", e);
      alert("Não consegui copiar a imagem neste navegador. Use Baixar JPG.");
    }
  }

  async function copyMessage(row) {
    const msg = buildMessage(row || STATE.previewRow || getFilteredRows()[0] || {});

    try {
      await navigator.clipboard.writeText(msg);
      setStatus("✅ Mensagem copiada");
    } catch {
      prompt("Copie a mensagem:", msg);
    }
  }

  async function enviarWhatsAppRow(row) {
    await copyMessage(row);

    const phone = extractPhoneBR(row.contato);
    const msg = buildMessage(row);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
  }

  function getSelectedRows() {
    return STATE.rows.filter((r) => STATE.selectedIds.has(safeText(r.id)));
  }

  function updateBulkUI() {
  const selected = getSelectedRows();
  const n = selected.length;

  const a = document.getElementById("nfSelecionadosTxt");
  const b = document.getElementById("nfArtesTxt");
  const c = document.getElementById("nfMsgsTxt");

  if (a) a.textContent = `${n} selecionado${n === 1 ? "" : "s"}`;
  if (b) b.textContent = `${n} arte${n === 1 ? "" : "s"}`;
  if (c) c.textContent = `${n} mensagem${n === 1 ? "" : "s"}`;

  const selectAll = document.getElementById("nfSelectAll");
  if (selectAll) {
    const visible = getFilteredRows().filter((r) => safeText(r.id));
    selectAll.checked = visible.length > 0 && visible.every((r) => STATE.selectedIds.has(safeText(r.id)));
    selectAll.indeterminate =
      visible.some((r) => STATE.selectedIds.has(safeText(r.id))) && !selectAll.checked;
  }

  const msg = document.getElementById("nfMensagemPronta");
  if (msg) {
    msg.value = selected.length
      ? buildMessage()
      : STATE.previewRow
        ? buildMessage(STATE.previewRow)
        : "";
  }
}
  function renderStats(rows) {
    rows = rows || [];

    const sum = (key) => rows.reduce((acc, r) => acc + (parsePtNumber(r[key]) || 0), 0);
    const avg = (key) => {
      const nums = rows.map((r) => parsePtNumber(r[key])).filter(Number.isFinite);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    };

    const set = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    set("nfStatVolume", `${sum("volume").toLocaleString("pt-BR", { maximumFractionDigits: 0 })} t`);
    set("nfStatEmpresa", `${formatMoneyBR(avg("valorEmpresa"))} / t`);
    set("nfStatMotorista", `${formatMoneyBR(avg("valorMotorista"))} / t`);
    set("nfStatKm", `${sum("km").toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`);
    set("nfStatPedagio", formatMoneyBR(sum("pedagioEixo")));
  }

  async function gerarPacoteJPG() {
    const rows = getSelectedRows();

    if (!rows.length) {
      alert("Selecione uma ou mais linhas para gerar o pacote JPG.");
      return;
    }

    setStatus(`⚡ Gerando ${rows.length} artes...`);

    for (let i = 0; i < rows.length; i++) {
      await downloadDivulgacaoJPG(rows[i]);
      await new Promise((r) => setTimeout(r, 250));
    }

    setStatus("✅ Pacote JPG gerado");
  }

  async function enviarWhatsAppPacote() {
  const rows = getSelectedRows();

  if (!rows.length) {
    alert("Selecione uma ou mais linhas.");
    return;
  }

  const msg = buildMessage();

  try {
    await navigator.clipboard.writeText(msg);
  } catch {}

  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}

  function buildDivulgacaoHtml(rows) {
    const linhas = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.regional)}</td>
        <td>${escapeHtml(row.filial)}</td>
        <td>${escapeHtml(row.origem)}</td>
        <td>${escapeHtml(row.coleta)}</td>
        <td>${escapeHtml(row.destino)}</td>
        <td>${escapeHtml(row.uf)}</td>
        <td>${escapeHtml(row.descarga)}</td>
        <td>${escapeHtml(row.produto)}</td>
        <td class="freteCol">${escapeHtml(formatMoneyBR(row.valorMotorista))}</td>
        <td>${escapeHtml(row.contato)}</td>
      </tr>
    `).join("");

    const hoje = new Date().toLocaleDateString("pt-BR");

    return `
<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8" />
<title>Divulgação de Frete</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body{ margin:0; font-family:Arial,sans-serif; color:#222; background:#fff; }
.page{ width:100%; padding:8px 10px; }
.head{ text-align:center; margin-bottom:10px; border:1px solid #cfd8dc; padding:12px 10px; }
.head img{ max-width:420px; max-height:75px; object-fit:contain; display:block; margin:0 auto 6px; }
.bar{ height:24px; background:#3B7D23; border:1px solid #2f661b; border-bottom:none; }
table{ width:100%; border-collapse:collapse; table-layout:fixed; font-size:10px; }
thead th{ background:#F6D96B; color:#1f2937; border:1px solid #666; padding:4px 3px; text-align:center; font-weight:900; }
tbody td{ border:1px solid #666; padding:2px 3px; font-size:9px; }
tbody tr:nth-child(even){ background:#f8f8f8; }
.freteCol{ color:#c62828; font-weight:900; text-align:right; }
.foot{ margin-top:8px; font-size:11px; color:#555; display:flex; justify-content:space-between; }
@media print { .printHint { display:none; } }
</style>
</head>
<body>
<div class="page">
  <div class="head">
    <img src="../assets/img/logo-novafrota.png" alt="NOVA FROTA" />
  </div>
  <div class="bar"></div>
  <table>
    <thead>
      <tr>
        <th>REGIONAL</th>
        <th>FILIAL</th>
        <th>ORIGEM</th>
        <th>LOCAL DE CARREGAMENTO</th>
        <th>DESTINO</th>
        <th>UF</th>
        <th>DESCARGA</th>
        <th>PRODUTO</th>
        <th>FRETE</th>
        <th>CONTATO</th>
      </tr>
    </thead>
    <tbody>
      ${linhas || `<tr><td colspan="10" style="text-align:center;padding:18px;font-weight:700;">NENHUM FRETE LIBERADO ENCONTRADO</td></tr>`}
    </tbody>
  </table>
  <div class="foot">
    <div><b>Data:</b> ${hoje}</div>
    <div><b>Total de fretes:</b> ${rows.length}</div>
  </div>
</div>
</body>
</html>`;
  }

  function getDivulgacaoRows() {
    return getFilteredRows().filter((row) => normalizeFreteStatus(row.status) === "LIBERADO");
  }

  function openDivulgacaoFrete() {
    const rows = getDivulgacaoRows();

    if (!rows.length) {
      alert("Não há fretes LIBERADO para divulgar com os filtros atuais.");
      return;
    }

    const html = buildDivulgacaoHtml(rows);
    const win = window.open("", "_blank");

    if (!win) {
      alert("O navegador bloqueou a nova janela. Libere pop-up para continuar.");
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();

    win.onload = () => {
      setTimeout(() => {
        win.focus();
        win.print();
      }, 400);
    };
  }

  function modalShow(show) {
    const el = MODAL.wrap();
    if (!el) return;

    el.style.display = show ? "flex" : "none";
    el.setAttribute("aria-hidden", show ? "false" : "true");
  }


  function getModalLoadingElements() {
    return {
      overlay: document.getElementById("nfModalLoading"),
      title: document.getElementById("nfModalLoadingTitle"),
      sub: document.getElementById("nfModalLoadingSub"),
      btnSave: document.getElementById("btnSave"),
      btnCancel: document.getElementById("btnCancel"),
      btnClose: document.getElementById("btnCloseModal"),
    };
  }

  function setModalButtonsDisabled(disabled) {
    const els = getModalLoadingElements();
    [els.btnSave, els.btnCancel, els.btnClose].forEach((btn) => {
      if (btn) btn.disabled = !!disabled;
    });
  }

  function showModalLoading(title, sub) {
    STATE.modalBusy = true;
    const els = getModalLoadingElements();

    if (els.title) els.title.textContent = title || "Aguarde...";
    if (els.sub) els.sub.textContent = sub || "Processando informações.";

    if (els.overlay) {
      els.overlay.classList.add("show");
      els.overlay.setAttribute("aria-hidden", "false");
    }

    setModalButtonsDisabled(true);
  }

  function hideModalLoading() {
    const els = getModalLoadingElements();

    if (els.overlay) {
      els.overlay.classList.remove("show");
      els.overlay.setAttribute("aria-hidden", "true");
    }

    setModalButtonsDisabled(false);
    STATE.modalBusy = false;
  }

  function clearModalFields() {
    STATE.editingId = "";

    if (MODAL.title()) MODAL.title().textContent = "Novo Frete";

    [
      MODAL.origem(), MODAL.coleta(), MODAL.destino(), MODAL.uf(), MODAL.descarga(),
      MODAL.produto(), MODAL.km(), MODAL.ped(), MODAL.volume(), MODAL.icms(),
      MODAL.empresa(), MODAL.motorista(), MODAL.sat(), MODAL.porta(),
      MODAL.transito(), MODAL.obs()
    ].forEach((el) => {
      if (el) el.value = "";
    });

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

      if (contatos.length === 1 && MODAL.contato()) {
        MODAL.contato().value = contatos[0];
      }
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
    if (MODAL.empresa()) MODAL.empresa().value = normalizeMoneyInput(row.valorEmpresa);
    if (MODAL.motorista()) MODAL.motorista().value = normalizeMoneyInput(row.valorMotorista);
    if (MODAL.sat()) MODAL.sat().value = safeText(row.pedidoSat);
    if (MODAL.porta()) MODAL.porta().value = safeText(row.porta);
    if (MODAL.transito()) MODAL.transito().value = safeText(row.transito);
    if (MODAL.status()) MODAL.status().value = normalizeFreteStatus(row.status) || "LIBERADO";
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
      valorEmpresa: normalizeMoneyInput(MODAL.empresa()?.value),
      valorMotorista: normalizeMoneyInput(MODAL.motorista()?.value),
      km: safeText(MODAL.km()?.value),
      pedagioEixo: safeText(MODAL.ped()?.value),
      produto: upper(MODAL.produto()?.value),
      icms: safeText(MODAL.icms()?.value),
      pedidoSat: upper(MODAL.sat()?.value),
      porta: safeText(MODAL.porta()?.value),
      transito: safeText(MODAL.transito()?.value),
      status: normalizeFreteStatus(MODAL.status()?.value),
      obs: upperKeepSpaces(MODAL.obs()?.value).trim(),
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

  async function saveFrete(payload) {
    if (STATE.editingId) {
      return await apiGet({ action: "fretes_update", id: STATE.editingId, ...payload });
    }

    return await apiGet({ action: "fretes_add", ...payload });
  }

  async function handleSave() {
    if (STATE.modalBusy) return;

    const payload = collectModalPayload();

    if (!validateModalPayload(payload)) return;

    try {
      showModalLoading("Salvando Frete...", "Sincronizando. Aguarde alguns segundos.");
      setStatus("💾 Salvando...");

      await saveFrete(payload);

      showModalLoading("Frete salvo com sucesso ✓", "Atualizando a lista de fretes.");
      await atualizar();

      modalShow(false);
      setStatus("✅ Salvo");
    } catch (e) {
      setStatus("❌ Erro ao salvar");
      alert(e.message || "Falha ao salvar.");
    } finally {
      hideModalLoading();
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

  function closeModal(force) {
    if (STATE.modalBusy && !force) return;

    showModalLoading("Cancelando...", "Fechando a janela com segurança.");

    setTimeout(() => {
      modalShow(false);
      hideModalLoading();
    }, 180);
  }

  async function atualizar() {
    try {
      setStatus("🔄 Carregando...");

      const res = await apiGet({ action: "fretes_list" });

      STATE.rows = Array.isArray(res.data)
        ? res.data.map((row) => ({ ...row, status: normalizeFreteStatus(row.status) }))
        : [];

      fillTopFilters(STATE.rows);
      applyFilters();
      renderPreview(getFilteredRows()[0] || STATE.rows[0]);
      updateBulkUI();

      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[fretes] erro ao atualizar:", e);
      setStatus("❌ Erro ao sincronizar");
    }
  }

  function ensureFloatingHorizontalBar() {
    if (STATE.floatingBarReady) return;

    if (document.getElementById("nfFloatingHBar")) {
      STATE.floatingBarReady = true;
      return;
    }

    const style = document.createElement("style");
    style.id = "nfFloatingHBarStyle";
    style.textContent = `
      #nfFloatingHBar{
        position:fixed;
        left:12px;
        right:330px;
        bottom:8px;
        height:18px;
        display:none;
        z-index:9999;
        background:rgba(255,255,255,.96);
        border:1px solid rgba(15,23,42,.12);
        border-radius:999px;
        box-shadow:0 4px 14px rgba(0,0,0,.12);
        overflow-x:auto;
        overflow-y:hidden;
        backdrop-filter:blur(6px);
      }

      body.preview-hidden #nfFloatingHBar{
        right:12px;
      }

      #nfFloatingHBarInner{
        height:1px;
      }

      @media(max-width:1250px){
        #nfFloatingHBar{
          right:12px;
        }
      }
    `;
    document.head.appendChild(style);

    const bar = document.createElement("div");
    bar.id = "nfFloatingHBar";
    bar.innerHTML = `<div id="nfFloatingHBarInner"></div>`;
    document.body.appendChild(bar);

    STATE.floatingBarReady = true;
  }

  function syncFloatingHorizontalBar() {
    ensureFloatingHorizontalBar();

    const wrap = document.querySelector(".tableWrap");
    const bar = document.getElementById("nfFloatingHBar");
    const inner = document.getElementById("nfFloatingHBarInner");

    if (!wrap || !bar || !inner) return;

    const hasOverflow = wrap.scrollWidth > wrap.clientWidth + 2;

    if (!hasOverflow) {
      bar.style.display = "none";
      return;
    }

    inner.style.width = wrap.scrollWidth + "px";
    bar.style.display = "block";

    if (!STATE.floatingSyncing) bar.scrollLeft = wrap.scrollLeft;
  }

  function bindFloatingHorizontalBar() {
    ensureFloatingHorizontalBar();

    const wrap = document.querySelector(".tableWrap");
    const bar = document.getElementById("nfFloatingHBar");

    if (!wrap || !bar) return;

    wrap.addEventListener("scroll", () => {
      if (STATE.floatingSyncing) return;

      STATE.floatingSyncing = true;
      bar.scrollLeft = wrap.scrollLeft;
      STATE.floatingSyncing = false;
    }, { passive: true });

    bar.addEventListener("scroll", () => {
      if (STATE.floatingSyncing) return;

      STATE.floatingSyncing = true;
      wrap.scrollLeft = bar.scrollLeft;
      STATE.floatingSyncing = false;
    }, { passive: true });

    window.addEventListener("resize", syncFloatingHorizontalBar, { passive: true });
    window.addEventListener("scroll", syncFloatingHorizontalBar, { passive: true });
  }

  function bindFilters() {
    $("#fRegional")?.addEventListener("change", applyFilters);
    $("#fFilial")?.addEventListener("change", applyFilters);
    $("#fContato")?.addEventListener("change", applyFilters);
    $("#fBusca")?.addEventListener("input", applyFilters);
  }

  function bindMoneyMask(inputEl) {
    if (!inputEl) return;

    inputEl.addEventListener("blur", () => {
      inputEl.value = normalizeMoneyInput(inputEl.value);
    });
  }

  function initUppercaseFields() {
    [
      MODAL.origem(), MODAL.coleta(), MODAL.destino(), MODAL.uf(),
      MODAL.descarga(), MODAL.produto(), MODAL.sat(), MODAL.obs()
    ].forEach((el) => {
      if (!el) return;

      el.addEventListener("input", () => {
        const start = el.selectionStart;
        const end = el.selectionEnd;

        el.value = upperKeepSpaces(el.value);

        if (start !== null && end !== null) {
          el.setSelectionRange(start, end);
        }
      });
    });
  }

  function initMasks() {
    bindMoneyMask(MODAL.empresa());
    bindMoneyMask(MODAL.motorista());
  }

  function bindButtons() {
    // Amarração direta dos botões principais
    $("#btnReloadFromSheets")?.addEventListener("click", atualizar);
    $("#btnNew")?.addEventListener("click", openNewModal);
    $("#btnCloseModal")?.addEventListener("click", closeModal);
    $("#btnCancel")?.addEventListener("click", closeModal);
    $("#btnSave")?.addEventListener("click", handleSave);
    $("#btnDivulgacaoFrete")?.addEventListener("click", openDivulgacaoFrete);

    // Segurança extra: captura por delegação.
    // Isso resolve casos de botão recriado, botão duplicado ou listener perdido.
    if (!document.body.dataset.nfFretesDelegatedClicks) {
      document.body.dataset.nfFretesDelegatedClicks = "1";

      document.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const id = btn.id || "";

        if (id === "btnSave") {
          e.preventDefault();
          e.stopPropagation();
          handleSave();
          return;
        }

        if (id === "btnCancel" || id === "btnCloseModal") {
          e.preventDefault();
          e.stopPropagation();
          closeModal();
          return;
        }

        if (id === "btnNew") {
          e.preventDefault();
          e.stopPropagation();
          openNewModal();
          return;
        }

        if (id === "btnReloadFromSheets") {
          e.preventDefault();
          e.stopPropagation();
          atualizar();
          return;
        }

        if (id === "btnDivulgacaoFrete") {
          e.preventDefault();
          e.stopPropagation();
          openDivulgacaoFrete();
        }
      });
    }

    MODAL.wrap()?.addEventListener("click", (e) => {
      if (STATE.modalBusy) return;
      if (e.target === MODAL.wrap()) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (STATE.modalBusy) {
          e.preventDefault();
          return;
        }
        closeModal();
      }
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

  function bindModoRaio() {
    document.getElementById("btnSelecionarTodosVisiveis")?.addEventListener("click", () => {
      const visible = getFilteredRows().filter((r) => safeText(r.id));
      const allSelected = visible.length && visible.every((r) => STATE.selectedIds.has(safeText(r.id)));

      visible.forEach((r) => {
        if (allSelected) STATE.selectedIds.delete(safeText(r.id));
        else STATE.selectedIds.add(safeText(r.id));
      });

      applyFilters();
      updateBulkUI();
    });

    document.getElementById("nfSelectAll")?.addEventListener("change", (e) => {
      const checked = e.target.checked;

      getFilteredRows().forEach((r) => {
        const id = safeText(r.id);
        if (!id) return;

        if (checked) STATE.selectedIds.add(id);
        else STATE.selectedIds.delete(id);
      });

      applyFilters();
      updateBulkUI();
    });

    document.getElementById("btnGerarPacoteJPG")?.addEventListener("click", gerarPacoteJPG);
    document.getElementById("btnEnviarWhatsAppPacote")?.addEventListener("click", enviarWhatsAppPacote);
    document.getElementById("nfBaixarJPG")?.addEventListener("click", () => downloadDivulgacaoJPG(STATE.previewRow || getFilteredRows()[0]));
    document.getElementById("nfCopiarImagem")?.addEventListener("click", () => copyPreviewImage(STATE.previewRow || getFilteredRows()[0]));
    document.getElementById("nfEnviarWhatsapp")?.addEventListener("click", () => {
      const row = STATE.previewRow || getFilteredRows()[0];
      if (row) enviarWhatsAppRow(row);
    });
    document.getElementById("nfCopiarMensagem")?.addEventListener("click", () => copyMessage(STATE.previewRow || getFilteredRows()[0]));
    document.getElementById("nfClosePreview")?.addEventListener("click", () => {
      const workspace = document.querySelector(".fretes-workspace");
      if (!workspace) return;

      workspace.classList.toggle("preview-hidden");

      document.body.classList.toggle(
        "preview-hidden",
        workspace.classList.contains("preview-hidden")
      );

      setTimeout(syncFloatingHorizontalBar, 80);
      setTimeout(syncFloatingHorizontalBar, 240);
    });
  }

  function init() {
    ensureFloatingHorizontalBar();
    fillModalSelectors();
    initUppercaseFields();
    initMasks();
    bindButtons();
    bindFilters();
    bindFloatingHorizontalBar();
    bindModoRaio();
    atualizar();

    setTimeout(syncFloatingHorizontalBar, 200);
    setTimeout(syncFloatingHorizontalBar, 600);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
