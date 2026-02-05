/* fretes.js | NOVA FROTA (Google Sheets Shared)
   - Dados compartilhados via Apps Script (JSONP, sem CORS)
   - CRUD completo: listar, salvar, excluir
   - Zerar Qtd Porta/Trânsito (API reset) se quiser disparar manual
   - Botão Share Clientes
   - Botão WhatsApp no modal de contato
*/
(function () {
  "use strict";

  // ===== CONFIG =====
  const API_URL = "https://script.google.com/macros/s/AKfycbzvsPglqBxyiUByazFPi_5ihhBc3L_-xhnuR5H90RUwAfDj9t4HKMWZPwyiNunmfZ5W/exec";

  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);

  // JSONP (para GitHub Pages sem CORS)
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = "__nfcb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout JSONP"));
      }, 20000);

      function cleanup() {
        clearTimeout(timer);
        if (window[cb]) delete window[cb];
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }

      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };

      const join = url.includes("?") ? "&" : "?";
      s.src = url + join + "callback=" + encodeURIComponent(cb);
      s.onerror = () => {
        cleanup();
        reject(new Error("Falha ao carregar JSONP"));
      };
      document.head.appendChild(s);
    });
  }

  async function apiList() {
    const res = await jsonp(API_URL + "?action=list");
    if (!res || !res.ok) throw new Error(res && res.error ? res.error : "Erro em list");
    return res.data || [];
  }

  async function apiContacts() {
    const res = await jsonp(API_URL + "?action=contacts");
    if (!res || !res.ok) throw new Error(res && res.error ? res.error : "Erro em contacts");
    return res.data || [];
  }

  async function apiSave(row) {
    const data = encodeURIComponent(JSON.stringify(row));
    const res = await jsonp(API_URL + "?action=save&data=" + data);
    if (!res || !res.ok) throw new Error(res && res.error ? res.error : "Erro em save");
    return res.data;
  }

  async function apiDelete(id) {
    const res = await jsonp(API_URL + "?action=delete&id=" + encodeURIComponent(id));
    if (!res || !res.ok) throw new Error(res && res.error ? res.error : "Erro em delete");
    return res.data;
  }

  async function apiResetQtd() {
    const res = await jsonp(API_URL + "?action=reset");
    if (!res || !res.ok) throw new Error(res && res.error ? res.error : "Erro em reset");
    return res.data;
  }

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

  const LS_KEY_WEIGHTS_PREFIX = "nf_fretes_weights_";
  const LS_KEY_USER = "nf_auth_user";

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
    if (v === "" || v == null) return 0;
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

  // ===== Permissão =====
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

  // ===== UI: selects =====
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

  // contatos dinâmicos do Sheets
  let CONTACTS = []; // {nome, telefone}

  function contactLabel(c) {
    if (!c) return "";
    const phone = safeText(c.telefone);
    return phone ? `${c.nome} ${formatPhonePretty(phone)}` : `${c.nome}`;
  }

  function formatPhonePretty(digits) {
    const p = String(digits || "").replace(/\D/g, "");
    // não força formato perfeito, só uma “cara” melhor
    if (p.length === 11) return `(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}`;
    if (p.length === 10) return `(${p.slice(0,2)}) ${p.slice(2,6)}-${p.slice(6)}`;
    return p;
  }

  function fillContatoSelect(sel) {
    sel.innerHTML = "";
    CONTACTS.forEach((c) => {
      const op = document.createElement("option");
      op.value = c.nome; // grava só o nome
      op.textContent = contactLabel(c);
      sel.appendChild(op);
    });
  }

  function getContactByName(name) {
    const key = safeText(name).toUpperCase();
    return CONTACTS.find(c => safeText(c.nome).toUpperCase() === key) || null;
  }

  function openWhatsAppForContactName(name) {
    const c = getContactByName(name);
    const phone = c ? safeText(c.telefone).replace(/\D/g, "") : "";
    if (!phone) {
      alert("Esse contato ainda não tem telefone cadastrado no Apps Script.");
      return;
    }
    // Brasil: 55 + DDD + número
    const url = `https://wa.me/55${phone}`;
    window.open(url, "_blank", "noopener,noreferrer");
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

      // contato com botão WhatsApp na tabela (opcional)
      const contatoNome = safeText(row.contato);
      const contatoObj = getContactByName(contatoNome);
      const hasPhone = contatoObj && safeText(contatoObj.telefone).replace(/\D/g, "").length >= 10;

      const contatoCellHTML = hasPhone
        ? `<span style="font-weight:900">${contatoNome}</span>
           <a href="https://wa.me/55${safeText(contatoObj.telefone).replace(/\D/g,"")}"
              target="_blank" rel="noopener noreferrer"
              title="Chamar no WhatsApp"
              style="margin-left:8px; display:inline-flex; align-items:center; justify-content:center;
                     width:26px; height:26px; border-radius:10px; border:1px solid #D1D5DB;
                     text-decoration:none; font-weight:900;">
              WA
           </a>`
        : contatoNome;

      const cells = [
        safeText(row.regional),
        safeText(row.filial),
        safeText(row.cliente),
        safeText(row.origem),
        safeText(row.coleta),
        { html: true, v: contatoCellHTML },
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

          if (c.html) {
            td.innerHTML = c.v || "";
          }
          else if (c.yn) {
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
    $("mContato").value = r ? (r.contato || (CONTACTS[0] ? CONTACTS[0].nome : "")) : (CONTACTS[0] ? CONTACTS[0].nome : "");
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
    $("mPorta").value = (r && r.qtdPorta !== 0) ? r.qtdPorta : "";
    $("mTransito").value = (r && r.qtdTransito !== 0) ? r.qtdTransito : "";
    $("mStatus").value = r ? safeText(r.status).toUpperCase() : "LIBERADO";
    $("mObs").value = r ? r.obs : "";

    syncWhatsAppBtnState();

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

  async function upsertRow(row) {
    // salva no Sheets
    await apiSave(row);

    // recarrega lista (garante sincronismo)
    state.rows = await apiList();
    render(state.rows, state.weights);
  }

  async function removeRow(id) {
    if (!confirm("Excluir este frete?")) return;
    await apiDelete(id);
    state.rows = await apiList();
    render(state.rows, state.weights);
  }

  // ===== WhatsApp no modal (botão ao lado do select contato) =====
  function ensureWhatsAppButtonInModal() {
    const sel = $("mContato");
    if (!sel) return;

    // já existe?
    if ($("btnWhatsContato")) return;

    const wrap = sel.parentElement;
    if (!wrap) return;

    // cria uma mini linha com select + botão
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";

    // move select pra dentro
    wrap.appendChild(row);
    row.appendChild(sel);

    // botão WhatsApp
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btnWhatsContato";
    btn.className = "btnTiny ghost";
    btn.style.height = "36px";
    btn.style.padding = "0 12px";
    btn.textContent = "WhatsApp";
    btn.title = "Chamar contato no WhatsApp";

    btn.addEventListener("click", () => {
      openWhatsAppForContactName(sel.value);
    });

    row.appendChild(btn);

    sel.addEventListener("change", syncWhatsAppBtnState);
  }

  function syncWhatsAppBtnState() {
    const btn = $("btnWhatsContato");
    const sel = $("mContato");
    if (!btn || !sel) return;

    const c = getContactByName(sel.value);
    const hasPhone = c && safeText(c.telefone).replace(/\D/g, "").length >= 10;

    btn.disabled = !hasPhone;
    btn.style.opacity = hasPhone ? "1" : "0.5";
    btn.style.cursor = hasPhone ? "pointer" : "not-allowed";
  }

  // ===== Init =====
  async function init() {
    // selects
    fillFilialSelect($("fFilial"), true);
    fillFilialSelect($("mFilial"), false);

    // contatos do Sheets
    try {
      CONTACTS = await apiContacts();
    } catch (e) {
      console.error(e);
      CONTACTS = [];
    }
    fillContatoSelect($("mContato"));
    ensureWhatsAppButtonInModal();

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

    // carrega do Sheets (compartilhado)
    state.rows = await apiList();

    // filtros
    $("fFilial").addEventListener("change", () => render(state.rows, state.weights));
    $("fBusca").addEventListener("input", () => render(state.rows, state.weights));

    // botões
    $("btnNew").addEventListener("click", () => openModal("new"));

    // se você quer ocultar o Exemplo: deixa o botão no HTML mas escondido via CSS (ou remove do HTML)
    const btnExample = $("btnResetExample");
    if (btnExample) {
      // recomendado: esconder
      btnExample.style.display = "none";
    }

    // botão Share Clientes (se existir no HTML)
    const btnShare = $("btnShareClientes");
    if (btnShare) {
      btnShare.addEventListener("click", () => {
        window.location.href = "./share-clientes.html";
      });
    }

    // modal events
    $("btnCloseModal").addEventListener("click", closeModal);
    $("btnCancel").addEventListener("click", closeModal);

    $("btnSave").addEventListener("click", async () => {
      const row = collectModal();
      if (!row.filial) return alert("Selecione uma filial.");
      if (!row.contato) return alert("Selecione um contato.");

      try {
        await upsertRow(row);
        closeModal();
      } catch (e) {
        console.error(e);
        alert("Erro ao salvar no Google Sheets. Veja o console.");
      }
    });

    // primeira renderização
    render(state.rows, state.weights);
  }

  window.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => {
      console.error(e);
      alert("Falha ao carregar dados do Google Sheets. Veja o console.");
    });
  });

  // (Opcional) Se quiser testar reset manual:
  // window.__resetQtd = () => apiResetQtd().then(()=>apiList()).then(r=>{state.rows=r; render(state.rows,state.weights);});
})();
