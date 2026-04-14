// ==========================================
// FRETES MERCADO - NOVA FROTA
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

const API = "https://script.google.com/macros/s/AKfycbx6dBok-h7P9ktdNIsOrzPJGczrx8HTeIPh2kMAQ76NqDhSbx3YcBDxgdOiCv4-dTf6/exec";

// guarda os ids/linhas alteradas
const DIRTY_KEYS = new Set();

// ==========================================
// HELPERS
// ==========================================

function $(id) {
  return document.getElementById(id);
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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
  el.style.color = isError ? "#fca5a5" : "#93c5fd";
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

// ==========================================
// LOAD
// ==========================================

async function load() {
  try {
    setStatus("🔄 Carregando...");
    const res = await fetch(API + "?action=fretes_mercado_list");
    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.error || "Erro ao carregar.");
    }

    const dados = json.data || [];
    DIRTY_KEYS.clear();
    render(dados);
    setStatus("✅ Dados sincronizados.");
  } catch (err) {
    console.error(err);
    setStatus("❌ " + err.message, true);
  }
}

// ==========================================
// RENDER
// ==========================================

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
              <input
                type="text"
                inputmode="decimal"
                value="${valor ? formatBRL(valor) : ""}"
                class="freteInput"
                data-original="${valor}"
                placeholder="R$ 0,00"
              >
            </div>
          `;
        }).join("")}
      </div>
    `;
  }).join("");

  bindCurrencyInputs();
}

// ==========================================
// INPUT DE MOEDA + DIRTY
// ==========================================

function bindCurrencyInputs() {
  const inputs = document.querySelectorAll(".freteInput");

  inputs.forEach((input) => {
    input.addEventListener("focus", () => {
      const n = toNumber(input.value);
      input.value = n ? String(n).replace(".", ",") : "";
    });

    input.addEventListener("blur", () => {
      const linha = input.closest(".linha-frete");
      if (!linha) return;

      const regiao = linha.dataset.regiao || "";
      const base = linha.dataset.base || "";
      const key = makeKey(regiao, base);

      const valorAtual = toNumber(input.value);
      const valorOriginal = Number(input.dataset.original || 0);

      input.value = valorAtual ? formatBRL(valorAtual) : "";

      if (valorAtual !== valorOriginal) {
        DIRTY_KEYS.add(key);
        linha.dataset.dirty = "1";
      } else {
        DIRTY_KEYS.delete(key);
        linha.dataset.dirty = "";
      }
    });
  });
}

// ==========================================
// COLETAR DADOS
// ==========================================

function coletarDadosAlterados() {
  const linhas = document.querySelectorAll('.linha-frete[data-dirty="1"]');

  return [...linhas].map((linha) => {
    const regiao = linha.dataset.regiao || "";
    const base = linha.dataset.base || "";
    const id = linha.dataset.id || "";
    const freteEl = linha.querySelector(".freteInput");

    return {
      id,
      regiao,
      base,
      frete: toNumber(freteEl ? freteEl.value : 0),
      linha
    };
  });
}

// ==========================================
// SALVAR
// ==========================================

async function salvarTudo() {
  setButtonLoading("btnSalvarMercado", "Salvando...");

  try {
    const itens = coletarDadosAlterados();

    if (!itens.length) {
      setStatus("✅ Nenhuma alteração para salvar.");
      return;
    }

    for (const item of itens) {
      const res = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "fretes_mercado_save",
          id: item.id || "",
          regiao: item.regiao,
          base: item.base,
          frete: item.frete
        })
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || `Erro ao salvar ${item.regiao} / ${item.base}`);
      }
    }

    setStatus(`✅ ${itens.length} alteração(ões) salva(s) com sucesso.`);
    await load();
  } catch (err) {
    console.error(err);
    setStatus("❌ " + err.message, true);
  } finally {
    resetButtonLoading("btnSalvarMercado");
  }
}

// ==========================================
// ZERAR
// ==========================================

async function zerarTudo() {
  const ok = confirm("Deseja zerar todos os fretes da tela?");
  if (!ok) return;

  setButtonLoading("btnZerarMercado", "Zerando...");

  try {
    const inputs = document.querySelectorAll(".freteInput");
    inputs.forEach((input) => {
      input.value = "";
    });

    const linhas = document.querySelectorAll(".linha-frete");
    linhas.forEach((linha) => {
      linha.dataset.dirty = "1";
      const key = makeKey(linha.dataset.regiao || "", linha.dataset.base || "");
      DIRTY_KEYS.add(key);
    });

    const res = await fetch(API + "?action=fretes_mercado_clear");
    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.error || "Erro ao zerar.");
    }

    setStatus("✅ Fretes zerados.");
    await load();
  } catch (err) {
    console.error(err);
    setStatus("❌ " + err.message, true);
  } finally {
    resetButtonLoading("btnZerarMercado");
  }
}

// ==========================================
// PRINT
// ==========================================

function imprimirTela() {
  window.print();
}

// ==========================================
// NAVEGAÇÃO
// ==========================================

function irHome() {
  window.location.href = "./home.html";
}

function sairSistema() {
  const logoutEl = document.querySelector("[data-logout]");
  if (logoutEl) {
    logoutEl.click();
    return;
  }
  window.location.href = "./index.html";
}

// ==========================================
// EVENTOS
// ==========================================

function bindEvents() {
  $("btnSalvarMercado")?.addEventListener("click", salvarTudo);
  $("btnZerarMercado")?.addEventListener("click", zerarTudo);
  $("btnPrintMercado")?.addEventListener("click", imprimirTela);
  $("btnHomeMercado")?.addEventListener("click", irHome);
  $("btnSairMercado")?.addEventListener("click", sairSistema);
}

// ==========================================
// INIT
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await load();
});
