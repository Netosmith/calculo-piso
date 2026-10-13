/* home-map.js | NOVA FROTA | Fretes por estado na Home */
(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const REFRESH_MS = 60000;

  const STATE = {
    rows: [],
    selectedUf: "",
    timer: null,
    bound: false,
    loading: false
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

  function safe(value) {
    return String(value == null ? "" : value).trim();
  }

  function upper(value) {
    return safe(value).toUpperCase();
  }

  function escapeHtml(value) {
    return safe(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function num(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    let text = String(value).trim().replace(/\s+/g, "").replace(/[^\d.,-]/g, "");
    if (!text) return 0;

    if (text.includes(",")) {
      text = text.replace(/\./g, "").replace(",", ".");
    }

    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function moneyBR(value) {
    return num(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function firstValue(object, keys, fallback = "") {
    for (const key of keys) {
      if (
        object &&
        object[key] !== undefined &&
        object[key] !== null &&
        object[key] !== ""
      ) {
        return object[key];
      }
    }
    return fallback;
  }

  function extractRows(response, depth = 0) {
    if (Array.isArray(response)) return response;
    if (!response || typeof response !== "object" || depth > 6) return [];

    const keys = ["data", "rows", "items", "fretes", "registros", "result"];
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(response, key)) continue;
      const rows = extractRows(response[key], depth + 1);
      if (rows.length || Array.isArray(response[key])) return rows;
    }

    return [];
  }

  function normalizeRow(row, source) {
    return {
      id: safe(firstValue(row, ["id", "idFrete", "ID", "Id"])),
      source: upper(source),
      regional: upper(firstValue(row, ["regional", "Regional"])),
      filial: upper(firstValue(row, ["filial", "Filial", "nomeFilial"])),
      cliente: upper(firstValue(row, ["cliente", "Cliente", "nomeCliente"])),
      origem: upper(firstValue(row, ["origem", "Origem", "cidadeOrigem"])),
      coleta: upper(firstValue(row, ["coleta", "Coleta", "localColeta"])),
      destino: upper(firstValue(row, ["destino", "Destino", "cidadeDestino"])),
      descarga: upper(firstValue(row, ["descarga", "Descarga", "localDescarga"])),
      produto: upper(firstValue(row, ["produto", "Produto"])),
      contato: upper(firstValue(row, [
        "contato", "Contato", "responsavel", "responsável", "Responsavel", "Responsável"
      ])),
      valorMotorista: firstValue(row, [
        "valorMotorista", "vlrMotorista", "freteMotorista",
        "valor_motorista", "Valor Motorista"
      ]),
      status: upper(firstValue(row, ["status", "Status"], "LIBERADO"))
    };
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
    const explicit = extractUf(row.origem) || extractUf(row.coleta);
    if (explicit) return explicit;

    if (row.source === "FRETES") return "GO";
    if (row.source === "FRETES2") return "MT";
    return "";
  }

  function availableRows(rows) {
    return rows.filter((row) => {
      const status = upper(row.status);
      return !status || status === "LIBERADO";
    });
  }

  function stateSummary(rows) {
    const map = new Map();

    rows.forEach((row) => {
      const uf = loadingUf(row);
      if (!STATES[uf]) return;
      map.set(uf, (map.get(uf) || 0) + 1);
    });

    return map;
  }

  function chooseDefaultState(rows) {
    if (STATE.selectedUf && rows.some((row) => loadingUf(row) === STATE.selectedUf)) {
      return;
    }

    const summary = stateSummary(rows);
    const top = [...summary.entries()].sort((a, b) => b[1] - a[1])[0];
    STATE.selectedUf = top ? top[0] : "";
  }

  function stateColor(total, max) {
    if (!total) return "#d7e3f0";
    const ratio = max > 0 ? total / max : 0;
    if (ratio >= 0.72) return "#1d4ed8";
    if (ratio >= 0.40) return "#3b82f6";
    return "#7db7f5";
  }

  function renderList(rows) {
    const uf = STATE.selectedUf;
    const title = $("#homeMapStateTitle");
    const count = $("#homeMapStateCount");
    const list = $("#homeMapFreightList");

    if (!list) return;

    if (!uf || !STATES[uf]) {
      if (title) title.textContent = "Selecione um estado";
      if (count) count.textContent = "0 fretes";
      list.innerHTML =
        '<div class="homeMapEmpty">Clique em um estado azul do mapa para visualizar os fretes disponíveis.</div>';
      return;
    }

    const filtered = rows
      .filter((row) => loadingUf(row) === uf)
      .sort((a, b) =>
        a.origem.localeCompare(b.origem, "pt-BR") ||
        a.destino.localeCompare(b.destino, "pt-BR")
      );

    if (title) title.textContent = STATES[uf].toUpperCase();
    if (count) count.textContent = filtered.length + (filtered.length === 1 ? " frete" : " fretes");

    if (!filtered.length) {
      list.innerHTML =
        '<div class="homeMapEmpty">Nenhum frete liberado neste estado no momento.</div>';
      return;
    }

    list.innerHTML = filtered.map((row, index) => {
      const reference = row.id ? "#" + escapeHtml(row.id) : "#" + String(index + 1).padStart(3, "0");

      return `
        <article class="homeFreightItem">
          <div class="homeFreightTop">
            <div class="homeFreightRoute">
              <span class="homeFreightOriginDot">●</span>
              <strong>${escapeHtml(row.origem || "-")}</strong>
              <span>→</span>
              <strong>${escapeHtml(row.destino || "-")}</strong>
            </div>
            <span class="homeFreightRef">${reference}</span>
          </div>

          <div class="homeFreightGrid">
            <div class="homeFreightInfo">
              <span class="homeFreightInfoIcon green">⌖</span>
              <div><small>Origem</small><b>${escapeHtml(row.origem || "-")}</b></div>
            </div>

            <div class="homeFreightInfo">
              <span class="homeFreightInfoIcon blue">▦</span>
              <div><small>Local de coleta</small><b>${escapeHtml(row.coleta || "-")}</b></div>
            </div>

            <div class="homeFreightInfo">
              <span class="homeFreightInfoIcon red">⌖</span>
              <div><small>Destino</small><b>${escapeHtml(row.destino || "-")}</b></div>
            </div>

            <div class="homeFreightInfo">
              <span class="homeFreightInfoIcon blue">▦</span>
              <div><small>Local de descarga</small><b>${escapeHtml(row.descarga || "-")}</b></div>
            </div>

            <div class="homeFreightInfo">
              <span class="homeFreightInfoIcon money">R$</span>
              <div><small>Frete motorista</small><b class="homeFreightPrice">${moneyBR(row.valorMotorista)}</b></div>
            </div>

            <div class="homeFreightInfo">
              <span class="homeFreightInfoIcon blue">●</span>
              <div><small>Contato do responsável</small><b>${escapeHtml(row.contato || "-")}</b></div>
            </div>
          </div>

          ${row.produto ? '<div class="homeFreightProduct">' + escapeHtml(row.produto) + '</div>' : ""}
        </article>
      `;
    }).join("");
  }

  function applyMapColors(rows) {
    const component = $("#homeBrazilMap");
    const root = component && component.shadowRoot;
    if (!root) return false;

    const summary = stateSummary(rows);
    const max = Math.max(0, ...summary.values());

    UFS.forEach((uf) => {
      const path = root.querySelector("#BR-" + uf);
      if (!path) return;

      const total = summary.get(uf) || 0;
      const selected = uf === STATE.selectedUf;

      path.style.fill = selected ? "#0b5ed7" : stateColor(total, max);
      path.style.stroke = selected ? "#7dd3fc" : "#ffffff";
      path.style.strokeWidth = selected ? "2.4" : "0.8";
      path.style.filter = selected
        ? "drop-shadow(0 0 8px rgba(59,130,246,.70))"
        : "";
      path.style.opacity = total ? "1" : ".72";
      path.style.transition = "fill .18s ease, stroke .18s ease, filter .18s ease";

      const acronym = root.querySelector("#" + uf);
      if (acronym) {
        acronym.style.fill = selected ? "#ffffff" : (total ? "#ffffff" : "#496782");
        acronym.style.fontWeight = "800";
      }

      path.setAttribute(
        "title",
        STATES[uf] + " • " + total + (total === 1 ? " frete" : " fretes")
      );

      if (!path.dataset.nfHomeMapBound) {
        path.dataset.nfHomeMapBound = "1";
        path.addEventListener("mouseleave", () => {
          requestAnimationFrame(() => applyMapColors(STATE.rows));
        });
      }
    });

    return true;
  }

  async function paintMap(rows) {
    const component = $("#homeBrazilMap");
    if (!component) return;

    try {
      if (window.customElements && customElements.whenDefined) {
        await customElements.whenDefined("brazil-component");
      }

      if (component.updateComplete) {
        await component.updateComplete;
      }

      applyMapColors(rows);
    } catch (error) {
      console.warn("[HOME MAP] não foi possível pintar o mapa:", error);
    }
  }

  function render() {
    chooseDefaultState(STATE.rows);
    renderList(STATE.rows);
    void paintMap(STATE.rows);

    const totalStates = stateSummary(STATE.rows).size;
    const subtitle = $("#homeMapSubtitle");
    if (subtitle) {
      subtitle.textContent = totalStates
        ? totalStates + (totalStates === 1 ? " estado com fretes disponíveis" : " estados com fretes disponíveis")
        : "Nenhum frete liberado no momento";
    }
  }

  function setLoading(active) {
    const panel = $("#homeFreightMapPanel");
    if (panel) panel.classList.toggle("is-loading", !!active);
  }

  function showError(message) {
    const list = $("#homeMapFreightList");
    if (list) {
      list.innerHTML =
        '<div class="homeMapEmpty homeMapError">' +
        escapeHtml(message || "Não foi possível carregar os fretes.") +
        '</div>';
    }
  }

  function isPiso(session) {
    const profile = upper(session && session.perfil) ||
      (typeof window.getProfile === "function" ? upper(window.getProfile()) : "");
    return profile === "PISO";
  }

  async function load(force = false) {
    if (STATE.loading) return;
    STATE.loading = true;
    setLoading(true);

    try {
      const session = window.portalAuthReady
        ? await window.portalAuthReady
        : null;

      if (!session) throw new Error("Sessão inválida ou expirada.");

      if (isPiso(session)) {
        const panel = $("#homeFreightMapPanel");
        if (panel) panel.classList.add("is-restricted");
        const list = $("#homeMapFreightList");
        if (list) {
          list.innerHTML =
            '<div class="homeMapEmpty">INFORMAÇÃO RESTRITA PARA O PERFIL PISO.</div>';
        }
        return;
      }

      const panel = $("#homeFreightMapPanel");
      if (panel) panel.classList.remove("is-restricted");

      if (!window.PortalAPI) {
        if (typeof window.ensurePortalApi === "function") {
          await window.ensurePortalApi();
        }
      }
      if (!window.PortalAPI) throw new Error("API segura do Portal indisponível.");

      const results = await Promise.allSettled([
        window.PortalAPI.call("fretes", "read"),
        window.PortalAPI.call("fretes2", "read")
      ]);

      const merged = [];
      const sources = ["FRETES", "FRETES2"];

      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        merged.push(
          ...extractRows(result.value).map((row) => normalizeRow(row, sources[index]))
        );
      });

      if (!merged.length && results.every((result) => result.status === "rejected")) {
        throw results[0].reason || new Error("Falha ao carregar fretes.");
      }

      STATE.rows = availableRows(merged);
      render();
    } catch (error) {
      console.error("[HOME MAP] erro ao carregar:", error);
      showError(error && error.message ? error.message : "Não foi possível carregar os fretes.");
    } finally {
      STATE.loading = false;
      setLoading(false);
    }
  }

  function bind() {
    if (STATE.bound) return;
    STATE.bound = true;

    const component = $("#homeBrazilMap");
    if (component) {
      component.addEventListener("onStateSelected", (event) => {
        const uf = upper(event.detail);
        if (!STATES[uf]) return;
        STATE.selectedUf = uf;
        render();
      });
    }

    const refresh = $("#homeMapRefresh");
    if (refresh) {
      refresh.addEventListener("click", () => load(true));
    }

    window.addEventListener("portal:session", (event) => {
      if (isPiso(event && event.detail)) {
        const panel = $("#homeFreightMapPanel");
        if (panel) panel.classList.add("is-restricted");
      }
    });
  }

  function startRefresh() {
    if (STATE.timer) clearInterval(STATE.timer);
    STATE.timer = setInterval(() => {
      if (document.visibilityState === "visible") load(false);
    }, REFRESH_MS);
  }

  async function init() {
    bind();
    await load(true);
    startRefresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
