from pathlib import Path
import re

js_path = Path('assets/js/calculo-piso.js')
html_path = Path('pages/calculo-piso.html')

text = js_path.read_text(encoding='utf-8')

new_load = r'''async function loadHistory(){
 const o=txt($("origemRota").value);
 const d=txt($("destinoRota").value);

 if(!o||!d){
  historyRouteRows=[];
  $("historyStatus").textContent="Aguardando rota";
  renderHistory([]);
  return;
 }

 $("historyStatus").textContent="Consultando B.I...";

 try{
  if(!window.PortalAPI)throw new Error("API segura do Portal indisponível.");

  const res=await window.PortalAPI.call("bi","read",{
   resource:"commercial-history"
  });

  if(!res||res.ok===false)throw new Error(res?.error||"Falha na API");

  const payload=res?.data;
  let rows=Array.isArray(payload)
   ?payload
   :Array.isArray(payload?.data)
    ?payload.data
    :Array.isArray(payload?.rows)
     ?payload.rows
     :Array.isArray(payload?.historico)
      ?payload.historico
      :Array.isArray(payload?.registros)
       ?payload.registros
       :[];

  const pick=(row,...keys)=>{
   for(const key of keys){
    if(row&&row[key]!==undefined&&row[key]!==null&&txt(row[key])!=="")return row[key];
   }
   return "";
  };

  rows=rows.map(row=>({
   ...row,
   origem:pick(row,"origem","Origem","ORIGEM","cidadeOrigem","origemCidade","localOrigem"),
   coleta:pick(row,"coleta","Coleta","COLETA","localColeta","embarque","Local Embarque"),
   destino:pick(row,"destino","Destino","DESTINO","cidadeDestino","destinoCidade","localDestino"),
   descarga:pick(row,"descarga","Descarga","DESCARGA","localDescarga","recebedor"),
   cliente:pick(row,"cliente","Cliente","CLIENTE","nomeCliente","NomeCliente"),
   produto:pick(row,"produto","Produto","PRODUTO","nomeProduto","NomeProduto"),
   valorEmpresa:pick(row,"valorEmpresa","ValorEmpresa","valor_empresa","Vlr Empresa","freteEmpresa"),
   valorMotorista:pick(row,"valorMotorista","ValorMotorista","valor_motorista","Vlr Motorista","freteMotorista"),
   km:pick(row,"km","KM","Km","quilometragem"),
   pedagioEixo:pick(row,"pedagioEixo","PedagioEixo","pedagio_eixo","Pedágio/Eixo"),
   dataHora:pick(row,"dataHora","DataHora","data_hora","data","Data"),
   ultimaAlteracao:pick(row,"ultimaAlteracao","Última Alteração","ultima_alteracao","updatedAt")
  }));

  const totalRecebido=rows.length;

  rows=rows
   .filter(r=>routeMatch(r,o,d))
   .sort((a,b)=>dateVal(b)-dateVal(a));

  historyRouteRows=rows;

  console.info("[CÁLCULO PISO] Histórico recebido:",totalRecebido);
  console.info("[CÁLCULO PISO] Rota pesquisada:",{
   origemDigitada:o,
   destinoDigitado:d,
   origemNormalizada:normPlace(o),
   destinoNormalizado:normPlace(d),
   encontrados:rows.length
  });

  applyHistoryDateFilter();

  if(!rows.length){
   $("historyStatus").textContent=
    `Nenhum histórico para esta rota (${totalRecebido} registros analisados)`;
  }

 }catch(e){
  console.error("[CÁLCULO PISO] Erro ao consultar histórico:",e);
  historyRouteRows=[];
  renderHistory([]);
  $("historyStatus").textContent="Falha ao consultar B.I.";
 }
}
'''

pattern = re.compile(r'async function loadHistory\(\)\{.*?\n\}\n\nfunction quote\(\)', re.S)
if not pattern.search(text):
    raise SystemExit('Função loadHistory não encontrada')
text = pattern.sub(new_load + '\nfunction quote()', text, count=1)
js_path.write_text(text, encoding='utf-8')

html = html_path.read_text(encoding='utf-8')
html = re.sub(r'calculo-piso\.js(?:\?v=\d+)?', 'calculo-piso.js?v=20', html)
html_path.write_text(html, encoding='utf-8')

print('Histórico do Cálculo Piso corrigido para gateway seguro e aliases de campos.')