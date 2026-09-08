from pathlib import Path
import re

html_path = Path("pages/fretes.html")
js_path = Path("assets/js/fretes.js")

html = html_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

old_html = '''            <div class="field"><label>Origem</label><input id="mOrigem" /></div>
            <div class="field"><label>Coleta</label><input id="mColeta" /></div>
            <div class="field"><label>Destino</label><input id="mDestino" /></div>'''
new_html = '''            <div class="field"><label>Origem</label><input id="mOrigem" /></div>
            <div class="field"><label>Coleta</label><input id="mColeta" /></div>
            <div class="field" style="grid-column: 1 / -1;">
              <label>Localização da coleta (Google Maps)</label>
              <input id="mLocalizacao" type="url" placeholder="https://maps.app.goo.gl/..." style="text-transform:none;" />
            </div>
            <div class="field"><label>Destino</label><input id="mDestino" /></div>'''

if "id=\"mLocalizacao\"" not in html:
    if old_html not in html:
        raise SystemExit("Trecho do modal não encontrado em fretes.html")
    html = html.replace(old_html, new_html, 1)

html = re.sub(r'fretes\.js\?v=\d+', 'fretes.js?v=16', html, count=1)

if 'isColeta: true' not in js:
    old = '    { key: "coleta", label: "Coleta" },'
    new = '    { key: "coleta", label: "Coleta", isColeta: true },'
    if old not in js:
        raise SystemExit("COLS coleta não encontrado")
    js = js.replace(old, new, 1)

if 'localizacao: () => document.getElementById("mLocalizacao")' not in js:
    old = '    coleta: () => document.getElementById("mColeta"),\n    destino: () => document.getElementById("mDestino"),'
    new = '    coleta: () => document.getElementById("mColeta"),\n    localizacao: () => document.getElementById("mLocalizacao"),\n    destino: () => document.getElementById("mDestino"),'
    if old not in js:
        raise SystemExit("MODAL coleta/destino não encontrado")
    js = js.replace(old, new, 1)

if 'function buildColetaCell(row)' not in js:
    helper_marker = '  function ceil0(n) {'
    helpers = r'''
  const NF_MAP_RE = /(?:^|\n)\[\[NF_MAP:([^\]]+)\]\]/i;

  function extractLocationFromObs(obs) {
    const match = String(obs ?? "").match(NF_MAP_RE);
    return match ? safeText(match[1]) : "";
  }

  function cleanObsText(obs) {
    return String(obs ?? "")
      .replace(/(?:^|\n)\[\[NF_MAP:[^\]]+\]\]/ig, "")
      .trim();
  }

  function encodeObsLocation(obs, location) {
    const clean = cleanObsText(obs);
    const loc = safeText(location);
    if (!loc) return clean;
    return `${clean}${clean ? "\n" : ""}[[NF_MAP:${loc}]]`;
  }

  function getRowLocation(row) {
    if (!row) return "";
    return safeText(row.localizacao || extractLocationFromObs(row.obs));
  }

  function buildColetaCell(row) {
    const td = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "5px";

    const location = getRowLocation(row);
    if (location) {
      const a = document.createElement("a");
      a.href = location;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "🗺️";
      a.title = "Abrir localização da coleta";
      a.style.textDecoration = "none";
      a.style.fontSize = "14px";
      a.style.lineHeight = "1";
      a.addEventListener("click", (event) => event.stopPropagation());
      wrap.appendChild(a);
    }

    const text = document.createElement("span");
    text.textContent = safeText(row.coleta);
    wrap.appendChild(text);
    td.appendChild(wrap);
    return td;
  }

'''
    if helper_marker not in js:
        raise SystemExit("Ponto de helpers não encontrado")
    js = js.replace(helper_marker, helpers + helper_marker, 1)

if 'tr.appendChild(buildColetaCell(row));' not in js:
    old = '''        if (col.isContato) {
          tr.appendChild(buildContatoCell(row.contato || ""));
          return;
        }'''
    new = '''        if (col.isColeta) {
          tr.appendChild(buildColetaCell(row));
          return;
        }

        if (col.isContato) {
          tr.appendChild(buildContatoCell(row.contato || ""));
          return;
        }'''
    if old not in js:
        raise SystemExit("Bloco de render contato não encontrado")
    js = js.replace(old, new, 1)

if 'col.key === "obs"' not in js:
    old = '''        if (col.isColorTag) {
          td.appendChild(createColorTag(row[col.key], col.isColorTag));
        } else if (col.isMoney) {
          td.textContent = safeText(row[col.key]) ? formatMoneyBR(row[col.key]) : "";
        } else {
          td.textContent = safeText(row[col.key]);
        }'''
    new = '''        if (col.isColorTag) {
          td.appendChild(createColorTag(row[col.key], col.isColorTag));
        } else if (col.isMoney) {
          td.textContent = safeText(row[col.key]) ? formatMoneyBR(row[col.key]) : "";
        } else if (col.key === "obs") {
          td.textContent = cleanObsText(row[col.key]);
        } else {
          td.textContent = safeText(row[col.key]);
        }'''
    if old not in js:
        raise SystemExit("Bloco de render genérico não encontrado")
    js = js.replace(old, new, 1)

js = js.replace('    obs: upper(row.obs || ""),', '    obs: upper(cleanObsText(row.obs || "")),', 1)

if 'const localizacao = getRowLocation(row);' not in js:
    pattern = re.compile(r'  function buildFreteBloco\(row\) \{.*?\n\}\n\nfunction buildMessage\(row\)', re.S)
    replacement = '''  function buildFreteBloco(row) {
  const origem = upper(row.origem || "");
  const coleta = upper(row.coleta || "");
  const localizacao = getRowLocation(row);
  const destino = cityUf(row, "destino", "uf");
  const descarga = upper(row.descarga || "");
  const produto = upper(row.produto || "");

  const valor = safeText(row.valorMotorista)
    ? formatMoneyBR(row.valorMotorista)
    : "A COMBINAR";

  const linhas = [
    `🏷️ ${origem}${coleta ? ` (${coleta})` : ""}`
  ];

  if (localizacao) linhas.push(`🗺️  ${localizacao}`);

  linhas.push(
    `🏁 ${destino}${descarga ? ` (${descarga})` : ""}`,
    `💢 ${produto}`,
    `💰${valor}`
  );

  return linhas.join("\\n");
}

function buildMessage(row)'''
    js, count = pattern.subn(replacement, js, count=1)
    if count != 1:
        raise SystemExit("buildFreteBloco não encontrado")

if 'MODAL.localizacao(), MODAL.destino()' not in js:
    old = '''      MODAL.origem(), MODAL.coleta(), MODAL.destino(), MODAL.uf(), MODAL.descarga(),
      MODAL.produto(), MODAL.km(), MODAL.ped(), MODAL.volume(), MODAL.icms(),'''
    new = '''      MODAL.origem(), MODAL.coleta(), MODAL.localizacao(), MODAL.destino(), MODAL.uf(), MODAL.descarga(),
      MODAL.produto(), MODAL.km(), MODAL.ped(), MODAL.volume(), MODAL.icms(),'''
    if old not in js:
        raise SystemExit("clearModalFields não encontrado")
    js = js.replace(old, new, 1)

if 'MODAL.localizacao().value = getRowLocation(row)' not in js:
    old = '''    if (MODAL.origem()) MODAL.origem().value = safeText(row.origem);
    if (MODAL.coleta()) MODAL.coleta().value = safeText(row.coleta);
    if (MODAL.destino()) MODAL.destino().value = safeText(row.destino);'''
    new = '''    if (MODAL.origem()) MODAL.origem().value = safeText(row.origem);
    if (MODAL.coleta()) MODAL.coleta().value = safeText(row.coleta);
    if (MODAL.localizacao()) MODAL.localizacao().value = getRowLocation(row);
    if (MODAL.destino()) MODAL.destino().value = safeText(row.destino);'''
    if old not in js:
        raise SystemExit("fillModalFromRow localização não encontrado")
    js = js.replace(old, new, 1)

js = js.replace('    if (MODAL.obs()) MODAL.obs().value = safeText(row.obs);', '    if (MODAL.obs()) MODAL.obs().value = cleanObsText(row.obs);', 1)

if 'localizacao: safeText(MODAL.localizacao()?.value)' not in js:
    old = '''      transito: safeText(MODAL.transito()?.value),
      status: normalizeFreteStatus(MODAL.status()?.value),
      obs: upperKeepSpaces(MODAL.obs()?.value).trim(),'''
    new = '''      transito: safeText(MODAL.transito()?.value),
      status: normalizeFreteStatus(MODAL.status()?.value),
      localizacao: safeText(MODAL.localizacao()?.value),
      obs: encodeObsLocation(
        upperKeepSpaces(MODAL.obs()?.value).trim(),
        safeText(MODAL.localizacao()?.value)
      ),'''
    if old not in js:
        raise SystemExit("collectModalPayload final não encontrado")
    js = js.replace(old, new, 1)

assert 'id="mLocalizacao"' in html
assert 'fretes.js?v=16' in html
assert 'function buildColetaCell(row)' in js
assert '🗺️  ${localizacao}' in js
assert 'obs: upper(cleanObsText(row.obs || ""))' in js
assert 'localizacao: safeText(MODAL.localizacao()?.value)' in js

html_path.write_text(html, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")
print("Patch de localização aplicado ao Fretes GO")
