const REGIOES = {
  "TIUB": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","BOM JESUS","MINEIROS","ANAPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "TIA": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","BOM JESUS","MINEIROS","ANAPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "SANTOS": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","BOM JESUS","MINEIROS","ANAPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "PARANAGUA": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","BOM JESUS","MINEIROS","ANAPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "CHAP SUL": ["RIO VERDE","JATAI","CHAP CEU","CAIAPONIA","MINEIROS"],
  "RIO VERDE": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","BOM JESUS","MINEIROS","ANAPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"],
  "SAO SIMAO": ["RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU","CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA","BOM JESUS","MINEIROS","ANAPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"]
};

const API = "https://script.google.com/macros/s/AKfycbwyvX-Yw6qvMKZmo0UPB54w13ULUQDo6DG4qMYLSjx3boiaQWTMcaExR0qMf_Y29qtI/exec";

async function load(){

  const res = await fetch(API + "?action=fretes_mercado_list");
  const json = await res.json();
  const dados = json.data || [];

  render(dados);
}

function render(dados){

  const container = document.getElementById("tabela");

  container.innerHTML = Object.keys(REGIOES).map(regiao => {

    return `
    <div class="regiao">
      <h3>${regiao}</h3>

      <div class="row">
        <b>Base</b>
        <b>Frete</b>
        <b>Oferta</b>
      </div>

      ${REGIOES[regiao].map(base => {

        const item = dados.find(d => d.regiao === regiao && d.base === base) || {};

        return `
        <div class="row">
          <input value="${base}" readonly>
          <input type="number" value="${item.frete || ''}">
          <select>
            <option ${item.tendencia=="ALTA"?"selected":""}>Alta</option>
            <option ${item.tendencia=="BAIXA"?"selected":""}>Baixa</option>
            <option ${item.tendencia=="ESTÁVEL"?"selected":""}>Estável</option>
          </select>
        </div>
        `;

      }).join("")}

    </div>
    `;

  }).join("");
}

load();
