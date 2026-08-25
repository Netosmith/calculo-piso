// ==========================================
// FRETES MERCADO - NOVA FROTA
// Gateway seguro via Cloudflare Worker
// AUTO-SAVE AO SAIR DO CAMPO
// ==========================================

const REGIOES = {
  "TIUB": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","CATALÃO","CRISTALINA","FORMOSA","BOM JESUS","MINEIROS","ANAPOLIS","VIANOPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "TIA": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","CATALÃO","CRISTALINA","FORMOSA","BOM JESUS","MINEIROS","ANAPOLIS","VIANOPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "SANTOS": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","CATALÃO","CRISTALINA","FORMOSA","BOM JESUS","MINEIROS","ANAPOLIS","VIANOPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "PARANAGUA": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","CATALÃO","CRISTALINA","FORMOSA","BOM JESUS","MINEIROS","ANAPOLIS","VIANOPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "CHAP SUL": ["RIO VERDE","JATAI","CHAP CEU","CAIAPONIA","MINEIROS"],
  "RIO VERDE": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","CATALÃO","CRISTALINA","FORMOSA","BOM JESUS","MINEIROS","ANAPOLIS","VIANOPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "SAO SIMAO": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","CATALÃO","CRISTALINA","FORMOSA","BOM JESUS","MINEIROS","ANAPOLIS","VIANOPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"]
};

const DIRTY_KEYS = new Set();
const SAVING_KEYS = new Set();
let LOAD_SEQUENCE = 0;

function $(id) {
  return document.getElementById(id);
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;

  let s = String(v).trim();
  if (!s) return 0;

  s = s.replace(/[^\d,.-]/g, "");

  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function formatBRL(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function setStatus(msg, isError = false) {
  const el = $("statusMercado");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "#b42318" : "#0b7d4e";
  el.style.borderColor = isError ? "#fecaca" : "#bde8d0";
  el.style.background = isError ? "#fff1f2" : "#eaf8f1";
}

function setButtonLoading(id, text) {
  const btn = $(id);
  if (!btn) return;

  if (!btn.dataset.originalText) {
    btn.dataset.originalText = btn.textContent;
  }

  btn.textContent = text || "Salvando...";
  btn.disabled = true;
  btn.style.opacity = "0.7";
  btn.style.cursor = "wait";
}

function resetButtonLoading(id) {
  const btn = $(id);
  if (!btn) return;

  btn.textContent = btn.dataset.originalText || btn.textContent;
  btn.disabled = false;
  btn.style.opacity = "";
  btn.style.cursor = "";
}

function makeKey(regiao, base) {
  return `${regiao}__${base}`;
}

async function mercadoApi(action, params = {}) {
  const api = await ensurePortalApi();
  const attempts = action === "read" ? 2 : 1;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await api.call("fretes-mercado", action, params);
      return result?.data ?? result;
    } catch (error) {
      lastError = error;
      const transient =
        !error?.status || [502, 503, 504].includes(Number(error.status));

      if (!transient || attempt >= attempts) {
        throw error;
      }

      setStatus("🔄 Comunicação instável. Tentando novamente...");
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  }

  throw lastError || new Error("Falha ao carregar os fretes de mercado.");
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function load() {
  const sequence = ++LOAD_SEQUENCE;

  try {
    setStatus("🔄 Carregando...");
    const payload = await mercadoApi("read", {});
    const dados = extractRows(payload);

    if (sequence !== LOAD_SEQUENCE) return;

    DIRTY_KEYS.clear();
    render(dados);
    setStatus("✅ Dados sincronizados.");
  } catch (err) {
    if (sequence !== LOAD_SEQUENCE) return;

    console.error(err);
    const hasRenderedRows = Boolean(document.querySelector(".linha-frete"));
    const suffix = hasRenderedRows
      ? " Os dados já exibidos foram preservados."
      : " Tente novamente em instantes.";
    setStatus("❌ " + err.message + suffix, true);
  }
}

function render(dados) {
  const container = $("tabela");
  if (!container) return;

  container.innerHTML = Object.keys(REGIOES).map((regiao) => {
    return `
      <div class="regiao">
        <h3>${esc(regiao)}</h3>

        <div class="row header">
          <b>Base</b>
          <b>Frete (R$)</b>
        </div>

        ${REGIOES[regiao].map((base) => {
          const item = dados.find(d => d.regiao === regiao && d.base === base) || {};
          const valor = Number(item.frete || 0);

          return `
            <div class="row linha-frete"
                 data-regiao="${esc(regiao)}"
                 data-base="${esc(base)}"
                 data-id="${esc(item.id || "")}">
              <input value="${esc(base)}" readonly class="baseInput">
              <div class="freteWrap">
                <input
                  type="text"
                  inputmode="decimal"
                  value="${valor ? formatBRL(valor) : ""}"
                  class="freteInput"
                  data-original="${valor}"
                  placeholder="R$ 0,00"
                  autocomplete="off"
                >
                <span class="saveState" aria-live="polite"></span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }).join("");

  bindCurrencyInputs();
}

function setLinhaState(linha, state, text = "") {
  if (!linha) return;

  linha.dataset.saveState = state || "";
  const stateEl = linha.querySelector(".saveState");
  const input = linha.querySelector(".freteInput");

  if (stateEl) {
    stateEl.textContent = text;
    stateEl.className = "saveState " + (state || "");
  }

  if (input) {
    input.classList.toggle("is-saving", state === "saving");
    input.classList.toggle("is-saved", state === "saved");
    input.classList.toggle("is-error", state === "error");
  }
}

async function salvarLinha(linha, input) {
  if (!linha || !input) return false;

  const regiao = linha.dataset.regiao || "";
  const base = linha.dataset.base || "";
  const id = linha.dataset.id || "";
  const key = makeKey(regiao, base);

  const valorAtual = toNumber(input.value);
  const valorOriginal = Number(input.dataset.original || 0);

  input.value = valorAtual ? formatBRL(valorAtual) : "";

  if (valorAtual === valorOriginal) {
    DIRTY_KEYS.delete(key);
    linha.dataset.dirty = "";
    setLinhaState(linha, "", "");
    return true;
  }

  if (SAVING_KEYS.has(key)) {
    return false;
  }

  SAVING_KEYS.add(key);
  DIRTY_KEYS.add(key);
  linha.dataset.dirty = "1";
  setLinhaState(linha, "saving", "Salvando...");
  setStatus(`💾 Salvando ${base} → ${regiao}...`);

  const valorAntesDeSalvar = valorOriginal;

  try {
    const result = await mercadoApi("update", {
      resource: "frete",
      id,
      regiao,
      base,
      frete: valorAtual
    });

    const returnedId =
      result?.id ||
      result?.data?.id ||
      result?.row?.id ||
      "";

    if (returnedId) {
      linha.dataset.id = String(returnedId);
    }

    input.dataset.original = String(valorAtual);
    DIRTY_KEYS.delete(key);
    linha.dataset.dirty = "";

    setLinhaState(linha, "saved", "Salvo");
    setStatus(`✅ ${base} → ${regiao} salvo automaticamente.`);

    window.setTimeout(() => {
      if (linha.dataset.saveState === "saved") {
        setLinhaState(linha, "", "");
      }
    }, 1800);

    return true;
  } catch (err) {
    console.error("[FRETES MERCADO] Falha no auto-save:", err);

    input.dataset.original = String(valorAntesDeSalvar);
    input.value = valorAntesDeSalvar ? formatBRL(valorAntesDeSalvar) : "";

    DIRTY_KEYS.delete(key);
    linha.dataset.dirty = "";

    setLinhaState(linha, "error", "Erro");
    setStatus(
      `❌ Não foi possível salvar ${base} → ${regiao}. O valor anterior foi restaurado.`,
      true
    );

    window.setTimeout(() => {
      if (linha.dataset.saveState === "error") {
        setLinhaState(linha, "", "");
      }
    }, 3000);

    return false;
  } finally {
    SAVING_KEYS.delete(key);
  }
}

function bindCurrencyInputs() {
  const inputs = document.querySelectorAll(".freteInput");

  inputs.forEach((input) => {
    input.addEventListener("focus", () => {
      const n = toNumber(input.value);
      input.value = n ? String(n).replace(".", ",") : "";
      input.select();
    });

    input.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        const valorOriginal = Number(input.dataset.original || 0);
        input.value = valorOriginal ? formatBRL(valorOriginal) : "";
        input.blur();
      }
    });

    input.addEventListener("input", () => {
      const linha = input.closest(".linha-frete");
      if (!linha) return;

      const regiao = linha.dataset.regiao || "";
      const base = linha.dataset.base || "";
      const key = makeKey(regiao, base);

      const valorAtual = toNumber(input.value);
      const valorOriginal = Number(input.dataset.original || 0);

      if (valorAtual !== valorOriginal) {
        DIRTY_KEYS.add(key);
        linha.dataset.dirty = "1";
        setLinhaState(linha, "", "");
      } else {
        DIRTY_KEYS.delete(key);
        linha.dataset.dirty = "";
      }
    });

    input.addEventListener("blur", async () => {
      const linha = input.closest(".linha-frete");
      if (!linha) return;

      await salvarLinha(linha, input);
    });
  });
}

function coletarDadosAlterados() {
  const linhas = document.querySelectorAll('.linha-frete[data-dirty="1"]');

  return [...linhas].map((linha) => {
    const regiao = linha.dataset.regiao || "";
    const base = linha.dataset.base || "";
    const id = linha.dataset.id || "";
    const freteEl = linha.querySelector(".freteInput");

    return {
      linha,
      input: freteEl,
      id,
      regiao,
      base,
      frete: toNumber(freteEl ? freteEl.value : 0)
    };
  });
}

async function salvarTudo() {
  setButtonLoading("btnSalvarMercado", "Salvando...");

  try {
    const itens = coletarDadosAlterados();

    if (!itens.length) {
      setStatus("✅ Nenhuma alteração pendente. Tudo já foi salvo automaticamente.");
      return;
    }

    let salvos = 0;

    for (const item of itens) {
      const ok = await salvarLinha(item.linha, item.input);
      if (ok) salvos += 1;
    }

    setStatus(`✅ ${salvos} alteração(ões) pendente(s) salva(s).`);
  } catch (err) {
    console.error(err);
    setStatus("❌ " + err.message, true);
  } finally {
    resetButtonLoading("btnSalvarMercado");
  }
}

async function zerarTudo() {
  const ok = confirm("Deseja zerar todos os fretes da tela?");
  if (!ok) return;

  setButtonLoading("btnZerarMercado", "Zerando...");

  try {
    await mercadoApi("delete", { resource: "all" });
    setStatus("✅ Fretes zerados.");
    await load();
  } catch (err) {
    console.error(err);
    setStatus("❌ " + err.message, true);
  } finally {
    resetButtonLoading("btnZerarMercado");
  }
}

function imprimirTela() {
  window.print();
}

function irHome() {
  window.location.href = "./home.html";
}

async function sairSistema() {
  await logoutPortal();
  window.location.href = "./login.html";
}

function bindEvents() {
  $("btnSalvarMercado")?.addEventListener("click", salvarTudo);
  $("btnZerarMercado")?.addEventListener("click", zerarTudo);
  $("btnPrintMercado")?.addEventListener("click", imprimirTela);
  $("btnHomeMercado")?.addEventListener("click", irHome);
  $("btnSairMercado")?.addEventListener("click", sairSistema);
}

async function iniciarFretesMercado() {
  setStatus("🔄 Validando acesso...");

  const session = await verifyPortalSession({ requireState: true });
  if (!session) return;

  if (!canAccessFeature("fretes-mercado")) {
    alert("Fretes Mercado não está liberado para este perfil.");
    window.location.href = "./home.html";
    return;
  }

  bindEvents();
  await load();
}

document.addEventListener("DOMContentLoaded", iniciarFretesMercado);
