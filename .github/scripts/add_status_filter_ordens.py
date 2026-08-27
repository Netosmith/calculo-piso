from pathlib import Path

path = Path('pages/relatorio.html')
text = path.read_text(encoding='utf-8')

# 1) Grade dos filtros: 7 -> 8 colunas
text = text.replace(
    '<section class="filters ordensFilters" style="grid-template-columns:repeat(7,minmax(0,1fr))">',
    '<section class="filters ordensFilters" style="grid-template-columns:repeat(8,minmax(0,1fr))">',
    1
)
text = text.replace(
    'grid-template-columns:180px 180px minmax(170px,1fr) minmax(190px,1fr) minmax(190px,1fr) minmax(190px,1fr) minmax(200px,1fr) !important;',
    'grid-template-columns:170px 170px minmax(160px,1fr) minmax(180px,1fr) minmax(180px,1fr) minmax(180px,1fr) minmax(190px,1fr) minmax(170px,1fr) !important;',
    1
)
text = text.replace(
    'grid-template-columns:repeat(7,minmax(165px,1fr)) !important;',
    'grid-template-columns:repeat(8,minmax(160px,1fr)) !important;',
    1
)

# 2) HTML do filtro multisseleção de status, após Nome Embarcador
anchor_html = '''        <div class="filterField">\n          <label>Nome embarcador</label>\n          <div class="multiSelect" id="ordEmbarcadorMulti">\n            <button class="multiSelectButton" type="button">\n              <span class="multiResumo">Todos os embarcadores</span><span class="arrow">▼</span>\n            </button>\n            <div class="multiSelectMenu"></div>\n          </div>\n        </div>'''

status_html = anchor_html + '''\n\n        <div class="filterField">\n          <label>Status da Ordem</label>\n          <div class="multiSelect" id="ordStatusMulti">\n            <button class="multiSelectButton" type="button">\n              <span class="multiResumo">Todos os status</span><span class="arrow">▼</span>\n            </button>\n            <div class="multiSelectMenu"></div>\n          </div>\n        </div>'''

if 'id="ordStatusMulti"' not in text:
    if anchor_html not in text:
        raise SystemExit('Bloco Nome embarcador não encontrado para inserir filtro de status.')
    text = text.replace(anchor_html, status_html, 1)

# 3) Normalização da ordem: acrescenta status com leitura flexível
old_norm = '''      cliente:upper(valorCampoFlex(r,["Cliente","CLIENTE","Cliente Principal"])),\n      embarcador:upper(valorCampoFlex(r,["Nome Embarcador","NOME EMBARCADOR","Embarcador","Nome do Embarcador"]))\n    };'''
new_norm = '''      cliente:upper(valorCampoFlex(r,["Cliente","CLIENTE","Cliente Principal"])),\n      embarcador:upper(valorCampoFlex(r,["Nome Embarcador","NOME EMBARCADOR","Embarcador","Nome do Embarcador"])),\n      status:normalizarStatusOrdem(valorCampoFlex(r,["Status","STATUS","Status Ordem","STATUS ORDEM","Status da Ordem","Situação","Situacao","Situação Ordem","Situacao Ordem"]))\n    };'''
if old_norm in text:
    text = text.replace(old_norm, new_norm, 1)
elif 'status:normalizarStatusOrdem' not in text:
    raise SystemExit('Bloco normalizarOrdem não encontrado.')

# 4) Função de normalização do status antes de normalizarOrdem
marker = '  function normalizarOrdem(r){'
func = '''  function normalizarStatusOrdem(valor){\n    const v = upper(valor)\n      .normalize("NFD")\n      .replace(/[\\u0300-\\u036f]/g,"")\n      .replace(/[_-]+/g," ")\n      .replace(/\\s+/g," ")\n      .trim();\n\n    if(!v) return "NÃO INFORMADO";\n\n    if(["CARREGADA","CARREGADO","CARREGADAS","CARREGADOS"].includes(v)) return "CARREGADA";\n    if(["CANCELADA","CANCELADO","CANCELADAS","CANCELADOS"].includes(v)) return "CANCELADA";\n    if(["A CARREGAR","À CARREGAR","AGUARDANDO CARREGAMENTO","PENDENTE","ABERTA","ABERTO"].includes(v)) return "A CARREGAR";\n\n    return v;\n  }\n\n'''
if 'function normalizarStatusOrdem' not in text:
    if marker not in text:
        raise SystemExit('Função normalizarOrdem não localizada.')
    text = text.replace(marker, func + marker, 1)

# 5) Aplicar filtro de status
old_filters = '''    const clientes = selecionadosMulti("ordClienteMulti").map(upper);\n    const embarcadores = selecionadosMulti("ordEmbarcadorMulti").map(upper);\n    const grupoUnidade = upper($("ordGrupoUnidade")?.value || "");'''
new_filters = '''    const clientes = selecionadosMulti("ordClienteMulti").map(upper);\n    const embarcadores = selecionadosMulti("ordEmbarcadorMulti").map(upper);\n    const statusOrdens = selecionadosMulti("ordStatusMulti").map(upper);\n    const grupoUnidade = upper($("ordGrupoUnidade")?.value || "");'''
if old_filters in text:
    text = text.replace(old_filters, new_filters, 1)
elif 'const statusOrdens = selecionadosMulti("ordStatusMulti")' not in text:
    raise SystemExit('Bloco de leitura dos filtros de Ordens não encontrado.')

old_row = '''      const cliente = upper(r.cliente);\n      const embarcador = upper(r.embarcador);'''
new_row = '''      const cliente = upper(r.cliente);\n      const embarcador = upper(r.embarcador);\n      const statusOrdem = upper(r.status);'''
if old_row in text:
    text = text.replace(old_row, new_row, 1)
elif 'const statusOrdem = upper(r.status);' not in text:
    raise SystemExit('Bloco de campos da linha filtrada não encontrado.')

old_return = '''        (!clientes.length || clientes.includes(cliente)) &&\n        (!embarcadores.length || embarcadores.includes(embarcador)) &&\n        passaGrupo'''
new_return = '''        (!clientes.length || clientes.includes(cliente)) &&\n        (!embarcadores.length || embarcadores.includes(embarcador)) &&\n        (!statusOrdens.length || statusOrdens.includes(statusOrdem)) &&\n        passaGrupo'''
if old_return in text:
    text = text.replace(old_return, new_return, 1)
elif '(!statusOrdens.length || statusOrdens.includes(statusOrdem))' not in text:
    raise SystemExit('Condição final dos filtros de Ordens não encontrada.')

# 6) Montar multiselect na importação do CSV
old_mount = '''    montarMultiOrdens("ordClienteMulti",unicos("cliente"),"Todos os clientes");\n    montarMultiOrdens("ordEmbarcadorMulti",unicos("embarcador"),"Todos os embarcadores");\n    configurarLimitesDatasOrdens();'''
new_mount = '''    montarMultiOrdens("ordClienteMulti",unicos("cliente"),"Todos os clientes");\n    montarMultiOrdens("ordEmbarcadorMulti",unicos("embarcador"),"Todos os embarcadores");\n\n    const statusPreferidos = ["CARREGADA","CANCELADA","A CARREGAR"];\n    const statusEncontrados = unicos("status");\n    const statusOrdenados = [\n      ...statusPreferidos.filter(s => statusEncontrados.includes(s)),\n      ...statusEncontrados.filter(s => !statusPreferidos.includes(s))\n    ];\n    montarMultiOrdens("ordStatusMulti",statusOrdenados,"Todos os status");\n\n    configurarLimitesDatasOrdens();'''
if old_mount in text:
    text = text.replace(old_mount, new_mount, 1)
elif 'montarMultiOrdens("ordStatusMulti"' not in text:
    raise SystemExit('Bloco de montagem dos multiselects não encontrado.')

# 7) Limpar filtro de status junto dos demais filtros de Ordens
# Insere uma limpeza genérica na função de limpar filtros das ordens, usando o botão já existente.
# O reset é feito desmarcando todos os checkboxes do novo multiselect quando limpar filtros for acionado.
needle = '''    ["ordFilialMulti","ordUnidadeMulti","ordClienteMulti","ordEmbarcadorMulti"].forEach(id => {'''
if needle in text:
    text = text.replace(needle, '''    ["ordFilialMulti","ordUnidadeMulti","ordClienteMulti","ordEmbarcadorMulti","ordStatusMulti"].forEach(id => {''', 1)
else:
    # Fallback para implementações onde o reset é feito diretamente no clique do botão.
    fallback = '$("btnLimparOrdens")?.addEventListener("click",'
    if fallback not in text and 'ordStatusMulti' not in text:
        raise SystemExit('Não foi possível localizar a rotina de limpeza dos filtros de Ordens.')

path.write_text(text, encoding='utf-8')
