from pathlib import Path
import re

p = Path('pages/relatorio.html')
s = p.read_text(encoding='utf-8')

# 1) Substitui a leitura de grupos por uma versão que sempre lê o localStorage,
# normaliza chaves/valores e NUNCA usa Grupo Regional como fallback.
pattern = re.compile(r"\n\s*function unidadesDoGrupoOrdens\(grupo\)\{.*?\n\s*\}", re.S)
replacement = r'''
  function lerMapaGruposOrdens(){
    const saida = {};

    try{
      const raw = JSON.parse(localStorage.getItem(STORAGE_ORDENS_GRUPOS_UNIDADE) || "{}");

      Object.entries(raw || {}).forEach(([chave,lista]) => {
        const grupo = upper(chave);
        if(!grupo || !Array.isArray(lista)) return;

        saida[grupo] = [...new Set(
          lista.map(item => upper(item)).filter(Boolean)
        )];
      });
    }catch(error){
      console.warn("Falha ao ler grupos de Unid. Emb.:", error);
    }

    return saida;
  }

  function unidadesDoGrupoOrdens(grupo){
    const chave = upper(grupo);
    if(!chave) return [];

    const mapa = lerMapaGruposOrdens();
    return Array.isArray(mapa[chave]) ? mapa[chave] : [];
  }'''
s2, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit('Nao localizei function unidadesDoGrupoOrdens(grupo)')
s = s2

# 2) Substitui o filtro do Dashboard Ordens por uma versão determinística.
pattern = re.compile(r"\n\s*function aplicarFiltrosOrdens\(\)\{.*?\n\s*\}\n\n\s*function agruparContagem", re.S)
replacement = r'''
  function aplicarFiltrosOrdens(){
    const filiais = selecionadosMulti("ordFilialMulti").map(upper);
    const unidades = selecionadosMulti("ordUnidadeMulti").map(upper);
    const clientes = selecionadosMulti("ordClienteMulti").map(upper);
    const embarcadores = selecionadosMulti("ordEmbarcadorMulti").map(upper);
    const grupoUnidade = upper($("ordGrupoUnidade")?.value || "");

    const dataInicial = parseInputDate($("ordDataInicial")?.value,false);
    const dataFinal = parseInputDate($("ordDataFinal")?.value,true);

    if(dataInicial && dataFinal && dataFinal < dataInicial){
      alert("A data final não pode ser anterior à data inicial.");
      return;
    }

    const unidadesGrupo = grupoUnidade
      ? unidadesDoGrupoOrdens(grupoUnidade).map(upper)
      : [];

    const conjuntoGrupo = new Set(unidadesGrupo);

    ordensFiltrados = ordensDados.filter(r => {
      const filial = upper(r.filial);
      const unidade = upper(r.unidade);
      const cliente = upper(r.cliente);
      const embarcador = upper(r.embarcador);

      const dentroPeriodo =
        (!dataInicial || (r.data instanceof Date && !Number.isNaN(r.data.getTime()) && r.data >= dataInicial)) &&
        (!dataFinal || (r.data instanceof Date && !Number.isNaN(r.data.getTime()) && r.data <= dataFinal));

      // Se um grupo foi escolhido, a unidade PRECISA pertencer exatamente a ele.
      // Grupo vazio gera zero registros em vez de cair no Grupo Regional/todos.
      const passaGrupo = !grupoUnidade || conjuntoGrupo.has(unidade);

      return (
        dentroPeriodo &&
        (!filiais.length || filiais.includes(filial)) &&
        (!unidades.length || unidades.includes(unidade)) &&
        (!clientes.length || clientes.includes(cliente)) &&
        (!embarcadores.length || embarcadores.includes(embarcador)) &&
        passaGrupo
      );
    });

    renderOrdens();

    if($("statusMensagem")){
      const grupoInfo = grupoUnidade
        ? ` • ${grupoUnidade}: ${unidadesGrupo.length} unidade(s)`
        : "";

      $("statusMensagem").textContent =
        `${ordensFiltrados.length.toLocaleString("pt-BR")} ordem(ns) exibida(s) após os filtros${grupoInfo}.`;
    }

    // Atualiza o período do topo quando o Dashboard Ordens estiver ativo.
    const viewOrdens = $("viewOrdens");
    if(viewOrdens?.classList.contains("active") && $("periodo")){
      const fmt = d => d.toLocaleDateString("pt-BR");
      if(dataInicial && dataFinal) $("periodo").textContent = `${fmt(dataInicial)} a ${fmt(dataFinal)}`;
      else if(dataInicial) $("periodo").textContent = `A partir de ${fmt(dataInicial)}`;
      else if(dataFinal) $("periodo").textContent = `Até ${fmt(dataFinal)}`;
      else $("periodo").textContent = "--";
    }
  }

  function agruparContagem'''
s2, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit('Nao localizei aplicarFiltrosOrdens')
s = s2

# 3) Salvar grupo: parte sempre de uma cópia fresca do localStorage e grava somente o grupo atual.
pattern = re.compile(r"\n\s*function salvarConfigGrupoUnidades\(\)\{.*?\n\s*\}", re.S)
replacement = r'''
  function salvarConfigGrupoUnidades(){
    try{
      const grupo = upper($("cfgGrupoUnidades")?.value || "");

      if(!grupo){
        alert("Selecione um grupo.");
        return;
      }

      const mapaAtual = lerMapaGruposOrdens();
      mapaAtual[grupo] = [...new Set(
        grupoUnidadesEdicao.map(item => upper(item)).filter(Boolean)
      )];

      ordensGruposUnidade = mapaAtual;

      localStorage.setItem(
        STORAGE_ORDENS_GRUPOS_UNIDADE,
        JSON.stringify(mapaAtual)
      );

      if($("ordGrupoUnidade")) $("ordGrupoUnidade").value = grupo;
      $("modalGrupoUnidades")?.classList.remove("show");

      aplicarFiltrosOrdens();

      if($("statusMensagem")){
        $("statusMensagem").textContent =
          `${mapaAtual[grupo].length} unidade(s) vinculada(s) ao ${grupo}.`;
      }
    }catch(error){
      console.error(error);
      alert("Não foi possível salvar o grupo: " + (error?.message || error));
    }
  }'''
s2, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit('Nao localizei salvarConfigGrupoUnidades')
s = s2

# 4) Força atualização pelo seletor de grupo mesmo se algum bind falhar.
s = re.sub(
    r'<select id="ordGrupoUnidade"(?![^>]*onchange=)',
    '<select id="ordGrupoUnidade" onchange="window.NF_applyOrdensFilters && window.NF_applyOrdensFilters()"',
    s,
    count=1
)

# 5) Exporta função do filtro para o onchange inline.
marker = '  window.NF_renderOrdensGroups = renderConfigGrupoUnidades;'
if marker in s and 'window.NF_applyOrdensFilters' not in s:
    s = s.replace(marker, marker + '\n  window.NF_applyOrdensFilters = aplicarFiltrosOrdens;', 1)

# Se o atributo foi adicionado, ainda assim garante exportação.
if 'window.NF_applyOrdensFilters = aplicarFiltrosOrdens;' not in s:
    marker2 = '  window.NF_changeOrdensGroup = trocarGrupoConfiguracao;'
    if marker2 in s:
        s = s.replace(marker2, marker2 + '\n  window.NF_applyOrdensFilters = aplicarFiltrosOrdens;', 1)

# 6) Ao trocar grupo no gerenciador, lê somente o grupo escolhido.
pattern = re.compile(r"\n\s*function trocarGrupoConfiguracao\(\)\{.*?\n\s*\}", re.S)
replacement = r'''
  function trocarGrupoConfiguracao(){
    const grupo = upper($("cfgGrupoUnidades")?.value || "");
    grupoUnidadesEdicao = [...unidadesDoGrupoOrdens(grupo)];
    if($("buscaUnidadesDisponiveis")) $("buscaUnidadesDisponiveis").value = "";
    if($("buscaUnidadesGrupo")) $("buscaUnidadesGrupo").value = "";
    renderConfigGrupoUnidades();
  }'''
s2, n = pattern.subn(replacement, s, count=1)
if n == 1:
    s = s2

p.write_text(s, encoding='utf-8')
print('Filtro de grupos do Dashboard Ordens corrigido.')
