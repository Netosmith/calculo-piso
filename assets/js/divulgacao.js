(function () {
  "use strict";

  function updatePreview(templateId, field, value) {
    const preview = document.querySelector(`[data-template-preview="${templateId}"]`);
    if (!preview) return;
    const target = preview.querySelector(`[data-bind="${field}"]`);
    if (!target) return;
    target.textContent = value;
  }

  function handleInput(event) {
    const input = event.target;
    const templateId = input.dataset.template;
    const field = input.dataset.field;
    if (!templateId || !field) return;
    updatePreview(templateId, field, input.value.trim());
  }

  function resetTemplate(templateId) {
    const inputs = document.querySelectorAll(`.templateCard[data-template="${templateId}"] input`);
    inputs.forEach((input) => {
      input.value = "";
      if (input.dataset.field) {
        updatePreview(templateId, input.dataset.field, "");
      }
    });
  }

  async function saveTemplate(templateId) {
    const preview = document.querySelector(`[data-template-preview="${templateId}"]`);
    if (!preview) return;

    const canvas = await html2canvas(preview, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.download = `divulgacao-modelo-${templateId}-${stamp}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  function bindActions() {
    document.querySelectorAll("input[data-template][data-field]").forEach((input) => {
      input.addEventListener("input", handleInput);
    });

    document.querySelectorAll("[data-action='reset']").forEach((button) => {
      button.addEventListener("click", () => resetTemplate(button.dataset.template));
    });

    document.querySelectorAll("[data-action='save']").forEach((button) => {
      button.addEventListener("click", () => saveTemplate(button.dataset.template));
    });
  }

  window.addEventListener("DOMContentLoaded", bindActions);
})();
