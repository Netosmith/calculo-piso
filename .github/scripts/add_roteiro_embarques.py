from pathlib import Path

html_path = Path('pages/embarques.html')
js_path = Path('assets/js/embarques.js')

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

# ==========================================================
# EMBARQUES: PENDENTE + CAMPOS OPCIONAIS
# ==========================================================

# 1) Remove os asteriscos visuais dos campos que antes eram obrigatórios.
html = html.replace('<label>Número da carga *</label>', '<label>Número da carga</label>')
html = html.replace('<label>Cliente *</label>', '<label>Cliente</label>')
html = html.replace('<label>Placa *</label>', '<label>Placa</label>')

# 2) Garante PENDENTE nos selects estáticos do HTML.
html = html.replace(
    '<select class="select" id="fSituacao"><option value="">Todas</option>',
    '<select class="select" id="fSituacao"><option value="">Todas</option><option>PENDENTE</option>',
    1
)

html = html.replace(
    '<select class="select" id="mSituacao"><option>PORTA</option>',
    '<select class="select" id="mSituacao"><option>PENDENTE</option><option>PORTA</option>',
    1
)

# 3) Cache bust do JS.
html = html.replace('../assets/js/embarques.js?v=6', '../assets/js/embarques.js?v=7')

# 4) Adiciona PENDENTE à fonte real de status usada pelo JavaScript.
js = js.replace(
    'const STATUS_OPTIONS=["PORTA","TRANSITO/COLETA","TRANSITO/DESCARGA","NA DESCARGA","CONCLUIDA","ATRASADA"];',
    'const STATUS_OPTIONS=["PENDENTE","PORTA","TRANSITO/COLETA","TRANSITO/DESCARGA","NA DESCARGA","CONCLUIDA","ATRASADA"];',
    1
)

# 5) Novos registros sem situação começam como PENDENTE.
js = js.replace(
    'const situacao=up(r.situacao||"PORTA")',
    'const situacao=up(r.situacao||"PENDENTE")',
    1
)

# 6) Modal novo inicia como PENDENTE.
js = js.replace(
    'modal.value=STATUS_OPTIONS.includes(old)?old:"PORTA"',
    'modal.value=STATUS_OPTIONS.includes(old)?old:"PENDENTE"',
    1
)

# Existem versões do openNew/reset que definem PORTA explicitamente.
js = js.replace('$("mSituacao").value="PORTA"', '$("mSituacao").value="PENDENTE"')

# 7) Remove a validação obrigatória de Número da carga, Cliente e Placa.
js = js.replace(
    'if(!p.numeroCarga||!p.cliente||!p.placa){alert("Número da carga, Cliente e Placa são obrigatórios.");return}\n',
    '',
    1
)

# 8) Fallback do status inline para PENDENTE em registros incompletos.
js = js.replace(
    'const old=select.dataset.old||"PORTA",next=up(select.value)',
    'const old=select.dataset.old||"PENDENTE",next=up(select.value)'
)

# 9) Estilo visual próprio do PENDENTE.
needle = '.st-porta{color:#a96600;background:#fff7e3;border-color:#f7d68a}'
if needle in html and '.st-pendente{' not in html:
    html = html.replace(
        needle,
        '.st-pendente{color:#64748b;background:#f1f5f9;border-color:#cbd5e1}.inlineStatus.st-pendente{color:#64748b!important;background:#f1f5f9!important;border-color:#cbd5e1!important}' + needle,
        1
    )

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
print('Embarques ajustado: PENDENTE incluído e campos obrigatórios removidos no front-end.')
