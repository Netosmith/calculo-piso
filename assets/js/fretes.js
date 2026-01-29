/* =========================================================
   fretes.js | NOVA FROTA
   - Tabela operacional de fretes
   - Permissão Frete Mínimo (ANTT) por eixos
   - Pesos editáveis (salvos por usuário no navegador)
========================================================= */

(function () {
  const $ = (id) => document.getElementById(id);

  // --------- Helpers ----------
  function safeParseJSON(raw, fallback) {
    try {
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getHomeAuthKeyRaw() {
    // Você mencionou que o login 1 salva em "nf_auth_home"
    // Não sabemos se é string simples ou JSON, então vamos usar como "escopo"
    return localStorage.getItem("nf_auth_home") || "DEFAULT";
  }

  function getScope() {
    const raw = getHomeAuthKeyRaw();
    // Se for JSON (ex: {user:"LUZIANO"}), tenta extrair
    const obj = safeParseJSON(raw, null);
    if (obj && typeof obj === "object") {
      const user =
        obj.user || obj.usuario || obj.name || obj.nome || obj.email || null;
      if (user) return String(user).toUpperCase().trim();
    }
    // Se for string simples (token/usuário)
    return String(raw).slice(0, 40).toUpperCase().trim() || "DEFAULT";
  }

  function keyPesos() {
    return `nf_fretes_pesos_${getScope()}_v1`;
  }
  function keyFretes() {
    return `nf_fretes_lista_${getScope()}_v1`;
  }

  function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function fmtDec(n, d = 2) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "";
    return x.toLocaleString("pt-BR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  }

  function sanitizeText(s) {
    return String(s ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // --------- Estado ----------
  const DEFAULT_PESOS = {
    p9: 47, // 9 eixos
    p4: 39, // 4º eixo
    p7: 36, // 7 eixos
    p6: 31, // 6 eixos
  };

  const DEFAULT_FRETES = [
    {
      id: cryptoId(),
      origem: "RIO VERDE/GO",
      destino: "SANTOS/SP",
      km: 950,
      pedagioEixo: 10.5,
      freteMotorista: 155.0,
    },
    {
      id: cryptoId(),
      origem: "JATAÍ/GO",
      destino: "GUARUJÁ/SP",
      km: 1030,
      pedagioEixo: 12.0,
      freteMotorista: 165.0,
    },
    {
      id: cryptoId(),
      origem: "SANTA HELENA/GO",
      destino: "SANTOS/SP",
      km: 980,
      pedagioEixo: 9.75,
      freteMotorista: 148.0,
    },
  ];

  let pesos = loadPesos();
  let fretes = loadFretes();

  // --------- Cálculo de Permissão (replica sua planilha) ----------
  // Regra: Se (PISO_POR_TON) < (FRETE_MOTORISTA_L) => "S" senão "N"
  function permissao(pisoPorTon, freteMotorista) {
    if (!Number.isFinite(pisoPorTon) || !Number.isFinite(freteMotorista))
      return "";
    return pisoPorTon < freteMotorista ? "S" : "N";
  }

  function piso5e(km, pedagioEixo) {
    // =(((N*6,0301)+(M*5)+615,26)/26)
    if (!Number.isFinite(km) || !Number.isFinite(pedagioEixo)) return NaN;
    return (km * 6.0301 + pedagioEixo * 5 + 615.26) / 26;
  }

  function piso6e(km, pedagioEixo) {
    // =(((N*6,7408)+(M*6)+663,07)/R5)  => R5 = pesoRef6
    if (!Number.isFinite(km) || !Number.isFinite(pedagioEixo)) return NaN;
    const p = toNum(pesos.p6);
    if (!Number.isFinite(p) || p <= 0) return NaN;
    return (km * 6.7408 + pedagioEixo * 6 + 663.07) / p;
  }

  function piso7e(km, pedagioEixo) {
    // =(((N*7,313)+(M*7)+753,88)/R4) => R4 = pesoRef7
    if (!Number.isFinite(km) || !Number.isFinite(pedagioEixo)) return NaN;
    const p = toNum(pesos.p7);
    if (!Number.isFinite(p) || p <= 0) return NaN;
    return (km * 7.313 + pedagioEixo * 7 + 753.88) / p;
  }

  function piso4e(km, pedagioEixo) {
    // Sua fórmula do 4º eixo é igual a de 7 eixos no numerador,
    // mas divide por R3 (pesoRef4). Mantido exatamente como você mandou.
    if (!Number.isFinite(km) || !Number.isFinite(pedagioEixo)) return NaN;
    const p = toNum(pesos.p4);
    if (!Number.isFinite(p) || p <= 0) return NaN;
    return (km * 7.313 + pedagioEixo * 7 + 753.88) / p;
  }

  function piso9e(km, pedagioEixo) {
    // =(((N*8,242)+(M*9)+808,17)/R2) => R2 = pesoRef9
    if (!Number.isFinite(km) || !Number.isFinite(pedagioEixo)) return NaN;
    const p = toNum(pesos.p9);
    if (!Number.isFinite(p) || p <= 0) return NaN;
    return (km * 8.242 + pedagioEixo * 9 + 808.17) / p;
  }

  // --------- Render ----------
  function render() {
    bindPesoInputs();
    renderTable();
  }

  function bindPesoInputs() {
    const i9 = $("pesoRef9");
    const i4 = $("pesoRef4");
    const i7 = $("pesoRef7");
    const i6 = $("pesoRef6");

    // Caso a página ainda não tenha esses inputs, não quebra
    if (!i9 || !i4 || !i7 || !i6) return;

    // Preenche
    i9.value = String(pesos.p9 ?? DEFAULT_PESOS.p9);
    i4.value = String(pesos.p4 ?? DEFAULT_PESOS.p4);
    i7.value = String(pesos.p7 ?? DEFAULT_PESOS.p7);
    i6.value = String(pesos.p6 ?? DEFAULT_PESOS.p6);

    // Eventos
    const onChange = () => {
      pesos = {
        p9: toNum(i9.value),
        p4: toNum(i4.value),
        p7: toNum(i7.value),
        p6: toNum(i6.value),
      };

      // Se algum virar NaN, volta no padrão
      pesos.p9 = Number.isFinite(pesos.p9) && pesos.p9 > 0 ? pesos.p9 : DEFAULT_PESOS.p9;
      pesos.p4 = Number.isFinite(pesos.p4) && pesos.p4 > 0 ? pesos.p4 : DEFAULT_PESOS.p4;
      pesos.p7 = Number.isFinite(pesos.p7) && pesos.p7 > 0 ? pesos.p7 : DEFAULT_PESOS.p7;
      pesos.p6 = Number.isFinite(pesos.p6) && pesos.p6 > 0 ? pesos.p6 : DEFAULT_PESOS.p6;

      savePesos(pesos);
      renderTable();
    };

    [i9, i4, i7, i6].forEach((el) => {
      el.addEventListener("input", onChange);
      el.addEventListener("change", onChange);
    });
  }

  function renderTable() {
    const tbody = $("tblFretes");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!fretes.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="10" style="padding:14px; opacity:.75;">Nenhum frete cadastrado.</td>`;
      tbody.appendChild(tr);
      return;
    }

    fretes.forEach((f) => {
      const km = toNum(f.km);
      const ped = toNum(f.pedagioEixo);
      const L = toNum(f.freteMotorista);

      const p5 = piso5e(km, ped);
      const p6 = piso6e(km, ped);
      const p7 = piso7e(km, ped);
      const p4 = piso4e(km, ped);
      const p9 = piso9e(km, ped);

      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid rgba(31,43,85,.85)";

      tr.innerHTML = `
        <td style="padding:10px;">
          <input data-field="origem" data-id="${f.id}" value="${escapeHtml(f.origem)}"
                 style="width:160px; max-width:100%; padding:8px 10px; border-radius:10px;" />
        </td>
        <td style="padding:10px;">
          <input data-field="destino" data-id="${f.id}" value="${escapeHtml(f.destino)}"
                 style="width:160px; max-width:100%; padding:8px 10px; border-radius:10px;" />
        </td>

        <td style="padding:10px; text-align:right;">
          <input data-field="km" data-id="${f.id}" type="number" step="0.1" value="${Number.isFinite(km) ? km : ""}"
                 style="width:110px; text-align:right; padding:8px 10px; border-radius:10px;" />
        </td>

        <td style="padding:10px; text-align:right;">
          <input data-field="pedagioEixo" data-id="${f.id}" type="number" step="0.01" value="${Number.isFinite(ped) ? ped : ""}"
                 style="width:120px; text-align:right; padding:8px 10px; border-radius:10px;" />
        </td>

        <td style="padding:10px; text-align:right;">
          <input data-field="freteMotorista" data-id="${f.id}" type="number" step="0.01" value="${Number.isFinite(L) ? L : ""}"
                 style="width:130px; text-align:right; padding:8px 10px; border-radius:10px;" />
        </td>

        <td style="padding:10px; text-align:right; font-weight:900;">${badge(permissao(p5, L))}</td>
        <td style="padding:10px; text-align:right; font-weight:900;">${badge(permissao(p6, L))}</td>
        <td style="padding:10px; text-align:right; font-weight:900;">${badge(permissao(p7, L))}</td>
        <td style="padding:10px; text-align:right; font-weight:900;">${badge(permissao(p4, L))}</td>
        <td style="padding:10px; text-align:right; font-weight:900;">${badge(permissao(p9, L))}</td>
      `;

      tbody.appendChild(tr);
    });

    // Bind inputs (edição inline)
    tbody.querySelectorAll("input[data-field][data-id]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const id = e.target.getAttribute("data-id");
        const field = e.target.getAttribute("data-field");
        const val = e.target.value;

        const idx = fretes.findIndex((x) => x.id === id);
        if (idx < 0) return;

        if (field === "km" || field === "pedagioEixo" || field === "freteMotorista") {
          fretes[idx][field] = val === "" ? "" : Number(val);
        } else {
          fretes[idx][field] = sanitizeText(val);
        }

        saveFretes(fretes);
        // Recalcula permissões em tempo real
        renderTable();
      });
    });
  }

  function badge(v) {
    if (!v) return `<span style="opacity:.55;">-</span>`;
    if (v === "S") {
      return `<span style="display:inline-block; min-width:18px; text-align:center; padding:2px 8px; border-radius:999px; border:1px solid rgba(60,255,160,.45); background:rgba(60,255,160,.10); color:#b7ffd7;">S</span>`;
    }
    return `<span style="display:inline-block; min-width:18px; text-align:center; padding:2px 8px; border-radius:999px; border:1px solid rgba(255,120,120,.45); background:rgba(255,120,120,.10); color:#ffb3b3;">N</span>`;
  }

  // --------- Novo frete ----------
  function bindNovoFrete() {
    const btn = $("btnNovoFrete");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const origem = sanitizeText(prompt("Origem:", "RIO VERDE/GO") || "");
      if (!origem) return;

      const destino = sanitizeText(prompt("Destino:", "SANTOS/SP") || "");
      if (!destino) return;

      const km = Number(prompt("KM:", "950") || "");
      const ped = Number(prompt("Pedágio por eixo (R$):", "10") || "");
      const frete = Number(prompt("Frete Motorista (R$):", "150") || "");

      fretes.unshift({
        id: cryptoId(),
        origem,
        destino,
        km: Number.isFinite(km) ? km : "",
        pedagioEixo: Number.isFinite(ped) ? ped : "",
        freteMotorista: Number.isFinite(frete) ? frete : "",
      });

      saveFretes(fretes);
      renderTable();
    });
  }

  // --------- Storage ----------
  function loadPesos() {
    const raw = localStorage.getItem(keyPesos());
    const obj = safeParseJSON(raw, null);
    if (obj && typeof obj === "object") {
      return {
        p9: Number.isFinite(Number(obj.p9)) ? Number(obj.p9) : DEFAULT_PESOS.p9,
        p4: Number.isFinite(Number(obj.p4)) ? Number(obj.p4) : DEFAULT_PESOS.p4,
        p7: Number.isFinite(Number(obj.p7)) ? Number(obj.p7) : DEFAULT_PESOS.p7,
        p6: Number.isFinite(Number(obj.p6)) ? Number(obj.p6) : DEFAULT_PESOS.p6,
      };
    }
    return { ...DEFAULT_PESOS };
  }

  function savePesos(p) {
    localStorage.setItem(keyPesos(), JSON.stringify(p));
  }

  function loadFretes() {
    const raw = localStorage.getItem(keyFretes());
    const arr = safeParseJSON(raw, null);
    if (Array.isArray(arr) && arr.length) return normalizeFretes(arr);
    // seed
    localStorage.setItem(keyFretes(), JSON.stringify(DEFAULT_FRETES));
    return normalizeFretes(DEFAULT_FRETES);
  }

  function saveFretes(list) {
    localStorage.setItem(keyFretes(), JSON.stringify(list));
  }

  function normalizeFretes(list) {
    return list
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        id: x.id || cryptoId(),
        origem: sanitizeText(x.origem || ""),
        destino: sanitizeText(x.destino || ""),
        km: x.km ?? "",
        pedagioEixo: x.pedagioEixo ?? "",
        freteMotorista: x.freteMotorista ?? "",
      }));
  }

  // --------- Utils ----------
  function cryptoId() {
    // ID simples e confiável
    return "F" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // --------- Boot ----------
  window.addEventListener("DOMContentLoaded", () => {
    // Recarrega escopo (se o auth acabou de logar)
    pesos = loadPesos();
    fretes = loadFretes();

    bindNovoFrete();
    render();
  });
})();
