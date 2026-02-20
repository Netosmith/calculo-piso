/* fretes.js | NOVA FROTA */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzQv34T2Oi_hs5Re91N81XM1lH_5mZSkNJw8_8I6Ij4HZNFb97mcL8fNmob1Bg8ZGI6/exec";

  // ----------------------------
  // DOM helpers
  // ----------------------------
  const $ = (sel) => document.querySelector(sel);

  function getTbody() {
    return document.querySelector("#tbody") || document.querySelector("tbody");
  }

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

  // ----------------------------
  // WhatsApp helper
  // ----------------------------
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
  // API (JSON puro)
  // ----------------------------
  async function apiGet(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const rawText = await res.text().catch(() => "");

    // Detecta HTML (Apps Script pedindo login/permissão)
    const looksHtml =
      ct.includes("text/html") ||
      /^\s*<!doctype html/i.test(rawText) ||
      /^\s*<html/i.test(rawText);

    if (looksHtml) {
      const err = new Error("API retornou HTML (deploy/permissão do Apps Script).");
      err.httpStatus = res.status;
      err.url = url.toString();
      err.preview = rawText.slice(0, 260);
      throw err;
    }

    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      const err = new Error("Falha ao interpretar JSON da API.");
      err.url = url.toString();
      err.preview = rawText.slice(0, 260);
      throw err;
    }

    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.httpStatus = res.status;
      err.data = data;
      err.url = url.toString();
      throw err;
    }

    return data;
  }

  async function fetchRows() {
    const data = await apiGet({ action: "list" });
    const rows =
      data?.data ||
      data?.rows ||
      data?.fretes ||
      (Array.isArray(data) ? data : null);

    if (!Array.isArray(rows)) throw new Error("API respondeu sem lista de fretes.");
    console.log("[fretes] rows:", rows.length);
    return rows;
  }

  // ----------------------------
  // RENDER
  // (alinhado com seu fretes.html + backend)
  // ----------------------------
  const COLS = [
    { key: "regional", label: "Regional" },
    { key: "filial", label: "Filial" },
    { key: "cliente", label: "Cliente" },
    { key: "origem", label: "Origem" },
    { key: "coleta", label: "Coleta" },

    { key: "contato", label: "Contato", isContato: true },

    { key: "destino", label: "Destino" },
    { key: "uf", label: "UF" },
    { key: "descarga", label: "Descarga" },

    { key: "volume", label: "Volume" },

    { key: "valorEmpresa", label: "Vlr Empresa" },
    { key: "valorMotorista", label: "Vlr Motorista" },

    { key: "km", label: "KM" },
    { key: "pedagioEixo", label: "Pedágio/Eixo" },

    // Se você não tiver isso na planilha, vai vir vazio (ok)
    { key: "e5", label: "5E" },
    { key: "e6", label: "6E" },
    { key: "e7", label: "7E" },
    { key: "e4", label: "4E" },
    { key: "e9", label: "9E" },

    { key: "produto", label: "Produto" },
    { key: "icms", label: "ICMS" },

    { key: "pedidoSat", label: "Pedido SAT" },

    { key: "porta", label: "Porta" },
    { key: "transito", label: "Trânsito" },
    { key: "status", label: "Status" },
    { key: "obs", label: "Observações" },

    { key: "_acoes", label: "Ações", isActions: true },
  ];

  function valueFromRow(row, key) {
    if (!row) return "";

    if (row && typeof row === "object" && !Array.isArray(row)) {
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

        valorEmpresa: ["valorEmpresa", "vlrEmpresa", "empresa"],
        valorMotorista: ["valorMotorista", "vlrMotorista", "motorista"],

        km: ["km"],
        pedagioEixo: ["pedagioEixo", "pedagio", "pedagio_por_eixo"],

        e5: ["5e", "e5"],
        e6: ["6e", "e6"],
        e7: ["7e", "e7"],
        e4: ["4e", "e4"],
        e9: ["9e", "e9"],

        produto: ["produto"],
        icms: ["icms"],
        pedidoSat: ["pedidoSat", "pedidoSAT", "pedido", "sat"],

        porta: ["porta"],
        transito: ["transito"],
        status: ["status"],
        obs: ["obs", "observacao", "observações"],
      };

      const candidates = map[key] || [key];
      for (const c of candidates) {
        if (c in row) return safeText(row[c]);
      }
      return "";
    }

    // Se um dia vier array, retorna vazio seguro
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
      a.className = "waIcon";

      const img = document.createElement("img");
      img.src = "../assets/img/whatsapp.png";
      img.alt = "WhatsApp";

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
      tr.className = "rowSlim";

      COLS.forEach((col) => {
        if (col.isContato) {
          const contatoText = valueFromRow(row, "contato");
          tr.appendChild(buildContatoCell(contatoText));
          return;
        }

        if (col.isActions) {
          const td = document.createElement("td");
          td.className = "num";
          td.textContent = ""; // (depois você coloca editar/excluir aqui)
          tr.appendChild(td);
          return;
        }

        const td = document.createElement("td");
        td.textContent = valueFromRow(row, col.key);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ----------------------------
  // AÇÕES
  // ----------------------------
  async function atualizar() {
    try {
      setStatus("🔄 Carregando...");
      const rows = await fetchRows();
      render(rows);
      setStatus("✅ Atualizado");
    } catch (e) {
      console.error("[fretes] erro ao atualizar:", e);

      if (String(e?.message || "").includes("retornou HTML")) {
        setStatus("❌ Erro ao sincronizar (ver deploy/permissão)");
        console.warn("[fretes] retorno preview:", e.preview || "");
      } else {
        setStatus("❌ Erro ao sincronizar");
      }
    }
  }

  function bindButtons() {
    const btnAtualizar = $("#btnReloadFromSheets");
    const btnNovo = $("#btnNew");

    if (btnAtualizar) btnAtualizar.addEventListener("click", atualizar);

    if (btnNovo) {
      btnNovo.addEventListener("click", () => {
        console.log("[fretes] clique em NOVO (bind ok)");
        // aqui você chama sua função de abrir modal, se existir
        // ex: openModalNew();
      });
    }
  }

  function init() {
    bindButtons();
    atualizar(); // carrega ao abrir
  }

  window.addEventListener("DOMContentLoaded", init);
})();
