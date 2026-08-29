from pathlib import Path

html_path = Path('pages/embarques.html')
js_path = Path('assets/js/embarques.js')

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

# CSS do botão compacto de roteiro
needle = '.annexes{display:flex;align-items:center;gap:5px}'
if needle in html and '.route-link{' not in html:
    html = html.replace(
        needle,
        needle + '\n.route-link{display:inline-flex;width:29px;height:29px;align-items:center;justify-content:center;border:1px solid #a9c9f7;border-radius:7px;background:#eaf3ff;color:#1d4ed8;text-decoration:none;font-size:15px;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}.route-link:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(15,35,63,.10)}',
        1
    )

# Coluna Roteiro imediatamente depois de Local destino
html = html.replace(
    '<th>Destino</th><th>Local destino</th><th>Placa</th>',
    '<th>Destino</th><th>Local destino</th><th>Roteiro</th><th>Placa</th>',
    1
)

# Campo no modal, após Local destino
html = html.replace(
    '<div class="form-field two"><label>Local destino</label><input class="input" id="mLocalDestino"></div><div class="form-field"><label>Placa *</label>',
    '<div class="form-field two"><label>Local destino</label><input class="input" id="mLocalDestino"></div><div class="form-field full"><label>Roteiro / Google Maps</label><input class="input" id="mRoteiro" type="url" placeholder="https://maps.app.goo.gl/..." autocomplete="off"></div><div class="form-field"><label>Placa *</label>',
    1
)

# Bump de versão do JS
html = html.replace('../assets/js/embarques.js?v=5', '../assets/js/embarques.js?v=6', 1)

# JS: sanitizador de URL
needle = 'const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll(\'"\',"&quot;");'
if needle in js and 'const safeUrl=' not in js:
    js = js.replace(
        needle,
        needle + '\nconst safeUrl=v=>{const s=String(v??"").trim();return /^https?:\\/\\//i.test(s)?s:""};',
        1
    )

# Normalização do campo
js = js.replace(
    'localDestino:String(r.localDestino||""),placa:String(r.placa||"")',
    'localDestino:String(r.localDestino||""),roteiro:String(r.roteiro||""),placa:String(r.placa||"")',
    1
)

# Busca também encontra roteiro
js = js.replace(
    'r.destino,r.localDestino,r.placa',
    'r.destino,r.localDestino,r.roteiro,r.placa',
    1
)

# Colspan vazio
js = js.replace('colspan="18"', 'colspan="19"', 1)

# Render: coluna compacta após local destino
old = '<td>${esc(r.destino||"-")}</td><td>${esc(r.localDestino||"-")}</td><td class="strong">${esc(r.placa||"-")}</td>'
new = '<td>${esc(r.destino||"-")}</td><td>${esc(r.localDestino||"-")}</td><td>${safeUrl(r.roteiro)?`<a class="route-link" href="${esc(safeUrl(r.roteiro))}" target="_blank" rel="noopener noreferrer" title="Abrir roteiro no Google Maps">🗺️</a>`:"-"}</td><td class="strong">${esc(r.placa||"-")}</td>'
if old in js:
    js = js.replace(old, new, 1)

# Reset modal
js = js.replace(
    '"mDestino","mLocalDestino","mPlaca"',
    '"mDestino","mLocalDestino","mRoteiro","mPlaca"',
    1
)

# Edição modal
js = js.replace(
    '$("mLocalDestino").value=item.localDestino;$("mPlaca").value=item.placa;',
    '$("mLocalDestino").value=item.localDestino;$("mRoteiro").value=item.roteiro||"";$("mPlaca").value=item.placa;',
    1
)

# Payload
js = js.replace(
    'localDestino:up($("mLocalDestino").value),placa:up($("mPlaca").value)',
    'localDestino:up($("mLocalDestino").value),roteiro:$("mRoteiro").value.trim(),placa:up($("mPlaca").value)',
    1
)

# Exportação Excel
js = js.replace(
    '"LOCAL DESTINO":r.localDestino,"PLACA":r.placa',
    '"LOCAL DESTINO":r.localDestino,"ROTEIRO":r.roteiro,"PLACA":r.placa',
    1
)

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
print('Roteiro Google Maps adicionado ao módulo Embarques.')
