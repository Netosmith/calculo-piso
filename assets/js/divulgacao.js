(function () {
  "use strict";

  /***********************
   * CONFIG (imagens do GitHub)
   ***********************/
  const BG_BY_PRODUCT = {
    SOJA: "../assets/img/SOJATESTE.png",
    MILHO: "../assets/img/MILHOTESTE.png",
    ACUCAR: "../assets/img/ACUCARTESTE.png",
    AÇÚCAR: "../assets/img/ACUCARTESTE.png",
    CALCARIO: "../assets/img/CALCARIOTESTE.png",
    CALCÁRIO: "../assets/img/CALCARIOTESTE.png"
  };

  const DEFAULT_BG = "../assets/img/SOJATESTE.png";

  /***********************
   * HELPERS
   ***********************/
  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  // permite \n virar quebra de linha no preview
  function setTextWithBreaks(el, text) {
    const v = safeText(text);
    // mantém placeholder se estiver vazio (se seu CSS usa :empty::before)
    if (!v) {
      el.textContent = "";
      return;
    }
    // quebra de linha real
    if (v.includes("\n")) {
      el.innerHTML = "";
      v.split("\n").forEach((line, i) => {
        if (i > 0) el.appendChild(document.createElement("br"));
        el.appendChild(document.createTextNode(line));
      });
    } else {
      el.textContent = v;
    }
  }

  function normalizeKey(text) {
    return safeText(text)
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // remove acentos
  }

  /***********************
   * PREVIEW BIND
   ***********************/
  function updatePreview(templateId, field, value) {
    const preview = qs(`[data-template-preview="${templateId}"]`);
    if (!preview) return;

    const target = qs(`[data-bind="${field}"]`, preview);
    if (!target) return;

    setTextWithBreaks(target, value);
  }

  function setPreviewBackground(templateId, productValue) {
    const preview = qs(`[data-template-preview="${templateId}"]`);
    if (!preview) return;

    const img = qs(".previewBg", preview);
    if (!img) return;

    const key = normalizeKey(productValue);
    const url = BG_BY_PRODUCT[key] || DEFAULT_BG;

    // troca a imagem do modelo
    img.src = url;
  }

  /***********************
   * INPUT HANDLING
   ***********************/
  function handleInput(event) {
    const input = event.target;

    const templateId = input.dataset.template;
    const field = input.dataset.field;
    if (!templateId || !field) return;

    const value = safeText(input.value);

    // Se o campo for "produto", já troca o fundo
    if (normalizeKey(field) === "PRODUTO") {
      setPreviewBackground(templateId, value);
    }

    // Atualiza o bind padrão
    updatePreview(templateId, field, value);

    // ✅ Opcional: se você tiver campos separados para Coleta:
    // cidadeColeta + localColeta -> monta:
    // "-INDIARA-GO\nFaz Ouro Branco"
    // Basta usar data-field="coletaCidade" e data-field="coletaLocal"
    // e no preview usar data-bind="coletaFinal"
    const f = normalizeKey(field);
    if (f === "COLETACIDADE" || f === "COLETALOCAL") {
      applyComposite(templateId, "COLETA");
    }
    if (f === "DESCARGACIDADE" || f === "DESCARGALOCAL") {
      applyComposite(templateId, "DESCARGA");
    }
  }

  function applyComposite(templateId, type) {
    // lê inputs do card
    const card = qs(`.templateCard[data-template="${templateId}"]`);
    if (!card) return;

    if (type === "COLETA") {
      const cidade = safeText(qs(`input[data-template="${templateId}"][data-field="coletaCidade"]`, card)?.value);
      const local = safeText(qs(`input[data-template="${templateId}"][data-field="coletaLocal"]`, card)?.value);

      const composed = [
        cidade ? `-${cidade}` : "",
        local ? `${local}` : ""
      ].filter(Boolean).join("\n");

      updatePreview(templateId, "coletaFinal", composed);
    }

    if (type === "DESCARGA") {
      const cidade = safeText(qs(`input[data-template="${templateId}"][data-field="descargaCidade"]`, card)?.value);
      const local = safeText(qs(`input[data-template="${templateId}"][data-field="descargaLocal"]`, card)?.value);

      const composed = [
        cidade ? `-${cidade}` : "",
        local ? `${local}` : ""
      ].filter(Boolean).join("\n");

      updatePreview(templateId, "descargaFinal", composed);
    }
  }

  /***********************
   * RESET / SAVE
   ***********************/
  function resetTemplate(templateId) {
    const card = qs(`.templateCard[data-template="${templateId}"]`);
    if (!card) return;

    // limpa inputs
    qsa("input[data-template][data-field]", card).forEach((input) => {
      input.value = "";
      if (input.dataset.field) {
        updatePreview(templateId, input.dataset.field, "");
      }
    });

    // limpa binds compostos se existirem
    updatePreview(templateId, "coletaFinal", "");
    updatePreview(templateId, "descargaFinal", "");

    // volta fundo default
    setPreviewBackground(templateId, "");
  }

  async function saveTemplate(templateId) {
    const preview = qs(`[data-template-preview="${templateId}"]`);
    if (!preview) return;

    // dica: se o preview tiver imagem, garante que carregou
    const bgImg = qs(".previewBg", preview);
    if (bgImg && !bgImg.complete) {
      await new Promise((res) => {
        bgImg.addEventListener("load", res, { once: true });
        bgImg.addEventListener("error", res, { once: true });
      });
    }

    // captura com o fundo do modelo (não forçar branco)
    const canvas = await html2canvas(preview, {
      backgroundColor: null,
      scale: 2,
      useCORS: true
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.download = `divulgacao-modelo-${templateId}-${stamp}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  /***********************
   * BIND
   ***********************/
  function bindActions() {
    // inputs que atualizam preview
    qsa("input[data-template][data-field]").forEach((input) => {
      input.addEventListener("input", handleInput);
    });

    // reset
    qsa("[data-action='reset']").forEach((button) => {
      button.addEventListener("click", () => resetTemplate(button.dataset.template));
    });

    // save
    qsa("[data-action='save']").forEach((button) => {
      button.addEventListener("click", () => saveTemplate(button.dataset.template));
    });

    // inicializa fundo default em todos previews
    qsa("[data-template-preview]").forEach((pv) => {
      const templateId = pv.getAttribute("data-template-preview");
      setPreviewBackground(templateId, "");
    });
  }

  window.addEventListener("DOMContentLoaded", bindActions);
})();
