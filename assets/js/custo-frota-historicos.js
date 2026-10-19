(() => {
  "use strict";

  const PAGE_SIZE = 50;
  const config = {
    expense: { id: "nfgModule-lancamentos", type: "expense" },
    freight: { id: "nfgModule-fretes", type: "freight" },
    fuel: { id: "nfgModule-combustivel", type: "fuel" },
    maintenance: { id: "nfgModule-manutencao", type: "maintenance" },
    commission: { id: "nfgModule-comissoes", type: "commission" },
    all: { id: "nfgAllRows", type: "" }
  };
  const state = Object.fromEntries(Object.keys(config).map(key => [key, {
    month: "", plate: "", driver: "", chosenMonth: false, shown: PAGE_SIZE
  }]));
  const els = Object.fromEntries(Object.entries(config).map(([key, value]) => [
    key, { root: document.querySelector('[data-nfgh-key="' + key + '"]'),
      table: document.getElementById(value.id),
      more: document.querySelector('[data-nfgh-more="' + key + '"]') }
  ]));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const money = value => Number(value || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL"
  });
  const normalizePlate = value => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const monthLabel = month => {
    if (month === "__undated__") return "Sem data informada";
    const [year, number] = month.split("-");
    const names = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return (names[Number(number) - 1] || month) + "/" + year;
  };
  const isUndated = row => row.isSchedule && row.source?.undated || row.date === "0001-01-01";
  const getMonth = row => isUndated(row) ? "__undated__" :
    /^\d{4}-\d{2}/.test(String(row.date || "")) ? row.date.slice(0, 7) : "__undated__";
  const description = row => {
    if (row.type === "freight") {
      return [row.origin, row.destination].filter(Boolean).join(" → ") ||
        row.client || row.invoice || "Frete";
    }
    if (row.type === "fuel") return [row.category || "Abastecimento", row.supplier].filter(Boolean).join(" • ");
    return row.description || row.category || row.supplier || "";
  };
  const typeLabels = {
    freight: "Frete", expense: "Despesa", fuel: "Abastecimento",
    maintenance: "Manutenção", commission: "Comissão / vale"
  };
  const total = row => {
    if (row.type === "freight") return row.netFreight != null && row.netFreight !== ""
      ? Number(row.netFreight) : Number(row.gross || 0) - Number(row.discount || 0) - Number(row.otherDiscount || 0);
    if (row.type === "fuel") return row.value != null && row.value !== ""
      ? Number(row.value) : Number(row.liters || 0) * Number(row.price || 0);
    return Number(row.value || 0);
  };
  const dateLabel = row => isUndated(row) ? "Sem data" :
    /^\d{4}-\d{2}-\d{2}$/.test(row.date || "") ?
      row.date.slice(8, 10) + "/" + row.date.slice(5, 7) + "/" + row.date.slice(0, 4) :
      row.date || "Sem data";
  const allRecords = () => typeof window.NFGFetchRows === "function" ? window.NFGFetchRows() : [];

  function buildOptions(select, options, selected) {
    const already = new Set(options.map(x => String(x.value)));
    if (selected && !already.has(selected)) options.push({
      value: selected, label: selected === "__undated__" ? "Sem data informada" : selected
    });
    select.innerHTML = options.map(o =>
      '<option value="' + esc(o.value) + '">' + esc(o.label) + "</option>"
    ).join("");
    select.value = selected;
  }

  function table(rows) {
    if (!rows.length) return '<p class="nfg-muted">Nenhum lançamento encontrado. Altere o mês, a placa ou o motorista para consultar outros registros.</p>';
    return '<table class="nfg-table"><thead><tr>' +
      "<th>Data</th><th>Placa</th><th>Motorista</th><th>Tipo</th><th>Descrição / trajeto</th>" +
      "<th>Valor</th><th>Informações</th><th>Ações</th></tr></thead><tbody>" +
      rows.map(row => {
        const isFreight = row.type === "freight";
        const details = isFreight ? "Bruto: " + money(row.gross) :
          row.type === "fuel" ? (row.liters != null ? Number(row.liters).toLocaleString("pt-BR") + " L" : "") :
          row.isSchedule ? "Revisão programada" : (row.category || "");
        const price = row.isSchedule ? "Sem custo lançado" : money(total(row));
        return "<tr><td>" + esc(dateLabel(row)) + "</td><td>" + esc(row.plate) +
          "</td><td>" + esc(row.driver || "Não informado") + "</td><td>" +
          esc(typeLabels[row.type] || row.type) + "</td><td>" + esc(description(row)) +
          "</td><td>" + esc(price) + "</td><td>" + esc(details) + "</td><td>" +
          '<button type="button" class="nfg-action secondary" data-nfg-detail="' + esc(row.id) + '">Detalhes / editar</button> ' +
          '<button type="button" class="nfg-action secondary" data-delete="' + esc(row.id) + '">Excluir</button>' +
          "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function render(key, source) {
    const widgets = els[key], settings = state[key];
    if (!widgets.root || !widgets.table) return;
    const base = (config[key].type ? source.filter(r => r.type === config[key].type) : source)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")) ||
        String(b.id || "").localeCompare(String(a.id || "")));
    const months = [...new Set(base.map(getMonth))].sort((a, b) => {
      if (a === "__undated__") return 1;
      if (b === "__undated__") return -1;
      return b.localeCompare(a);
    });
    if (!settings.chosenMonth && months.length) {
      const ownMonths = [...new Set(base.filter(r =>
        (!settings.plate || normalizePlate(r.plate) === settings.plate) &&
        (!settings.driver || String(r.driver || "").trim() === settings.driver)
      ).map(getMonth))].sort((a, b) => b.localeCompare(a));
      settings.month = ownMonths.find(m => m !== "__undated__") ||
        (ownMonths.includes("__undated__") ? "__undated__" : "");
    }

    const plates = [...new Set(base.map(r => normalizePlate(r.plate)).filter(Boolean))].sort();
    const drivers = [...new Set(base.map(r => String(r.driver || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    buildOptions(widgets.root.querySelector("[data-nfgh-month]"),
      [{value: "", label: "Todos os meses"}, ...months.map(m => ({value: m, label: monthLabel(m)}))],
      settings.month);
    buildOptions(widgets.root.querySelector("[data-nfgh-plate]"),
      [{value: "", label: "Todas as placas"}, ...plates.map(p => ({value: p, label: p}))],
      settings.plate);
    buildOptions(widgets.root.querySelector("[data-nfgh-driver]"),
      [{value: "", label: "Todos os motoristas"}, ...drivers.map(d => ({value: d, label: d}))],
      settings.driver);

    const matches = base.filter(r =>
      (!settings.month || getMonth(r) === settings.month) &&
      (!settings.plate || normalizePlate(r.plate) === settings.plate) &&
      (!settings.driver || String(r.driver || "").trim() === settings.driver)
    );
    const page = matches.slice(0, settings.shown);
    widgets.table.innerHTML = table(page);
    const count = widgets.root.querySelector("[data-nfgh-count]");
    count.textContent = "Exibindo " + page.length + " de " + matches.length +
      " lançamento(s) filtrado(s)" + (base.length !== matches.length ?
        " | " + base.length + " no histórico completo" : "");
    if (widgets.more) {
      widgets.more.hidden = matches.length <= page.length;
      widgets.more.textContent = "Mostrar mais " + Math.min(PAGE_SIZE, matches.length - page.length) + " registros";
    }
  }

  function refresh() {
    if (typeof window.NFGDataReady === "function" && !window.NFGDataReady()) return;
    const data = allRecords();
    for (const key of Object.keys(config)) render(key, data);
  }

  for (const [key, widgets] of Object.entries(els)) {
    if (!widgets.root) continue;
    widgets.root.addEventListener("change", event => {
      const field = event.target;
      if (!field.matches("select")) return;
      if (field.hasAttribute("data-nfgh-month")) {
        state[key].month = field.value;
        state[key].chosenMonth = true;
      } else if (field.hasAttribute("data-nfgh-plate")) {
        state[key].plate = field.value;
      } else if (field.hasAttribute("data-nfgh-driver")) {
        state[key].driver = field.value;
      }
      state[key].shown = PAGE_SIZE;
      refresh();
    });
    widgets.root.querySelector("[data-nfgh-clear]")?.addEventListener("click", () => {
      state[key] = {
        month: "", plate: "", driver: "", chosenMonth: true, shown: PAGE_SIZE
      };
      refresh();
    });
    widgets.more?.addEventListener("click", () => {
      state[key].shown += PAGE_SIZE;
      refresh();
    });
  }
  window.addEventListener("nfg-records-changed", refresh);
  if (window.NFGDataReady?.()) refresh();
})();