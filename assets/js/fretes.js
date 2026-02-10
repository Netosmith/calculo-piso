/* fretes.js | NOVA FROTA
   - Operacional + Permissão Frete Mínimo
   - Contatos fixos
   - Separação por filial
   - Pesos por usuário
   - Sync com Google Sheets via JSONP
   - Botão Share Clientes
   - Botão WhatsApp no Contato (se tiver número)
*/
(function () {
  "use strict";

  /********************
   * CONFIG
   ********************/
  const API_URL = "https://script.google.com/macros/s/AKfycbzbRKO6O7RdN50TKkXGKWu8vyISGVBGVRnnx561Su2MnIzOINHeU1TqV86N7LS2C8o/exec";

  const LS_KEY_ROWS = "nf_fretes_rows_v1";
  const LS_KEY_WEIGHTS_PREFIX = "nf_fretes_weights_";
  const LS_KEY_USER = "nf_auth_user";

  const FILIAIS_ORDEM = [
    "ITUMBIARA", "ANAPOLIS", "RIO VERDE", "CRISTALINA", "BOM JESUS", "JATAI",
    "CATALÃO", "INDIARA", "MINEIROS", "MONTIVIDIU", "CHAP CÉU"
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

  /********************
   * HELPERS
   ********************/
  const $ = (id) => document.getElementById(id);

  function getUserKey() {
    const u = localStorage.getItem(LS_KEY_USER) || localStorage.getItem("nf_user") || "default";
    return String(u).trim().toUpperCase() || "default";
  }

  function safeText(v) { return (v ?? "").toString().trim(); }

  function num(v) {
    const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    return isFinite(n) ? n : 0;
  }

  function formatBRL(v) {
    const n = Number(v);
    if (!isFinite(n)) return "";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function statusClass(st) {
    const s = safeText(st).toUpperCase();
    if (s === "LIBERADO") return "liberado";
    if (s === "PARADO") return "parado";
    return "suspenso";
  }

  function updateSyncStatus(status, message) {
    const el = $("syncStatus");
    if (!el) return;

    if (status === "loading") {
      el.textContent = "🔄 " + (message || "Carregando...");
      el.style.color = "#5B7CFA";
    } else if (status === "success") {
      el.textContent = "✅ " + (message || "Sincronizado");
      el.style.color = "#067647";
    } else if (status === "error") {
      el.textContent = "❌ " + (message || "Falha ao carregar");
      el.style.color = "#991B1B";
    }
  }

  // Extrai telefone do contato (ex: "ARIEL 64 99227-7537")
  function extractPhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";
    let digits = s.replace(/\D/g, "");
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return "";
  }

  function whatsappLinkFromContato(contato) {
    const phone = extractPhoneBR(contato);
    return phone ? ("https://wa.me/" + phone) : "";
  }

  // JSONP (resolve CORS no GitHub Pages)
  function jsonp(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";
      let done = false;

      const t = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("Timeout JSONP: servidor não chamou callback (deploy/permissão/erro no script)."));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(t);
        try { delete window[cb]; } catch {}
        s.remove();
      }

      window[cb] = (data) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(data);
      };

      s.src = url + sep + "callback=" + encodeURIComponent(cb);
      s.onerror = () => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("Falha JSONP: não foi possível carregar o script remoto."));
      };

      document.head.appendChild(s);
    });
  }

  /********************
   * PESOS
   ********************/
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

  /********************
   * PERMISSÃO
   ********************/
  function permYN(isOk) { return isOk ? "S" : "N"; }

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

  /********************
   * STORAGE
   ********************/
  function saveRowsLocal(rows) { localStorage.setItem(LS_KEY_ROWS, JSON.stringify(rows)); }

  function loadRowsLocal() {
    const raw = localStorage.getItem(LS_KEY_ROWS);
    if (!raw) return [];
    try {
      const rows = JSON.parse(raw);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  /********************
   * SHEETS SYNC (ROBUSTO)
   ********************/
  // Helper para pegar campo com vários nomes possíveis
  function getFieldValue(row, possibleNames) {
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
        return row[name];
      }
    }
    return "";
  }

  function normalizeFromSheets(payload) {
    // ✅ Aceita:
    // 1) Array direto: [ {...}, {...} ]
    // 2) Wrapper: {rows:[...]} ou {data:[...]} ou {ok:true, rows:[...]}
    // 3) Erro: {ok:false, error:"..."}  -> lança erro real
    let rows = payload;

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      if (payload.ok === false) throw new Error(payload.error || "Apps Script retornou ok:false");
      if (Array.isArray(payload.rows)) rows = payload.rows;
      else if (Array.isArray(payload.data)) rows = payload.data;
      else {
        // caso venha algum objeto inesperado
        throw new Error("Resposta do Sheets não é lista. Recebido: " + JSON.stringify(payload).slice(0, 200));
      }
    }

    if (!Array.isArray(rows)) {
      throw new Error("Resposta do Sheets não é array. Tipo: " + (typeof rows));
    }

    return rows.map((r) => {
      // 🔍 Log para debug - vamos ver o que está vindo do Sheets
      if (rows.indexOf(r) === 0) {
        console.log("📋 Primeira linha do Sheets (debug):", r);
        console.log("📋 Chaves disponíveis:", Object.keys(r));
      }

      return {
        id: safeText(r.id) || crypto.randomUUID(),
        regional: safeText(r.regional),
        filial: safeText(r.filial).toUpperCase(),
        cliente: safeText(r.cliente),
        origem: safeText(r.origem),
        coleta: safeText(r.coleta),
        contato: safeText(r.contato),
        destino: safeText(r.destino),
        uf: safeText(r.uf).toUpperCase(),
        descarga: safeText(r.descarga),

        volume: r.volume === "" ? "" : num(r.volume),
        valorEmpresa: r.valorEmpresa === "" ? "" : num(r.valorEmpresa),
        valorMotorista: r.valorMotorista === "" ? "" : num(r.valorMotorista),
        pedagioEixo: r.pedagioEixo === "" ? "" : num(r.pedagioEixo),
        km: r.km === "" ? "" : num(r.km),

        produto: safeText(r.produto),
        icms: safeText(r.icms),

        // ✅ Aceita vários nomes possíveis para as colunas de quantidade
        pedidoSat: (() => {
          const val = getFieldValue(r, ["pedidoSat", "Pedido SAT", "pedido_sat", "sat"]);
          return (val && num(val) > 0) ? num(val) : "";
        })(),
        
        qtdPorta: (() => {
          const val = getFieldValue(r, ["qtdPorta", "qtPorta", "Qtd Porta", "qtd_porta", "porta", "qtdLocal", "Qtd Local"]);
          const n = num(val);
          console.log(`🔍 qtdPorta para cliente ${r.cliente}: valor="${val}", num=${n}, result=${(val && n > 0) ? n : ""}`);
          return (val && n > 0) ? n : "";
        })(),
        
        qtdTransito: (() => {
          const val = getFieldValue(r, ["qtdTransito", "Qtd Trânsito", "Qtd Transito", "qtd_transito", "transito"]);
          const n = num(val);
          console.log(`🔍 qtdTransito para cliente ${r.cliente}: valor="${val}", num=${n}, result=${(val && n > 0) ? n : ""}`);
          return (val && n > 0) ? n : "";
        })(),

        status: safeText(r.status).toUpperCase(),
        obs: safeText(r.obs || "")
      };
    });
  }

  async function reloadFromServer() {
    updateSyncStatus("loading", "Carregando do Sheets...");
    const payload = await jsonp(API_URL + "?action=list");
    const rows = normalizeFromSheets(payload);

    state.rows = rows;
    saveRowsLocal(rows);
    render(state.rows, state.weights);

    updateSyncStatus("success", `Sincronizado (${rows.length} fretes)`);
  }

  async function saveRowToSheets(row) {
    console.log("🚀 saveRowToSheets - ANTES de enviar:");
    console.log("  - row completo:", JSON.stringify(row, null, 2));
    console.log("  - qtPorta:", row.qtPorta, "(tipo:", typeof row.qtPorta, ")");
    console.log("  - qtdTransito:", row.qtdTransito, "(tipo:", typeof row.qtdTransito, ")");
    
    const params = new URLSearchParams();
    params.append("action", "save");
    
    const jsonData = JSON.stringify(row);
    console.log("📦 JSON enviado:", jsonData);
    params.append("data", jsonData);
    
    const fullUrl = `${API_URL}?${params.toString()}`;
    console.log("🌐 URL completa:", fullUrl);
    
    const result = await jsonp(fullUrl);
    
    console.log("✅ Resposta do servidor:", result);

    if (!result || result.ok === false || result.status !== "success") {
      console.error("❌ ERRO na resposta:", result);
      throw new Error((result && (result.error || result.message)) || "Erro ao salvar no Sheets");
    }
    return result;
  }

  async function deleteRowFromSheets(id) {
    const params = new URLSearchParams();
    params.append("action", "delete");
    params.append("id", id);
    const result = await jsonp(`${API_URL}?${params.toString()}`);

    if (!result || result.ok === false || result.status !== "success") {
      throw new Error((result && (result.error || result.message)) || "Erro ao deletar no Sheets");
    }
    return result;
  }

  /********************
   * UI: SELECTS
   ********************/
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

  /********************
   * RENDER
   ********************/
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

      const wpp = whatsappLinkFromContato(row.contato);

      const cells = [
        safeText(row.regional),
        safeText(row.filial),
        safeText(row.cliente),
        safeText(row.origem),
        safeText(row.coleta),

        // contato + botão whatsapp
        {
          contact: true,
          v: safeText(row.contato),
          wpp
        },

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
        { num: true, v: row.pedidoSat ? safeText(row.pedidoSat) : "" },
        { num: true, v: row.qtdPorta ? safeText(row.qtdPorta) : "" },
        { num: true, v: row.qtdTransito ? safeText(row.qtdTransito) : "" },
        { status: true, v: safeText(row.status) },
        safeText(row.obs),
        { actions: true }
      ];

      cells.forEach((c) => {
        const td = document.createElement("td");

        if (typeof c === "object" && c) {
          if (c.num) td.classList.add("num");

          if (c.contact) {
            const wrap = document.createElement("div");
            wrap.style.display = "flex";
            wrap.style.alignItems = "center";
            wrap.style.justifyContent = "space-between";
            wrap.style.gap = "8px";

            const span = document.createElement("span");
            span.textContent = c.v || "";
            span.style.overflow = "hidden";
            span.style.textOverflow = "ellipsis";
            span.style.whiteSpace = "nowrap";

            wrap.appendChild(span);

            if (c.wpp) {
              const a = document.createElement("a");
              a.href = c.wpp;
              a.target = "_blank";
              a.rel = "noopener";
              a.title = "Chamar no WhatsApp";
              a.textContent = "WhatsApp";
              a.className = "btnTiny green";
              a.style.padding = "6px 10px";
              a.style.whiteSpace = "nowrap";
              wrap.appendChild(a);
            }

            td.appendChild(wrap);
          } else if (c.yn) {
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

  /********************
   * MODAL CRUD
   ********************/
  let state = { rows: [], editId: null, weights: { ...DEFAULT_WEIGHTS } };

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
    const mPortaValue = $("mPorta").value;
    const mTransitoValue = $("mTransito").value;
    
    console.log("📝 collectModal - Lendo campos do formulário:");
    console.log("  - Campo mPorta.value:", mPortaValue, "(tipo:", typeof mPortaValue, ")");
    console.log("  - Campo mTransito.value:", mTransitoValue, "(tipo:", typeof mTransitoValue, ")");
    
    const qtdPortaFinal = mPortaValue === "" ? "" : num(mPortaValue);
    const qtdTransitoFinal = mTransitoValue === "" ? "" : num(mTransitoValue);
    
    console.log("  - qtdPorta após num():", qtdPortaFinal, "(tipo:", typeof qtdPortaFinal, ")");
    console.log("  - qtdTransito após num():", qtdTransitoFinal, "(tipo:", typeof qtdTransitoFinal, ")");
    
    return {
      id: state.editId || "", // se vazio, Apps Script cria no final
      regional: safeText($("mRegional").value),
      filial: safeText($("mFilial").value).toUpperCase(),
      cliente: safeText($("mCliente").value),
      origem: safeText($("mOrigem").value),
      coleta: safeText($("mColeta").value),
      contato: safeText($("mContato").value),
      destino: safeText($("mDestino").value),
      uf: safeText($("mUF").value).toUpperCase(),
      descarga: safeText($("mDescarga").value),

      volume: $("mVolume").value === "" ? "" : num($("mVolume").value),
      valorEmpresa: $("mEmpresa").value === "" ? "" : num($("mEmpresa").value),
      valorMotorista: $("mMotorista").value === "" ? "" : num($("mMotorista").value),
      km: $("mKM").value === "" ? "" : num($("mKM").value),
      pedagioEixo: $("mPed").value === "" ? "" : num($("mPed").value),

      produto: safeText($("mProduto").value),
      icms: safeText($("mICMS").value),
      pedidoSat: $("mSat").value === "" ? "" : num($("mSat").value),
      qtdPorta: qtdPortaFinal,
      qtdTransito: qtdTransitoFinal,
      status: safeText($("mStatus").value).toUpperCase(),
      obs: safeText($("mObs").value)
    };
  }

  async function upsertRow(row) {
    console.log("🔄 upsertRow - Objeto recebido do collectModal:");
    console.log("  - qtdPorta:", row.qtdPorta, "(tipo:", typeof row.qtdPorta, ")");
    console.log("  - qtdTransito:", row.qtdTransito, "(tipo:", typeof row.qtdTransito, ")");
    
    // 🔧 Mapeia qtdPorta para qtPorta (nome usado no Google Sheets)
    const mappedRow = {
      ...row,
      qtPorta: row.qtdPorta,  // Mapeia para o nome correto
    };
    delete mappedRow.qtdPorta;  // Remove o nome antigo
    
    console.log("🗺️ upsertRow - Após mapeamento:");
    console.log("  - qtPorta:", mappedRow.qtPorta, "(tipo:", typeof mappedRow.qtPorta, ")");
    console.log("  - qtdTransito:", mappedRow.qtdTransito, "(tipo:", typeof mappedRow.qtdTransito, ")");
    console.log("  - Objeto completo:", JSON.stringify(mappedRow, null, 2));
    
    await saveRowToSheets(mappedRow);
    await reloadFromServer(); // garante que pega o id/linha real do Sheets
  }

  async function removeRow(id) {
    if (!confirm("Excluir este frete?")) return;
    await deleteRowFromSheets(id);
    await reloadFromServer();
  }

  /********************
   * INIT
   ********************/
  async function init() {
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

    $("fFilial").addEventListener("change", () => render(state.rows, state.weights));
    $("fBusca").addEventListener("input", () => render(state.rows, state.weights));

    $("btnNew").addEventListener("click", () => openModal("new"));

    $("btnCloseModal").addEventListener("click", closeModal);
    $("btnCancel").addEventListener("click", closeModal);

    $("btnSave").addEventListener("click", async () => {
      const row = collectModal();
      if (!row.filial) return alert("Selecione uma filial.");
      if (!row.contato) return alert("Selecione um contato.");

      const btn = $("btnSave");
      const txt = btn.textContent;
      btn.disabled = true; btn.textContent = "Salvando...";

      try {
        await upsertRow(row);
        closeModal();
        alert("✅ Salvo no Google Sheets!");
      } catch (e) {
        console.error(e);
        alert("❌ Erro ao salvar: " + e.message);
      } finally {
        btn.disabled = false; btn.textContent = txt;
      }
    });

    const btnShare = $("btnShareClientes");
    if (btnShare) btnShare.addEventListener("click", () => (window.location.href = "./share-clientes.html"));

    const btnReload = $("btnReloadFromSheets");
    if (btnReload) {
      btnReload.addEventListener("click", async () => {
        const old = btnReload.textContent;
        btnReload.disabled = true;
        btnReload.textContent = "Carregando...";
        try {
          await reloadFromServer();
          alert("✅ Atualizado do Google Sheets!");
        } catch (e) {
          console.error("ERRO SHEETS (detalhado):", e);
          alert("Falha ao carregar do Google Sheets. Veja o console (F12).");
        } finally {
          btnReload.disabled = false;
          btnReload.textContent = old;
        }
      });
    }

    // carga inicial: Sheets -> fallback local
    try {
      await reloadFromServer();
    } catch (e) {
      console.warn("Sheets falhou, usando localStorage:", e);
      updateSyncStatus("error", "Offline - dados locais");
      state.rows = loadRowsLocal();
      render(state.rows, state.weights);
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
