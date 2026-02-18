(function () {
  "use strict";

  const PRODUCT_BG_MAP = {
    SOJA: "../assets/img/SOJATESTE.png",
    MILHO: "../assets/img/MILHOTESTE.png",
    ACUCAR: "../assets/img/ACUCARTESTE.png",
    CALCARIO: "../assets/img/CALCARIOTESTE.png",
    FARELODESOJA: "../assets/img/FARELODESOJA.png",
    SORGO: "../assets/img/SORGOTESTE.png",
    FERTILIZANTE: "../assets/img/FERTILIZANTE.png"
  };

  const FILIAIS_CONTATOS = {
    RIOVERDE: [
      "LUIS.G (64) 99277-4293",
      "MARÇAL (64) 99929-3431",
      "MARCIO (64) 99345-7740",
      "ARIEL (64) 99227-7537"
    ],
    FERTILIZANTE: [
      "NARCISO (64) 99936-5343",
      "NIVAIR (64) 99284-4955",
      "--------------------",
      "--------------------"
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
    ARAGUARI: [
      "RAFINHA (34) 99155-9742",
      "GUSTAVO (34) 99959-6731",
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
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "");
  }

  function updatePreview(templateId, field, value) {
    const preview = getPreview(templateId);
    if (!preview) return;
    const target = preview.querySelector(`[data-bind="${field}"]`);
    if (target) target.textContent = value;
  }

  /* =========================
     VALOR: aceita número OU texto
     - sempre MAIÚSCULO
     - se for número -> formata moeda no BLUR
     - se for texto -> não formata
  ========================= */

  function hasLetters(s) {
    return /[A-ZÀ-Ü]/i.test(String(s || ""));
  }

  function limparDigitacaoNumerica(valor) {
    if (valor == null) return "";
    let v = String(valor);
    v = v.replace(/R\$\s?/gi, "");
    // deixa só números e separadores
    v = v.replace(/[^\d,\.]/g, "");
    // se tiver ponto e vírgula, mantém só um separador decimal (preferindo vírgula no final)
    // regra simples: permite só 1 separador decimal (último separador vira o decimal)
    const parts = v.split(/[,\.]/);
    if (parts.length <= 1) return v;

    const dec = parts.pop() || "";
    const intPart = parts.join(""); // junta o resto como inteiro (remove separadores antigos)
    return intPart + "," + dec;
  }

  function formatarMoedaBR(valor) {
    if (valor == null) return "";

    let v = String(valor).trim();
    if (!v) return "";

    // se tiver letras, não é moeda
    if (hasLetters(v)) return v.toUpperCase();

    v = v.replace(/R\$\s?/gi, "");
    v = v.replace(/\./g, "");
    v = v.replace(/[^\d,]/g, "");

    const partes = v.split(",");
    let reais = partes[0] || "0";
    let centavos = partes[1] || "";

    centavos = centavos.substring(0, 2);
    while (centavos.length < 2) centavos += "0";

    reais = reais.replace(/^0+(?=\d)/, "");
    reais = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    return `R$ ${reais || "0"},${centavos}`;
  }

  /* =========================
     PRODUTO: aliases / inferência
  ========================= */
  const PRODUCT_ALIAS = {
    SOJA: "SOJA",
    SOJAEMGRAOS: "SOJA",
    SOJAEMGRAO: "SOJA",
    SOJAGRAOS: "SOJA",
    SOJAGRANEL: "SOJA",

    MILHO: "MILHO",
    MILHOEMGRAOS: "MILHO",
    MILHOEMGRAO: "MILHO",
    MILHOGRAOS: "MILHO",
    MILHOGRANEL: "MILHO",

    ACUCAR: "ACUCAR",
    ACUCARGRANEL: "ACUCAR",
    ACUCARVHP: "ACUCAR",
    ACUCARCRISTAL: "ACUCAR",

    CALCARIO: "CALCARIO",
    CALCARIOGRANEL: "CALCARIO",

    FARELODESOJA: "FARELODESOJA",
    FARELOSOJA: "FARELODESOJA",

    SORGO: "SORGO",
    SORGOEMGRAOS: "SORGO",
    SORGOGRANEL: "SORGO",

    ADUBO: "FERTILIZANTE",
    FERTILIZANTE: "FERTILIZANTE",
    FERTILIZANTES: "FERTILIZANTE",
    FERT: "FERTILIZANTE"
  };

  function inferProductFamily(normalized) {
    if (normalized.includes("FARELO") && normalized.includes("SOJA")) return "FARELODESOJA";
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
    const aliased = PRODUCT_ALIAS[n];
    if (aliased && PRODUCT_BG_MAP[aliased]) return PRODUCT_BG_MAP[aliased];

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

  /* =========================
     FILIAL -> CONTATOS
  ========================= */
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

  /* =========================
     INPUT HANDLER
  ========================= */
  function handleInput(event) {
    const el = event.target;
    const templateId = el.dataset.template;
    const field = el.dataset.field;
    if (!templateId || !field) return;

    let value = el.value ?? "";

    // ✅ VALOR: aceita TEXTO também + MAIÚSCULO sempre
    if (field === "valor") {
      let v = String(value).toUpperCase();

      // se for só número/separador, limpa sem formatar moeda (pra digitar livre)
      if (!hasLetters(v)) {
        v = limparDigitacaoNumerica(v);
      }

      el.value = v;
      updatePreview(templateId, "valor", v);
      return;
    }

    // Demais campos: só trim e atualiza
    value = String(value).trim();
    updatePreview(templateId, field, value);

    if (field === "produto") {
      setPreviewBackgroundByProduct(templateId, value);
    }

    if (templateId === "1" && field === "filial") {
      preencherContatosFilial(templateId, value);
    }
  }

  // ✅ Ao sair do campo valor: se for número, vira moeda; se for texto, só mantém maiúsculo
  function handleBlur(event) {
    const el = event.target;
    const templateId = el.dataset.template;
    const field = el.dataset.field;
    if (!templateId || field !== "valor") return;

    const raw = String(el.value || "").toUpperCase().trim();
    const finalValue = formatarMoedaBR(raw); // se tiver letras, não formata
    el.value = finalValue;
    updatePreview(templateId, "valor", finalValue);
  }

  /* =========================
     RESET / SAVE
  ========================= */
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

  /* =========================
     INIT
  ========================= */
  function initDefaults() {
    document.querySelectorAll(`[data-template-preview]`).forEach((preview) => {
      const templateId = preview.dataset.templatePreview;

      const produtoEl = document.querySelector(
        `[data-template="${templateId}"][data-field="produto"]`
      );
      const produtoVal = produtoEl ? (produtoEl.value || "").trim() : "";
      setPreviewBackgroundByProduct(templateId, produtoVal || "SOJA");

      if (templateId === "1") {
        const filialEl = document.querySelector(`[data-template="1"][data-field="filial"]`);
        if (filialEl && filialEl.value) preencherContatosFilial("1", filialEl.value);
      }

      const valorEl = document.querySelector(
        `[data-template="${templateId}"][data-field="valor"]`
      );
      if (valorEl && valorEl.value) {
        // formata só se for número; se for texto, fica maiúsculo
        const raw = String(valorEl.value || "").toUpperCase().trim();
        const v = formatarMoedaBR(raw);
        valorEl.value = v;
        updatePreview(templateId, "valor", v);
      }
    });
  }

  function bindActions() {
    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      const evt = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, handleInput);

      if (el.dataset.field === "valor") {
        el.addEventListener("blur", handleBlur);
      }
    });

    document.querySelectorAll("[data-action='reset']").forEach((btn) => {
      btn.addEventListener("click", () => resetTemplate(btn.dataset.template));
    });

    document.querySelectorAll("[data-action='save']").forEach((btn) => {
      btn.addEventListener("click", () => saveTemplate(btn.dataset.template));
    });

    initDefaults();

    // sincroniza preview com o que já estiver preenchido
    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      handleInput({ target: el });
      if (el.dataset.field === "valor") handleBlur({ target: el });
    });
  }

  window.addEventListener("DOMContentLoaded", bindActions);
})();
