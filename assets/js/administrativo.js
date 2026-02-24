/* administrativo.js | NOVA FROTA */
(function () {
  "use strict";

  // ======================================================
  // 1) CONFIG (Google Drive / Apps Script)
  // ======================================================
  // ✅ Cole aqui depois (quando você criar a pasta no Drive)
  const DRIVE_FOLDER_ID = "COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE";
  // ✅ Cole aqui depois (WebApp do Apps Script que recebe upload)
  const UPLOAD_API_URL = "COLE_AQUI_A_URL_DO_WEBAPP_DE_UPLOAD";

  // ======================================================
  // 2) DADOS FIXOS (dentro do GitHub)
  // ======================================================
  const FILIAIS = [
    "ITUMBIARA",
    "RIO VERDE",
    "JATAI",
    "MINEIROS",
    "CHAPADAO DO CEU",
    "MONTIVIDIU",
    "INDIARA",
    "BOM JESUS DE GO",
    "VIANOPOLIS",
    "ANAPOLIS",
    "URUAÇU",
  ];

  // (exemplo) contatos responsáveis por filial
  // -> aqui você pode ir adicionando quando quiser
  const CONTATOS_FILIAL = {
    "ITUMBIARA": [{ nome: "ARIEL", fone: "64992277537" }, { nome: "SERGIO", fone: "" }],
    "RIO VERDE": [{ nome: "JHONATAN", fone: "" }],
    "JATAI": [{ nome: "SERGIO", fone: "" }],
    "MINEIROS": [],
    "CHAPADAO DO CEU": [],
    "MONTIVIDIU": [],
    "INDIARA": [],
    "BOM JESUS DE GO": [],
    "VIANOPOLIS": [],
    "ANAPOLIS": [],
    "URUAÇU": [],
  };

  // ======================================================
  // 3) STORAGE (salvo no navegador)
  // ======================================================
  const KEY = "nf_admin_v1";
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const d = raw ? JSON.parse(raw) : null;
      return d && typeof d === "object" ? d : null;
    } catch {
      return null;
    }
  }
  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  const DB = load() || {
    frota: [],      // {id, placa, condutor, filial, uploads:[{mes, url}]}
    cheques: [],    // {id, filial, data, seq, contatoNome, contatoFone, termoUrl, status}
    solicit: [],    // {id, filial, data, qtd, previstoPara, status, obs}
  };

  // ======================================================
  // 4) HELPERS
  // ======================================================
  const $ = (id) => document.getElementById(id);

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function up(str) {
    return String(str || "").toUpperCase().trim();
  }

  function fmtDateISO(d) {
    if (!d) return "";
    // espera YYYY-MM-DD
    return String(d);
  }

  function setStatus(txt) {
    const el = $("adminStatus");
    if (el) el.textContent = txt;
  }

  // ======================================================
  // 5) TABS
  // ======================================================
  function bindTabs() {
    document.querySelectorAll(".tabBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        document.querySelectorAll(".tabBtn").forEach((b) => b.classList.toggle("active", b === btn));
        document.querySelectorAll(".tabPanel").forEach((p) => p.classList.remove("active"));
        const panel = document.getElementById("tab-" + tab);
        if (panel) panel.classList.add("active");
      });
    });
  }

  // ======================================================
  // 6) FILIAIS NOS SELECTS
  // ======================================================
  function fillFiliais(selectId) {
    const sel = $(selectId);
    if (!sel) return;
    // mantém primeira option
    const first = sel.querySelector("option[value='']");
    sel.innerHTML = "";
    sel.appendChild(first || new Option("TODAS", ""));
    FILIAIS.forEach((f) => sel.appendChild(new Option(f, f)));
  }

  // ======================================================
  // 7) WHATSAPP
  // ======================================================
  function toPhoneBR(digits) {
    const s = String(digits || "").replace(/\D/g, "");
    if (!s) return "";
    if (s.startsWith("55")) return s;
    if (s.length === 10 || s.length === 11) return "55" + s;
    return s;
  }

  function wppLink(fone) {
    const p = toPhoneBR(fone);
    return p ? "https://wa.me/" + p : "";
  }

  // ======================================================
  // 8) RENDER
  // ======================================================
  function renderFrota() {
    const tbody = $("tbFrota");
    if (!tbody) return;

    const filial = up($("fltFrotaFilial")?.value || "");
    const busca = up($("fltFrotaBusca")?.value || "");

    tbody.innerHTML = "";
    DB.frota
      .filter((r) => (!filial || up(r.filial) === filial))
      .filter((r) => {
        if (!busca) return true;
        return up(r.placa).includes(busca) || up(r.condutor).includes(busca);
      })
      .forEach((r) => {
        const tr = document.createElement("tr");

        const tdPlaca = document.createElement("td");
        tdPlaca.textContent = r.placa;
        tr.appendChild(tdPlaca);

        const tdCond = document.createElement("td");
        tdCond.textContent = r.condutor;
        tr.appendChild(tdCond);

        const tdFil = document.createElement("td");
        tdFil.textContent = r.filial;
        tr.appendChild(tdFil);

        // upload checklist
        const tdUp = document.createElement("td");
        const file = document.createElement("input");
        file.type = "file";
        file.accept = "image/*,application/pdf";
        file.className = "fileInput";
        file.id = "file_" + r.id;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "uploadBtn";
        btn.textContent = "Enviar checklist do mês";
        btn.addEventListener("click", () => file.click());

        file.addEventListener("change", async () => {
          const f = file.files && file.files[0];
          if (!f) return;
          await handleUpload({
            file: f,
            pasta: "FROTA_LEVE",
            subpasta: r.filial,
            meta: { placa: r.placa, condutor: r.condutor },
            onDone: (url) => {
              r.uploads = r.uploads || [];
              r.uploads.push({ mes: new Date().toISOString().slice(0, 7), url });
              save(DB);
              renderFrota();
            },
          });
          file.value = "";
        });

        tdUp.appendChild(btn);
        tdUp.appendChild(file);
        tr.appendChild(tdUp);

        // histórico
        const tdHist = document.createElement("td");
        const last = (r.uploads || []).slice(-1)[0];
        if (last?.url) {
          const a = document.createElement("a");
          a.href = last.url;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = "Ver último (" + last.mes + ")";
          tdHist.appendChild(a);
        } else {
          tdHist.innerHTML = `<span class="muted">sem uploads</span>`;
        }
        tr.appendChild(tdHist);

        tbody.appendChild(tr);
      });
  }

  function renderCheques() {
    const tbody = $("tbCheques");
    if (!tbody) return;

    const filial = up($("fltChequeFilial")?.value || "");
    const busca = up($("fltChequeBusca")?.value || "");

    tbody.innerHTML = "";
    DB.cheques
      .filter((r) => (!filial || up(r.filial) === filial))
      .filter((r) => {
        if (!busca) return true;
        return up(r.seq).includes(busca) || up(r.contatoNome).includes(busca);
      })
      .forEach((r) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td>${r.filial}</td>
          <td>${r.data || ""}</td>
          <td>${r.seq}</td>
          <td>${r.contatoNome}</td>
        `;

        // upload termo
        const tdUp = document.createElement("td");
        const file = document.createElement("input");
        file.type = "file";
        file.accept = "image/*,application/pdf";
        file.className = "fileInput";
        file.id = "term_" + r.id;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "uploadBtn";
        btn.textContent = r.termoUrl ? "Reenviar termo" : "Enviar termo assinado";
        btn.addEventListener("click", () => file.click());

        file.addEventListener("change", async () => {
          const f = file.files && file.files[0];
          if (!f) return;
          await handleUpload({
            file: f,
            pasta: "CHEQUES",
            subpasta: r.filial,
            meta: { seq: r.seq, contato: r.contatoNome },
            onDone: (url) => {
              r.termoUrl = url;
              r.status = "EM MÃOS";
              save(DB);
              renderCheques();
            },
          });
          file.value = "";
        });

        tdUp.appendChild(btn);
        tdUp.appendChild(file);
        tr.appendChild(tdUp);

        // status
        const tdSt = document.createElement("td");
        const pill = document.createElement("span");
        pill.className = "pill " + (r.status === "DEVOLVIDO" ? "ok" : r.status === "PENDENTE" ? "warn" : "");
        pill.textContent = r.status || "PENDENTE";
        tdSt.appendChild(pill);

        // link wpp se tiver fone
        if (r.contatoFone) {
          const a = document.createElement("a");
          a.href = wppLink(r.contatoFone);
          a.target = "_blank";
          a.rel = "noopener";
          a.style.marginLeft = "10px";
          a.textContent = "WhatsApp";
          tdSt.appendChild(a);
        }

        tr.appendChild(tdSt);

        tbody.appendChild(tr);
      });
  }

  function renderSolic() {
    const tbody = $("tbSolic");
    if (!tbody) return;

    const filial = up($("fltSolFilial")?.value || "");
    const busca = up($("fltSolBusca")?.value || "");

    tbody.innerHTML = "";
    DB.solicit
      .filter((r) => (!filial || up(r.filial) === filial))
      .filter((r) => {
        if (!busca) return true;
        return up(r.obs).includes(busca);
      })
      .forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.filial}</td>
          <td>${r.data || ""}</td>
          <td class="num">${r.qtd || ""}</td>
          <td>${r.previstoPara || ""}</td>
          <td><span class="pill ${r.status==="ENVIADO"?"ok":r.status==="SOLICITADO"?"warn":""}">${r.status}</span></td>
          <td>${r.obs || ""}</td>
        `;
        tbody.appendChild(tr);
      });
  }

  function renderAll() {
    renderFrota();
    renderCheques();
    renderSolic();
  }

  // ======================================================
  // 9) MODAL (criação)
  // ======================================================
  function showModal(title, bodyHtml, onSave) {
    const modal = $("modal");
    const body = $("modalBody");
    const t = $("modalTitle");
    if (!modal || !body || !t) return;

    t.textContent = title;
    body.innerHTML = bodyHtml;

    function close() {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      $("btnSave")?.removeEventListener("click", saveHandler);
    }

    async function saveHandler() {
      try {
        await onSave(close);
      } catch (e) {
        console.error(e);
        alert("Não consegui salvar. Veja o console.");
      }
    }

    $("btnCloseModal")?.addEventListener("click", close, { once: true });
    $("btnCancel")?.addEventListener("click", close, { once: true });
    $("btnSave")?.addEventListener("click", saveHandler);

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    // força uppercase ao digitar
    body.querySelectorAll("input,textarea").forEach((el) => {
      el.addEventListener("input", () => (el.value = up(el.value)));
    });
  }

  function modalNovoVeiculo() {
    const optionsFilial = FILIAIS.map((f) => `<option value="${f}">${f}</option>`).join("");
    showModal(
      "Novo Veículo (Frota Leve)",
      `
      <div class="grid2">
        <div class="field"><label>Placa</label><input id="mPlaca" placeholder="ABC1D23" /></div>
        <div class="field"><label>Condutor</label><input id="mCondutor" placeholder="NOME" /></div>
        <div class="field"><label>Filial</label>
          <select id="mFilial">
            <option value="">SELECIONE A FILIAL</option>
            ${optionsFilial}
          </select>
        </div>
        <div class="field"><label class="muted">Google Drive (pasta)</label><input disabled value="${DRIVE_FOLDER_ID}" /></div>
      </div>
      <div class="muted" style="margin-top:10px;">Checklist mensal será enviado por upload na própria linha do veículo.</div>
      `,
      async (close) => {
        const placa = up($("mPlaca")?.value);
        const condutor = up($("mCondutor")?.value);
        const filial = up($("mFilial")?.value);
        if (!placa || !condutor || !filial) return alert("Preencha PLACA, CONDUTOR e FILIAL.");

        DB.frota.push({ id: uid(), placa, condutor, filial, uploads: [] });
        save(DB);
        close();
        renderFrota();
      }
    );
  }

  function modalNovoCheque() {
    const optionsFilial = FILIAIS.map((f) => `<option value="${f}">${f}</option>`).join("");
    showModal(
      "Novo Registro (Cheques)",
      `
      <div class="grid2">
        <div class="field"><label>Filial</label>
          <select id="mFilial">
            <option value="">SELECIONE A FILIAL</option>
            ${optionsFilial}
          </select>
        </div>
        <div class="field"><label>Data</label><input id="mData" type="date" /></div>
        <div class="field"><label>Sequência</label><input id="mSeq" placeholder="01800 A 01819" /></div>
        <div class="field"><label>Contato (responsável)</label><select id="mContato"></select></div>
      </div>
      <div class="muted" style="margin-top:10px;">O termo assinado será anexado por upload após salvar.</div>
      `,
      async (close) => {
        const filial = up($("mFilial")?.value);
        const data = fmtDateISO($("mData")?.value);
        const seq = up($("mSeq")?.value);
        const contatoSel = $("mContato");
        const contatoNome = up(contatoSel?.value || "");
        const contatoFone = contatoSel?.selectedOptions?.[0]?.getAttribute("data-fone") || "";

        if (!filial || !data || !seq || !contatoNome) return alert("Preencha FILIAL, DATA, SEQUÊNCIA e CONTATO.");

        DB.cheques.push({
          id: uid(),
          filial,
          data,
          seq,
          contatoNome,
          contatoFone,
          termoUrl: "",
          status: "PENDENTE",
        });
        save(DB);
        close();
        renderCheques();
      }
    );

    // bind contato dependente da filial
    const selFil = $("mFilial");
    const selCont = $("mContato");
    function fillContatos(fil) {
      if (!selCont) return;
      const list = CONTATOS_FILIAL[fil] || [];
      selCont.innerHTML = `<option value="">SELECIONE O CONTATO</option>`;
      list.forEach((c) => {
        const op = document.createElement("option");
        op.value = c.nome;
        op.textContent = c.nome;
        op.setAttribute("data-fone", c.fone || "");
        selCont.appendChild(op);
      });
    }
    if (selFil) {
      selFil.addEventListener("change", () => fillContatos(up(selFil.value)));
    }
  }

  function modalNovaSolic() {
    const optionsFilial = FILIAIS.map((f) => `<option value="${f}">${f}</option>`).join("");
    showModal(
      "Nova Solicitação (Cheques)",
      `
      <div class="grid2">
        <div class="field"><label>Filial</label>
          <select id="mFilial">
            <option value="">SELECIONE A FILIAL</option>
            ${optionsFilial}
          </select>
        </div>
        <div class="field"><label>Data</label><input id="mData" type="date" /></div>
        <div class="field"><label>Qtd</label><input id="mQtd" inputmode="numeric" placeholder="EX: 3" /></div>
        <div class="field"><label>Previsto Para</label><input id="mPrev" type="date" /></div>
        <div class="field"><label>Status</label>
          <select id="mStatus">
            <option value="SOLICITADO">SOLICITADO</option>
            <option value="ENVIADO">ENVIADO</option>
            <option value="RECEBIDO">RECEBIDO</option>
          </select>
        </div>
        <div class="field" style="grid-column:1/-1;">
          <label>Observação</label>
          <textarea id="mObs" placeholder="EX: PRECISO DE MAIS TALÕES PARA PRÓXIMA SEMANA"></textarea>
        </div>
      </div>
      `,
      async (close) => {
        const filial = up($("mFilial")?.value);
        const data = fmtDateISO($("mData")?.value);
        const qtd = up($("mQtd")?.value);
        const previstoPara = fmtDateISO($("mPrev")?.value);
        const status = up($("mStatus")?.value);
        const obs = up($("mObs")?.value);

        if (!filial || !data || !qtd || !previstoPara) return alert("Preencha FILIAL, DATA, QTD e PREVISTO PARA.");

        DB.solicit.push({ id: uid(), filial, data, qtd, previstoPara, status, obs });
        save(DB);
        close();
        renderSolic();
      }
    );
  }

  // ======================================================
  // 10) UPLOAD (placeholder)
  // ======================================================
  async function handleUpload({ file, pasta, subpasta, meta, onDone }) {
    setStatus("• enviando upload...");

    // ⚠️ GitHub Pages não sobe arquivo no Drive sozinho.
    // Precisa de um Apps Script WebApp (POST) para receber o arquivo e salvar no Drive.
    // Aqui fica pronto pra você colar a URL do WebApp depois.

    if (!UPLOAD_API_URL || UPLOAD_API_URL.includes("COLE_AQUI")) {
      setStatus("• upload desativado (falta configurar WebApp)");
      alert(
        "Upload ainda não está configurado.\n\n" +
        "1) Crie um Apps Script WebApp de upload\n" +
        "2) Cole a URL em UPLOAD_API_URL no administrativo.js\n" +
        "3) Cole o ID da pasta em DRIVE_FOLDER_ID\n\n" +
        "Enquanto isso, o sistema salva os registros e o histórico local."
      );
      return;
    }

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folderId", DRIVE_FOLDER_ID);
      fd.append("pasta", pasta);
      fd.append("subpasta", subpasta || "");
      fd.append("meta", JSON.stringify(meta || {}));

      const res = await fetch(UPLOAD_API_URL, { method: "POST", body: fd });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok || !data?.url) throw new Error(data?.error || "Falha no upload.");

      setStatus("• upload ok");
      onDone && onDone(data.url);
    } catch (e) {
      console.error(e);
      setStatus("• erro no upload");
      alert("Não consegui enviar o arquivo. Veja o console.");
    }
  }

  // ======================================================
  // 11) BINDS
  // ======================================================
  function bindFilters() {
    ["fltFrotaFilial","fltFrotaBusca"].forEach((id) => $(id)?.addEventListener("input", renderFrota));
    ["fltChequeFilial","fltChequeBusca"].forEach((id) => $(id)?.addEventListener("input", renderCheques));
    ["fltSolFilial","fltSolBusca"].forEach((id) => $(id)?.addEventListener("input", renderSolic));
  }

  function bindButtons() {
    $("btnNovoVeic")?.addEventListener("click", modalNovoVeiculo);
    $("btnNovoCheque")?.addEventListener("click", modalNovoCheque);
    $("btnNovaSol")?.addEventListener("click", modalNovaSolic);
  }

  function init() {
    bindTabs();

    fillFiliais("fltFrotaFilial");
    fillFiliais("fltChequeFilial");
    fillFiliais("fltSolFilial");

    bindFilters();
    bindButtons();

    renderAll();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
