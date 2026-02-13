(function () {
  "use strict";

  // Mapa do seletor Produto -> imagem de fundo
  const PRODUCT_BG_MAP = {
    SOJA: "../assets/img/SOJATESTE.png",
    MILHO: "../assets/img/MILHOTESTE.png",
    "AÇÚCAR": "../assets/img/ACUCARTESTE.png",
    ACUCAR: "../assets/img/ACUCARTESTE.png",
    CALCÁRIO: "../assets/img/CALCARIOTESTE.png",
    CALCARIO: "../assets/img/CALCARIOTESTE.png"
  };

  const DEFAULT_BG = PRODUCT_BG_MAP.SOJA;

  function getPreview(templateId) {
    return document.querySelector(`[data-template-preview="${templateId}"]`);
  }

  function getBgImgEl(preview) {
    if (!preview) return null;
    return preview.querySelector(".previewBg");
  }

  function normalizeProductKey(v) {
    return String(v || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // remove acentos (AÇÚCAR -> ACUCAR)
  }

  function productToImage(productValue) {
    const raw = String(productValue || "").trim().toUpperCase();
    const noAccent = normalizeProductKey(productValue);

    // tenta nas 2 formas
    return PRODUCT_BG_MAP[raw] || PRODUCT_BG_MAP[noAccent] || "";
  }

  function setPreviewBackgroundByProduct(templateId, productValue) {
    const preview = getPreview(templateId);
    if (!preview) return;

    const img = productToImage(productValue) || DEFAULT_BG;

    // ✅ Seu HTML usa <img class="previewBg">, então troca o SRC
    const bgImg = getBgImgEl(preview);
    if (bgImg) {
      bgImg.src = img;
      return;
    }

    // fallback: se algum template não tiver <img>, usa background CSS
    preview.style.backgroundImage = `url("${img}")`;
  }

  function updatePreview(templateId, field, value) {
    const preview = getPreview(templateId);
    if (!preview) return;

    const target = preview.querySelector(`[data-bind="${field}"]`);
    if (!target) return;

    target.textContent = value;
  }

  function handleInput(event) {
    const el = event && event.target ? event.target : null;
    if (!el) return;

    const templateId = el.dataset.template;
    const field = el.dataset.field;
    if (!templateId || !field) return;

    const value = (el.value || "").trim();

    // Atualiza texto no preview (inclui contatos 1..4)
    updatePreview(templateId, field, value);

    // Troca fundo quando mexer no produto (template 1, 2 e 3 se quiser)
    if (field === "produto") {
      setPreviewBackgroundByProduct(templateId, value);
    }
  }

  function resetTemplate(templateId) {
    const card = document.querySelector(`.templateCard[data-template="${templateId}"]`);
    if (!card) return;

    // limpa inputs e selects
    card.querySelectorAll("input, select").forEach((el) => {
      if (el.tagName === "SELECT") {
        el.selectedIndex = 0;
      } else {
        el.value = "";
      }

      if (el.dataset.field) {
        updatePreview(templateId, el.dataset.field, "");
      }
    });

    // volta fundo padrão
    setPreviewBackgroundByProduct(templateId, "SOJA");
  }

  async function saveTemplate(templateId) {
    const preview = getPreview(templateId);
    if (!preview) return;

    const canvas = await html2canvas(preview, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.download = `divulgacao-modelo-${templateId}-${stamp}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  function initDefaults() {
    // fundo inicial para todos os previews que tiverem produto
    document.querySelectorAll(`[data-template-preview]`).forEach((preview) => {
      const templateId = preview.getAttribute("data-template-preview");

      // tenta achar o campo produto no formulário
      const produtoEl = document.querySelector(
        `[data-template="${templateId}"][data-field="produto"]`
      );

      const produtoVal = produtoEl ? (produtoEl.value || "SOJA").trim() : "SOJA";
      setPreviewBackgroundByProduct(templateId, produtoVal);

      // garante atualização do preview do produto (se existir bind)
      updatePreview(templateId, "produto", produtoVal);
    });
  }

  function bindActions() {
    // inputs e selects com data-template + data-field
    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      const evt = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, handleInput);

      // já atualiza preview na carga
      handleInput({ target: el });
    });

    document.querySelectorAll("[data-action='reset']").forEach((button) => {
      button.addEventListener("click", () => resetTemplate(button.dataset.template));
    });

    document.querySelectorAll("[data-action='save']").forEach((button) => {
      button.addEventListener("click", () => saveTemplate(button.dataset.template));
    });

    initDefaults();
  }

  window.addEventListener("DOMContentLoaded", bindActions);
})();
