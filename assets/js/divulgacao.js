(function () {
  "use strict";

  /* =========================================
     PRODUTO 
  ========================================= */
  const PRODUCT_BG_MAP = {
    SOJA: "../assets/img/SOJATESTE.png",
    MILHO: "../assets/img/MILHOTESTE.png",
    ACUCAR: "../assets/img/ACUCARTESTE.png",
    CALCARIO: "../assets/img/CALCARIOTESTE.png",
    FARELODESOJA: "../assets/img/FARELODESOJA.png",
    SORGO: "../assets/img/SORGOTESTE.png",
    FERTILIZANTE: "../assets/img/FERTILIZANTE.png"
  };

  /* =========================================
     FILIAL -> CONTATOS 
     
  ========================================= */
  const FILIAIS_CONTATOS = {
    RIOVERDE: [
      "LUIS.G (64) 99277-4293",
      "MARÇAL (64) 99929-3431",
      "MARCIO (64) 99345-7740",
      "ARIEL (64) 99227-7537"
    ],
    MONTIVIDIU: [
      "ROBSON (64) 99962-8005",
      "MARCELO (64) 99653-2847",
      "--------------------",
      "--------------------"
    ],
    MINEIROS: [
      "KIEWERSON (64) 99979-4586",
      "VINICIUS (64) 99939-9946",
      "--------------------",
      "--------------------"
    ],
    INDIARA: [
      "RAFAEL P (64) 99910-8790",
      "RAFAEL (64) 99937-0131",
      "--------------------",
      "--------------------"
    ],
    FORMOSA: [
      "FABIOLA (62) 99601-7658",
      "JOAMAR (61) 99628-1922",
      "--------------------",
      "--------------------"
    ],
    CRISTALINA: [
      "EVERALDO (61) 99692-4906",
      "RAFAELA (61) 99319-6153",
      "--------------------",
      "--------------------"
    ],
    CATALAO: [
      "EVERALDO JR (64) 99237-3735",
      "--------------------",
      "--------------------",
      "--------------------"
    ],
    ANAPOLIS: [
      "SERGIO (64) 99266-9136",
      "ANDRE (64) 99995-0112",
      "LUCAS (62) 99318-9816",
      "--------------------"
    ],
    URUACU: [
      "GUILHERME (62) 9697-8707",
      "--------------------",
      "--------------------",
      "--------------------"
    ],
    ITUMBIARA: [
      "JEFERSON (64) 99263-5363",
      "NATAL (64) 99322-6440",
      "GUILHERME (64) 99217-7636",
      "MAYKON (64) 99254-4094"
    ],
    VIANOPOLIS: [
      "FHELLIPE (62) 99930-7778",
      "--------------------",
      "--------------------",
      "--------------------"
    ],
    CHAPEU: [
      "RICARDO (64) 99991-3512",
      "JONAS (64) 99607-2391",
      "--------------------",
      "--------------------"
    ],
    JATAI: [
      "TRIPA (64) 99982-9980",
      "HUDSON (64) 99906-2674",
      "PAULO (64) 99228-4439",
      "NATANAEL (64) 99333-6454"
    ]
  };

  const DEFAULT_BG = PRODUCT_BG_MAP.SOJA;

  /* =========================================
     HELPERS
  ========================================= */
  function getPreview(templateId) {
    return document.querySelector(`[data-template-preview="${templateId}"]`);
  }

  function getBgImgEl(preview) {
    return preview ? preview.querySelector(".previewBg") : null;
  }

  // Normaliza: remove acento, espaço, pontuação, vira UPPER
  function normalizeKey(v) {
    return String(v || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^A-Z0-9]/g, "");     // remove espaços e símbolos (/, -, etc)
  }

  function updatePreview(templateId, field, value) {
    const preview = getPreview(templateId);
    if (!preview) return;
    const target = preview.querySelector(`[data-bind="${field}"]`);
    if (target) target.textContent = value;
  }

  /* =========================================
     MOEDA (R$)
     5    -> R$ 5,00
     50   -> R$ 50,00
     500  -> R$ 500,00
     5,50 -> R$ 5,50
  ========================================= */
  function formatarMoedaBR(valor) {
    if (!valor) return "";

    let v = String(valor);

    // remove "R$" e espaços
    v = v.replace(/R\$\s?/gi, "");

    // troca ponto por vírgula (se usuário digitar 5.50)
    v = v.replace(/\./g, ",");

    // mantém apenas números e vírgula
    v = v.replace(/[^\d,]/g, "");

    const partes = v.split(",");
    let reais = partes[0] || "0";
    let centavos = partes[1] || "";

    // limita centavos em 2
    centavos = centavos.substring(0, 2);

    // completa centavos
    while (centavos.length < 2) centavos += "0";

    // remove zeros à esquerda
    reais = reais.replace(/^0+(?=\d)/, "");

    // separador de milhar
    reais = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    return `R$ ${reais || "0"},${centavos}`;
  }

  /* =========================================
     PRODUTO: TODAS AS VARIAÇÕES -> IMAGEM
  ========================================= */
  const PRODUCT_ALIAS = {
    // SOJA
    SOJA: "SOJA",
    SOJAEMGRAOS: "SOJA",
    SOJAEMGRAO: "SOJA",
    SOJAGRAOS: "SOJA",
    SOJAGRAO: "SOJA",
    SOJAGRANEL: "SOJA",

    // MILHO
    MILHO: "MILHO",
    MILHOEMGRAOS: "MILHO",
    MILHOEMGRAO: "MILHO",
    MILHOGRAOS: "MILHO",
    MILHOGRAO: "MILHO",
    MILHOGRANEL: "MILHO",

    // AÇÚCAR
    ACUCAR: "ACUCAR",
    ACUCARGRANEL: "ACUCAR",
    ACUCARVHP: "ACUCAR",
    ACUCARCRISTAL: "ACUCAR",

    // CALCÁRIO
    CALCARIO: "CALCARIO",
    CALCARIOGRANEL: "CALCARIO",

    // FARELO DE SOJA
    FARELODESOJA: "FARELODESOJA",
    FARELOSOJA: "FARELODESOJA",
    FARELODE_SOJA: "FARELODESOJA",

    // SORGO
    SORGO: "SORGO",
    SORGOGRANEL: "SORGO",
    SORGOEMGRAOS: "SORGO",
    SORGOEMGRAO: "SORGO",

    // FERTILIZANTE
    ADUBO: "FERTILIZANTE",
    ADUBOGRANEL: "FERTILIZANTE",
    FERTILIZANTE: "FERTILIZANTE",
    FERTILIZANTES: "FERTILIZANTE",
    FERT: "FERTILIZANTE"
  };

  function inferProductFamily(normalized) {
    if (normalized.includes("FARELO") && normalized.includes("SOJA")) return "FARELODESOJA";
    if (normalized.includes("FARELODESOJA")) return "FARELODESOJA";
    if (normalized.includes("SOJA")) return "SOJA";
    if (normalized.includes("MILHO")) return "MILHO";
    if (normalized.includes("ACUCAR")) return "ACUCAR";
    if (normalized.includes("CALCARIO")) return "CALCARIO";
    if (normalized.includes("SORGO")) return "SORGO";
    if (normalized.includes("FERT") || normalized.includes("ADUBO")) return "FERTILIZANTE";
    return "";
  }

  function productToImage(productValue) {
    const n = normalizeKey(productValue);

    // alias exato
    const aliased = PRODUCT_ALIAS[n];
    if (aliased && PRODUCT_BG_MAP[aliased]) return PRODUCT_BG_MAP[aliased];

    // inferência por "contém"
    const family = inferProductFamily(n);
    if (family && PRODUCT_BG_MAP[family]) return PRODUCT_BG_MAP[family];

    return DEFAULT_BG;
  }

  function setPreviewBackgroundByProduct(templateId, productValue) {
    const preview = getPreview(templateId);
    if (!preview) return;

    const img = productToImage(productValue);
    const bgImg = getBgImgEl(preview);

    if (bgImg) bgImg.src = img;
    else preview.style.backgroundImage = `url("${img}")`;
  }

  /* =========================================
     AUTOPREENCHER CONTATOS (FILIAL)
  ========================================= */
  function preencherContatosFilial(templateId, filialValue) {
    const key = normalizeKey(filialValue);
    const lista = FILIAIS_CONTATOS[key] || ["", "", "", ""];

    ["contato1", "contato2", "contato3", "contato4"].forEach((campo, i) => {
      const input = document.querySelector(
        `[data-template="${templateId}"][data-field="${campo}"]`
      );

      const valor = lista[i] || "";
      if (input) input.value = valor;

      updatePreview(templateId, campo, valor);
    });
  }

  /* =========================================
     INPUT HANDLER
  ========================================= */
  function handleInput(event) {
    const el = event.target;
    const templateId = el.dataset.template;
    const field = el.dataset.field;
    if (!templateId || !field) return;

    let value = (el.value || "").trim();

    // ✅ moeda no campo valor
    if (field === "valor") {
      value = formatarMoedaBR(value);
      el.value = value;
    }

    // Atualiza texto no preview
    updatePreview(templateId, field, value);

    // Produto troca fundo
    if (field === "produto") {
      setPreviewBackgroundByProduct(templateId, value);
    }

    // Filial preenche contatos (template 1)
    if (templateId === "1" && field === "filial") {
      preencherContatosFilial(templateId, value);
    }
  }

  /* =========================================
     RESET
  ========================================= */
  function resetTemplate(templateId) {
    const card = document.querySelector(`.templateCard[data-template="${templateId}"]`);
    if (!card) return;

    card.querySelectorAll("input, select").forEach((el) => {
      if (el.tagName === "SELECT") el.selectedIndex = 0;
      else el.value = "";

      if (el.dataset.field) updatePreview(templateId, el.dataset.field, "");
    });

    setPreviewBackgroundByProduct(templateId, "SOJA");
  }

  /* =========================================
     SALVAR JPG
  ========================================= */
  async function saveTemplate(templateId) {
    const preview = getPreview(templateId);
    if (!preview) return;

    // garante que a imagem carregou
    const bgImg = getBgImgEl(preview);
    if (bgImg && (!bgImg.complete || bgImg.naturalWidth === 0)) {
      await new Promise((resolve) => {
        bgImg.addEventListener("load", resolve, { once: true });
        bgImg.addEventListener("error", resolve, { once: true });
      });
    }

    const canvas = await html2canvas(preview, {
      backgroundColor: null,
      scale: 2,
      useCORS: true
    });

    const link = document.createElement("a");
    link.download = `divulgacao-modelo-${templateId}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  /* =========================================
     INIT
  ========================================= */
  function initDefaults() {
    document.querySelectorAll(`[data-template-preview]`).forEach((preview) => {
      const templateId = preview.dataset.templatePreview;

      // fundo inicial baseado no que já estiver no campo produto
      const produtoEl = document.querySelector(
        `[data-template="${templateId}"][data-field="produto"]`
      );
      const produtoVal = produtoEl ? (produtoEl.value || "").trim() : "";
      setPreviewBackgroundByProduct(templateId, produtoVal || "SOJA");

      // se já houver filial selecionada no template 1, já preenche contatos
      if (templateId === "1") {
        const filialEl = document.querySelector(`[data-template="1"][data-field="filial"]`);
        if (filialEl && filialEl.value) preencherContatosFilial("1", filialEl.value);
      }

      // formata valor se já tiver algo preenchido
      const valorEl = document.querySelector(
        `[data-template="${templateId}"][data-field="valor"]`
      );
      if (valorEl && valorEl.value) {
        const v = formatarMoedaBR(valorEl.value);
        valorEl.value = v;
        updatePreview(templateId, "valor", v);
      }
    });
  }

  function bindActions() {
    // listeners
    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      const evt = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, handleInput);
    });

    // botões
    document.querySelectorAll("[data-action='reset']").forEach((btn) => {
      btn.addEventListener("click", () => resetTemplate(btn.dataset.template));
    });

    document.querySelectorAll("[data-action='save']").forEach((btn) => {
      btn.addEventListener("click", () => saveTemplate(btn.dataset.template));
    });

    // ✅ sincroniza tudo ao carregar
    initDefaults();

    // ✅ aplica preview inicial (caso tenha valores já digitados)
    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      handleInput({ target: el });
    });
  }

  window.addEventListener("DOMContentLoaded", bindActions);
})();
