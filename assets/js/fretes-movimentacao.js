/* Painel compacto de Portas e Trânsitos por filial — Fretes / Fretes2 */
(function () {
  "use strict";

  const style = `
    .fretes-top .title{flex:0 1 40%;min-width:270px}
    .nfMov{flex:1 1 52%;min-width:300px;max-width:100%;display:flex;flex-direction:column;gap:5px;overflow:hidden}
    .nfMovHead{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#12365f;font-size:10px;font-weight:900;letter-spacing:.04em}
    .nfMovHead small{color:#60758f;font-size:9px;font-weight:700;letter-spacing:0}
    .nfMovNav{display:flex;gap:4px;flex-shrink:0}
    .nfMovArrow{border:1px solid #cbdaed;background:#f0f6ff;color:#153f75;border-radius:7px;width:22px;height:20px;cursor:pointer;font-weight:900;line-height:1}
    .nfMovArrow:hover{background:#dcecff}
    .nfMovTrack{display:flex;gap:7px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:#9dbde0 transparent;padding:1px 1px 4px;overscroll-behavior-x:contain}
    .nfMovCard{flex:0 0 144px;scroll-snap-align:start;border:1px solid #d6e3f0;border-radius:10px;background:linear-gradient(180deg,#f9fcff,#eef5fc);padding:6px 8px;min-width:0;cursor:pointer;text-align:left;color:#13345e}
    .nfMovCard:hover{border-color:#2587db;box-shadow:0 2px 8px #1470b51c}
    .nfMovCard[aria-pressed="true"]{border-color:#0c83d9;box-shadow:0 0 0 1px #0c83d9;background:#e8f5ff}
    .nfMovName{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px;font-weight:900;margin-bottom:4px}
    .nfMovNums{display:flex;justify-content:space-between;gap:8px;font-size:10px;font-weight:800}
    .nfMovNums b{font-size:17px;line-height:1;font-variant-numeric:tabular-nums}
    .nfMovPorta{color:#1767bb}.nfMovTransito{color:#b97805}
    .nfMovEmpty{font-size:10px;color:#60758f;padding:16px 5px}
    @media(max-width:950px){.fretes-top .title{flex:1 1 100%}.nfMov{flex:1 1 100%;min-width:0}}
  `;

  function ensurePanel() {
    const top = document.querySelector(".fretes-top");
    if (!top) return null;
    let panel = document.getElementById("nfMovPanel");
    if (panel) return panel;
    if (!document.getElementById("nfMovStyles")) {
      const tag = document.createElement("style");
      tag.id = "nfMovStyles";
      tag.textContent = style;
      document.head.appendChild(tag);
    }
    panel = document.createElement("section");
    panel.id = "nfMovPanel";
    panel.className = "nfMov";
    panel.setAttribute("aria-label", "Movimentação de veículos por filial");
    panel.innerHTML = '<div class="nfMovHead"><span>🚛 PORTA E TRÂNSITO POR FILIAL <small id="nfMovTotal"></small></span><div class="nfMovNav"><button class="nfMovArrow" type="button" id="nfMovPrev" aria-label="Ver filiais anteriores">‹</button><button class="nfMovArrow" type="button" id="nfMovNext" aria-label="Ver próximas filiais">›</button></div></div><div class="nfMovTrack" id="nfMovTrack" tabindex="0" aria-label="Role para visualizar todas as filiais"><span class="nfMovEmpty">Aguardando dados dos fretes...</span></div>';
    top.appendChild(panel);
    panel.querySelector("#nfMovPrev").addEventListener("click", () => panel.querySelector("#nfMovTrack").scrollBy({left:-330,behavior:"smooth"}));
    panel.querySelector("#nfMovNext").addEventListener("click", () => panel.querySelector("#nfMovTrack").scrollBy({left:330,behavior:"smooth"}));
    return panel;
  }

  function numeric(value) {
    const raw = String(value ?? "").trim();
    if (!raw || !/^[\d.,\s+-]+$/.test(raw)) return 0;
    let cleaned = raw.replace(/\s/g, "");
    if (cleaned.includes(",")) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/\./g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function render(rows) {
    const panel = ensurePanel();
    if (!panel) return;
    const track = panel.querySelector("#nfMovTrack");
    const position = track.scrollLeft;
    const groups = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const filial = String(row?.filial || "").trim().toLocaleUpperCase("pt-BR");
      if (!filial) return;
      if (!groups.has(filial)) groups.set(filial, {porta:0,transito:0});
      const item = groups.get(filial);
      item.porta += numeric(row?.porta);
      item.transito += numeric(row?.transito);
    });
    const entries = [...groups.entries()].sort((a,b) => a[0].localeCompare(b[0],"pt-BR"));
    const totalPorta = entries.reduce((n,[,x]) => n+x.porta,0);
    const totalTransito = entries.reduce((n,[,x]) => n+x.transito,0);
    const format = n => n.toLocaleString("pt-BR",{maximumFractionDigits:2});
    panel.querySelector("#nfMovTotal").textContent = entries.length ? `· ${format(totalPorta)} porta / ${format(totalTransito)} trânsito` : "";
    track.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("span");
      empty.className = "nfMovEmpty";
      empty.textContent = "Nenhum frete disponível.";
      track.appendChild(empty);
      return;
    }
    const current = String(document.getElementById("fFilial")?.value || "").trim().toLocaleUpperCase("pt-BR");
    entries.forEach(([filial,values]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nfMovCard";
      button.title = `Filtrar fretes da filial ${filial}`;
      button.setAttribute("aria-pressed",String(current===filial));
      const name = document.createElement("span");
      name.className = "nfMovName";
      name.textContent = filial;
      const nums = document.createElement("span");
      nums.className = "nfMovNums";
      const porta = document.createElement("span");
      porta.className = "nfMovPorta";
      porta.innerHTML = "<b></b> Porta";
      porta.querySelector("b").textContent = format(values.porta);
      const transito = document.createElement("span");
      transito.className = "nfMovTransito";
      transito.innerHTML = "<b></b> Trânsito";
      transito.querySelector("b").textContent = format(values.transito);
      nums.append(porta,transito);
      button.append(name,nums);
      button.addEventListener("click", () => {
        const select = document.getElementById("fFilial");
        if (!select) return;
        const option = [...select.options].find(o => o.value.trim().toLocaleUpperCase("pt-BR")===filial);
        if (!option) return;
        select.value = select.value === option.value ? "" : option.value;
        select.dispatchEvent(new Event("change",{bubbles:true}));
      });
      track.appendChild(button);
    });
    track.scrollLeft = position;
  }

  window.NFFilialMovimentacao = { render };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensurePanel, {once:true});
  else ensurePanel();
})();
