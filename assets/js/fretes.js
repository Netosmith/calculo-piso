/* fretes.js - NOVA FROTA
   Base operacional (igual planilha): tabela cheia, compacta, full-width.
   Armazenamento: localStorage por usuário.
*/

(function () {
  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);

  function toBRMoney(v) {
    const n = Number(v);
    if (!isFinite(n)) return "";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function toBRNumber(v, decimals = 2) {
    const n = Number(v);
    if (!isFinite(n)) return "";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function norm(s) {
    return String(s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  // Tenta pegar usuário do seu auth.js (se existir algo)
  function getUserKey() {
    // 1) se o auth.js salvar algo assim, pega
    const possible =
      localStorage.getItem("nf_user") ||
      localStorage.getItem("nf_auth_user") ||
      localStorage.getItem("nf_auth_username") ||
      localStorage.getItem("user") ||
      "";

    const u = possible ? norm(possible).replace(/\s+/g, "_") : "default";
    return `nf_fretes_v1_${u}`;
  }

  const LS_KEY = getUserKey();

  // ===== Campos da planilha =====
  const FIELDS = [
    { key: "regional", label: "Regional", type: "text" },
    { key: "filial", label: "Filial", type: "text" },
    { key: "cliente", label: "Cliente", type: "text" },
    { key: "origem", label: "Origem", type: "text" },
    { key: "coleta", label: "Coleta", type: "text" },
    { key: "contato", label: "Contato de embarque", type: "text" },
    { key: "destino", label: "Destino", type: "text" },
    { key: "uf", label: "UF", type: "text" },
    { key: "descarga", label: "Descarga", type: "text" },
    { key: "volume", label: "Volume", type: "number" },
    { key: "valorEmpresa", label: "Valor Empresa", type: "number" },
    { key: "valorMotorista", label: "Valor Motorista", type: "number" },
    { key: "km", label: "KM", type: "number" },
    { key: "produto", label: "Produto", type: "text" },
    { key: "icms", label: "ICMS", type: "text" },
    { key: "pedidoSat", label: "Pedido SAT", type: "text" },
    { key: "qtdPorta", label: "Qtd Porta", type: "number" },
    { key: "qtdTransito", label: "Qtd Trânsito", type: "number" },
    { key: "status", label: "Status", type: "select", options: ["LIBERADO", "PARADO", "SUSPENSO"] },
    { key: "obs", label: "Observações", type: "text" },
  ];

  // ===== Estado =====
  let rows = [];
  let editingId = null;

  // ===== Storage =====
  function loadRows() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data;
    } catch {
      return [];
    }
  }

  function saveRows() {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  }

  // ===== Demo =====
  function demoRows() {
    return [
      {
        id: crypto.randomUUID(),
        regional: "GOIÁS",
        filial: "ITUMBIARA-GO",
        cliente: "COMEXR",
        origem: "BURITI ALEGRE-GO",
        coleta: "PAIOLÃO",
        contato: "Jhonatan (64) 99225-1214",
        destino: "QUIRINÓPOLIS",
        uf: "GO",
        descarga: "CARGILL",
        volume: 55,
        valorEmpresa: 55,
        valorMotorista: 50,
        km: 219,
        produto: "",
        icms: "",
        pedidoSat: "",
        qtdPorta: "",
        qtdTransito: "",
        status: "SUSPENSO",
        obs: "AGENDAMENTO ALONGADO",
      },
      {
        id: crypto.randomUUID(),
        regional: "GOIÁS",
        filial: "ANÁPOLIS-GO",
        cliente: "OURO SAFRA",
        origem: "ÁGUA FRIA DE GOIÁS-GO",
        coleta: "FAZ. ARAÇÁ",
        contato: "Sérgio (64) 99266-9136",
        destino: "CABECEIRAS",
        uf: "GO",
        descarga: "GRANJA MANTIQUEIRA",
        volume: 75,
        valorEmpresa: 75,
        valorMotorista: 60,
        km: 106,
        produto: "MILHO",
        icms: "ISENTO (CIF)",
        pedidoSat: "12245",
        qtdPorta: 3,
        qtdTransito: 0,
        status: "PARADO",
        obs: "",
      },
      {
        id: crypto.randomUUID(),
        regional: "GOIÁS",
        filial: "CRISTALINA-GO",
        cliente: "CARGILL",
        origem: "CRISTALINA-GO",
        coleta: "COCARIS",
        contato: "Everaldo (61) 99692-4906",
        destino: "ANÁPOLIS",
        uf: "GO",
        descarga: "CARGILL NOVOS HORIZONTES",
        volume: 87,
        valorEmpresa: 87,
        valorMotorista: 80,
        km: 200,
        produto: "SOJA",
        icms: "ISENTO (CIF)",
        pedidoSat: "12018",
        qtdPorta: "",
        qtdTransito: "",
        status: "SUSPENSO",
        obs: "",
      },
      {
        id: crypto.randomUUID(),
        regional: "GOIÁS",
        filial: "JATAÍ-GO",
        cliente: "CARGILL",
        origem: "JATAÍ",
        coleta: "ARMAZ BOA ESPERANÇA",
        contato: "Rone (64) 99626-4511",
        destino: "ITUMBIARA",
        uf: "GO",
        descarga: "CARAMURU",
        volume: 0,
        valorEmpresa: 80,
        valorMotorista: 73,
        km: 330,
        produto: "MILHO",
        icms: "ISENTO (CIF)",
        pedidoSat: "",
        qtdPorta: 2,
        qtdTransito: 3,
        status: "LIBERADO",
        obs: "",
      },
    ];
  }

  // ===== Render =====
  function statusPill(status) {
    const st = (status || "").toUpperCase();
    const cls = st === "LIBERADO" ? "stLIBERADO" : st === "PARADO" ? "stPARADO" : "stSUSPENSO";
    return `<span class="statusPill ${cls}">${st || "-"}</span>`;
  }

  function applyFilters(data) {
    const q = norm($("qSearch").value);
    const st = ($("qStatus").value || "").toUpperCase();
    const filial = norm($("qFilial").value);
    const regional = norm($("qRegional").value);

    return data.filter((r) => {
      if (st && String(r.status || "").toUpperCase() !== st) return false;
      if (filial && !norm(r.filial).includes(filial)) return false;
      if (regional && !norm(r.regional).includes(regional)) return false;

      if (!q) return true;
      const blob = norm([
        r.regional, r.filial, r.cliente, r.origem, r.coleta, r.contato,
        r.destino, r.uf, r.descarga, r.volume, r.valorEmpresa, r.valorMotorista,
        r.km, r.produto, r.icms, r.pedidoSat, r.qtdPorta, r.qtdTransito, r.status, r.obs
      ].join(" "));
      return blob.includes(q);
    });
  }

  function render() {
    const tbody = $("tblBody");
    const filtered = applyFilters(rows);

    tbody.innerHTML = filtered.map((r) => {
      return `
        <tr data-id="${r.id}">
          <td>${r.regional ?? ""}</td>
          <td>${r.filial ?? ""}</td>
          <td>${r.cliente ?? ""}</td>
          <td>${r.origem ?? ""}</td>
          <td>${r.coleta ?? ""}</td>
          <td>${r.contato ?? ""}</td>
          <td>${r.destino ?? ""}</td>
          <td>${r.uf ?? ""}</td>
          <td>${r.descarga ?? ""}</td>
          <td class="num">${toBRNumber(r.volume, 2)}</td>
          <td class="num">${toBRMoney(r.valorEmpresa)}</td>
          <td class="num">${toBRMoney(r.valorMotorista)}</td>
          <td class="num">${toBRNumber(r.km, 0)}</td>
          <td>${r.produto ?? ""}</td>
          <td>${r.icms ?? ""}</td>
          <td>${r.pedidoSat ?? ""}</td>
          <td class="num">${toBRNumber(r.qtdPorta, 0)}</td>
          <td class="num">${toBRNumber(r.qtdTransito, 0)}</td>
          <td class="center">${statusPill(r.status)}</td>
          <td>${r.obs ?? ""}</td>
        </tr>
      `;
    }).join("");

    // Clique para editar
    tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
      tr.addEventListener("click", () => {
        const id = tr.getAttribute("data-id");
        openEdit(id);
      });
    });
  }

  // ===== Modal =====
  function buildForm() {
    const grid = $("formGrid");
    grid.innerHTML = "";

    FIELDS.forEach((f) => {
      const div = document.createElement("div");
      div.className = "field";

      const label = document.createElement("label");
      label.textContent = f.label;
      label.setAttribute("for", `f_${f.key}`);

      let input;
      if (f.type === "select") {
        input = document.createElement("select");
        input.className = "selectMini";
        input.innerHTML = `<option value="">Selecione...</option>` + f.options.map(o => `<option value="${o}">${o}</option>`).join("");
      } else {
        input = document.createElement("input");
        input.className = "inputMini";
        input.type = f.type === "number" ? "number" : "text";
        if (f.type === "number") input.step = "0.01";
      }

      input.id = `f_${f.key}`;

      div.appendChild(label);
      div.appendChild(input);
      grid.appendChild(div);
    });
  }

  function setFormValues(obj) {
    FIELDS.forEach((f) => {
      const el = $(`f_${f.key}`);
      el.value = obj?.[f.key] ?? "";
    });
  }

  function getFormValues() {
    const out = {};
    FIELDS.forEach((f) => {
      const el = $(`f_${f.key}`);
      let v = el.value;

      if (f.type === "number") {
        // aceita vazio
        if (String(v).trim() === "") v = "";
        else v = Number(String(v).replace(",", "."));
      } else {
        v = String(v ?? "").trim();
      }
      out[f.key] = v;
    });
    // normaliza status
    if (out.status) out.status = String(out.status).toUpperCase();
    return out;
  }

  function openNew() {
    editingId = null;
    $("modalTitle").textContent = "+ Novo Frete";
    $("btnDelete").style.display = "none";
    setFormValues({
      status: "LIBERADO",
      regional: "GOIÁS"
    });
    $("modal").classList.add("show");
  }

  function openEdit(id) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    editingId = id;
    $("modalTitle").textContent = "✏️ Editar Frete";
    $("btnDelete").style.display = "inline-flex";
    setFormValues(row);
    $("modal").classList.add("show");
  }

  function closeModal() {
    $("modal").classList.remove("show");
  }

  function saveModal() {
    const payload = getFormValues();

    // defaults
    if (!payload.status) payload.status = "LIBERADO";

    if (!editingId) {
      rows.unshift({ id: crypto.randomUUID(), ...payload });
    } else {
      rows = rows.map((r) => (r.id === editingId ? { ...r, ...payload } : r));
    }

    saveRows();
    closeModal();
    render();
  }

  function deleteRow() {
    if (!editingId) return;
    rows = rows.filter((r) => r.id !== editingId);
    saveRows();
    closeModal();
    render();
  }

  // ===== Export CSV =====
  function exportCSV() {
    const filtered = applyFilters(rows);
    const header = FIELDS.map((f) => f.label);

    const lines = [
      header.join(";"),
      ...filtered.map((r) => {
        return FIELDS.map((f) => {
          const v = r[f.key] ?? "";
          // evita quebrar CSV
          const s = String(v).replaceAll("\n", " ").replaceAll(";", ",");
          return s;
        }).join(";");
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "fretes.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ===== Init =====
  function init() {
    buildForm();

    rows = loadRows();
    if (!rows.length) {
      // começa vazio (você decide). Se quiser já com exemplo, troque para demoRows().
      rows = [];
      saveRows();
    }

    // Eventos
    $("btnNovo").addEventListener("click", openNew);
    $("btnCloseModal").addEventListener("click", closeModal);
    $("btnSave").addEventListener("click", saveModal);
    $("btnDelete").addEventListener("click", deleteRow);

    $("modal").addEventListener("click", (e) => {
      if (e.target && e.target.id === "modal") closeModal();
    });

    $("btnResetDemo").addEventListener("click", () => {
      rows = demoRows();
      saveRows();
      render();
    });

    $("btnExport").addEventListener("click", exportCSV);

    ["qSearch", "qStatus", "qFilial", "qRegional"].forEach((id) => {
      $(id).addEventListener("input", render);
      $(id).addEventListener("change", render);
    });

    // Render inicial
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
