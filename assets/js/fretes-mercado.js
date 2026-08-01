// ==========================================
// FRETES MERCADO - NOVA FROTA
// Gateway seguro via Cloudflare Worker
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

async function mercadoApi(action, params = {}) {
  const api = await ensurePortalApi();
  const result = await api.call("fretes-mercado", action, params);
  return result?.data ?? result;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function load() {
  try {
    setStatus("🔄 Carregando...");
    const payload = await mercadoApi("read", {});
    const dados = extractRows(payload);

    DIRTY_KEYS.clear();
    render(dados);
    setStatus("✅ Dados sincronizados.");
  } catch (err) {
    console.error(err);
    setStatus("❌ " + err.message, true);
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
      frete: toNumber(freteEl ? freteEl.value : 0)
    };
  });
}

async function salvarTudo() {
  setButtonLoading("btnSalvarMercado", "Salvando...");

  try {
    const itens = coletarDadosAlterados();

    if (!itens.length) {
      setStatus("✅ Nenhuma alteração para salvar.");
      return;
    }

    for (const item of itens) {
      await mercadoApi("update", {
        resource: "frete",
        id: item.id || "",
        regiao: item.regiao,
        base: item.base,
        frete: item.frete
      });
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

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await load();
});
