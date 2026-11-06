/**
 * LOTOFÁCIL LAB • Extensão privada do Apps Script do FRETES
 * Crie o arquivo LotoFacil.gs no projeto já usado pelo Cloudflare Worker.
 *
 * IMPORTANTE: ESTE ARQUIVO NÃO CRIA UM SEGUNDO doPost.
 * No doPost existente, APÓS validar gatewayRequest e gatewayKey,
 * acrescente ANTES das outras ações:
 *
 *   if (body.action === 'lotofacil_bridge') {
 *     return ContentService.createTextOutput(
 *       JSON.stringify(lotofacilBridge_(body))
 *     ).setMimeType(ContentService.MimeType.JSON);
 *   }
 *
 * Substitua "body" pelo nome da variável do JSON de sua função.
 * Preserve o mecanismo de autenticação e os demais endpoints existentes.
 * Publique uma nova versão da implantação (/exec).
 */
var LOTOFACIL_TAB_ = 'LOTOFACIL_COMBINACOES';
var LOTOFACIL_HEADERS_ = [
  'NUMERO','CRIADO_EM','USUARIO','MODO','METODO','QTD_BILHETES',
  'CUSTO_REAIS','JOGOS_JSON','SORTEIO_DEZENAS','CONFERIDO_EM',
  'PREMIOS_11','PREMIOS_12','PREMIOS_13','PREMIOS_14','PREMIOS_15',
  'PREMIOS_FIXOS_REAIS','STATUS','REQUEST_ID'
];
var LOTOFACIL_PRECOS_ = {15:3.5,16:56,17:476};
function lotofacilPlanilha_(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss){
    var id=PropertiesService.getScriptProperties().getProperty('LOTO_SHEET_ID');
    if(!id)throw new Error('Configure LOTO_SHEET_ID nas propriedades do Apps Script.');
    ss=SpreadsheetApp.openById(id);
  }
  var sh=ss.getSheetByName(LOTOFACIL_TAB_);
  if(!sh)throw new Error('Aba LOTOFACIL_COMBINACOES não encontrada na planilha.');
  return sh;
}
function lotofacilInteiro_(value,min,max){
  var n=Number(value);
  if(!isFinite(n)||Math.floor(n)!==n||n<min||n>max)throw new Error('Valor numérico inválido.');
  return n;
}
function lotofacilPlano_(groups){
  if(!Array.isArray(groups)||groups.length<1||groups.length>12)
    throw new Error('Quantidade de bilhetes inválida.');
  var list=[],seen={};
  groups.forEach(function(group){
    var v=Array.isArray(group)?group:group.numbers;
    if(!Array.isArray(v))throw new Error('Jogo sem dezenas.');
    var size=v.length;
    if(size<15||size>17)throw new Error('São permitidos jogos de 15, 16 ou 17 dezenas.');
    var chosen={};
    var numbers=v.map(function(n){
      n=lotofacilInteiro_(n,1,25);
      if(chosen[n])throw new Error('Dezena repetida no mesmo jogo.');
      chosen[n]=true;return n;
    }).sort(function(a,b){return a-b});
    var key=numbers.join(',');
    if(seen[key])throw new Error('Jogo idêntico repetido no conjunto.');
    seen[key]=true;
    list.push({size:size,numbers:numbers});
  });
  return list;
}
function lotofacilCusto_(groups){
  var total=0;
  groups.forEach(function(group){total+=LOTOFACIL_PRECOS_[group.size];});
  return Math.round(total*100)/100;
}
function lotofacilIdLinha_(sh,id){
  var last=sh.getLastRow();
  if(last<2)return 0;
  var ids=sh.getRange(2,1,last-1,1).getValues();
  for(var i=0;i<ids.length;i++){
    if(Number(ids[i][0])===id)return i+2;
  }
  return 0;
}
function lotofacilEncontrarRequest_(sh,requestId){
  var last=sh.getLastRow();
  if(last<2)return 0;
  var values=sh.getRange(2,18,last-1,1).getValues();
  for(var i=0;i<values.length;i++)if(String(values[i][0])===requestId)return i+2;
  return 0;
}
function lotofacilLinhaParaObjeto_(r){
  if(!r||!r.length)throw new Error('Conjunto não encontrado.');
  var games;
  try{games=lotofacilPlano_(JSON.parse(r[7]||'[]'));}
  catch(_){throw new Error('Dados dos jogos inválidos na planilha.');}
  return{
    number:Number(r[0]),
    createdAt:r[1] instanceof Date?r[1].toISOString():String(r[1]||''),
    user:String(r[2]||''),mode:String(r[3]||''),
    method:String(r[4]||''),count:Number(r[5]||games.length),
    cost:Number(r[6]||lotofacilCusto_(games)),
    groups:games,
    draw:String(r[8]||'').trim().split(/[ ,;]+/).filter(Boolean).map(Number),
    checkedAt:r[9] instanceof Date?r[9].toISOString():String(r[9]||''),
    prizes:{11:Number(r[10]||0),12:Number(r[11]||0),13:Number(r[12]||0),14:Number(r[13]||0),15:Number(r[14]||0)},
    fixedPrize:Number(r[15]||0),status:String(r[16]||'GERADO')
  };
}
function lotofacilComb_(n,k){
  if(k<0||k>n)return 0;
  var r=1;for(var i=1;i<=k;i++)r=r*(n-i+1)/i;
  return Math.round(r);
}
function lotofacilContarPremios_(games,draw){
  var selected={};draw.forEach(function(n){selected[n]=true;});
  var prizes={11:0,12:0,13:0,14:0,15:0};
  games.forEach(function(g){
    var match=g.numbers.filter(function(n){return !!selected[n];}).length;
    var out=g.size-match;
    for(var hits=11;hits<=15;hits++){
      prizes[hits]+=lotofacilComb_(match,hits)*lotofacilComb_(out,15-hits);
    }
  });
  return prizes;
}
/** Chamada pelo doPost EXISTENTE após a chave de gateway ter sido verificada. */
function lotofacilBridge_(body){
  if(!body||body.gatewayRequest!==true||body.action!=='lotofacil_bridge')
    return{ok:false,error:'Requisição não autorizada.'};
  var p=body.params||{},op=String(p.op||'').toLowerCase();
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))return{ok:false,error:'Sistema ocupado, tente novamente.'};
  try{
    var sh=lotofacilPlanilha_();
    if(op==='create'){
      var requestId=String(p.requestId||'').trim();
      if(!/^[a-f0-9-]{30,64}$/i.test(requestId))
        throw new Error('Identificador da solicitação inválido.');
      var existing=lotofacilEncontrarRequest_(sh,requestId);
      if(existing)return{ok:true,combination:lotofacilLinhaParaObjeto_(sh.getRange(existing,1,1,18).getValues()[0]),duplicate:true};
      var games=lotofacilPlano_(p.games);
      var mode=String(p.mode||'').slice(0,40);
      var method=String(p.method||'').slice(0,40);
      var user=String(p.user||'').replace(/[\r\n\t]/g,' ').slice(0,80);
      var max=Number(PropertiesService.getScriptProperties().getProperty('LOTO_SEQ_NEXT')||0);
      var last=sh.getLastRow();
      if(last>1){
        var ids=sh.getRange(2,1,last-1,1).getValues();
        ids.forEach(function(row){if(Number(row[0])>max)max=Number(row[0]);});
      }
      var next=max+1,when=new Date(),cost=lotofacilCusto_(games);
      sh.appendRow([next,when,user,mode,method,games.length,cost,JSON.stringify(games),
        '','',0,0,0,0,0,0,'GERADO',requestId]);
      sh.getRange(sh.getLastRow(),1).setNumberFormat('000000');
      PropertiesService.getScriptProperties().setProperty('LOTO_SEQ_NEXT',String(next));
      return{ok:true,combination:{number:next,createdAt:when.toISOString(),user:user,mode:mode,method:method,count:games.length,cost:cost,groups:games,status:'GERADO'}};
    }
    var id=lotofacilInteiro_(p.number,1,999999999);
    var row=lotofacilIdLinha_(sh,id);
    if(!row)return{ok:false,error:'Combinação não encontrada.'};
    var record=lotofacilLinhaParaObjeto_(sh.getRange(row,1,1,18).getValues()[0]);
    if(op==='get')return{ok:true,combination:record};
    if(op==='check'){
      var draw=Array.isArray(p.draw)?p.draw:[];
      if(draw.length!==15)throw new Error('Informe exatamente 15 dezenas sorteadas.');
      var used={},nums=draw.map(function(n){
        var v=lotofacilInteiro_(n,1,25);
        if(used[v])throw new Error('Dezena sorteada repetida.');
        used[v]=true;return v;
      }).sort(function(a,b){return a-b});
      var prizes=lotofacilContarPremios_(record.groups,nums);
      var fixed=Math.round((prizes[11]*7+prizes[12]*14+prizes[13]*35)*100)/100;
      var checkedAt=new Date();
      sh.getRange(row,9,1,9).setValues([[nums.map(function(n){return ('0'+n).slice(-2);}).join(' '),checkedAt,prizes[11],prizes[12],prizes[13],prizes[14],prizes[15],fixed,'CONFERIDO']]);
      record.draw=nums;record.checkedAt=checkedAt.toISOString();record.prizes=prizes;record.fixedPrize=fixed;record.status='CONFERIDO';
      return{ok:true,combination:record};
    }
    return{ok:false,error:'Operação desconhecida.'};
  }catch(e){
    return{ok:false,error:String(e.message||e).slice(0,180)};
  }finally{lock.releaseLock();}
}
