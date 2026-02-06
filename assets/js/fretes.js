/* fretes.js | NOVA FROTA
   - Operacional + Permissão Frete Mínimo (5E/6E/7E/4E/9E)
   - Contatos fixos
   - Separação por filial
   - Pesos por usuário (localStorage)
   - ✅ Sync com Google Sheets via JSONP (resolve CORS no GitHub Pages)
   - ✅ Botão "Share Clientes"
   - ✅ Botão WhatsApp na coluna Contato (quando existir telefone)
*/
(function () {
  "use strict";

  /********************
   * CONFIG
   ********************/
  const API_URL = "https://script.google.com/macros/s/AKfycbz05hQfNPztgZm24gzE7jgODmCU1nQqAxpCJbmJs9j_g8pR86xVRqEWQS_zUXqKogG2/exec";

  const LS_KEY_ROWS = "nf_fretes_rows_v1";
  const LS_KEY_EXAMPLE = "nf_fretes_example_v1";
  const LS_KEY_WEIGHTS_PREFIX = "nf_fretes_weights_";
  const LS_KEY_USER = "nf_auth_user";

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

  /********************
   * HELPERS
   ********************/
  const $ = (id) => document.getElementById(id);

  function getUserKey() {
    const u = localStorage.getItem(LS_KEY_USER) || localStorage.getItem("nf_user") || "default";
    return String(u).trim().toUpperCase() || "default";
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

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

  // 🔥 Status de sincronização
  function updateSyncStatus(status, message) {
    const el = $("syncStatus");
    if (!el) return;
    
    if (status === 'loading') {
      el.textContent = '🔄 ' + (message || 'Carregando...');
      el.style.color = '#5B7CFA';
    } else if (status === 'success') {
      el.textContent = '✅ ' + (message || 'Sincronizado');
      el.style.color = '#067647';
    } else if (status === 'error') {
      el.textContent = '❌ ' + (message || 'Erro');
      el.style.color = '#991B1B';
    }
  }

  // Extrai telefone do contato (ex: "ARIEL 64 99227-7537")
  function extractPhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";
    // pega tudo que parece número
    let digits = s.replace(/\D/g, "");
    // Se vier com 11 dígitos (DDD + 9 + 8), ok
    // Se vier com 10, ok também
    if (digits.length === 11) return "55" + digits;
    if (digits.length === 10) return "55" + digits;
    // Se já vier com 55...
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
    return "";
  }

  function whatsappLinkFromContato(contato) {
    const phone = extractPhoneBR(contato);
    if (!phone) return "";
    return "https://wa.me/" + phone;
  }

  // JSONP (resolve CORS)
  function jsonp(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";

      const t = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout JSONP"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(t);
        try { delete window[cb]; } catch {}
        s.remove();
      }

      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };

      s.src = url + sep + "callback=" + encodeURIComponent(cb);
      s.onerror = () => {
        cleanup();
        reject(new Error("Falha JSONP"));
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
  function permYN(isOk) {
    return isOk ? "S" : "N";
  }

  function calcPerm(row, weights) {
    const km = num(row.km);
    const ped = num(row.pedagioEixo);
    const mot = num(row.valorMotorista);

    if (!km || km <= 0 || !isFinite(km) || (row.km === "")) return { p5: "", p6: "", p7: "", p4: "", p9: "" };
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
   * STORAGE (LOCAL + SHEETS SYNC)
   ********************/
  function saveRows(rows) {
    localStorage.setItem(LS_KEY_ROWS, JSON.stringify(rows));
  }

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

  // 🔥 Salvar linha no Sheets (CREATE/UPDATE)
  async function saveRowToSheets(row) {
    const params = new URLSearchParams();
    params.append('action', 'save');
    params.append('data', JSON.stringify(row));
    
    const url = `${API_URL}?${params.toString()}`;
    const result = await jsonp(url);
    
    if (result.status !== 'success') {
      throw new Error(result.message || 'Erro ao salvar no Sheets');
    }
    
    return result;
  }

  // 🔥 Deletar linha no Sheets
  async function deleteRowFromSheets(id) {
    const params = new URLSearchParams();
    params.append('action', 'delete');
    params.append('id', id);
    
    const url = `${API_URL}?${params.toString()}`;
    const result = await jsonp(url);
    
    if (result.status !== 'success') {
      throw new Error(result.message || 'Erro ao deletar no Sheets');
    }
    
    return result;
  }

  /********************
   * SHEETS SYNC
   ********************/
  function normalizeFromSheets(rows) {
    // Garante campos usados pelo seu site
    return (rows || []).map((r) => ({
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
      pedidoSat: r.pedidoSat === "" ? "" : num(r.pedidoSat),
      qtdPorta: r.qtdPorta === "" ? "" : num(r.qtdPorta),
      qtdTransito: r.qtdTransito === "" ? "" : num(r.qtdTransito),
      status: safeText(r.status).toUpperCase(),
      obs: safeText(r.obs || r.observacao || r.observações || "")
    }));
  }

  async function reloadFromServer() {
    updateSyncStatus('loading', 'Carregando do Sheets...');
    
    try {
      // usa action=list do Apps Script
      const data = await jsonp(API_URL + "?action=list");
      const rows = normalizeFromSheets(data);

      // salva e renderiza
      state.rows = rows;
      localStorage.setItem(LS_KEY_EXAMPLE, "0");
      saveRows(state.rows);
      render(state.rows, state.weights);
      
      updateSyncStatus('success', `Sincronizado (${rows.length} fretes)`);
    } catch (e) {
      updateSyncStatus('error', 'Falha ao carregar');
      throw e;
    }
  }

  /********************
   * UI: selects
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

      // ✅ Contato com botão WhatsApp (se tiver número)
      const wpp = whatsappLinkFromContato(row.contato);
      const contatoCell = wpp
        ? (() => {
            const wrap = document.createElement("div");
            wrap.style.display = "flex";
            wrap.style.alignItems = "center";
            wrap.style.justifyContent = "space-between";
            wrap.style.gap = "8px";

            const span = document.createElement("span");
            span.textContent = safeText(row.contato);
            span.style.overflow = "hidden";
            span.style.textOverflow = "ellipsis";
            span.style.whiteSpace = "nowrap";

            const a = document.createElement("a");
            a.href = wpp;
            a.target = "_blank";
            a.rel = "noopener";
            a.title = "Chamar no WhatsApp";
            a.textContent = "WhatsApp";
            a.className = "btnTiny green"; // usa seu css existente
            a.style.padding = "6px 10px";
            a.style.whiteSpace = "nowrap";

            wrap.appendChild(span);
            wrap.appendChild(a);
            return wrap;
          })()
        : null;

      const cells = [
        safeText(row.regional),
        safeText(row.filial),
        safeText(row.cliente),
        safeText(row.origem),
        safeText(row.coleta),

        // contato (com botão wpp)
        { customNode: contatoCell, v: safeText(row.contato) },

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

          if (c.customNode) {
            td.appendChild(c.customNode);
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
   * MODAL CRUD (LOCAL)
   ********************/
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
      volume: $("mVolume").value === "" ? "" : num($("mVolume").value),
      valorEmpresa: $("mEmpresa").value === "" ? "" : num($("mEmpresa").value),
      valorMotorista: $("mMotorista").value === "" ? "" : num($("mMotorista").value),
      km: $("mKM").value === "" ? "" : num($("mKM").value),
      pedagioEixo: $("mPed").value === "" ? "" : num($("mPed").value),
      produto: safeText($("mProduto").value),
      icms: safeText($("mICMS").value),
      pedidoSat: $("mSat").value === "" ? "" : num($("mSat").value),
      qtdPorta: $("mPorta").value === "" ? "" : num($("mPorta").value),
      qtdTransito: $("mTransito").value === "" ? "" : num($("mTransito").value),
      status: safeText($("mStatus").value).toUpperCase(),
      obs: safeText($("mObs").value)
    };
  }

  async function upsertRow(row) {
    try {
      // 🔥 Salva no Sheets primeiro
      await saveRowToSheets(row);
      
      // Atualiza local
      const idx = state.rows.findIndex((x) => x.id === row.id);
      if (idx >= 0) state.rows[idx] = row;
      else state.rows.unshift(row);
      
      saveRows(state.rows);
      render(state.rows, state.weights);
      
      return true;
    } catch (e) {
      console.error('Erro ao salvar:', e);
      alert('❌ Erro ao salvar no Google Sheets: ' + e.message);
      return false;
    }
  }

  async function removeRow(id) {
    if (!confirm("Excluir este frete?")) return;
    
    try {
      // 🔥 Deleta no Sheets primeiro
      await deleteRowFromSheets(id);
      
      // Remove local
      state.rows = state.rows.filter((x) => x.id !== id);
      saveRows(state.rows);
      render(state.rows, state.weights);
      
      alert('✅ Frete excluído com sucesso!');
    } catch (e) {
      console.error('Erro ao excluir:', e);
      alert('❌ Erro ao excluir do Google Sheets: ' + e.message);
    }
  }

  /********************
   * INIT
   ********************/
  async function init() {
    // selects
    fillFilialSelect($("fFilial"), true);
    fillFilialSelect($("mFilial"), false);
    fillContatoSelect($("mContato"));

    // pesos
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

    // filtros
    $("fFilial").addEventListener("change", () => render(state.rows, state.weights));
    $("fBusca").addEventListener("input", () => render(state.rows, state.weights));

    // botões CRUD
    $("btnNew").addEventListener("click", () => openModal("new"));

    // se existir botão de exemplo, você pode esconder pelo CSS ou remover
    const btnExample = $("btnResetExample");
    if (btnExample) {
      btnExample.addEventListener("click", () => {
        if (!confirm("Restaurar o exemplo local? Isso substitui sua lista atual.")) return;
        // mantém local só se você quiser, mas agora o ideal é usar Sheets
        alert("Use o botão Atualizar (Sheets). Exemplo local desativado.");
      });
    }

    // modal
    $("btnCloseModal").addEventListener("click", closeModal);
    $("btnCancel").addEventListener("click", closeModal);
    $("btnSave").addEventListener("click", async () => {
      const row = collectModal();
      if (!row.filial) return alert("Selecione uma filial.");
      if (!row.contato) return alert("Selecione um contato.");
      
      // 🔥 Desabilita botão durante o salvamento
      const btnSave = $("btnSave");
      const originalText = btnSave.textContent;
      btnSave.disabled = true;
      btnSave.textContent = "Salvando...";
      
      const success = await upsertRow(row);
      
      btnSave.disabled = false;
      btnSave.textContent = originalText;
      
      if (success) {
        alert('✅ Frete salvo com sucesso!');
        closeModal();
      }
    });

    // ✅ Botão Share Clientes (se existir no HTML)
    const btnShare = $("btnShareClientes");
    if (btnShare) {
      btnShare.addEventListener("click", () => {
        window.location.href = "./share-clientes.html";
      });
    }

    // ✅ Botão Atualizar do Sheets (se existir)
    const btnReload = $("btnReloadFromSheets");
    if (btnReload) {
      btnReload.addEventListener("click", async () => {
        try {
          btnReload.disabled = true;
          btnReload.textContent = "Carregando...";
          await reloadFromServer();
          alert("Dados atualizados do Google Sheets ✅");
        } catch (e) {
          console.error(e);
          alert("Falha ao carregar dados do Google Sheets. Veja o console.");
        } finally {
          btnReload.disabled = false;
          btnReload.textContent = "Atualizar (Sheets)";
        }
      });
    }

    // ✅ Carrega inicial:
    // tenta Sheets primeiro, se falhar cai no localStorage
    try {
      await reloadFromServer();
    } catch (e) {
      console.warn("Sheets falhou, usando localStorage:", e);
      updateSyncStatus('error', 'Offline - dados locais');
      state.rows = loadRowsLocal();
      render(state.rows, state.weights);
    }

    // primeira renderização garantida (caso sem dados)
    if (!Array.isArray(state.rows)) state.rows = [];
    if (state.rows.length === 0) {
      updateSyncStatus('success', 'Nenhum frete cadastrado');
    }
    render(state.rows, state.weights);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
