/* bi-map.js | NOVA FROTA | Mapa operacional interativo */
(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const STATE = {
    selectedUf: "",
    detailMode: "FILIAL",
    initialized: false
  };

  const STATES = {
    AC:"Acre", AL:"Alagoas", AP:"Amapá", AM:"Amazonas", BA:"Bahia", CE:"Ceará",
    DF:"Distrito Federal", ES:"Espírito Santo", GO:"Goiás", MA:"Maranhão",
    MT:"Mato Grosso", MS:"Mato Grosso do Sul", MG:"Minas Gerais", PA:"Pará",
    PB:"Paraíba", PR:"Paraná", PE:"Pernambuco", PI:"Piauí", RJ:"Rio de Janeiro",
    RN:"Rio Grande do Norte", RS:"Rio Grande do Sul", RO:"Rondônia", RR:"Roraima",
    SC:"Santa Catarina", SP:"São Paulo", SE:"Sergipe", TO:"Tocantins"
  };

  const UFS = Object.keys(STATES);
  const UF_RE = new RegExp(
    "(?:^|[-/\\s,])(" + UFS.join("|") + ")(?=$|[-/\\s,])",
    "g"
  );

  function bi() {
    return window.NFBI || null;
  }

  function safe(value) {
    return String(value == null ? "" : value).trim();
  }

  function upper(value) {
    return safe(value).toUpperCase();
  }

  function number(value) {
    const api = bi();
    return api && typeof api.num === "function" ? api.num(value) : (Number(value) || 0);
  }

  function intBR(value) {
    const api = bi();
    if (api && typeof api.intBR === "function") return api.intBR(value);
    return (Number(value) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }

  function escapeHtml(value) {
    return safe(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function rows() {
    const api = bi();
    return api && typeof api.getRows === "function" ? api.getRows() : [];
  }

  function extractUf(value) {
    const raw = upper(value).replace(/[()]/g, " ");
    if (!raw) return "";

    UF_RE.lastIndex = 0;
    let match;
    let found = "";

    while ((match = UF_RE.exec(raw))) {
      found = match[1] || found;
    }

    UF_RE.lastIndex = 0;
    return found;
  }

  function loadingUf(row) {
    const explicit = extractUf(row && row.origem) || extractUf(row && row.coleta);
    if (explicit) return explicit;

    const source = upper(row && row.origemDados);
    if (source === "FRETES") return "GO";
    if (source === "FRETES2") return "MT";
    return "";
  }

  function cleanCity(value, uf) {
    let city = upper(value);
    if (!city) return "";

    const suffix = upper(uf);
    if (suffix) {
      city = city
        .replace(new RegExp("\\s*[-/]\\s*" + suffix + "\\s*$", "i"), "")
        .replace(new RegExp("\\s*,\\s*" + suffix + "\\s*$", "i"), "")
        .replace(new RegExp("\\s+" + suffix + "\\s*$", "i"), "")
        .replace(new RegExp("\\s*\\(" + suffix + "\\)\\s*$", "i"), "");
    }

    return city.replace(/\s{2,}/g, " ").trim();
  }

  function loadingCity(row) {
    const uf = loadingUf(row);
    return cleanCity(row && row.origem, uf) ||
      cleanCity(row && row.coleta, uf) ||
      "SEM CIDADE";
  }

  function operational(row) {
    const porta = number(row && row.porta);
    const transito = number(row && row.transito);
    return {
      porta: porta,
      transito: transito,
      vehicles: porta + transito
    };
  }

  function stateSummaries(data) {
    const map = new Map();
    const peso = (bi() && bi().pesoMedio) || 38;

    data.forEach(function (row) {
      const uf = loadingUf(row);
      if (!STATES[uf]) return;

      if (!map.has(uf)) {
        map.set(uf, {
          uf: uf,
          freights: 0,
          vehicles: 0,
          volume: 0,
          branches: new Set(),
          regionals: new Set()
        });
      }

      const item = map.get(uf);
      const op = operational(row);

      item.freights += 1;
      item.vehicles += op.vehicles;
      item.volume += op.vehicles * peso;

      if (row.filial) item.branches.add(row.filial);
      if (row.regional) item.regionals.add(row.regional);
    });

    return map;
  }

  function metric() {
    return safe($("#mapMetric") && $("#mapMetric").value || "VEICULOS");
  }

  function metricValue(item) {
    const current = metric();
    if (!item) return 0;
    if (current === "FRETES") return item.freights;
    if (current === "VOLUME") return item.volume;
    return item.vehicles;
  }

  function metricLabel() {
    const current = metric();
    if (current === "FRETES") return "Quantidade de Fretes";
    if (current === "VOLUME") return "Volume Operacional";
    return "Quantidade de Veículos";
  }

  function heatColor(value, max) {
    if (!(value > 0) || !(max > 0)) return "#dbe7f3";
    const ratio = value / max;
    if (ratio >= 0.72) return "#1d4ed8";
    if (ratio >= 0.42) return "#3b82f6";
    if (ratio >= 0.18) return "#60a5fa";
    return "#b9d8fb";
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function renderKpis(data) {
    const api = bi();
    const kpi = api && typeof api.calcOperationalKPIs === "function"
      ? api.calcOperationalKPIs(data)
      : { totalVeiculos: 0, volume: 0 };

    const branches = new Set(
      data.map(function (row) { return upper(row.filial); }).filter(Boolean)
    );

    setText("#mapKpiFretes", intBR(data.length));
    setText("#mapKpiVeiculos", intBR(kpi.totalVeiculos));
    setText("#mapKpiVolume", intBR(kpi.volume) + " t");
    setText("#mapKpiFiliais", intBR(branches.size));
  }

  function ensureSelectedState(data) {
    if (STATE.selectedUf) return;

    const summaries = stateSummaries(data);
    const ordered = Array.from(summaries.values()).sort(function (a, b) {
      return metricValue(b) - metricValue(a);
    });

    if (ordered[0]) STATE.selectedUf = ordered[0].uf;
  }

  function detailGroups(data) {
    const groups = new Map();

    data.forEach(function (row) {
      const key = upper(
        STATE.detailMode === "REGIONAL" ? row.regional : row.filial
      ) || (STATE.detailMode === "REGIONAL" ? "SEM REGIONAL" : "SEM FILIAL");

      const city = loadingCity(row);
      const vehicles = operational(row).vehicles;

      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          freights: 0,
          vehicles: 0,
          cities: new Map()
        });
      }

      const group = groups.get(key);
      group.freights += 1;
      group.vehicles += vehicles;

      if (!group.cities.has(city)) {
        group.cities.set(city, {
          name: city,
          freights: 0,
          vehicles: 0
        });
      }

      const cityItem = group.cities.get(city);
      cityItem.freights += 1;
      cityItem.vehicles += vehicles;
    });

    return Array.from(groups.values()).map(function (group) {
      group.cities = Array.from(group.cities.values()).sort(function (a, b) {
        return b.vehicles - a.vehicles ||
          b.freights - a.freights ||
          a.name.localeCompare(b.name, "pt-BR");
      });
      return group;
    }).sort(function (a, b) {
      return b.vehicles - a.vehicles ||
        b.freights - a.freights ||
        a.name.localeCompare(b.name, "pt-BR");
    });
  }

  function renderStateDetails(data) {
    const uf = upper(STATE.selectedUf);
    const title = $("#mapStateTitle");
    const subtitle = $("#mapStateSubtitle");
    const breadcrumb = $("#mapBreadcrumbState");
    const details = $("#mapStateDetails");

    if (!details) return;

    if (!uf || !STATES[uf]) {
      if (title) title.textContent = "Selecione um estado";
      if (subtitle) subtitle.textContent = "Clique no mapa para visualizar onde temos carregamentos.";
      if (breadcrumb) breadcrumb.textContent = "Estado";
      details.innerHTML = '<div class="mapDetailEmpty">Selecione um estado no mapa.</div>';
      return;
    }

    const stateRows = data.filter(function (row) {
      return loadingUf(row) === uf;
    });

    const api = bi();
    const kpi = api && typeof api.calcOperationalKPIs === "function"
      ? api.calcOperationalKPIs(stateRows)
      : { totalVeiculos: 0, volume: 0 };

    if (title) {
      title.innerHTML =
        escapeHtml(STATES[uf]) +
        ' <span class="mapActivityBadge">' +
        intBR(kpi.totalVeiculos) +
        ' veículos</span>';
    }

    if (subtitle) {
      subtitle.textContent = stateRows.length
        ? intBR(stateRows.length) + " carregamentos • " + intBR(kpi.volume) + " t de volume operacional"
        : "Nenhum carregamento encontrado com os filtros atuais.";
    }

    if (breadcrumb) breadcrumb.textContent = STATES[uf];

    const groups = detailGroups(stateRows);
    if (!groups.length) {
      details.innerHTML = '<div class="mapDetailEmpty">Nenhuma cidade encontrada neste estado para os filtros selecionados.</div>';
      return;
    }

    let maxCity = 1;
    groups.forEach(function (group) {
      group.cities.forEach(function (city) {
        maxCity = Math.max(maxCity, city.vehicles, city.freights);
      });
    });

    const html = [];

    groups.forEach(function (group) {
      html.push('<div class="mapGroup">');
      html.push(
        '<div class="mapGroupHead">' +
          '<span class="mapGroupName">' + escapeHtml(group.name) + '</span>' +
          '<span class="mapGroupTotal">' +
            intBR(group.vehicles) + ' veículos • ' + intBR(group.freights) + ' fretes' +
          '</span>' +
        '</div>'
      );

      group.cities.forEach(function (city) {
        const score = Math.max(city.vehicles, city.freights);
        const width = Math.max(4, Math.round((score / maxCity) * 100));

        html.push(
          '<div class="mapCityRow">' +
            '<span class="mapCityName">📍 ' + escapeHtml(city.name) + '</span>' +
            '<span class="mapCityMeta">' +
              intBR(city.vehicles) + ' veículos • ' + intBR(city.freights) + ' fretes' +
            '</span>' +
            '<div class="mapCityBar"><span style="width:' + width + '%"></span></div>' +
          '</div>'
        );
      });

      html.push('</div>');
    });

    details.innerHTML = html.join("");
  }

  function aggregate(data, keyFn, valueFn) {
    const map = new Map();

    data.forEach(function (row) {
      const key = upper(keyFn(row)) || "SEM DADO";
      map.set(key, (map.get(key) || 0) + Number(valueFn(row) || 0));
    });

    return Array.from(map.entries()).map(function (entry) {
      return { name: entry[0], value: entry[1] };
    }).sort(function (a, b) {
      return b.value - a.value || a.name.localeCompare(b.name, "pt-BR");
    });
  }

  function renderCharts(data) {
    const api = bi();
    if (!api || typeof api.makeChart !== "function") return;

    const uf = upper(STATE.selectedUf);
    const stateRows = uf ? data.filter(function (row) {
      return loadingUf(row) === uf;
    }) : [];

    setText("#mapRegionalSubtitle", uf ? STATES[uf] : "Estado selecionado");
    setText(
      "#mapBranchesSubtitle",
      uf ? "Top 10 filiais de " + STATES[uf] + " • Veículos (Porta + Trânsito)"
        : "Top 10 filiais do estado • Veículos (Porta + Trânsito)"
    );
    setText(
      "#mapProductsSubtitle",
      uf ? "Produtos movimentados em " + STATES[uf] : "Veículos por produto no estado"
    );

    if (!stateRows.length) {
      ["mapRegionalChart", "mapBranchesChart", "mapProductsChart"].forEach(function (id) {
        api.destroyChart(id);
      });
      return;
    }

    const regional = aggregate(
      stateRows,
      function (row) { return row.regional || "SEM REGIONAL"; },
      function (row) { return operational(row).vehicles; }
    ).slice(0, 10);

    // Ranking real de filiais no estado selecionado, a partir dos fretes
    // já filtrados pela base, regional, cliente, status e busca do B.I.
    // Não confundir quantidade de registros com quantidade de veículos.
    const branchesMap = new Map();
    stateRows.forEach(function (row) {
      const name = upper(row.filial);
      if (!name) return; // "SEM FILIAL" não é uma filial no ranking.

      let item = branchesMap.get(name);
      if (!item) {
        item = { name: name, vehicles: 0, freights: 0 };
        branchesMap.set(name, item);
      }
      item.vehicles += operational(row).vehicles;
      item.freights += 1;
    });

    const branches = Array.from(branchesMap.values()).sort(function (a, b) {
      return b.vehicles - a.vehicles ||
        b.freights - a.freights ||
        a.name.localeCompare(b.name, "pt-BR");
    }).slice(0, 10);

    const products = aggregate(
      stateRows,
      function (row) { return row.produto || "SEM PRODUTO"; },
      function (row) { return Math.max(1, operational(row).vehicles); }
    ).slice(0, 10);

    api.makeChart("mapRegionalChart", {
      type: "bar",
      data: {
        labels: regional.map(function (item) { return item.name; }),
        datasets: [{
          label: "Veículos",
          data: regional.map(function (item) { return item.value; }),
          backgroundColor: "rgba(37,99,235,.72)",
          borderColor: "#2563eb",
          borderWidth: 1,
          borderRadius: 7
        }]
      },
      options: api.chartBaseOptions({
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0, color: "#64748b" } },
          y: { ticks: { color: "#334155", font: { size: 10, weight: "700" } } }
        }
      })
    });

    if (branches.length) {
      api.makeChart("mapBranchesChart", {
        type: "bar",
        data: {
          labels: branches.map(function (item) {
            return item.name.length > 20 ? item.name.slice(0, 19) + "…" : item.name;
          }),
          datasets: [{
            label: "Veículos (Porta + Trânsito)",
            data: branches.map(function (item) { return item.vehicles; }),
            backgroundColor: "rgba(37,99,235,.72)",
            borderColor: "#2563eb",
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 22
          }]
        },
        options: api.chartBaseOptions({
          indexAxis: "y",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function (items) {
                  const item = branches[items[0] && items[0].dataIndex];
                  return item ? item.name : "";
                },
                label: function (context) {
                  const item = branches[context.dataIndex];
                  return "Veículos: " + intBR(item ? item.vehicles : 0);
                },
                afterLabel: function (context) {
                  const item = branches[context.dataIndex];
                  return "Fretes: " + intBR(item ? item.freights : 0);
                }
              }
            }
          },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0, color: "#64748b" } },
            y: { ticks: { color: "#334155", font: { size: 10, weight: "700" } } }
          }
        })
      });
    } else {
      api.destroyChart("mapBranchesChart");
    }

    api.makeChart("mapProductsChart", {
      type: "bar",
      data: {
        labels: products.map(function (item) { return item.name; }),
        datasets: [{
          label: "Veículos",
          data: products.map(function (item) { return item.value; }),
          backgroundColor: "rgba(22,163,74,.70)",
          borderColor: "#16a34a",
          borderWidth: 1,
          borderRadius: 7
        }]
      },
      options: api.chartBaseOptions({
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0, color: "#64748b" } },
          y: { ticks: { color: "#334155", font: { size: 10, weight: "700" } } }
        }
      })
    });
  }

  function applyMapColors(data) {
    const component = $("#biBrazilMap");
    const root = component && component.shadowRoot;
    if (!root) return false;

    const summaries = stateSummaries(data);
    let max = 0;

    summaries.forEach(function (item) {
      max = Math.max(max, metricValue(item));
    });

    setText("#mapLegendTitle", metricLabel());

    UFS.forEach(function (uf) {
      const path = root.querySelector("#BR-" + uf);
      if (!path) return;

      const item = summaries.get(uf);
      const value = metricValue(item);
      const selected = uf === STATE.selectedUf;

      path.style.fill = selected ? "#0b5ed7" : heatColor(value, max);
      path.style.stroke = selected ? "#082f70" : "#ffffff";
      path.style.strokeWidth = selected ? "2.2" : "0.8";
      path.style.filter = selected
        ? "drop-shadow(0 4px 7px rgba(37,99,235,.32))"
        : "";
      path.style.transition = "fill .18s ease, stroke .18s ease, filter .18s ease";

      const acronym = root.querySelector("#" + uf);
      if (acronym) acronym.style.fill = selected ? "#ffffff" : "#193a63";

      const valueText = metric() === "VOLUME"
        ? intBR(value) + " t"
        : intBR(value);

      path.setAttribute("title", STATES[uf] + " • " + valueText);

      if (!path.dataset.nfBiMapBound) {
        path.dataset.nfBiMapBound = "1";
        path.addEventListener("mouseleave", function () {
          requestAnimationFrame(function () {
            const api = bi();
            if (api && api.getMode() === "MAPA") {
              applyMapColors(rows());
            }
          });
        });
      }
    });

    return true;
  }

  async function paint(data) {
    const component = $("#biBrazilMap");
    if (!component) return;

    try {
      if (window.customElements && window.customElements.whenDefined) {
        await customElements.whenDefined("brazil-component");
      }

      if (component.updateComplete) {
        await component.updateComplete;
      }

      applyMapColors(data);
    } catch (error) {
      console.warn("[bi/mapa] Falha ao preparar mapa:", error);
      setText("#mapStateSubtitle", "Não foi possível carregar o desenho do mapa.");
    }
  }

  function render() {
    const api = bi();
    if (!api) return;

    const data = rows();
    renderKpis(data);
    ensureSelectedState(data);
    renderStateDetails(data);
    renderCharts(data);
    void paint(data);
  }

  function setDetailMode(mode) {
    STATE.detailMode = upper(mode) === "REGIONAL" ? "REGIONAL" : "FILIAL";

    document.querySelectorAll("[data-map-detail]").forEach(function (button) {
      button.classList.toggle(
        "active",
        upper(button.dataset.mapDetail) === STATE.detailMode
      );
    });

    renderStateDetails(rows());
  }

  function bind() {
    if (STATE.initialized) return;
    STATE.initialized = true;

    const component = $("#biBrazilMap");
    if (component) {
      component.addEventListener("onStateSelected", function (event) {
        const uf = upper(event.detail);
        if (!STATES[uf]) return;

        STATE.selectedUf = uf;
        render();
      });
    }

    const metricSelect = $("#mapMetric");
    if (metricSelect) {
      metricSelect.addEventListener("change", function () {
        render();
      });
    }

    document.querySelectorAll("[data-map-detail]").forEach(function (button) {
      button.addEventListener("click", function () {
        setDetailMode(button.dataset.mapDetail);
      });
    });
  }

  window.NFBIMap = {
    render: render,
    selectState: function (uf) {
      const normalized = upper(uf);
      if (!STATES[normalized]) return;
      STATE.selectedUf = normalized;
      render();
    }
  };

  function init() {
    bind();
    const api = bi();
    if (api && api.getMode() === "MAPA") render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
