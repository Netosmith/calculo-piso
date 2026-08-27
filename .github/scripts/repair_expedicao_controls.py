from pathlib import Path
import re

p = Path('pages/relatorio.html')
s = p.read_text(encoding='utf-8')

# 1) Chart.js nunca pode impedir a inicialização dos controles.
s = s.replace(
'''  Chart.defaults.color = "#b8c9dc";
  Chart.defaults.borderColor = "rgba(160,190,225,.11)";
  Chart.defaults.font.family = "Inter, Arial, sans-serif";''',
'''  if(typeof Chart !== "undefined"){
    Chart.defaults.color = "#b8c9dc";
    Chart.defaults.borderColor = "rgba(160,190,225,.11)";
    Chart.defaults.font.family = "Inter, Arial, sans-serif";
  }''',
1)

# 2) Fallback direto nos controles principais da Expedição.
repls = {
'<input id="csvInput" type="file" accept=".csv,text/csv" />':
'<input id="csvInput" type="file" accept=".csv,text/csv" onchange="window.NF_importExpedicaoFile && window.NF_importExpedicaoFile(this)" />',
'<button class="btn primary" id="btnImportar" type="button">📂 Importar CSV</button>':
'<button class="btn primary" id="btnImportar" type="button" onclick="document.getElementById(\'csvInput\')?.click()">📂 Importar CSV</button>',
'<button class="btn green" id="btnGrupos" type="button">👥 Gerenciar grupos</button>':
'<button class="btn green" id="btnGrupos" type="button" onclick="window.NF_openExpedicaoGroups && window.NF_openExpedicaoGroups()">👥 Gerenciar grupos</button>',
'<button class="btn ghost" id="btnOcultarMargemRs" type="button">👁 Ocultar margem líquida R$</button>':
'<button class="btn ghost" id="btnOcultarMargemRs" type="button" onclick="window.NF_toggleExpedicaoMargin && window.NF_toggleExpedicaoMargin()">👁 Ocultar margem líquida R$</button>',
'<button class="btn ghost" id="btnLimpar" type="button">Limpar filtros</button>':
'<button class="btn ghost" id="btnLimpar" type="button" onclick="window.NF_clearExpedicaoFilters && window.NF_clearExpedicaoFilters()">Limpar filtros</button>'
}
for a,b in repls.items():
    if a in s:
        s=s.replace(a,b,1)

# 3) Fallback direto para os filtros simples da Expedição.
for fid in ["filtroDataInicial","filtroDataFinal","filtroUnidade","filtroCliente","filtroGrupo","filtroProduto","filtroUF","filtroFilial"]:
    pattern = rf'id="{fid}"(?![^>]*onchange=)'
    s = re.sub(pattern, f'id="{fid}" onchange="window.NF_applyExpedicaoFilters && window.NF_applyExpedicaoFilters()"', s, count=1)

# 4) Tabs também ganham fallback direto.
s = s.replace(
'<button class="dashboardTab active" id="tabExpedicao" type="button">📊 Dashboard Expedição</button>',
'<button class="dashboardTab active" id="tabExpedicao" type="button" onclick="window.NF_switchDashboard && window.NF_switchDashboard(\'expedicao\')">📊 Dashboard Expedição</button>',1)
s = s.replace(
'<button class="dashboardTab" id="tabOrdens" type="button">📋 Dashboard Ordens</button>',
'<button class="dashboardTab" id="tabOrdens" type="button" onclick="window.NF_switchDashboard && window.NF_switchDashboard(\'ordens\')">📋 Dashboard Ordens</button>',1)

# 5) Exporta funções da Expedição antes da inicialização.
marker = '  window.NF_renderOrdensGroups = renderConfigGrupoUnidades;'
exports = '''  window.NF_renderOrdensGroups = renderConfigGrupoUnidades;
  window.NF_applyExpedicaoFilters = aplicarFiltros;
  window.NF_openExpedicaoGroups = abrirGrupos;
  window.NF_toggleExpedicaoMargin = alternarMargemLiquidaRs;
  window.NF_clearExpedicaoFilters = limparFiltros;
  window.NF_switchDashboard = trocarDashboard;
  window.NF_importExpedicaoFile = function(input){
    try{
      const file = input && input.files ? input.files[0] : null;
      if(file) importarArquivo(file);
    }finally{
      if(input) input.value = "";
    }
  };'''
if marker in s:
    s = s.replace(marker, exports, 1)

# 6) Renderização da Expedição não derruba o importador se Chart.js falhar.
old = '''  function renderGraficos(){
    renderBar('''
if old in s:
    s = s.replace(old, '''  function renderGraficos(){
    if(typeof Chart === "undefined"){
      console.warn("Chart.js indisponível. Dados e filtros continuam funcionando.");
      return;
    }
    renderBar(''', 1)

# Evita duplicar importação do mesmo arquivo via onchange + addEventListener.
# Mantemos o listener, mas ele só executa se o evento não foi tratado pelo fallback inline.
old_listener = '''    $("csvInput")?.addEventListener("change",e => {
      importarArquivo(e.target.files?.[0]);
      e.target.value = "";
    });'''
new_listener = '''    $("csvInput")?.addEventListener("change",e => {
      if(e.target.dataset.nfHandled === "1"){
        e.target.dataset.nfHandled = "";
        return;
      }
      importarArquivo(e.target.files?.[0]);
      e.target.value = "";
    });'''
if old_listener in s:
    s=s.replace(old_listener,new_listener,1)

# Marca fallback inline como tratado antes de importar.
s=s.replace(
'''  window.NF_importExpedicaoFile = function(input){
    try{
      const file = input && input.files ? input.files[0] : null;
      if(file) importarArquivo(file);''',
'''  window.NF_importExpedicaoFile = function(input){
    try{
      if(input) input.dataset.nfHandled = "1";
      const file = input && input.files ? input.files[0] : null;
      if(file) importarArquivo(file);''',1)

p.write_text(s, encoding='utf-8')
print('Controles do Dashboard Expedição reparados.')
