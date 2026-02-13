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

  function getPreview(templateId) {
    return document.querySelector(`[data-template-preview="${templateId}"]`);
  }

  function updatePreview(templateId, field, value) {
    const preview = getPreview(templateId);
    if (!preview) return;

    const target = preview.querySelector(`[data-bind="${field}"]`);
    if (!target) return;

    target.textContent = value;
  }

  function setPreviewBackgroundByProduct(templateId, productValue) {
    const preview = getPreview(templateId);
    if (!preview) return;

    const key = String(productValue || "").trim().toUpperCase();
    const img = PRODUCT_BG_MAP[key];

    // Se não bater com nenhum item do mapa, não altera o fundo
    if (!img) return;

    preview.style.backgroundImage = `url("${img}")`;
  }

  function handleInput(event) {
    const el = event.target;
    const templateId = el.dataset.template;
    const field = el.dataset.field;
    if (!templateId || !field) return;

    const value = (el.value || "").trim();

    // Atualiza texto no preview
    updatePreview(templateId, field, value);

    // Se for o campo produto do template 1: troca o fundo
    if (String(templateId) === "1" && field === "produto") {
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
        // dispara atualização (pra refletir no preview e trocar fundo)
        handleInput({ target: el });
      } else {
        el.value = "";
        if (el.dataset.field) updatePreview(templateId, el.dataset.field, "");
      }
    });

    // Se for template 1, volta para fundo padrão (SOJA)
    if (String(templateId) === "1") {
      const preview = getPreview(templateId);
      if (preview) preview.style.backgroundImage = `url("${PRODUCT_BG_MAP.SOJA}")`;
    }
  }

  async function saveTemplate(templateId) {
    const preview = getPreview(templateId);
    if (!preview) return;

    // html2canvas pega o elemento já com background inline (ou CSS)
    const canvas = await html2canvas(preview, {
      backgroundColor: null, // mantém transparência/visual do preview
      scale: 2,
      useCORS: true
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.download = `divulgacao-modelo-${templateId}-${stamp}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  function initTemplate1Defaults() {
    // Seta fundo inicial do modelo 1 como SOJA
    const preview1 = getPreview("1");
    if (preview1) {
      preview1.style.backgroundImage = `url("${PRODUCT_BG_MAP.SOJA}")`;
    }

    // Se o select de produto existir, garante o evento e o fundo inicial coerente
    const sel = document.querySelector(`select[data-template="1"][data-field="produto"]`);
    if (sel) {
      const val = (sel.value || "SOJA").trim();
      setPreviewBackgroundByProduct("1", val);
      updatePreview("1", "produto", val);
    }
  }

  function bindActions() {
    // inputs e selects com data-template + data-field
    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      const evt = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, handleInput);

      // já atualiza preview na carga (útil pra selects)
      handleInput({ target: el });
    });

    document.querySelectorAll("[data-action='reset']").forEach((button) => {
      button.addEventListener("click", () => resetTemplate(button.dataset.template));
    });

    document.querySelectorAll("[data-action='save']").forEach((button) => {
      button.addEventListener("click", () => saveTemplate(button.dataset.template));
    });

    initTemplate1Defaults();
  }

  window.addEventListener("DOMContentLoaded", bindActions);
})();
