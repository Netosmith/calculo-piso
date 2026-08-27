from pathlib import Path
import re

p = Path('pages/relatorio.html')
s = p.read_text(encoding='utf-8')

old_button = '<button class="btn green" id="btnAbrirGruposUnidades" type="button">🗂️ Grupos Unid. Emb.</button>'
new_button = '<button class="btn green" id="btnAbrirGruposUnidades" type="button" onclick="window.NF_openOrdensGroups && window.NF_openOrdensGroups()">🗂️ Grupos Unid. Emb.</button>'
if old_button in s:
    s = s.replace(old_button, new_button, 1)

pattern = re.compile(r'  function abrirConfigGrupoUnidades\(\)\{.*?\n  \}\n\n  function todasUnidadesOrdens\(\)', re.S)
replacement = '''  function abrirConfigGrupoUnidades(){
    const modal = $("modalGrupoUnidades");
    const seletor = $("cfgGrupoUnidades");

    if(!modal || !seletor){
      alert("Janela de grupos de Unid. Emb. não encontrada.");
      return;
    }

    if(!ordensDados.length){
      alert("Primeiro importe o CSV de Ordens. As Unid. Emb. serão carregadas automaticamente dele.");
      return;
    }

    const grupo = $("ordGrupoUnidade")?.value || "GRUPO SP";
    seletor.value = grupo || "GRUPO SP";
    grupoUnidadesEdicao = [...unidadesDoGrupoOrdens(seletor.value)];

    if($("buscaUnidadesDisponiveis")) $("buscaUnidadesDisponiveis").value = "";
    if($("buscaUnidadesGrupo")) $("buscaUnidadesGrupo").value = "";

    modal.classList.add("show");

    try{
      renderConfigGrupoUnidades();
    }catch(error){
      console.error("Falha ao montar unidades dos grupos:", error);
      const lista = $("listaUnidadesDisponiveis");
      if(lista){
        const unidades = [...new Set(ordensDados.map(r => upper(r.unidade)).filter(Boolean))]
          .sort((a,b) => a.localeCompare(b,"pt-BR"));
        lista.innerHTML = unidades.map(unidade => `
          <label class="unitGroupItem">
            <input type="checkbox" value="${escapar(unidade)}">
            <span>${escapar(unidade)}</span>
          </label>
        `).join("");
      }
    }
  }

  function todasUnidadesOrdens()'''

s, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit('Função abrirConfigGrupoUnidades não encontrada')

anchor = '  function iniciarDashboard(){'
expose = '  window.NF_openOrdensGroups = abrirConfigGrupoUnidades;\n\n'
if 'window.NF_openOrdensGroups = abrirConfigGrupoUnidades;' not in s:
    if anchor not in s:
        raise SystemExit('Ponto de inicialização não encontrado')
    s = s.replace(anchor, expose + anchor, 1)

p.write_text(s, encoding='utf-8')
print('relatorio.html corrigido')
