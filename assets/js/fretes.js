/* fretes.js | NOVA FROTA
   - Tabela Operacional + Permissão Frete Mínimo (5E/6E/7E/4E/9E)
   - Contatos fixos (select)
   - Separação por filial (linhas "grupo" como na planilha)
   - Pesos editáveis salvos por usuário (localStorage)
   - ✅ Botão WhatsApp na coluna Contato (abre wa.me)
*/
(function () {
  "use strict";

  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);

  const FILIAIS_ORDEM = [
    "ITUMBIARA",
    "ANAPOLIS",
    "RIO VERDE",
    "CRISTALINA",
    "BOM JESUS",
    "JATAI",
    "CATALÃO",
    "INDIARA",
    "MINEIROS",
    "MONTIVIDIU",
    "CHAP CÉU"
  ];

  const CONTATOS_FIXOS = [
    "ARIEL 64 99227-7537",
    "JHONATAN",
    "NARCISO",
    "SERGIO",
    "ELTON",
    "EVERALDO",
    "RONE",
    "RAFAEL",
    "KIEWERSON",
    "PIRULITO"
  ];

  const LS_KEY_ROWS = "nf_fretes_rows_v1";
  const LS_KEY_EXAMPLE = "nf_fretes_example_v1";
  const LS_KEY_WEIGHTS_PREFIX = "nf_fretes_weights_";
  const LS_KEY_USER = "nf_auth_user"; // opcional: se seu auth.js não setar, cai no "default"

  function getUserKey() {
    const u = localStorage.getItem(LS_KEY_USER) || localStorage.getItem("nf_user") || "default";
    return String(u).trim().toUpperCase() || "default";
  }

  function formatBRL(v) {
    const n = Number(v);
    if (!isFinite(n)) return "";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function num(v) {
    const n = Number(String(v).replace(",", "."));
    return isFinite(n) ? n : 0;
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function statusClass(st) {
    const s = safeText(st).toUpperCase();
    if (s === "LIBERADO") return "liberado";
    if (s === "PARADO") return "parado";
    return "suspenso";
  }

  // ===== ✅ WhatsApp helpers =====
  function onlyDigits(s) {
    return safeText(s).replace(/\D+/g, "");
  }

  // Extrai número BR do texto.
  // - Se vier "55" + DDD + celular (13 dígitos) mantém.
  // - Se vier DDD + número (10 ou 11) adiciona "55".
  // - Se vier com 0 na frente (ex: 064...), remove o 0 e adiciona 55.
  function extractBRPhone(contatoText) {
    const d = onlyDigits(contatoText);

    if (d.length === 13 && d.startsWith("55")) return d;

    if (d.length === 10 || d.length === 11) return "55" + d;

    if ((d.length === 11 || d.length === 12) && d.startsWith("0")) {
      const cut = d.slice(1);
      if (cut.length === 10 || cut.length === 11) return "55" + cut;
    }

    return "";
  }

  function makeWhatsLink(phoneE164, contatoNome) {
    if (!phoneE164) return "";
    const msg = `Olá ${contatoNome ? contatoNome + ", " : ""}tudo bem?`;
    return `https://wa.me/${phoneE164}?text=${encodeURIComponent(msg)}`;
  }

  // HTML da célula de contato com botão do Whats (se tiver número)
  function contatoCellHTML(rawContato) {
    const label = safeText(rawContato);
    const phone = extractBRPhone(label);
    const nome = label.split(/\d/)[0].trim(); // texto antes do primeiro número

    if (!phone) {
      return `<div class="contatoCell"><span>${label}</span></div>`;
    }

    const link = makeWhatsLink(phone, nome);
    return `
      <div class="contatoCell">
        <span>${label}</span>
        <a class="btnWhats" href="${link}" target="_blank" rel="noopener" title="Chamar no WhatsApp">💬</a>
      </div>
    `;
  }

  // ===== Pesos (editáveis) =====
  const DEFAULT_WEIGHTS = { w9: 47, w4: 39, w7: 36, w6: 31 };

  function loadWeights() {
    const key = LS_KEY_WEIGHTS_PREFIX + getUserKey();
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { ...DEFAULT_WEIGHTS };
      const obj = JSON.parse(raw);
      return {
        w9: isFinite(Number(obj.w9)) ? Number(obj.w9) : DEFAULT_WEIGHTS.w9,
        w4: isFinite(Number(obj.w4)) ? Number(obj.w4) : DEFAULT_WEIGHTS.w4,
        w7: isFinite(Number(obj.w7)) ? Number(obj.w7) : DEFAULT_WEIGHTS.w7,
        w6: isFinite(Number(obj.w6)) ? Number(obj.w6) : DEFAULT_WEIGHTS.w6
      };
    } catch {
      return { ...DEFAULT_WEIGHTS };
    }
  }

  function saveWeights(weights) {
    const key = LS_KEY_WEIGHTS_PREFIX + getUserKey();
    localStorage.setItem(key, JSON.stringify(weights));
  }

  // ===== Permissão (mesma lógica do Sheets) =====
  function permYN(isOk) {
    return isOk ? "S" : "N";
  }

  function calcPerm(row, weights) {
    const km = num(row.km);
    const ped = num(row.pedagioEixo);
    const mot = num(row.valorMotorista);

    if (!km || km <= 0 || !isFinite(km) || row.km === "") return { p5: "", p6: "", p7: "", p4: "", p9: "" };
    if (!isFinite(ped)) return { p5: "", p6: "", p7: "", p4: "", p9: "" };
    if (!isFinite(mot) || mot <= 0) return { p5: "", p6: "", p7: "", p4: "", p9: "" };

    const t5 = ((km * 6.0301) + (ped * 5) + 615.26) / 26;
    const t6 = ((km * 6.7408) + (ped * 6) + 663.07) / Math.max(1, num(weights.w6));
    const t7 = ((km * 7.313) + (ped * 7) + 753.88) / Math.max(1, num(weights.w7));
    const t4 = ((km * 7.313) + (ped * 7) + 753.88) / Math.max(1, num(weights.w4));
    const t9 = ((km * 8.242) + (ped * 9) + 808.17) / Math.max(1, num(weights.w9));

    return {
      p5: permYN(t5 < mot),
      p6: permYN(t6 < mot),
      p7: permYN(t7 < mot),
      p4: permYN(t4 < mot),
      p9: permYN(t9 < mot)
    };
  }

  // ===== Dados (local) =====
  function exampleRows() {
    return [
      {
        id: crypto.randomUUID(),
        regional: "GOIÁS",
        filial: "INDIARA",
        cliente: "CERRADINHO",
        origem: "INDIARA/GO",
        coleta: "GOIASCAL",
        contato: "RAFAEL",
        destino: "CHAPADÃO DO CÉU/GO",
        uf: "GO",
        descarga: "USINA CERRADINHO",
        volume: 5000,
        valorEmpresa: 95,
        valorMotorista: 85,
        km: 396,
        pedagioEixo: 0,
        produto: "CALCÁRIO",
        icms: "ISENTO (CIF)",
        pedidoSat: 10453,
        qtdPorta: 0,
        qtdTransito: 0,
        status: "LIBERADO",
        obs: ""
      },
      {
        id: crypto.randomUUID(),
        regional: "GOIÁS",
        filial: "JATAI",
        cliente: "CARGILL",
        origem: "JATAI/GO",
        coleta: "ARMAZ BOA ESPERANÇA",
        contato: "RONE",
        destino: "ITUMBIARA/GO",
        uf: "GO",
        descarga: "CARAMURU",
        volume: 0,
        valorEmpresa: 80,
        valorMotorista: 73,
        km: 330,
        pedagioEixo: 0,
        produto: "MILHO",
        icms: "ISENTO (CIF)",
        pedidoSat: 0,
        qtdPorta: 2,
        qtdTransito: 3,
        status: "LIBERADO",
        obs: ""
      },
      {
        id: crypto.randomUUID(),
        regional: "GOIÁS",
        filial: "ANAPOLIS",
        cliente: "OURO SAFRA",
        origem: "ÁGUA FRIA DE GOIÁS-GO",
        coleta: "FAZ. ARAÇÁ",
        contato: "SERGIO",
        destino: "CABECEIRAS",
        uf: "GO",
        descarga: "GRANJA MANTIQUEIRA",
        volume: 75,
        valorEmpresa: 75,
        valorMotorista: 60,
        km: 106,
        pedagioEixo: 0,
        produto: "MILHO",
        icms: "ISENTO (CIF)",
        pedidoSat: 12245,
        qtdPorta: 0,
        qtdTransito: 0,
        status: "PARADO",
        obs: ""
      }
    ];
  }

  function loadRows() {
    const hasExample = localStorage.getItem(LS_KEY_EXAMPLE) === "1";
    const raw = localStorage.getItem(LS_KEY_ROWS);
    if (!raw) {
      localStorage.setItem(LS_KEY_EXAMPLE, "1");
      const ex = exampleRows();
      localStorage.setItem(LS_KEY_ROWS, JSON.stringify(ex));
      return ex;
    }
    try {
      const rows = JSON.parse(raw);
      if (!Array.isArray(rows)) throw new Error("bad");
      if (rows.length === 0 && hasExample) {
        const ex = exampleRows();
        localStorage.setItem(LS_KEY_ROWS, JSON.stringify(ex));
        return ex;
      }
      return rows;
    } catch {
      const ex = exampleRows();
      localStorage.setItem(LS_KEY_ROWS, JSON.stringify(ex));
      localStorage.setItem(LS_KEY_EXAMPLE, "1");
      return ex;
    }
  }

  function saveRows(rows) {
    localStorage.setItem(LS_KEY_ROWS, JSON.stringify(rows));
  }

  // ===== UI: selects fixos =====
  function fillFilialSelect(sel, includeAll) {
    sel.innerHTML = "";
    if (includeAll) {
      const op = document.createElement("option");
      op.value = "";
      op.textContent = "Todas";
      sel.appendChild(op);
    }
    FILIAIS_ORDEM.forEach((f) => {
      const op = document.createElement("option");
      op.value = f;
      op.textContent = f;
      sel.appendChild(op);
    });
  }

  function fillContatoSelect(sel) {
    sel.innerHTML = "";
    CONTATOS_FIXOS.forEach((c) => {
      const op = document.createElement("option");
      op.value = c;
      op.textContent = c;
      sel.appendChild(op);
    });
  }

  // ===== Render =====
  function matchesSearch(row, q) {
    if (!q) return true;
    const blob = [
      row.regional, row.filial, row.cliente, row.origem, row.coleta, row.contato,
      row.destino, row.uf, row.descarga, row.produto, row.icms, row.status, row.obs
    ].join(" ").toLowerCase();
    return blob.includes(q.toLowerCase());
  }

  function orderFilialIndex(f) {
    const i = FILIAIS_ORDEM.indexOf(safeText(f).toUpperCase());
    return i >= 0 ? i : 9999;
  }

  function render(rows, weights) {
    const tbody = $("tbody");
    const fFilial = $("fFilial").value;
    const fBusca = $("fBusca").value.trim();

    let list = rows.filter((r) => {
      if (fFilial && safeText(r.filial).toUpperCase() !== fFilial) return false;
      if (!matchesSearch(r, fBusca)) return false;
      return true;
    });

    list = list.slice().sort((a, b) => {
      const ia = orderFilialIndex(a.filial);
      const ib = orderFilialIndex(b.filial);
      if (ia !== ib) return ia - ib;
      const da = safeText(a.destino);
      const db = safeText(b.destino);
      if (da !== db) return da.localeCompare(db, "pt-BR");
      return safeText(a.cliente).localeCompare(safeText(b.cliente), "pt-BR");
    });

    tbody.innerHTML = "";

    let currentFilial = null;
    list.forEach((row) => {
      const filial = safeText(row.filial).toUpperCase();

      if (filial !== currentFilial) {
        currentFilial = filial;
        const trG = document.createElement("tr");
        trG.className = "groupRow";
        const tdG = document.createElement("td");
        tdG.colSpan = 27;
        tdG.textContent = filial || "SEM FILIAL";
        trG.appendChild(tdG);
        tbody.appendChild(trG);
      }

      const perm = calcPerm(row, weights);

      const tr = document.createElement("tr");
      tr.className = "rowSlim";

      const cells = [
        safeText(row.regional),
        safeText(row.filial),
        safeText(row.cliente),
        safeText(row.origem),
        safeText(row.coleta),

        // ✅ Contato com botão Whats
        { html: true, v: contatoCellHTML(row.contato) },

        safeText(row.destino),
        safeText(row.uf),
        safeText(row.descarga),
        { num: true, v: safeText(row.volume) },
        { num: true, v: formatBRL(row.valorEmpresa) },
        { num: true, v: formatBRL(row.valorMotorista) },
        { num: true, v: safeText(row.km) },
        { num: true, v: safeText(row.pedagioEixo) },
        { yn: true, v: perm.p5 },
        { yn: true, v: perm.p6 },
        { yn: true, v: perm.p7 },
        { yn: true, v: perm.p4 },
        { yn: true, v: perm.p9 },
        safeText(row.produto),
        safeText(row.icms),
        { num: true, v: safeText(row.pedidoSat) },
        { num: true, v: safeText(row.qtdPorta) },
        { num: true, v: safeText(row.qtdTransito) },
        { status: true, v: safeText(row.status) },
        safeText(row.obs),
        { actions: true }
      ];

      cells.forEach((c) => {
        const td = document.createElement("td");

        if (typeof c === "object" && c) {
          if (c.num) td.classList.add("num");

          if (c.yn) {
            const span = document.createElement("span");
            span.className = "pillYN " + (c.v === "S" ? "yes" : (c.v === "N" ? "no" : ""));
            span.textContent = c.v || "";
            td.classList.add("num");
            td.appendChild(span);
          } else if (c.status) {
            const s = safeText(c.v).toUpperCase() || "SUSPENSO";
            const span = document.createElement("span");
            span.className = "statusPill " + statusClass(s);
            span.textContent = s;
            td.appendChild(span);
          } else if (c.actions) {
            td.classList.add("num");
            const btnEdit = document.createElement("button");
            btnEdit.className = "btnSmall";
            btnEdit.style.padding = "7px 10px";
            btnEdit.textContent = "Editar";
            btnEdit.addEventListener("click", () => openModal("edit", row.id));

            const btnDel = document.createElement("button");
            btnDel.className = "btnSmall";
            btnDel.style.padding = "7px 10px";
            btnDel.style.marginLeft = "8px";
            btnDel.textContent = "Excluir";
            btnDel.addEventListener("click", () => removeRow(row.id));

            td.appendChild(btnEdit);
            td.appendChild(btnDel);
          } else if (c.html) {
            td.innerHTML = c.v || "";
          } else {
            td.textContent = c.v ?? "";
          }
        } else {
          td.textContent = c ?? "";
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ===== Modal CRUD =====
  let state = {
    rows: [],
    editId: null,
    weights: { ...DEFAULT_WEIGHTS }
  };

  function openModal(mode, id) {
    state.editId = mode === "edit" ? id : null;

    const r = mode === "edit" ? state.rows.find((x) => x.id === id) : null;

    $("mRegional").value = r ? r.regional : "GOIÁS";
    $("mFilial").value = r ? safeText(r.filial).toUpperCase() : "ITUMBIARA";
    $("mCliente").value = r ? r.cliente : "";
    $("mOrigem").value = r ? r.origem : "";
    $("mColeta").value = r ? r.coleta : "";
    $("mContato").value = r ? (r.contato || CONTATOS_FIXOS[0]) : CONTATOS_FIXOS[0];
    $("mDestino").value = r ? r.destino : "";
    $("mUF").value = r ? r.uf : "GO";
    $("mDescarga").value = r ? r.descarga : "";
    $("mProduto").value = r ? r.produto : "";
    $("mKM").value = r ? r.km : "";
    $("mPed").value = r ? r.pedagioEixo : 0;
    $("mVolume").value = r ? r.volume : "";
    $("mEmpresa").value = r ? r.valorEmpresa : "";
    $("mMotorista").value = r ? r.valorMotorista : "";
    $("mICMS").value = r ? r.icms : "";
    $("mSat").value = r ? r.pedidoSat : "";
    $("mPorta").value = r ? r.qtdPorta : "";
    $("mTransito").value = r ? r.qtdTransito : "";
    $("mStatus").value = r ? safeText(r.status).toUpperCase() : "LIBERADO";
    $("mObs").value = r ? r.obs : "";

    $("modal").style.display = "flex";
  }

  function closeModal() {
    $("modal").style.display = "none";
    state.editId = null;
  }

  function collectModal() {
    return {
      id: state.editId || crypto.randomUUID(),
      regional: safeText($("mRegional").value),
      filial: safeText($("mFilial").value).toUpperCase(),
      cliente: safeText($("mCliente").value),
      origem: safeText($("mOrigem").value),
      coleta: safeText($("mColeta").value),
      contato: safeText($("mContato").value),
      destino: safeText($("mDestino").value),
      uf: safeText($("mUF").value).toUpperCase(),
      descarga: safeText($("mDescarga").value),
      volume: num($("mVolume").value),
      valorEmpresa: num($("mEmpresa").value),
      valorMotorista: num($("mMotorista").value),
      km: num($("mKM").value),
      pedagioEixo: num($("mPed").value),
      produto: safeText($("mProduto").value),
      icms: safeText($("mICMS").value),
      pedidoSat: $("mSat").value === "" ? "" : num($("mSat").value),
      qtdPorta: $("mPorta").value === "" ? "" : num($("mPorta").value),
      qtdTransito: $("mTransito").value === "" ? "" : num($("mTransito").value),
      status: safeText($("mStatus").value).toUpperCase(),
      obs: safeText($("mObs").value)
    };
  }

  function upsertRow(row) {
    const idx = state.rows.findIndex((x) => x.id === row.id);
    if (idx >= 0) state.rows[idx] = row;
    else state.rows.unshift(row);
    saveRows(state.rows);
    render(state.rows, state.weights);
  }

  function removeRow(id) {
    if (!confirm("Excluir este frete?")) return;
    state.rows = state.rows.filter((x) => x.id !== id);
    saveRows(state.rows);
    render(state.rows, state.weights);
  }

  // ===== Init =====
  function init() {
    fillFilialSelect($("fFilial"), true);
    fillFilialSelect($("mFilial"), false);
    fillContatoSelect($("mContato"));

    state.weights = loadWeights();
    $("w9").value = state.weights.w9;
    $("w4").value = state.weights.w4;
    $("w7").value = state.weights.w7;
    $("w6").value = state.weights.w6;

    $("btnSaveWeights").addEventListener("click", () => {
      const w = {
        w9: num($("w9").value) || DEFAULT_WEIGHTS.w9,
        w4: num($("w4").value) || DEFAULT_WEIGHTS.w4,
        w7: num($("w7").value) || DEFAULT_WEIGHTS.w7,
        w6: num($("w6").value) || DEFAULT_WEIGHTS.w6
      };
      state.weights = w;
      saveWeights(w);
      render(state.rows, state.weights);
      alert("Pesos salvos ✅");
    });

    $("btnResetWeights").addEventListener("click", () => {
      state.weights = { ...DEFAULT_WEIGHTS };
      $("w9").value = state.weights.w9;
      $("w4").value = state.weights.w4;
      $("w7").value = state.weights.w7;
      $("w6").value = state.weights.w6;
      saveWeights(state.weights);
      render(state.rows, state.weights);
    });

    state.rows = loadRows();

    $("fFilial").addEventListener("change", () => render(state.rows, state.weights));
    $("fBusca").addEventListener("input", () => render(state.rows, state.weights));

    $("btnNew").addEventListener("click", () => openModal("new"));
    $("btnResetExample").addEventListener("click", () => {
      if (!confirm("Restaurar o exemplo local? Isso substitui sua lista atual.")) return;
      const ex = exampleRows();
      state.rows = ex;
      localStorage.setItem(LS_KEY_EXAMPLE, "1");
      saveRows(state.rows);
      render(state.rows, state.weights);
    });

    $("btnCloseModal").addEventListener("click", closeModal);
    $("btnCancel").addEventListener("click", closeModal);
    $("btnSave").addEventListener("click", () => {
      const row = collectModal();
      if (!row.filial) {
        alert("Selecione uma filial.");
        return;
      }
      if (!row.contato) {
        alert("Selecione um contato.");
        return;
      }
      upsertRow(row);
      closeModal();
    });

    render(state.rows, state.weights);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
