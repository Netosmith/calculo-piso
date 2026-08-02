from pathlib import Path
import re

js_path = Path('assets/js/calculo-piso.js')
html_path = Path('pages/calculo-piso.html')

text = js_path.read_text(encoding='utf-8')

old = '''  const pick=(row,...keys)=>{
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
'''

new = '''  const normalizeKey=(value)=>up(value).replace(/[^A-Z0-9]/g,"");
  const pick=(row,...keys)=>{
   for(const key of keys){
    if(row&&row[key]!==undefined&&row[key]!==null&&txt(row[key])!=="")return row[key];
   }

   const wanted=new Set(keys.map(normalizeKey));
   for(const [key,value] of Object.entries(row||{})){
    if(wanted.has(normalizeKey(key))&&value!==undefined&&value!==null&&txt(value)!==""){
     return value;
    }
   }

   return "";
  };

  rows=rows.map(row=>({
   ...row,
   origem:pick(row,
    "origem","Origem","ORIGEM","cidadeOrigem","origemCidade","localOrigem",
    "Cidade Origem","Origem Cidade","Local Origem","Municipio Origem","Município Origem"
   ),
   coleta:pick(row,
    "coleta","Coleta","COLETA","localColeta","embarque","Local Embarque",
    "Local de Coleta","Ponto de Coleta","Embarque","LocalEmbarque"
   ),
   destino:pick(row,
    "destino","Destino","DESTINO","cidadeDestino","destinoCidade","localDestino",
    "Cidade Destino","Destino Cidade","Local Destino","Municipio Destino","Município Destino"
   ),
   descarga:pick(row,
    "descarga","Descarga","DESCARGA","localDescarga","recebedor",
    "Local de Descarga","Ponto de Descarga","LocalDescarga"
   ),
   cliente:pick(row,"cliente","Cliente","CLIENTE","nomeCliente","NomeCliente","Nome Cliente"),
   produto:pick(row,"produto","Produto","PRODUTO","nomeProduto","NomeProduto","Nome Produto"),
   valorEmpresa:pick(row,
    "valorEmpresa","ValorEmpresa","valor_empresa","Vlr Empresa","freteEmpresa",
    "Valor Empresa","Frete Empresa"
   ),
   valorMotorista:pick(row,
    "valorMotorista","ValorMotorista","valor_motorista","Vlr Motorista","freteMotorista",
    "Valor Motorista","Frete Motorista"
   ),
   km:pick(row,"km","KM","Km","quilometragem","Quilometragem"),
   pedagioEixo:pick(row,"pedagioEixo","PedagioEixo","pedagio_eixo","Pedágio/Eixo","Pedagio por Eixo"),
   dataHora:pick(row,"dataHora","DataHora","data_hora","data","Data","Data Hora"),
   ultimaAlteracao:pick(row,"ultimaAlteracao","Última Alteração","ultima_alteracao","updatedAt","Data Atualizacao")
  }));
'''

if old not in text:
    raise SystemExit('Bloco de normalização do histórico não encontrado em calculo-piso.js')

text = text.replace(old, new, 1)
js_path.write_text(text, encoding='utf-8')

html = html_path.read_text(encoding='utf-8')
html_new, count = re.subn(r'calculo-piso\.js\?v=\d+', 'calculo-piso.js?v=12', html, count=1)
if count == 0:
    html_new, count = re.subn(r'calculo-piso\.js', 'calculo-piso.js?v=12', html, count=1)
if count == 0:
    raise SystemExit('Referência a calculo-piso.js não encontrada em calculo-piso.html')
html_path.write_text(html_new, encoding='utf-8')

print('Histórico comercial do Cálculo Piso corrigido e cache atualizado.')
