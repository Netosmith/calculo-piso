/* Fretes | NOVA FROTA
   - Tabela “planilha”
   - Pesos editáveis (salvos por usuário no navegador)
   - Permissão Frete Mínimo (S/N) conforme fórmulas do Google Sheets
*/

(function () {
  "use strict";

  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);

  function toNum(v) {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtNum(n, dec = 2) {
    const v = Number.isFinite(n) ? n : 0;
    return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function getLoggedUser() {
    // tenta reaproveitar algum “badge”/storage do seu sistema
    // se não achar, usa "default"
    try {
      const b = document.querySelector("#userBadge");
      if (b && b.textContent) return b.textContent.trim() || "default";
    } catch {}
    return localStorage.getItem("nf_last_user") || "default";
  }

  // ===== Storage keys (por usuário) =====
  const USER = getLoggedUser();
  const KEY_WEIGHTS = `nf_fretes_weights_${USER}`;
  const KEY_ROWS = `nf_fretes_rows_${USER}`;

  // ===== Elementos =====
  const elW9 = $("w9");
  const elW4 = $("w4");
  const elW7 = $("w7");
  const elW6 = $("w6");

  const tbody = $("tbodyFretes");
  const btnAdd = $("btnAdd");
  const btnReset = $("btnReset");

  // ===== Pesos (default) =====
  const DEFAULT_WEIGHTS = { w9: 47, w4: 39, w7: 36, w6: 31 };

  // ===== Linhas de exemplo =====
  const DEFAULT_ROWS = [
    { origem: "INDIARA-GO", destino: "SÃO SIMÃO-GO", km: 950, pedagioEixo: 10, freteMotorista: 310 },
    { origem: "RIO VERDE-GO", destino: "SANTOS-SP", km: 950, pedagioEixo: 10.5, freteMotorista: 300.01 },
    { origem: "JATAÍ-GO", destino: "GUARUJÁ-SP", km: 1030, pedagioEixo: 12, freteMotorista: 165 },
    { origem: "SANTA HELENA-GO", destino: "SANTOS-SP", km: 980, pedagioEixo: 9.75, freteMotorista: 148 },
  ];

  // ===== Cálculo Permissão (igual suas fórmulas) =====
  // Observação: mantive EXATAMENTE os coeficientes/constantes que você passou.
  // Regra: se pisoCalculado < freteMotorista => "S" senão "N"
  function calcPermissoes(row, weights) {
    const km = toNum(row.km);
    const ped = toNum(row.pedagioEixo);
    const L = toNum(row.freteMotorista);

    if (!km || km <= 0 || row.km === "" || !ped && ped !== 0 || row.pedagioEixo === "" || !L || L <= 0) {
      return { p5: "", p6: "", p7: "", p4: "", p9: "" };
    }

    // 5 eixos: ((KM*6,0301) + (Ped*5) + 615,26) / 26
    const piso5 = ((km * 6.0301) + (ped * 5) + 615.26) / 26;

    // 6 eixos: ((KM*6,7408) + (Ped*6) + 663,07) / R5  -> aqui R5 = peso 6 eixos
    const piso6 = ((km * 6.7408) + (ped * 6) + 663.07) / (toNum(weights.w6) || 1);

    // 7 eixos: ((KM*7,313) + (Ped*7) + 753,88) / R4 -> aqui R4 = peso 7 eixos
    const piso7 = ((km * 7.313) + (ped * 7) + 753.88) / (toNum(weights.w7) || 1);

    // 4 eixos: você passou igual ao 7 eixos porém /R3 (peso 4º eixo)
    const piso4 = ((km * 7.313) + (ped * 7) + 753.88) / (toNum(weights.w4) || 1);

    // 9 eixos: ((KM*8,242) + (Ped*9) + 808,17) / R2 (peso 9 eixos)
    const piso9 = ((km * 8.242) + (ped * 9) + 808.17) / (toNum(weights.w9) || 1);

    return {
      p5: piso5 < L ? "S" : "N",
      p6: piso6 < L ? "S" : "N",
      p7: piso7 < L ? "S" : "N",
      p4: piso4 < L ? "S" : "N",
      p9: piso9 < L ? "S" : "N",
    };
  }

  // ===== Carregar/Salvar =====
  function loadWeights() {
    try {
      const raw = localStorage.getItem(KEY_WEIGHTS);
      if (!raw) return { ...DEFAULT_WEIGHTS };
      const parsed = JSON.parse(raw);
      return {
        w9: toNum(parsed.w9) || DEFAULT_WEIGHTS.w9,
        w4: toNum(parsed.w4) || DEFAULT_WEIGHTS.w4,
        w7: toNum(parsed.w7) || DEFAULT_WEIGHTS.w7,
        w6: toNum(parsed.w6) || DEFAULT_WEIGHTS.w6,
      };
    } catch {
      return { ...DEFAULT_WEIGHTS };
    }
  }

  function saveWeights(w) {
    localStorage.setItem(KEY_WEIGHTS, JSON.stringify(w));
  }

  function loadRows() {
    try {
      const raw = localStorage.getItem(KEY_ROWS);
      if (!raw) return [...DEFAULT_ROWS];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [...DEFAULT_ROWS];
      return parsed.map((r) => ({
        origem: r.origem ?? "",
        destino: r.destino ?? "",
        km: r.km ?? "",
        pedagioEixo: r.pedagioEixo ?? "",
        freteMotorista: r.freteMotorista ?? "",
      }));
    } catch {
      return [...DEFAULT_ROWS];
    }
  }

  function saveRows(rows) {
    localStorage.setItem(KEY_ROWS, JSON.stringify(rows));
  }

  // ===== Render =====
  let weights = loadWeights();
  let rows = loadRows();

  function setWeightInputs() {
    elW9.value = weights.w9;
    elW4.value = weights.w4;
    elW7.value = weights.w7;
    elW6.value = weights.w6;
  }

  function render() {
    tbody.innerHTML = "";

    rows.forEach((row, idx) => {
      const perms = calcPermissoes(row, weights);

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td><input class="cell" data-k="origem" data-i="${idx}" value="${escapeHtml(String(row.origem ?? ""))}" /></td>
        <td><input class="cell" data-k="destino" data-i="${idx}" value="${escapeHtml(String(row.destino ?? ""))}" /></td>

        <td class="num"><input class="cell num" data-k="km" data-i="${idx}" value="${escapeHtml(String(row.km ?? ""))}" /></td>
        <td class="num"><input class="cell num" data-k="pedagioEixo" data-i="${idx}" value="${escapeHtml(String(row.pedagioEixo ?? ""))}" /></td>
        <td class="num"><input class="cell num" data-k="freteMotorista" data-i="${idx}" value="${escapeHtml(String(row.freteMotorista ?? ""))}" /></td>

        <td class="num">${pill(perms.p5)}</td>
        <td class="num">${pill(perms.p6)}</td>
        <td class="num">${pill(perms.p7)}</td>
        <td class="num">${pill(perms.p4)}</td>
        <td class="num">${pill(perms.p9)}</td>
      `;

      tbody.appendChild(tr);
    });
  }

  function pill(v) {
    if (!v) return "";
    const cls = v === "S" ? "S" : "N";
    return `<span class="pillSN ${cls}">${v}</span>`;
  }

  function escapeHtml(str) {
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ===== Eventos =====
  function bind() {
    // Pesos: ao digitar, salva e recalcula
    const onWeightChange = () => {
      weights = {
        w9: toNum(elW9.value) || DEFAULT_WEIGHTS.w9,
        w4: toNum(elW4.value) || DEFAULT_WEIGHTS.w4,
        w7: toNum(elW7.value) || DEFAULT_WEIGHTS.w7,
        w6: toNum(elW6.value) || DEFAULT_WEIGHTS.w6,
      };
      saveWeights(weights);
      render();
    };

    [elW9, elW4, elW7, elW6].forEach((el) => {
      el.addEventListener("input", onWeightChange);
      el.addEventListener("change", onWeightChange);
    });

    // Inputs da “planilha”
    tbody.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (!t.dataset.k || t.dataset.i === undefined) return;

      const i = Number(t.dataset.i);
      const k = t.dataset.k;

      if (!rows[i]) return;

      // campos numéricos
      if (k === "km" || k === "pedagioEixo" || k === "freteMotorista") {
        // permite vírgula
        rows[i][k] = t.value;
      } else {
        rows[i][k] = t.value.toUpperCase();
      }

      saveRows(rows);
      render(); // recalcula S/N em tempo real
    });

    // Novo frete
    btnAdd.addEventListener("click", () => {
      rows.unshift({ origem: "", destino: "", km: "", pedagioEixo: "", freteMotorista: "" });
      saveRows(rows);
      render();
      // foco no primeiro campo
      setTimeout(() => {
        const first = tbody.querySelector('input[data-k="origem"][data-i="0"]');
        if (first) first.focus();
      }, 10);
    });

    // Reset exemplo
    btnReset.addEventListener("click", () => {
      rows = [...DEFAULT_ROWS];
      saveRows(rows);
      weights = { ...DEFAULT_WEIGHTS };
      saveWeights(weights);
      setWeightInputs();
      render();
    });
  }

  // ===== Init =====
  function init() {
    setWeightInputs();
    bind();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
