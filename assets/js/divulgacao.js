(function () {
  "use strict";

  /* =========================================
     PRODUTO -> IMAGEM
  ========================================= */
  const PRODUCT_BG_MAP = {
    SOJA: "../assets/img/SOJATESTE.png",
    MILHO: "../assets/img/MILHOTESTE.png",
    ACUCAR: "../assets/img/ACUCARTESTE.png",
    CALCARIO: "../assets/img/CALCARIOTESTE.png",
    FARELODESOJA: "../assets/img/FARELODESOJA.png"
  };

  /* =========================================
     FILIAL -> CONTATOS (4 linhas)
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
      "--------------------",
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

  // ✅ fundo padrão
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

  function normalizeKey(v) {
    return String(v || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/\s+/g, ""); // remove espaços
  }

  function updatePreview(templateId, field, value) {
    const preview = getPreview(templateId);
    if (!preview) return;
    const target = preview.querySelector(`[data-bind="${field}"]`);
    if (target) target.textContent = value;
  }

  /* =========================================
     FUNDO PELO PRODUTO
  ========================================= */
  function productToImage(productValue) {
    const key = normalizeKey(productValue); // SOJA/MILHO/ACUCAR/CALCARIO/FARELODESOJA
    return PRODUCT_BG_MAP[key] || DEFAULT_BG;
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

    const value = (el.value || "").trim();

    updatePreview(templateId, field, value);

    if (field === "produto") {
      setPreviewBackgroundByProduct(templateId, value);
    }

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

      setPreviewBackgroundByProduct(templateId, "SOJA");

      // se já tiver filial selecionada (template 1), já preenche
      if (templateId === "1") {
        const filialEl = document.querySelector(`[data-template="1"][data-field="filial"]`);
        if (filialEl && filialEl.value) preencherContatosFilial("1", filialEl.value);
      }

      // se já tiver produto preenchido, aplica fundo correto
      const produtoEl = document.querySelector(
        `[data-template="${templateId}"][data-field="produto"]`
      );
      if (produtoEl && produtoEl.value) {
        setPreviewBackgroundByProduct(templateId, produtoEl.value);
      }
    });
  }

  function bindActions() {
    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      const evt = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, handleInput);
    });

    document.querySelectorAll("[data-action='reset']").forEach((btn) => {
      btn.addEventListener("click", () => resetTemplate(btn.dataset.template));
    });

    document.querySelectorAll("[data-action='save']").forEach((btn) => {
      btn.addEventListener("click", () => saveTemplate(btn.dataset.template));
    });

    initDefaults();
  }

  window.addEventListener("DOMContentLoaded", bindActions);
})();
