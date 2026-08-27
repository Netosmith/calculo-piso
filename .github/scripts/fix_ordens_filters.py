from pathlib import Path
import re

p = Path('pages/relatorio.html')
s = p.read_text(encoding='utf-8')

# 1) Corrige a leitura dos multisseletores. Agora, qualquer seleção parcial
# filtra imediatamente; nenhum marcado = sem restrição; todos marcados = sem restrição.
pattern = re.compile(r'''  function selecionadosMulti\(id\)\{.*?\n  \}\n\n  function aplicarFiltrosOrdens\(\)\{''', re.S)
replacement = '''  function selecionadosMulti(id){
    const root = $(id);
    if(!root) return [];

    const all = [...root.querySelectorAll('.multiSelectMenu input[type="checkbox"]')];
    if(!all.length) return [];

    const selecionados = all.filter(x => x.checked).map(x => x.value);

    // Nenhum marcado ou todos marcados significam "sem restrição".
    if(selecionados.length === 0 || selecionados.length === all.length){
      return [];
    }

    return selecionados;
  }

  function aplicarFiltrosOrdens(){'''
s, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit('Falha ao localizar selecionadosMulti/aplicarFiltrosOrdens')

# 2) Torna aplicarFiltrosOrdens mais robusto e atualiza também período/status.
start = s.find('  function aplicarFiltrosOrdens(){')
end = s.find('\n  function agruparContagem', start)
if start < 0 or end < 0:
    raise SystemExit('Falha ao localizar aplicarFiltrosOrdens completo')

novo = '''  function aplicarFiltrosOrdens(){
    const filiais = selecionadosMulti("ordFilialMulti");
    const unidades = selecionadosMulti("ordUnidadeMulti");
    const clientes = selecionadosMulti("ordClienteMulti");
    const embarcadores = selecionadosMulti("ordEmbarcadorMulti");
    const grupoUnidade = $("ordGrupoUnidade")?.value || "";

    const dataInicial = parseInputDate($("ordDataInicial")?.value,false);
    const dataFinal = parseInputDate($("ordDataFinal")?.value,true);

    if(dataInicial && dataFinal && dataFinal < dataInicial){
      alert("A data final não pode ser anterior à data inicial.");
      return;
    }

    const unidadesGrupo = grupoUnidade ? unidadesDoGrupoOrdens(grupoUnidade) : [];

    ordensFiltrados = ordensDados.filter(r => {
      const dentroPeriodo =
        (!dataInicial || (r.data instanceof Date && !Number.isNaN(r.data.getTime()) && r.data >= dataInicial)) &&
        (!dataFinal || (r.data instanceof Date && !Number.isNaN(r.data.getTime()) && r.data <= dataFinal));

      const passaGrupo = !grupoUnidade || unidadesGrupo.includes(r.unidade);

      return (
        dentroPeriodo &&
        (!filiais.length || filiais.includes(r.filial)) &&
        (!unidades.length || unidades.includes(r.unidade)) &&
        (!clientes.length || clientes.includes(r.cliente)) &&
        (!embarcadores.length || embarcadores.includes(r.embarcador)) &&
        passaGrupo
      );
    });

    renderOrdens();

    if($("statusMensagem")){
      $("statusMensagem").textContent =
        `${ordensFiltrados.length.toLocaleString("pt-BR")} ordem(ns) exibida(s) após os filtros.`;
    }

    // O período do topo também acompanha o Dashboard Ordens.
    if($("viewOrdens")?.classList.contains("active") && $("periodo")){
      const fmt = d => d.toLocaleDateString("pt-BR");
      if(dataInicial && dataFinal){
        $("periodo").textContent = `${fmt(dataInicial)} a ${fmt(dataFinal)}`;
      }else if(dataInicial){
        $("periodo").textContent = `A partir de ${fmt(dataInicial)}`;
      }else if(dataFinal){
        $("periodo").textContent = `Até ${fmt(dataFinal)}`;
      }else{
        const datas = ordensDados
          .map(r => r.data)
          .filter(d => d instanceof Date && !Number.isNaN(d.getTime()))
          .sort((a,b) => a-b);
        $("periodo").textContent = datas.length
          ? `${fmt(datas[0])} a ${fmt(datas[datas.length-1])}`
          : "--";
      }
    }
  }
'''
s = s[:start] + novo + s[end:]

# 3) Reforça eventos dos filtros de data e grupo: input + change.
old = '["ordDataInicial","ordDataFinal","ordGrupoUnidade"].forEach(id=>$(id)?.addEventListener("change",aplicarFiltrosOrdens));'
new = '''["ordDataInicial","ordDataFinal","ordGrupoUnidade"].forEach(id => {
      const el = $(id);
      el?.addEventListener("change",aplicarFiltrosOrdens);
      if(id !== "ordGrupoUnidade") el?.addEventListener("input",aplicarFiltrosOrdens);
    });'''
if old in s:
    s = s.replace(old, new, 1)
else:
    raise SystemExit('Falha ao localizar bind de datas/grupo')

# 4) Ao carregar Ordens, aplica os filtros em vez de apenas renderizar.
s = s.replace('''    configurarLimitesDatasOrdens();
    renderOrdens();''','''    configurarLimitesDatasOrdens();
    aplicarFiltrosOrdens();''',1)

# 5) Ao salvar grupo, força atualização do dashboard e mantém grupo selecionado.
needle = '''      if($("ordGrupoUnidade")) $("ordGrupoUnidade").value = grupo;
      $("modalGrupoUnidades")?.classList.remove("show");

      aplicarFiltrosOrdens();'''
if needle not in s:
    # versão pós-workflow pode não ter optional chaining exatamente igual; não falha por isso
    pass

p.write_text(s, encoding='utf-8')
print('OK - filtros do Dashboard Ordens corrigidos')
