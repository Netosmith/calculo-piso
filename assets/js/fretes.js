/* fretes.js | NOVA FROTA (AJUSTADO + PISO S/N) */
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
  // Parse número pt-BR (ex: "1.234,56" -> 1234.56)
  // ----------------------------
  function parsePtNumber(value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;

    let s = String(value).trim();
    if (!s) return NaN;

    // remove R$, espaços etc
    s = s.replace(/\s+/g, "").replace(/[^\d.,-]/g, "");

    // se tem vírgula, assume decimal pt-BR
    if (s.includes(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function ceil0(n) {
    return Math.ceil(n);
  }

  // ----------------------------
  // WhatsApp helper
  // ----------------------------
  function extractPhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";
    let digits = s.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return "";
  }

  function whatsappLinkFromContato(contato) {
    const phone = extractPhoneBR(contato);
    return phone ? "https://wa.me/" + phone : "";
  }

  // ----------------------------
  // API (JSON + JSONP)
  // ----------------------------
  async function apiGet(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const rawText = await res.text().catch(() => "");

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
      // JSONP: callback({...})
      const t = String(rawText || "").trim();
      const p1 = t.indexOf("(");
      const p2 = t.lastIndexOf(")");

      const looksJsonp =
        p1 > 0 &&
        p2 > p1 &&
        /^[a-zA-Z_$][\w$]*\s*\(/.test(t);

      if (looksJsonp) {
        const inner = t.slice(p1 + 1, p2).trim();
        try {
          data = inner ? JSON.parse(inner) : null;
        } catch {
          const err = new Error("Falha ao interpretar JSONP da API.");
          err.url = url.toString();
          err.preview = t.slice(0, 260);
          throw err;
        }
      } else {
        const err = new Error("Falha ao interpretar JSON da API.");
        err.url = url.toString();
        err.preview = t.slice(0, 260);
        throw err;
      }
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
    const tries = [{ action: "list" }, { action: "rows" }, {}];

    let lastErr = null;

    for (const p of tries) {
      try {
        const data = await apiGet(p);
        const rows =
          data?.data ||
          data?.rows ||
          data?.fretes ||
          data?.result ||
          (Array.isArray(data) ? data : null);

        if (Array.isArray(rows)) return rows;

        lastErr = new Error("Resposta sem array de linhas (params: " + JSON.stringify(p) + ")");
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Falha ao buscar dados.");
  }

  // ----------------------------
  // COLUNAS (na ordem do HTML)
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

    { key: "__acoes", label: "Ações", isAcoes: true },
  ];

  function valueFromRow(row, key, index) {
    if (Array.isArray(row)) return safeText(row[index] ?? "");

    if (row && typeof row === "object") {
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

        e5: ["e5", "5e"],
        e6: ["e6", "6e"],
        e7: ["e7", "7e"],
        e4: ["e4", "4e"],
        e9: ["e9", "9e"],

        produto: ["produto"],
        icms: ["icms"],

        pedidoSat: ["pedidoSat", "pedidoSAT", "pedido", "sat"],

        porta: ["porta"],
        transito: ["transito", "trânsito", "transitoDias"],
        status: ["status"],
        obs: ["obs", "observacao", "observações", "observacoes"],
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

  function buildAcoesCell(row) {
    const td = document.createElement("td");
    td.className = "num";

    const id = row?.id ? String(row.id) : "";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btnTiny ghost";
    btnEdit.textContent = "Editar";
    btnEdit.style.marginRight = "6px";
    btnEdit.addEventListener("click", () => {
      console.log("[fretes] editar", id, row);
      // se você já tiver modal/edit, chame aqui:
      // window.openEditModal?.(row);
    });

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btnTiny";
    btnDel.textContent = "Excluir";
    btnDel.addEventListener("click", async () => {
      if (!id) return alert("Sem ID para excluir.");
      if (!confirm("Excluir este frete?")) return;

      try {
        setStatus("🗑 Excluindo...");
        const data = await apiGet({ action: "delete", id });
        if (data?.ok) {
          setStatus("✅ Excluído");
          await atualizar();
        } else {
          setStatus("❌ Falha ao excluir");
          alert(data?.error || "Falha ao excluir.");
        }
      } catch (e) {
        console.error("[fretes] erro delete:", e);
        setStatus("❌ Erro ao excluir");
      }
    });

    td.appendChild(btnEdit);
    td.appendChild(btnDel);
    return td;
  }

  // ======================================================
  // ✅ PISO MÍNIMO (S/N) baseado na sua página do piso
  // - compara valorMotorista (R$/ton) vs mínimo calculado (R$/ton)
  // ======================================================
  const PISO_PARAMS = {
    e9: { eixos: 9, rkm: 8.53, custoCC: 877.83, weightInputId: "w9", defaultPeso: 47 },
    e4: { eixos: 4, rkm: 7.4505, custoCC: 792.30, weightInputId: "w4", defaultPeso: 39 },
    e7: { eixos: 7, rkm: 7.4505, custoCC: 792.30, weightInputId: "w7", defaultPeso: 36 },
    e6: { eixos: 6, rkm: 6.8058, custoCC: 656.76, weightInputId: "w6", defaultPeso: 31 },
    // no seu fretes.html não tem input w5, então usamos padrão (e se você criar no futuro, ele pega)
    e5: { eixos: 5, rkm: 6.1859, custoCC: 642.10, weightInputId: "w5", defaultPeso: 26 },
  };

  function getPesoFromUI(id, fallback) {
    const el = document.getElementById(id);
    const v = parsePtNumber(el?.value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  function calcMinRPorTon(param, km, pedagioPorEixo) {
    const peso = getPesoFromUI(param.weightInputId, param.defaultPeso);
    const numerador = (param.rkm * km) + param.custoCC + (pedagioPorEixo * param.eixos);
    const base = numerador / peso;          // R$/ton
    const minTon = ceil0(base);              // arredonda pra cima (igual seu piso.html)
    return minTon;
  }

  function sn(valueMotoristaTon, minTon) {
    if (!Number.isFinite(valueMotoristaTon) || !Number.isFinite(minTon)) return "";
    return valueMotoristaTon >= minTon ? "S" : "N";
  }

  function applyPisoSN(rows) {
    return (rows || []).map((r) => {
      const km = parsePtNumber(valueFromRow(r, "km")) || 0;
      const ped = parsePtNumber(valueFromRow(r, "pedagioEixo")) || 0;
      const vm = parsePtNumber(valueFromRow(r, "valorMotorista")); // R$/ton (da sua planilha)

      const min5 = calcMinRPorTon(PISO_PARAMS.e5, km, ped);
      const min6 = calcMinRPorTon(PISO_PARAMS.e6, km, ped);
      const min7 = calcMinRPorTon(PISO_PARAMS.e7, km, ped);
      const min4 = calcMinRPorTon(PISO_PARAMS.e4, km, ped);
      const min9 = calcMinRPorTon(PISO_PARAMS.e9, km, ped);

      return {
        ...r,
        e5: sn(vm, min5),
        e6: sn(vm, min6),
        e7: sn(vm, min7),
        e4: sn(vm, min4),
        e9: sn(vm, min9),

        // opcional (debug): mínimos calculados
        // _min5: min5, _min6: min6, _min7: min7, _min4: min4, _min9: min9,
      };
    });
  }

  // ----------------------------
  // RENDER (agrupa por filial, ordena por cliente)
  // ----------------------------
  function render(rowsRaw) {
    const tbody = getTbody();
    if (!tbody) return;

    tbody.innerHTML = "";
    if (!rowsRaw || !rowsRaw.length) return;

    // ✅ calcula S/N antes de ordenar/renderizar
    const rows = applyPisoSN(rowsRaw);

    // 🔹 ordena: FILIAL → CLIENTE → ORIGEM → DESTINO
    rows.sort((a, b) => {
      const fa = safeText(a?.filial).localeCompare(safeText(b?.filial));
      if (fa !== 0) return fa;

      const ca = safeText(a?.cliente).localeCompare(safeText(b?.cliente));
      if (ca !== 0) return ca;

      const oa = safeText(a?.origem).localeCompare(safeText(b?.origem));
      if (oa !== 0) return oa;

      return safeText(a?.destino).localeCompare(safeText(b?.destino));
    });

    let filialAtual = "";

    rows.forEach((row) => {
      // Cabeçalho de FILIAL
      const filialRow = safeText(row?.filial);
      if (filialRow !== filialAtual) {
        filialAtual = filialRow;

        const trGroup = document.createElement("tr");
        trGroup.className = "groupRow";

        const td = document.createElement("td");
        td.colSpan = COLS.length;
        td.textContent = filialAtual || "SEM FILIAL";

        trGroup.appendChild(td);
        tbody.appendChild(trGroup);
      }

      // Linha normal
      const tr = document.createElement("tr");

      COLS.forEach((col, idx) => {
        if (col.isContato) {
          const contatoText = valueFromRow(row, "contato", idx);
          tr.appendChild(buildContatoCell(contatoText));
          return;
        }

        if (col.isAcoes) {
          tr.appendChild(buildAcoesCell(row));
          return;
        }

        const td = document.createElement("td");
        td.textContent = valueFromRow(row, col.key, idx);
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
        setStatus("❌ Erro ao sincronizar (deploy/permissão)");
        console.warn("[fretes] Trecho retorno:", e.preview || "");
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
        // window.openNewModal?.();
      });
    }

    // ✅ quando pesos mudarem, recalcula a tabela (S/N)
    ["#w9", "#w4", "#w7", "#w6", "#w5"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", () => {
        // não precisa bater na API de novo, só re-render com os dados que já estão na tela
        // mas como aqui não guardamos cache, chamamos atualizar (simples e confiável)
        atualizar();
      });
    });
  }

  function init() {
    bindButtons();
    atualizar();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
