(function () {
  "use strict";

  // Produto -> imagem de fundo
  const PRODUCT_BG_MAP = {
    SOJA: "../assets/img/SOJATESTE.png",
    MILHO: "../assets/img/MILHOTESTE.png",
    "AÇÚCAR": "../assets/img/ACUCARTESTE.png",
    ACUCAR: "../assets/img/ACUCARTESTE.png",
    CALCÁRIO: "../assets/img/CALCARIOTESTE.png",
    CALCARIO: "../assets/img/CALCARIOTESTE.png"
  };

  // Filial -> contatos (4 linhas)
const FILIAIS_CONTATOS = {
  RIOVERDE: [
    "LUZIANO (64) 9xxxx-xxxx",
    "ARIEL (64) 9xxxx-xxxx",
    "NETO (64) 9xxxx-xxxx",
    "MARCIO (64) 9xxxx-xxxx"
  ],
  MONTIVIDIU: [
    "CONTATO 1 RV",
    "CONTATO 2 RV",
    "CONTATO 3 RV",
    "CONTATO 4 RV"
  ],
  JATAI: [
    "CONTATO 1 JT",
    "CONTATO 2 JT",
    "CONTATO 3 JT",
    "CONTATO 4 JT"
  ]
};
  const DEFAULT_BG = PRODUCT_BG_MAP.SOJA;

  function getPreview(templateId) {
    return document.querySelector(`[data-template-preview="${templateId}"]`);
  }

  function getBgImgEl(preview) {
    if (!preview) return null;
    return preview.querySelector(".previewBg");
  }

  function normalizeKey(v) {
    return String(v || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function productToImage(productValue) {
    const raw = String(productValue || "").trim().toUpperCase();
    const noAccent = normalizeKey(productValue);
    return PRODUCT_BG_MAP[raw] || PRODUCT_BG_MAP[noAccent] || "";
  }

  function setPreviewBackgroundByProduct(templateId, productValue) {
    const preview = getPreview(templateId);
    if (!preview) return;

    const img = productToImage(productValue) || DEFAULT_BG;

    // Preferência: trocar o SRC do <img class="previewBg">
    const bgImg = getBgImgEl(preview);
    if (bgImg) {
      bgImg.src = img;
      return;
    }

    // Fallback: background-image
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

    // Atualiza texto no preview
    updatePreview(templateId, field, value);

    // Troca fundo se mexer no produto
    if (field === "produto") {
      setPreviewBackgroundByProduct(templateId, value);

      // Se escolher a filial, autopreenche contatos do template 1
if (String(templateId) === "1" && field === "filial") {
  const lista = FILIAIS_CONTATOS[value] || ["", "", "", ""];

  // Preenche inputs
  ["contato1", "contato2", "contato3", "contato4"].forEach((cField, idx) => {
    const input = document.querySelector(
      `[data-template="1"][data-field="${cField}"]`
    );
    if (input) input.value = lista[idx] || "";

    // Atualiza preview
    updatePreview("1", cField, lista[idx] || "");
  });

  function resetTemplate(templateId) {
    const card = document.querySelector(`.templateCard[data-template="${templateId}"]`);
    if (!card) return;

    card.querySelectorAll("input, select").forEach((el) => {
      if (el.tagName === "SELECT") {
        el.selectedIndex = 0;
        // força update no preview também
        handleInput({ target: el });
      } else {
        el.value = "";
        if (el.dataset.field) updatePreview(templateId, el.dataset.field, "");
      }
    });

    // Fundo padrão
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
    document.querySelectorAll(`[data-template-preview]`).forEach((preview) => {
      const templateId = preview.getAttribute("data-template-preview");

      const produtoEl = document.querySelector(
        `[data-template="${templateId}"][data-field="produto"]`
      );

      // Só troca o fundo padrão (SOJA). Não força escrever "SOJA" no texto se estiver vazio.
      const produtoVal = produtoEl ? (produtoEl.value || "").trim() : "";
      setPreviewBackgroundByProduct(templateId, produtoVal || "SOJA");

      // Se o usuário já tinha algo no produto, reflete no preview.
      if (produtoVal) updatePreview(templateId, "produto", produtoVal);
    });
  }

  function bindActions() {
    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      const evt = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, handleInput);

      // aplica no load (para preencher o que já tiver)
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
