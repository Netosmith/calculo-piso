from pathlib import Path

p = Path('pages/relatorio.html')
s = p.read_text(encoding='utf-8')

# Amplia aliases aceitos para o campo Tipo CTE.
s = s.replace(
'''      "Tipo Ct-e"\n    ];''',
'''      "Tipo Ct-e",\n      "Tp.Cte",\n      "Tp. Cte",\n      "Tp.Ct-e",\n      "Tp CT E",\n      "Tipo do CTE",\n      "Tipo do CT-e"\n    ];''',
1)

s = s.replace(
'''    const chave = Object.keys(r).find(k => {\n      const n = upper(k).replace(/[^A-Z0-9]/g,"");\n      return n.includes("TIPO") && n.includes("CTE");\n    });''',
'''    const chave = Object.keys(r).find(k => {\n      const n = upper(k).replace(/[^A-Z0-9]/g,"");\n      return (n.includes("TIPO") && n.includes("CTE")) ||\n             n === "TPCTE" || n === "TIPODOCTE";\n    });''',
1)

# Cria o menu do Tipo CTE dinamicamente com os tipos que realmente existem no CSV.
if 'function popularTiposCte(){' not in s:
    marker = '  function tiposCteSelecionados(){'
    bloco = r'''  function popularTiposCte(){
    const menu = $("menuTipoCte");
    if(!menu) return;

    const mapa = new Map();
    dados.forEach(r => {
      const chave = chaveTipoCte(r.tipoCte);
      const label = normalizarTipoCte(r.tipoCte);
      if(chave && !mapa.has(chave)) mapa.set(chave,label || chave);
    });

    const ordem = [...mapa.entries()].sort((a,b) => {
      const na = Number(a[0]);
      const nb = Number(b[0]);
      if(Number.isFinite(na) && Number.isFinite(nb)) return na-nb;
      return String(a[1]).localeCompare(String(b[1]),"pt-BR");
    });

    menu.innerHTML = `
      <div class="multiSelectActions">
        <button class="multiMiniBtn" id="btnTipoCteTodos" type="button">Selecionar todos</button>
        <button class="multiMiniBtn" id="btnTipoCteLimpar" type="button">Limpar</button>
      </div>
      ${ordem.length ? ordem.map(([chave,label]) => `
        <label class="multiOption">
          <input type="checkbox" name="tipoCteOption" value="${escapar(chave)}">
          <span>${escapar(label)}</span>
        </label>
      `).join("") : `<div style="padding:14px;color:#9fb3ca;font-size:10px">Nenhum Tipo CTE foi identificado no CSV importado.</div>`}
    `;

    menu.querySelectorAll('input[name="tipoCteOption"]').forEach(input => {
      input.addEventListener("change",() => {
        atualizarResumoTipoCte();
        aplicarFiltros();
      });
    });

    $("btnTipoCteTodos")?.addEventListener("click",e => {
      e.stopPropagation();
      menu.querySelectorAll('input[name="tipoCteOption"]').forEach(input => input.checked = true);
      atualizarResumoTipoCte();
      aplicarFiltros();
    });

    $("btnTipoCteLimpar")?.addEventListener("click",e => {
      e.stopPropagation();
      menu.querySelectorAll('input[name="tipoCteOption"]').forEach(input => input.checked = false);
      atualizarResumoTipoCte();
      aplicarFiltros();
    });

    atualizarResumoTipoCte();
  }

'''
    s = s.replace(marker, bloco + marker, 1)

# Selecionados sempre comparados pela chave canônica.
s = s.replace(
'''  function tiposCteSelecionados(){\n    return [...document.querySelectorAll('input[name="tipoCteOption"]:checked')]\n      .map(input => input.value);\n  }''',
'''  function tiposCteSelecionados(){\n    return [...document.querySelectorAll('input[name="tipoCteOption"]:checked')]\n      .map(input => chaveTipoCte(input.value))\n      .filter(Boolean);\n  }''',
1)

s = s.replace(
'''        (!filial || r.filial === filial) &&\n        (!filtrarTipoCte || tiposCte.includes(r.tipoCte))''',
'''        (!filial || r.filial === filial) &&\n        (!filtrarTipoCte || tiposCte.includes(chaveTipoCte(r.tipoCte)))''',
1)

# Recria as opções após cada importação do CSV.
s = s.replace(
'''      popularFiltros();\n      configurarLimitesDatas();''',
'''      popularFiltros();\n      popularTiposCte();\n      configurarLimitesDatas();''',
1)

p.write_text(s, encoding='utf-8')
print('Filtro Tipo CTE v2 aplicado.')
