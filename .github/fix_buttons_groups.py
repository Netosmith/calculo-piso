from pathlib import Path

p = Path('pages/relatorio.html')
s = p.read_text(encoding='utf-8')

replacements = {
    'id="btnFecharGrupoUnidades" type="button"': 'id="btnFecharGrupoUnidades" type="button" onclick="window.NF_closeOrdensGroups && window.NF_closeOrdensGroups()"',
    'id="btnImportGrupoUnidades" type="button"': 'id="btnImportGrupoUnidades" type="button" onclick="document.getElementById(\'importGrupoUnidadesInput\')?.click()"',
    'id="btnAdicionarUnidadesGrupo" type="button"': 'id="btnAdicionarUnidadesGrupo" type="button" onclick="window.NF_addOrdensGroupUnits && window.NF_addOrdensGroupUnits()"',
    'id="btnRemoverUnidadesGrupo" type="button"': 'id="btnRemoverUnidadesGrupo" type="button" onclick="window.NF_removeOrdensGroupUnits && window.NF_removeOrdensGroupUnits()"',
    'id="btnLimparGrupoAtual" type="button"': 'id="btnLimparGrupoAtual" type="button" onclick="window.NF_clearOrdensGroup && window.NF_clearOrdensGroup()"',
    'id="btnSalvarGrupoUnidades" type="button"': 'id="btnSalvarGrupoUnidades" type="button" onclick="window.NF_saveOrdensGroup && window.NF_saveOrdensGroup()"',
}

for old, new in replacements.items():
    if old in s and new not in s:
        s = s.replace(old, new, 1)

marker = '  window.NF_openOrdensGroups = abrirConfigGrupoUnidades;'
expose = '''  window.NF_openOrdensGroups = abrirConfigGrupoUnidades;
  window.NF_closeOrdensGroups = function(){
    const modal = document.getElementById("modalGrupoUnidades");
    if(modal) modal.classList.remove("show");
  };
  window.NF_addOrdensGroupUnits = adicionarUnidadesAoGrupo;
  window.NF_removeOrdensGroupUnits = removerUnidadesDoGrupo;
  window.NF_saveOrdensGroup = salvarConfigGrupoUnidades;
  window.NF_clearOrdensGroup = limparGrupoAtualUnidades;
  window.NF_changeOrdensGroup = trocarGrupoConfiguracao;
  window.NF_renderOrdensGroups = renderConfigGrupoUnidades;'''

if marker in s and 'window.NF_addOrdensGroupUnits = adicionarUnidadesAoGrupo;' not in s:
    s = s.replace(marker, expose, 1)

# Reforço do select e buscas, sem depender do bind principal
s = s.replace(
    'id="cfgGrupoUnidades" style=',
    'id="cfgGrupoUnidades" onchange="window.NF_changeOrdensGroup && window.NF_changeOrdensGroup()" style=',
    1
)
s = s.replace(
    'id="buscaUnidadesDisponiveis" placeholder=',
    'id="buscaUnidadesDisponiveis" oninput="window.NF_renderOrdensGroups && window.NF_renderOrdensGroups()" placeholder=',
    1
)
s = s.replace(
    'id="buscaUnidadesGrupo" placeholder=',
    'id="buscaUnidadesGrupo" oninput="window.NF_renderOrdensGroups && window.NF_renderOrdensGroups()" placeholder=',
    1
)

p.write_text(s, encoding='utf-8')
