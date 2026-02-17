/* fretes.js | NOVA FROTA */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzeVrvWltpM8bJ0qUxkt1sUUi-RrS4XlGXHsFcEyXVFaNmOvGu89sNj0HdVqW0eD2Qa/exec";

  // tenta achar o tbody de forma robusta
  function getTbody() {
    return document.querySelector("#tbody") || document.querySelector("tbody");
  }

  // tenta achar algum “status” na tela (se existir)
  function setStatus(text) {
    const el =
      document.querySelector("[data-sync-status]") ||
      document.querySelector("#syncStatus") ||
      document.querySelector("#status") ||
      document.querySelector(".syncStatus");
    if (el) el.textContent = text;
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function extractPhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";
    let digits = s.replace(/\D/g, "");
    if (digits.startsWith("55")) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return "";
  }

  function whatsappLinkFromContato(contato) {
    const phone = extractPhoneBR(contato);
    return phone ? "https://wa.me/" + phone : "";
  }

  // ----------------------------
  // API
  // ----------------------------
  async function apiGet(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();

    let data;
    if (ct.includes("application/json")) {
      data = await res.json();
    } else {
      // às vezes Apps Script devolve texto JSON
      const t = await res.text();
      try {
        data = JSON.parse(t);
      } catch {
        data = { ok: false, raw: t };
      }
    }

    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.data = data;
      throw err;
    }

    return data;
  }

  async function fetchRows() {
    // Tenta várias ações comuns (porque cada Apps Script usa um nome)
    const tries = [
      { action: "fretes_list" },
      { action: "list_fretes" },
      { action: "listFretes" },
      { action: "list" },
      { route: "fretes", op: "list" },
      {}, // sem params (caso seu script liste por padrão)
    ];

    let lastErr = null;

    for (const p of tries) {
      try {
        const data = await apiGet(p);

        // formatos comuns:
        // { ok:true, rows:[...] }
        // { success:true, data:[...] }
        // { rows:[...] }
        // { data:[...] }
        const rows =
          data?.rows ||
          data?.data ||
          data?.fretes ||
          data?.result ||
          (Array.isArray(data) ? data : null);

        if (Array.isArray(rows)) {
          console.log("[fretes] API ok com params:", p, "rows:", rows.length);
          return rows;
        }

        // se veio algo mas não é array, tenta achar dentro
        if (data && typeof data === "object") {
          // tenta pegar a primeira propriedade array
          const firstArrayKey = Object.keys(data).find((k) => Array.isArray(data[k]));
          if (firstArrayKey) {
            console.log("[fretes] API ok (array em)", firstArrayKey, "params:", p);
            return data[firstArrayKey];
          }
        }
      } catch (e) {
        lastErr = e;
      }
    }

    console.error("[fretes] Falhou ao buscar rows", lastErr);
    throw lastErr || new Error("Falha ao buscar dados.");
  }

  // ----------------------------
  // RENDER
  // ----------------------------

  // Ordem de colunas (bate com seu cabeçalho)
  const COLS = [
    { key: "regional", label: "Regional" },
    { key: "filial", label: "Filial" },
    { key: "cliente", label: "Cliente" },
    { key: "origem", label: "Origem" },
    { key: "coleta", label: "Coleta" },

    // contato com ícone
    { key: "contato", label: "Contato", isContato: true },

    { key: "destino", label: "Destino" },
    { key: "uf", label: "UF" },
    { key: "descarga", label: "Descarga" },
    { key: "volume", label: "Volume" },
    { key: "vlrEmpresa", label: "Vlr Empresa" },
    { key: "vlrMotorista", label: "Vlr Motorista" },
    { key: "km", label: "KM" },
    { key: "pedagioEixo", label: "Pedágio/Eixo" },
    { key: "e5", label: "5E" },
    { key: "e6", label: "6E" },
    { key: "e7", label: "7E" },
    { key: "e4", label: "4E" },
    { key: "e9", label: "9E" },
    { key: "produto", label: "Produto" },
    { key: "icms", label: "ICMS" },
    { key: "pedidoSAT", label: "Pedido SAT" },
    { key: "porta", label: "Porta" },
  ];

  // Se a API vier em ARRAY (linha de planilha), mapeia por índice
  // Se vier como OBJ, usa as chaves.
  function valueFromRow(row, key, index) {
    if (Array.isArray(row)) return safeText(row[index] ?? "");
    if (row && typeof row === "object") {
      // variações de nomes comuns
      const map = {
        regional: ["regional"],
        filial: ["filial"],
        cliente: ["cliente"],
        origem: ["origem"],
        coleta: ["coleta"],
        contato: ["contato", "contatos", "telefone", "fone"],
        destino: ["destino"],
        uf: ["uf", "estado"],
        descarga: ["descarga"],
        volume: ["volume"],
        vlrEmpresa: ["vlrEmpresa", "valorEmpresa", "empresa"],
        vlrMotorista: ["vlrMotorista", "valorMotorista", "motorista"],
        km: ["km"],
        pedagioEixo: ["pedagioEixo", "pedagio", "pedagio_por_eixo"],
        e5: ["5e", "e5"],
        e6: ["6e", "e6"],
        e7: ["7e", "e7"],
        e4: ["4e", "e4"],
        e9: ["9e", "e9"],
        produto: ["produto"],
        icms: ["icms"],
        pedidoSAT: ["pedidoSAT", "pedido", "sat"],
        porta: ["porta"],
      };

      const candidates = map[key] || [key];
      for (const c of candidates) {
        if (c in row) return safeText(row[c]);
      }
    }
    return "";
  }

  function buildContatoCell(contatoText) {
    const td = document.createElement("td");

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "6px";
    wrap.style.minWidth = "0";

    const span = document.createElement("span");
    span.textContent = contatoText || "";
    span.style.whiteSpace = "nowrap";
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";
    span.style.minWidth = "0";
    wrap.appendChild(span);

    const wpp = whatsappLinkFromContato(contatoText);
    if (wpp) {
      const a = document.createElement("a");
      a.href = wpp;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Chamar no WhatsApp";

      a.style.display = "inline-flex";
      a.style.alignItems = "center";
      a.style.justifyContent = "center";
      a.style.width = "32px";
      a.style.height = "32px";
      a.style.borderRadius = "10px";
      a.style.border = "1px solid rgba(17,24,39,.14)";
      a.style.background = "#E6F6ED";
      a.style.flex = "0 0 auto";

      const img = document.createElement("img");
      img.src = "../assets/img/whatsapp.png";
      img.style.width = "18px";
      img.style.height = "18px";

      img.onerror = () => {
        a.textContent = "📞";
        a.style.background = "#EEF2F7";
      };

      a.appendChild(img);
      wrap.appendChild(a);
    }

    td.appendChild(wrap);
    return td;
  }

  function render(rows) {
    const tbody = getTbody();
    if (!tbody) {
      console.warn("[fretes] tbody não encontrado no HTML.");
      return;
    }

    tbody.innerHTML = "";

    rows.forEach((row) => {
      const tr = document.createElement("tr");

      COLS.forEach((col, idx) => {
        if (col.isContato) {
          const contatoText = valueFromRow(row, "contato", idx);
          tr.appendChild(buildContatoCell(contatoText));
        } else {
          const td = document.createElement("td");
          td.textContent = valueFromRow(row, col.key, idx);
          tr.appendChild(td);
        }
      });

      tbody.appendChild(tr);
    });
  }

  // ----------------------------
  // AÇÕES (Atualizar / etc)
  // ----------------------------
  async function atualizar() {
    try {
      setStatus("Carregando...");
      const rows = await fetchRows();
      render(rows);
      setStatus("Atualizado ✅");
    } catch (e) {
      console.error("[fretes] erro ao atualizar:", e);
      setStatus("Erro ao sincronizar ❌");
    }
  }

  function bindButtons() {
    // tenta achar botões de forma flexível
    const btnAtualizar =
      document.querySelector("[data-action='refresh']") ||
      document.querySelector("[data-action='atualizar']") ||
      document.querySelector("#btnAtualizar") ||
      document.querySelector("button.btnTiny.blue, button#atualizar");

    const btnNovo =
      document.querySelector("[data-action='new']") ||
      document.querySelector("[data-action='novo']") ||
      document.querySelector("#btnNovo");

    if (btnAtualizar) btnAtualizar.addEventListener("click", atualizar);

    // se você tiver função real de "novo", conecta aqui (por enquanto só loga)
    if (btnNovo) {
      btnNovo.addEventListener("click", () => {
        console.log("[fretes] clique em NOVO (bind ok)");
      });
    }
  }

  function init() {
    bindButtons();
    atualizar(); // já carrega ao abrir a página
  }

  window.addEventListener("DOMContentLoaded", init);
})();
