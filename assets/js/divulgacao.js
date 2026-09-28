/* divulgacao.js | NOVA-FROTA */
(function () {
  "use strict";

  const PRODUCT_BG_MAP = {
    "1": {
      SOJA: "../assets/img/SOJATESTE.png",
      MILHO: "../assets/img/MILHOTESTE.png",
      ACUCAR: "../assets/img/ACUCARTESTE.png",
      CALCARIO: "../assets/img/CALCARIOTESTE.png",
      FARELODESOJA: "../assets/img/FARELODESOJA.png",
      SORGO: "../assets/img/SORGOTESTE.png",
      FERTILIZANTE: "../assets/img/FERTILIZANTE.png"
    },

    "2": {
      SOJA: "../assets/img/SOJA2.png",
      MILHO: "../assets/img/MILHO2.png",
      ACUCAR: "../assets/img/ACUCAR2.png",
      CALCARIO: "../assets/img/CALCARIO2.png",
      FARELODESOJA: "../assets/img/FARELODESOJA2.png",
      SORGO: "../assets/img/SORGO2.png",
      SEMENTE: "../assets/img/SEMENTE.png",
      FERTILIZANTE: "../assets/img/FERTILIZANTE2.png"
    }
  };

  const FILIAIS_CONTATOS = {
    RIOVERDE: [
      "RICARDO (64) 9999-3512",
      "GUSTAVO (64) 99207-8772",
      "UANDER (64) 98114-4642",
      "NIVAIR (64) 99284-4955"
    ],
    FERTILIZANTE: [
      "--------------------",
      "NIVAIR (64) 99284-4955",
      "--------------------",
      "--------------------"
    ],
    MESAOPERACIONAL: [
      "ELOISA (64) 99232-3415",
      "GABRIEL (64) 99266-3603",
      "LUIS.G (64) 99277-4293",
      ""
    ],
    BOMJESUS: [
      "MATEUS (64) 99307-0738",
      "EDUARDO (64) 99208-5655",
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
      "JESSICA (61) 99242-7127",
      "--------------------",
      "--------------------"
    ],
    CGOMG: [
      "--------------------",
      "--------------------",
      "--------------------",
      "--------------------"
    ],
    ANAPOLIS: [
      "DANILO (62) 99315-5713",
      "EDVALDO (64) 98461-4152",
      "DANIEL (62) 99315-1675",
      "--------------------"
    ],
    URUACU: [
      "GUILHERME (62) 99697-8707",
      "--------------------",
      "--------------------",
      "--------------------"
    ],
    SAOPAULO: [
      "DIOGO (15) 99278-4842",
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
      "FERNANDO (62) 99930-7778",
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
      "GUILHERME (64) 99217-7636",
      "ADRIELLY (34) 99156-6198",
      "--------------------",
      "--------------------"
    ],
    JATAI: [
      "TRIPA (64) 99982-9980",
      "HUDSON (64) 99906-2674",
      "RONE (64) 99626-4511",
       "---------------------"
    ]
  };

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

    SEMENTEDESOJA: "SEMENTE",
    SEMENTE: "SEMENTE",
    SEMENTEDEMILHO: "SEMENTE",   
    
    ADUBO: "FERTILIZANTE",
    FERTILIZANTE: "FERTILIZANTE",
    FERTILIZANTES: "FERTILIZANTE",
    FERT: "FERTILIZANTE"
  };

  function getPreview(templateId) {
    return document.querySelector(`[data-template-preview="${templateId}"]`);
  }

  function getBgImgEl(preview) {
    return preview ? preview.querySelector(".previewBg") : null;
  }

  function getTemplateMap(templateId) {
    return PRODUCT_BG_MAP[String(templateId)] || PRODUCT_BG_MAP["1"];
  }

  function getDefaultBg(templateId) {
    const map = getTemplateMap(templateId);
    return map.SOJA;
  }

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "");
  }

  function fitModel3Text(target) {
    if (!target || !target.hasAttribute("data-fit")) return;

    const max = Number(target.dataset.fitMax || 40);
    const min = Number(target.dataset.fitMin || Math.max(16, max * 0.55));
    const lines = Math.max(1, Number(target.dataset.fitLines || 1));
    let size = max;

    target.style.fontSize = max + "px";
    target.style.letterSpacing = "";
    target.style.whiteSpace = lines === 1 ? "nowrap" : "normal";
    target.style.wordBreak = "normal";
    target.style.overflowWrap = "normal";
    target.style.textOverflow = "clip";

    let guard = 0;
    while (
      size > min &&
      guard < 140 &&
      (target.scrollWidth > target.clientWidth + 1 ||
       target.scrollHeight > target.clientHeight + 1)
    ) {
      size -= 1;
      target.style.fontSize = size + "px";
      guard += 1;
    }

    // Último ajuste para nomes muito largos sem quebrar o padrão visual.
    if (
      lines === 1 &&
      (target.scrollWidth > target.clientWidth + 1 ||
       target.scrollHeight > target.clientHeight + 1)
    ) {
      target.style.letterSpacing = "-0.8px";
    }
  }

  function fitModel3(preview) {
    if (!preview) return;
    window.requestAnimationFrame(() => {
      preview.querySelectorAll("[data-fit]").forEach(fitModel3Text);
    });
  }

  function updatePreview(templateId, field, value) {
    const preview = getPreview(templateId);
    if (!preview) return;

    const target = preview.querySelector(`[data-bind="${field}"]`);
    if (!target) return;

    target.textContent = value || "";

    if (String(templateId) === "2") {
      ajustarFonteModelo2(target, field, value || "");
    } else if (String(templateId) === "3") {
      fitModel3Text(target);
    }
  }

  function ajustarFonteModelo2(target, field, value) {
    const len = String(value || "").trim().length;

    target.style.fontSize = "";

    if (field === "coletaCidade" || field === "descargaCidade") {
      if (len >= 24) target.style.fontSize = "clamp(8px,1.20vw,18px)";
      else if (len >= 19) target.style.fontSize = "clamp(8.5px,1.35vw,20px)";
      return;
    }

    if (field === "coletaLocal" || field === "descargaLocal") {
      if (len >= 28) target.style.fontSize = "clamp(6px,.78vw,12px)";
      else if (len >= 22) target.style.fontSize = "clamp(6.5px,.90vw,13px)";
      return;
    }

    if (
      field === "contato1" ||
      field === "contato2" ||
      field === "contato3" ||
      field === "contato4"
    ) {
      if (len >= 26) target.style.fontSize = "clamp(4.8px,.62vw,9.5px)";
      else if (len >= 22) target.style.fontSize = "clamp(5px,.66vw,10px)";
      return;
    }

    if (field === "filial" && len >= 16) {
      target.style.fontSize = "clamp(5.5px,.72vw,11px)";
    }
  }

  function hasLetters(value) {
    return /[A-ZÀ-Ü]/i.test(String(value || ""));
  }

  function limparDigitacaoNumerica(valor) {
    if (valor == null) return "";

    let v = String(valor);
    v = v.replace(/R\$\s?/gi, "");
    v = v.replace(/[^\d,.]/g, "");

    const parts = v.split(/[,.]/);
    if (parts.length <= 1) return v;

    const dec = parts.pop() || "";
    const intPart = parts.join("");

    return intPart + "," + dec;
  }

  function formatarMoedaBR(valor) {
    if (valor == null) return "";

    let v = String(valor).trim();
    if (!v) return "";

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

  function inferProductFamily(normalized) {
    if (normalized.includes("FARELO") && normalized.includes("SOJA")) {
      return "FARELODESOJA";
    }

    if (normalized.includes("SOJA")) return "SOJA";
    if (normalized.includes("MILHO")) return "MILHO";
    if (normalized.includes("ACUCAR")) return "ACUCAR";
    if (normalized.includes("CALCARIO")) return "CALCARIO";
    if (normalized.includes("SORGO")) return "SORGO";

    if (normalized.includes("FERT") || normalized.includes("ADUBO")) {
      return "FERTILIZANTE";
    }

    return "";
  }

  function productToImage(templateId, productValue) {
    const map = getTemplateMap(templateId);
    const normalized = normalizeKey(productValue);
    const aliased = PRODUCT_ALIAS[normalized];

    if (aliased && map[aliased]) return map[aliased];

    const family = inferProductFamily(normalized);
    if (family && map[family]) return map[family];

    return getDefaultBg(templateId);
  }

  function setPreviewBackgroundByProduct(templateId, productValue) {
    const preview = getPreview(templateId);
    if (!preview) return;

    if (String(templateId) === "3") {
      fitModel3(preview);
      return;
    }

    const img = productToImage(templateId, productValue);
    const bgImg = getBgImgEl(preview);

    if (bgImg) {
      bgImg.src = img;
    } else {
      preview.style.backgroundImage = `url("${img}")`;
    }
  }

  let CADASTRO_CONTATOS_CACHE = null;
  let CADASTRO_CONTATOS_PROMISE = null;

  function rowsFromCadastro(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
  }

  function telefoneFormatado(value) {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\D/g, "");

    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return raw;
  }

  async function carregarContatosCadastro() {
    if (Array.isArray(CADASTRO_CONTATOS_CACHE)) {
      return CADASTRO_CONTATOS_CACHE;
    }

    if (CADASTRO_CONTATOS_PROMISE) {
      return CADASTRO_CONTATOS_PROMISE;
    }

    CADASTRO_CONTATOS_PROMISE = (async () => {
      try {
        if (!window.PortalAPI && typeof ensurePortalApi === "function") {
          await ensurePortalApi();
        }

        if (!window.PortalAPI) {
          throw new Error("API segura do Portal indisponível.");
        }

        const result = await window.PortalAPI.call("cadastros", "read", {
          resource: "contatos",
          operation: "list"
        });

        CADASTRO_CONTATOS_CACHE = rowsFromCadastro(result?.data)
          .filter((row) => normalizeKey(row?.Ativo ?? row?.ativo) !== "NAO")
          .filter((row) => {
            const ativo = normalizeKey(row?.Ativo ?? row?.ativo);
            return !ativo || ativo === "SIM";
          });

        return CADASTRO_CONTATOS_CACHE;
      } catch (error) {
        console.warn("[DIVULGACAO] Não foi possível carregar contatos cadastrados:", error);
        CADASTRO_CONTATOS_CACHE = [];
        return CADASTRO_CONTATOS_CACHE;
      } finally {
        CADASTRO_CONTATOS_PROMISE = null;
      }
    })();

    return CADASTRO_CONTATOS_PROMISE;
  }

  function contatoTextoCadastro(row) {
    const nome = String(row?.Nome ?? row?.nome ?? "").trim().toUpperCase();
    const telefone = telefoneFormatado(row?.Telefone ?? row?.telefone ?? "");

    return [nome, telefone].filter(Boolean).join(" ");
  }

  function contactNameKey(text) {
    const raw = String(text || "").trim();
    const name = raw.split(/\s*\(?\d/)[0] || raw;
    return normalizeKey(name);
  }

  async function preencherContatosFilialModelo3(templateId, filialValue) {
    const key = normalizeKey(filialValue);

    if (!key) {
      ["contato1", "contato2", "contato3", "contato4", "contato5"].forEach((campo) => {
        const input = document.querySelector(
          `[data-template="${templateId}"][data-field="${campo}"]`
        );
        if (input) input.value = "";
        updatePreview(templateId, campo, "");
      });
      fitModel3(getPreview(templateId));
      return;
    }

    const contatosCadastro = await carregarContatosCadastro();

    const select = document.querySelector(
      `[data-template="${templateId}"][data-field="filial"]`
    );

    if (!select || normalizeKey(select.value) !== key) return;

    const dinamicos = contatosCadastro
      .filter((row) => normalizeKey(row?.Filial ?? row?.filial) === key)
      .sort((a, b) => {
        const oa = Number(a?.Ordem ?? a?.ordem ?? 9999);
        const ob = Number(b?.Ordem ?? b?.ordem ?? 9999);
        return oa - ob;
      })
      .map(contatoTextoCadastro)
      .filter(Boolean);

    const contingencia = (FILIAIS_CONTATOS[key] || [])
      .map((value) => String(value || "").trim())
      .filter((value) => value && !/^[-\s]+$/.test(value));

    const lista = [];
    const usados = new Set();

    [...dinamicos, ...contingencia].forEach((contato) => {
      const id = contactNameKey(contato) || normalizeKey(contato);
      if (!id || usados.has(id) || lista.length >= 5) return;
      usados.add(id);
      lista.push(contato);
    });

    while (lista.length < 5) lista.push("");

    ["contato1", "contato2", "contato3", "contato4", "contato5"].forEach((campo, index) => {
      const input = document.querySelector(
        `[data-template="${templateId}"][data-field="${campo}"]`
      );

      const valor = lista[index] || "";
      if (input) input.value = valor;
      updatePreview(templateId, campo, valor);
    });

    fitModel3(getPreview(templateId));
  }

  function preencherContatosFilial(templateId, filialValue) {
    if (String(templateId) === "3") {
      preencherContatosFilialModelo3(templateId, filialValue);
      return;
    }

    const key = normalizeKey(filialValue);
    const lista = FILIAIS_CONTATOS[key] || ["", "", "", ""];

    ["contato1", "contato2", "contato3", "contato4"].forEach((campo, index) => {
      const input = document.querySelector(
        `[data-template="${templateId}"][data-field="${campo}"]`
      );

      const valor = lista[index] || "";

      if (input) input.value = valor;
      updatePreview(templateId, campo, valor);
    });
  }

  function handleInput(event) {
    const el = event.target;
    const templateId = el.dataset.template;
    const field = el.dataset.field;

    if (!templateId || !field) return;

    let value = el.value ?? "";

    if (field === "valor") {
      let v = String(value).toUpperCase();

      if (!hasLetters(v)) {
        v = limparDigitacaoNumerica(v);
      }

      el.value = v;
      updatePreview(templateId, "valor", v);
      return;
    }

    value = String(value).trim();

    if (field === "filial") {
      const selectedText = el.selectedOptions && el.selectedOptions[0]
        ? String(el.selectedOptions[0].textContent || "").trim()
        : value;

      updatePreview(
        templateId,
        "filial",
        value ? selectedText.toUpperCase() : ""
      );

      preencherContatosFilial(templateId, value);
      return;
    }

    if (
      field === "coletaCidade" ||
      field === "coletaLocal" ||
      field === "descargaCidade" ||
      field === "descargaLocal" ||
      field === "produto" ||
      field === "tonelagem" ||
      field === "obs"
    ) {
      value = value.toUpperCase();
    }

    updatePreview(templateId, field, value);

    if (field === "produto") {
      setPreviewBackgroundByProduct(templateId, value);
    }
  }

  function handleBlur(event) {
    const el = event.target;
    const templateId = el.dataset.template;
    const field = el.dataset.field;

    if (!templateId || field !== "valor") return;

    const raw = String(el.value || "").toUpperCase().trim();
    const finalValue = formatarMoedaBR(raw);

    el.value = finalValue;
    updatePreview(templateId, "valor", finalValue);
  }

  function resetTemplate(templateId) {
    const card = document.querySelector(
      `.templateCard[data-template="${templateId}"]`
    );

    if (!card) return;

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

    if (String(templateId) === "3") {
      fitModel3(getPreview(templateId));
    } else {
      setPreviewBackgroundByProduct(templateId, "SOJA");
    }
  }

  async function waitForImage(img) {
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) return;

    await new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }

  async function saveTemplate(templateId) {
    const preview = getPreview(templateId);
    if (!preview) return;

    const bgImg = getBgImgEl(preview);
    await waitForImage(bgImg);

    let canvas;

    if (String(templateId) === "3") {
      const previewImages = Array.from(preview.querySelectorAll("img"));
      await Promise.all(previewImages.map(waitForImage));
      fitModel3(preview);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const previousTransform = preview.style.transform;
      preview.style.transform = "none";

      try {
        canvas = await html2canvas(preview, {
          backgroundColor: "#f5f9fc",
          scale: 1,
          width: 1080,
          height: 1440,
          useCORS: true,
          logging: false
        });
      } finally {
        preview.style.transform = previousTransform;
      }
    } else {
      canvas = await html2canvas(preview, {
        backgroundColor: null,
        scale: 2,
        useCORS: true
      });
    }

    const link = document.createElement("a");
    link.download = String(templateId) === "3"
      ? "divulgacao-modelo-3-whatsapp-3x4.jpg"
      : `divulgacao-modelo-${templateId}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  function initDefaults() {
    document.querySelectorAll("[data-template-preview]").forEach((preview) => {
      const templateId = preview.dataset.templatePreview;

      const produtoEl = document.querySelector(
        `[data-template="${templateId}"][data-field="produto"]`
      );

      const produtoVal = produtoEl ? produtoEl.value.trim() : "";

      if (String(templateId) === "3") {
        fitModel3(preview);
      } else {
        setPreviewBackgroundByProduct(templateId, produtoVal || "SOJA");
      }

      const filialEl = document.querySelector(
        `[data-template="${templateId}"][data-field="filial"]`
      );

      if (filialEl && filialEl.value) {
        preencherContatosFilial(templateId, filialEl.value);
      }

      const valorEl = document.querySelector(
        `[data-template="${templateId}"][data-field="valor"]`
      );

      if (valorEl && valorEl.value) {
        const raw = String(valorEl.value).toUpperCase().trim();
        const value = formatarMoedaBR(raw);

        valorEl.value = value;
        updatePreview(templateId, "valor", value);
      }
    });
  }

  function fitManualMultiText(target) {
    if (!target || !target.hasAttribute("data-multi-fit")) return;

    const max = Number(target.dataset.max || 34);
    const min = Number(target.dataset.min || 14);
    let size = max;

    target.style.fontSize = max + "px";
    target.style.letterSpacing = "";
    target.style.whiteSpace = "nowrap";

    let guard = 0;
    while (
      size > min &&
      guard < 100 &&
      (target.scrollWidth > target.clientWidth + 1 ||
       target.scrollHeight > target.clientHeight + 1)
    ) {
      size -= 1;
      target.style.fontSize = size + "px";
      guard += 1;
    }

    if (target.scrollWidth > target.clientWidth + 1) {
      target.style.letterSpacing = "-0.8px";
    }
  }

  function fitManualMulti(section) {
    section?.querySelectorAll("[data-multi-fit]").forEach(fitManualMultiText);
  }

  function multiInput(section, field, index = null) {
    const suffix = index == null ? "" : `[data-multi-index="${index}"]`;
    return section.querySelector(`[data-multi-field="${field}"]${suffix}`);
  }

  function multiBind(section, field, index = null) {
    const suffix = index == null ? "" : `[data-multi-index="${index}"]`;
    return section.querySelector(`[data-multi-bind="${field}"]${suffix}`);
  }

  function setMultiBind(section, field, value, index = null) {
    const el = multiBind(section, field, index);
    if (el) el.textContent = String(value || "").toUpperCase();
  }

  function renderManualMulti(section) {
    const count = Number(section?.dataset.multiCount || 0);
    if (![2,3,4].includes(count)) return;

    for (let i = 1; i <= count; i += 1) {
      const read = (field) => multiInput(section, field, i)?.value?.trim() || "";

      setMultiBind(section, "origem", read("origem"), i);
      setMultiBind(section, "coleta", read("coleta"), i);
      setMultiBind(section, "destino", read("destino"), i);
      setMultiBind(section, "descarga", read("descarga"), i);
      setMultiBind(section, "produto", read("produto"), i);
      setMultiBind(section, "valor", read("valor"), i);
    }

    const filial = multiInput(section, "filial")?.value?.trim() || "NOVA FROTA";
    setMultiBind(section, "filial", filial);

    for (let i = 1; i <= 4; i += 1) {
      const value = multiInput(section, `contato${i}`)?.value?.trim() || "";
      setMultiBind(section, `contato${i}`, value);
    }

    requestAnimationFrame(() => fitManualMulti(section));
  }

  function buildManualMultiTemplate(section) {
    const count = Number(section.dataset.multiCount || 0);
    const mount = section.querySelector(".multiManualMount");
    if (!mount || ![2,3,4].includes(count)) return;

    const freteForms = Array.from({ length: count }, (_, idx) => {
      const i = idx + 1;
      return `
        <div class="multiFreteEditor">
          <div class="multiFreteEditorHead">
            <strong>Frete ${i}</strong>
            <span>${String(i).padStart(2,"0")}</span>
          </div>
          <div class="multiEditorGrid">
            <div class="multiEditorField">
              <label>Origem / Coleta (Cidade-UF)</label>
              <input data-multi-field="origem" data-multi-index="${i}" placeholder="Ex: RIO VERDE-GO">
            </div>
            <div class="multiEditorField">
              <label>Detalhe da coleta</label>
              <input data-multi-field="coleta" data-multi-index="${i}" placeholder="Ex: Fazenda / Armazém">
            </div>
            <div class="multiEditorField">
              <label>Destino / Descarga (Cidade-UF)</label>
              <input data-multi-field="destino" data-multi-index="${i}" placeholder="Ex: UBERLÂNDIA-MG">
            </div>
            <div class="multiEditorField">
              <label>Detalhe da descarga</label>
              <input data-multi-field="descarga" data-multi-index="${i}" placeholder="Ex: Unidade / Terminal">
            </div>
            <div class="multiEditorField">
              <label>Produto</label>
              <input data-multi-field="produto" data-multi-index="${i}" placeholder="Ex: SOJA">
            </div>
            <div class="multiEditorField">
              <label>Valor do frete</label>
              <input data-multi-field="valor" data-multi-index="${i}" placeholder="Ex: R$ 95,00 / A COMBINAR">
            </div>
          </div>
        </div>`;
    }).join("");

    const freteCards = Array.from({ length: count }, (_, idx) => {
      const i = idx + 1;
      const cityMax = count === 2 ? 43 : count === 3 ? 38 : 34;
      const detailMax = count === 2 ? 22 : 18;
      const productMax = count === 2 ? 33 : 27;
      const priceMax = count === 2 ? 50 : count === 3 ? 43 : 38;

      return `
        <article class="multiArtFrete">
          <div class="multiArtNum">${String(i).padStart(2,"0")}</div>
          <div class="multiArtRoute">
            <div class="multiArtRouteSide">
              <div class="multiArtLabel"><b>●</b> ORIGEM / COLETA</div>
              <div class="multiArtCity" data-multi-bind="origem" data-multi-index="${i}" data-multi-fit data-max="${cityMax}" data-min="20"></div>
              <div class="multiArtDetail" data-multi-bind="coleta" data-multi-index="${i}" data-multi-fit data-max="${detailMax}" data-min="14"></div>
            </div>
            <div class="multiArtArrow">→</div>
            <div class="multiArtRouteSide">
              <div class="multiArtLabel"><b>●</b> DESTINO / DESCARGA</div>
              <div class="multiArtCity" data-multi-bind="destino" data-multi-index="${i}" data-multi-fit data-max="${cityMax}" data-min="20"></div>
              <div class="multiArtDetail" data-multi-bind="descarga" data-multi-index="${i}" data-multi-fit data-max="${detailMax}" data-min="14"></div>
            </div>
          </div>
          <div class="multiArtMeta">
            <div class="multiArtProduct">
              <span>PRODUTO</span>
              <strong data-multi-bind="produto" data-multi-index="${i}" data-multi-fit data-max="${productMax}" data-min="18"></strong>
            </div>
            <div class="multiArtPrice">
              <span>VALOR DO FRETE</span>
              <strong data-multi-bind="valor" data-multi-index="${i}" data-multi-fit data-max="${priceMax}" data-min="23"></strong>
            </div>
          </div>
        </article>`;
    }).join("");

    mount.innerHTML = `
      <div class="multiManualLayout">
        <div class="multiManualForm">
          ${freteForms}

          <div class="multiSharedEditor">
            <div class="multiFreteEditorHead">
              <strong>Filial e contatos</strong>
              <span>☎</span>
            </div>
            <div class="multiSharedGrid">
              <div class="multiEditorField wide">
                <label>Filial</label>
                <input data-multi-field="filial" placeholder="Ex: RIO VERDE">
              </div>
              <div class="multiEditorField">
                <label>Contato 1</label>
                <input data-multi-field="contato1" placeholder="Nome + telefone">
              </div>
              <div class="multiEditorField">
                <label>Contato 2</label>
                <input data-multi-field="contato2" placeholder="Nome + telefone">
              </div>
              <div class="multiEditorField">
                <label>Contato 3</label>
                <input data-multi-field="contato3" placeholder="Nome + telefone">
              </div>
              <div class="multiEditorField">
                <label>Contato 4</label>
                <input data-multi-field="contato4" placeholder="Nome + telefone">
              </div>
            </div>
          </div>

          <div class="multiManualActions">
            <button type="button" class="save" data-multi-action="save">Salvar JPG 1080×1350</button>
            <button type="button" data-multi-action="reset">Resetar</button>
          </div>
        </div>

        <div class="multiPreviewColumn">
          <div class="multiPreviewLabel">
            <strong>Prévia da arte</strong>
            <span>saída 1080 × 1350</span>
          </div>
          <div class="multiPreviewShell">
            <div class="multiArt count-${count}">
              <section class="multiArtHero">
                <img class="multiArtHeroImg" src="../assets/img/hero.jpg" alt="" crossorigin="anonymous">
                <div class="multiArtHeroWash"></div>
                <img class="multiArtLogo" src="../assets/img/logo-novafrota.png" alt="Nova Frota" crossorigin="anonymous">
                <div class="multiArtTitle">FRETES <strong>DISPONÍVEIS</strong></div>
                <div class="multiArtSubtitle">CARGAS CONFIRMADAS • PRONTAS PARA CARREGAR</div>
              </section>

              <section class="multiArtBody">
                <div class="multiArtFretes">${freteCards}</div>
                <div class="multiArtContacts">
                  <div class="multiArtContactsIntro">
                    <div class="multiArtWa">☎</div>
                    <div>
                      <strong>FALE COM NOSSA EQUIPE</strong>
                      <span data-multi-bind="filial">NOVA FROTA</span>
                    </div>
                  </div>
                  <div class="multiArtContactsGrid">
                    <div class="multiArtContact" data-multi-bind="contato1" data-multi-fit data-max="19" data-min="14"></div>
                    <div class="multiArtContact" data-multi-bind="contato2" data-multi-fit data-max="19" data-min="14"></div>
                    <div class="multiArtContact" data-multi-bind="contato3" data-multi-fit data-max="19" data-min="14"></div>
                    <div class="multiArtContact" data-multi-bind="contato4" data-multi-fit data-max="19" data-min="14"></div>
                  </div>
                </div>
              </section>

              <footer class="multiArtFooter">
                <div><b>MAIS QUE FRETES,</b><br>PARCERIA EM CADA DESTINO.</div>
                <div class="multiArtFooterBenefits">
                  <span>◇ SEGURANÇA</span>
                  <span>◈ AGILIDADE</span>
                  <span>▥ RESULTADOS</span>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>`;

    mount.querySelectorAll("[data-multi-field]").forEach((input) => {
      input.addEventListener("input", () => renderManualMulti(section));

      if (input.dataset.multiField === "valor") {
        input.addEventListener("blur", () => {
          const raw = String(input.value || "").toUpperCase().trim();
          if (raw) input.value = formatarMoedaBR(raw);
          renderManualMulti(section);
        });
      }
    });

    mount.querySelector('[data-multi-action="reset"]')?.addEventListener("click", () => {
      mount.querySelectorAll("[data-multi-field]").forEach((input) => {
        input.value = "";
      });
      renderManualMulti(section);
    });

    mount.querySelector('[data-multi-action="save"]')?.addEventListener("click", async () => {
      await saveManualMultiTemplate(section);
    });

    renderManualMulti(section);
  }

  async function saveManualMultiTemplate(section) {
    const count = Number(section?.dataset.multiCount || 0);
    const preview = section?.querySelector(".multiArt");
    if (!preview || ![2,3,4].includes(count)) return;

    const images = Array.from(preview.querySelectorAll("img"));
    await Promise.all(images.map(waitForImage));
    renderManualMulti(section);
    fitManualMulti(section);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    if (typeof window.html2canvas !== "function") {
      alert("Não foi possível carregar o gerador de imagem.");
      return;
    }

    const previousTransform = preview.style.transform;
    preview.style.transform = "none";

    try {
      const canvas = await window.html2canvas(preview, {
        backgroundColor: "#f4f8fb",
        scale: 1,
        width: 1080,
        height: 1350,
        useCORS: true,
        logging: false
      });

      const link = document.createElement("a");
      link.download = `divulgacao-mod04-${count}-fretes.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } finally {
      preview.style.transform = previousTransform;
    }
  }

  function initManualMultiTemplates() {
    document.querySelectorAll(".multiTemplateCard[data-multi-count]").forEach(buildManualMultiTemplate);
  }

  function bindActions() {
    initManualMultiTemplates();

    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      const eventName = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(eventName, handleInput);

      if (el.dataset.field === "valor") {
        el.addEventListener("blur", handleBlur);
      }
    });

    document.querySelectorAll("[data-action='reset']").forEach((btn) => {
      btn.addEventListener("click", () => {
        resetTemplate(btn.dataset.template);
      });
    });

    document.querySelectorAll("[data-action='save']").forEach((btn) => {
      btn.addEventListener("click", () => {
        saveTemplate(btn.dataset.template);
      });
    });

    initDefaults();

    document.querySelectorAll('[data-template-preview="3"]').forEach(fitModel3);

    document.querySelectorAll("[data-template][data-field]").forEach((el) => {
      handleInput({ target: el });

      if (el.dataset.field === "valor") {
        handleBlur({ target: el });
      }
    });
  }

  window.addEventListener("DOMContentLoaded", bindActions);
})();
