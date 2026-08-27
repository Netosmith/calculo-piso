from pathlib import Path
import re

p = Path('pages/relatorio.html')
s = p.read_text(encoding='utf-8')

# A correção anterior substituiu somente parte de salvarConfigGrupoUnidades()
# e deixou um bloco órfão logo depois da função. Esse bloco quebra a sintaxe
# de todo o JavaScript e faz o Dashboard parar completamente.
pattern = re.compile(
    r"\n\s*function salvarConfigGrupoUnidades\(\)\{.*?\n\s*function limparGrupoAtualUnidades\(\)\{",
    re.S,
)

replacement = r'''
  function salvarConfigGrupoUnidades(){
    try{
      const grupo = upper($("cfgGrupoUnidades")?.value || "");

      if(!grupo){
        alert("Selecione um grupo.");
        return;
      }

      // Parte sempre de uma leitura fresca para preservar os demais grupos.
      const mapaAtual = lerMapaGruposOrdens();
      mapaAtual[grupo] = [...new Set(
        grupoUnidadesEdicao.map(item => upper(item)).filter(Boolean)
      )];

      ordensGruposUnidade = mapaAtual;

      localStorage.setItem(
        STORAGE_ORDENS_GRUPOS_UNIDADE,
        JSON.stringify(mapaAtual)
      );

      if($("ordGrupoUnidade")){
        $("ordGrupoUnidade").value = grupo;
      }

      $("modalGrupoUnidades")?.classList.remove("show");

      // Recalcula o Dashboard usando exatamente o grupo que acabou de ser salvo.
      aplicarFiltrosOrdens();

      if($("statusMensagem")){
        $("statusMensagem").textContent =
          `${mapaAtual[grupo].length} unidade(s) vinculada(s) ao ${grupo}.`;
      }
    }catch(error){
      console.error("Erro ao salvar grupo de Unid. Emb.:", error);
      alert("Não foi possível salvar o grupo: " + (error?.message || error));
    }
  }

  function limparGrupoAtualUnidades(){'''

s2, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit('Nao localizei a regiao corrompida de salvarConfigGrupoUnidades')
s = s2

# Remove helper legado que não é mais usado e poderia confundir manutenção.
s = re.sub(
    r'\n\s*function grupoOrdensUnidade\(v\)\{return ordensGruposUnidade\[upper\(v\)\]\|\|"NÃO DEFINIDO"\}\s*',
    '\n',
    s,
    count=1,
)

# Garante que a troca do filtro de grupo chama a função real.
if 'id="ordGrupoUnidade"' in s and 'window.NF_applyOrdensFilters' not in s:
    s = s.replace(
        '<select id="ordGrupoUnidade"',
        '<select id="ordGrupoUnidade" onchange="window.NF_applyOrdensFilters && window.NF_applyOrdensFilters()"',
        1,
    )

# Garante a exportação do filtro para o onchange inline.
if 'window.NF_applyOrdensFilters = aplicarFiltrosOrdens;' not in s:
    marker = '  window.NF_renderOrdensGroups = renderConfigGrupoUnidades;'
    if marker in s:
        s = s.replace(marker, marker + '\n  window.NF_applyOrdensFilters = aplicarFiltrosOrdens;', 1)

p.write_text(s, encoding='utf-8')
print('Dashboard Ordens reparado: sintaxe e filtro de grupos preservados.')
