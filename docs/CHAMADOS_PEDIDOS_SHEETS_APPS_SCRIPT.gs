/**
 * Serviço ISOLADO de documentos para o Painel de Solicitações de Cadastro.
 * Implante uma cópia diferente por transportadora em um projeto Apps Script próprio.
 * Propriedades do script: CADASTRO_GATEWAY_KEY, CADASTRO_TENANT_ID,
 * CADASTRO_DRIVE_FOLDER_ID. Nunca compartilhe a chave no GitHub / HTML.
 * Implantar como aplicativo da web, executar como o proprietário da pasta.
 */
function doPost(e) {
  try {
    var p=JSON.parse(e.postData.contents||"{}"),props=PropertiesService.getScriptProperties();
    var key=props.getProperty("CADASTRO_GATEWAY_KEY")||"";
    var tenant=props.getProperty("CADASTRO_TENANT_ID")||"";
    var root=props.getProperty("CADASTRO_DRIVE_FOLDER_ID")||"";
    if(!key||key.length<24||!tenant||!root||p.key!==key||p.tenant!==tenant||p.folderId!==root)
      return result_({ok:false,error:"Não autorizado."});
    if(/^chamados\./.test(String(p.action||"")))return chamadosDispatch_(p,props,tenant);
    if(!/^[a-f0-9-]{36}$/.test(p.ticketId||""))return result_({ok:false,error:"Protocolo inválido."});
    var folder=DriveApp.getFolderById(root);
    if(p.action==="upload"){
      var slots=["cavalo","carreta","antt","cnh","endereco","motorista","caminhao","motorista_caminhao","nota_origem","laudo","ticket_pesagem","ordem","nf_trocada","nota","nota_coleta","liberacao","rota_pedagio","tabela_antt","comprovante_pagamento","comprovante_guia"];
      var mimes=["application/pdf","image/jpeg","image/png","image/webp"];
      if(slots.indexOf(p.slot)<0||mimes.indexOf(p.mime)<0||
         !/^[A-Za-z0-9+/]+={0,2}$/.test(p.base64||"")||
         String(p.base64).length>8500000)return result_({ok:false,error:"Arquivo inválido."});
      var content=Utilities.base64Decode(p.base64);
      if(!content.length||content.length>6*1024*1024)return result_({ok:false,error:"Limite excedido."});
      var filename=String(p.nome||"documento").replace(/[\\/\x00-\x1f]/g,"_").slice(0,100);
      var subfolder=getTicketFolder_(folder,p.ticketId,true);
      var blob=Utilities.newBlob(content,p.mime,filename);
      var file=subfolder.createFile(blob);
      file.setDescription("Portal Frete "+tenant+" / "+p.ticketId+" / "+p.slot);
      // Google Drive mantém o arquivo PRIVADO. Não chamar setSharing.
      return result_({ok:true,fileId:file.getId()});
    }
    if(p.action==="download"){
      if(!/^[A-Za-z0-9_-]{15,160}$/.test(p.fileId||""))return result_({ok:false});
      var directory=getTicketFolder_(folder,p.ticketId,false);
      if(!directory)return result_({ok:false});
      var iterator=directory.getFiles(),file=null;
      while(iterator.hasNext()){var candidate=iterator.next();if(candidate.getId()===p.fileId){file=candidate;break;}}
      if(!file)return result_({ok:false});
      var bytes=file.getBlob().getBytes();
      if(bytes.length>6*1024*1024)return result_({ok:false,error:"Arquivo grande."});
      return result_({ok:true,base64:Utilities.base64Encode(bytes)});
    }
    return result_({ok:false,error:"Operação desconhecida."});
  }catch(err){console.error("Falha no serviço de documentos",err.name);return result_({ok:false,error:"Armazenamento indisponível."});}
}
function getTicketFolder_(root,id,create) {
 var f=root.getFoldersByName(id);
 if(f.hasNext())return f.next();
 return create?root.createFolder(id):null;
}
function result_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}


/* ===========================================================
  SOLICITAÇÕES / CHAMADOS: Google Sheets + Google Drive
  Um projeto Apps Script PRIVADO por transportadora.
  Reaproveita as propriedades CADASTRO_* existentes.
  SheetId é enviado pelo Worker após autenticação, nunca pelo browser.
  Mantém upload/download legado sem alteração.
=========================================================== */
var CM_CACHE_={};
var CM_TABS_={};
var CM_INDEX_={};
var CM_SPECS={
 SOLICITACOES:["ID","TRANSPORTADORA","PROTOCOLO","NUMERO","TIPO","STATUS","SOLICITANTE","NOME_SOLICITANTE","EXECUTOR","NUMERO_PEDIDO_SISTEMA","MOTIVO","CRIADO_EM","ATUALIZADO_EM","ENVIADO_EM","EXCLUIDO_EM","EXCLUIDO_POR","MOTIVO_EXCLUSAO"],
 PEDIDOS_DETALHES:["CHAMADO_ID","EMAIL","TELEFONE_WHATS","UNIDADE_EMBARQUE","NUMERO_PEDIDO_OC","NFE_MANIFESTADA","TOMADOR_CNPJ","COLETA_IE","ENTREGA_CNPJ","ENTREGA_IE","FRETE_EMPRESA","FRETE_MOTORISTA","ADIANTAMENTO_PCT","ICMS","PRODUTO","ESPECIE","TAG","OBS","COORDENADAS_COLETA","COORDENADAS_ENTREGA"],
 CORRECOES:["CHAMADO_ID","NUMERO_PEDIDO_CORRECAO","TEXTO_CORRECAO","NUMERO_CTE","DESCRICAO_COMPLEMENTO","DOCUMENTO_TIPO","NUMERO_DOCUMENTO","TEXTO_CARTA"],
 PAGAMENTOS:["CHAMADO_ID","CTE_PAGAMENTO","PLACA_PAGAMENTO","NOME_BENEFICIARIO","CPF_CNPJ_PAGAMENTO","FORMA_PAGAMENTO","ETAPA_PAGAMENTO","PIX_PAGAMENTO","BANCO_PAGAMENTO","AGENCIA_PAGAMENTO","CONTA_PAGAMENTO","CTE_GUIA","NF_GUIA"],
 ANEXOS:["ID","TRANSPORTADORA","CHAMADO_ID","TIPO_ANEXO","DRIVE_ID","NOME","MIME","BYTES","CRIADO_EM"],
 MENSAGENS:["ID","TRANSPORTADORA","CHAMADO_ID","AUTOR","TEXTO","CRIADO_EM"],
 HISTORICO:["ID","TRANSPORTADORA","CHAMADO_ID","AUTOR","STATUS","DESCRICAO","CRIADO_EM"],
 AUDITORIA:["ID","TRANSPORTADORA","CHAMADO_ID","AUTOR","ACAO","CAMPO","VALOR_ANTERIOR","VALOR_NOVO","CRIADO_EM"],
 EXCLUIDOS:["CHAMADO_ID","TRANSPORTADORA","PROTOCOLO","REMOVIDO_EM","REMOVIDO_POR","MOTIVO","RESTAURADO_EM","RESTAURADO_POR"],
 USUARIOS:["USUARIO","TIPOS_LIBERADOS","ATIVO","ATUALIZADO_EM","ATUALIZADO_POR"],
 CONFIG:["CHAVE","VALOR","OBSERVACAO"]
};
var CM_FIELDS={
 email:"EMAIL",telefoneWhats:"TELEFONE_WHATS",unidadeEmbarque:"UNIDADE_EMBARQUE",
 numeroPedidoOC:"NUMERO_PEDIDO_OC",nfeManifestada:"NFE_MANIFESTADA",
 tomadorCnpj:"TOMADOR_CNPJ",coletaIe:"COLETA_IE",entregaCnpj:"ENTREGA_CNPJ",entregaIe:"ENTREGA_IE",
 freteEmpresa:"FRETE_EMPRESA",freteMotorista:"FRETE_MOTORISTA",adiantamentoPct:"ADIANTAMENTO_PCT",
 icms:"ICMS",produto:"PRODUTO",especie:"ESPECIE",tag:"TAG",obs:"OBS",
 coordenadasColeta:"COORDENADAS_COLETA",coordenadasEntrega:"COORDENADAS_ENTREGA"
};
var CM_CORRECOES={
 numeroPedidoCorrecao:"NUMERO_PEDIDO_CORRECAO",textoCorrecao:"TEXTO_CORRECAO",
 numeroCte:"NUMERO_CTE",descricaoComplemento:"DESCRICAO_COMPLEMENTO",
 documentoTipo:"DOCUMENTO_TIPO",numeroDocumento:"NUMERO_DOCUMENTO",textoCarta:"TEXTO_CARTA"
};
var CM_FINANCEIRO={
 ctePagamento:"CTE_PAGAMENTO",placaPagamento:"PLACA_PAGAMENTO",
 nomeBeneficiario:"NOME_BENEFICIARIO",cpfCnpjPagamento:"CPF_CNPJ_PAGAMENTO",
 formaPagamento:"FORMA_PAGAMENTO",etapaPagamento:"ETAPA_PAGAMENTO",pixPagamento:"PIX_PAGAMENTO",
 bancoPagamento:"BANCO_PAGAMENTO",agenciaPagamento:"AGENCIA_PAGAMENTO",contaPagamento:"CONTA_PAGAMENTO",
 cteGuia:"CTE_GUIA",nfGuia:"NF_GUIA"
};
function cmNow_(){return new Date().toISOString();}
function cmId_(){return Utilities.getUuid();}
function cmCell_(value){
 if(value===null||value===undefined)return "";
 var v=cmRaw_(value);
 // Força timestamp como TEXTO. Sheets convertia "2026-11-12 22:00:59"
 // automaticamente em valor de data, divergindo da assinatura do D1.
 // Continua bloqueando fórmulas introduzidas pelos formulários externos.
 return /^[=+\-@]/.test(v)||/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d/.test(v)?"'"+v:v;
}
function cmRaw_(s){
 if(s===null||s===undefined)return "";
 // Dados importados ANTES desta correção podem estar como Date (tipo numérico).
 // Usar UTC, pois D1 CURRENT_TIMESTAMP grava "YYYY-MM-DD HH:MM:SS" em UTC.
 if(Object.prototype.toString.call(s)==="[object Date]")
  return Utilities.formatDate(s,"Etc/GMT","yyyy-MM-dd HH:mm:ss");
 return String(s);
}
function cmSafeText_(str,max,required){
 var value=cmRaw_(str).trim();
 if((required&&!value)||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new Error("Campo inválido.");
 return value;
}
function cmTab_(ss,name){
 if(CM_TABS_[name])return CM_TABS_[name];
 var tab=ss.getSheetByName(name);
 if(!tab)throw new Error("Planilha sem a aba "+name+".");
 var expected=CM_SPECS[name],actual=tab.getRange(1,1,1,expected.length).getValues()[0].map(String);
 if(expected.some(function(k,i){return actual[i]!==k;}))
  throw new Error("Cabeçalho alterado na aba "+name+". Corrija antes de continuar.");
 return CM_TABS_[name]=tab;
}
function cmRows_(ss,name){
 if(CM_CACHE_[name])return CM_CACHE_[name];
 var sh=cmTab_(ss,name),keys=CM_SPECS[name],last=sh.getLastRow();
 if(last<2)return CM_CACHE_[name]=[];
 // Dados bancários são identificadores TEXTUAIS. getValues() transforma
 // agência "3282-4" em Date e pode remover zeros à esquerda de PIX/CPF.
 // getDisplayValues() preserva exatamente o texto mostrado no Sheets.
 var values=sh.getRange(2,1,last-1,keys.length)[
  name==="PAGAMENTOS"?"getDisplayValues":"getValues"
 ](),all=[];
 values.forEach(function(v,i){
  if(!v[0])return;
  var obj={__row:i+2};
  keys.forEach(function(k,j){obj[k]=v[j];});
  all.push(obj);
 });
 return CM_CACHE_[name]=all;
}
function cmGet_(ss,name,key,value){
 // Índice O(1) por coluna. Não percorre todos os registros a cada card.
 var cacheKey=name+"|"+key,lookup=CM_INDEX_[cacheKey];
 if(!lookup){
  lookup=Object.create(null);
  cmRows_(ss,name).forEach(function(row){lookup[String(row[key])]=row;});
  CM_INDEX_[cacheKey]=lookup;
 }
 return lookup[String(value)]||null;
}
function cmPut_(ss,name,data,key){
 var sheet=cmTab_(ss,name),keys=CM_SPECS[name];
 var previous=cmGet_(ss,name,key||keys[0],data[key||keys[0]]);
 var row=keys.map(function(k){
  // Preserva outras colunas, inclusive edições manuais.
  return cmCell_(Object.prototype.hasOwnProperty.call(data,k)?data[k]:(previous?previous[k]:""));
 });
 if(name==="PAGAMENTOS"){
  // Formate ANTES de escrever, pois 3282-4 é interpretado como abril/3282.
  // Inclui novas linhas e atualizações, mesmo em outras transportadoras.
  var rowIndex=previous?previous.__row:sheet.getLastRow()+1;
  var target=sheet.getRange(rowIndex,1,1,row.length);
  target.setNumberFormat("@");
  target.setValues([row]);
 }else if(previous)sheet.getRange(previous.__row,1,1,row.length).setValues([row]);
 else sheet.appendRow(row);
 delete CM_CACHE_[name];
 Object.keys(CM_INDEX_).forEach(function(k){
  if(k.indexOf(name+"|")===0)delete CM_INDEX_[k];
 });
 return previous;
}
function cmCfg_(ss,key){
 var item=cmGet_(ss,"CONFIG","CHAVE",key);
 return item?cmRaw_(item.VALOR):"";
}
function cmCfgSet_(ss,key,value){
 cmPut_(ss,"CONFIG",{CHAVE:key,VALOR:cmRaw_(value)},"CHAVE");
}
function cmSheet_(p){
 if(!/^[A-Za-z0-9_-]{25,120}$/.test(String(p.sheetId||"")))
  throw new Error("ID da planilha inválido.");
 var ss=SpreadsheetApp.openById(p.sheetId);
 if(cmCfg_(ss,"TENANT_ID")!==p.tenant)throw new Error("Planilha de outra transportadora.");
 if(cmCfg_(ss,"SCHEMA_VERSION")!=="1")throw new Error("Versão das abas não reconhecida.");
 return ss;
}
function cmAllowed_(p,ticket,action){
 var ctx=p.context||{},user=cmRaw_(ctx.user),admin=ctx.superAdmin===true;
 var executor=ctx.executor===true,view=ctx.view;
 if(!admin&&ticket.EXCLUIDO_EM)return false;
 if(!admin&&ticket.STATUS==="RASCUNHO"&&ticket.SOLICITANTE!==user)return false;
 var owner=ticket.SOLICITANTE===user;
 var allowed=(ctx.allowedKinds||[]).indexOf(cmRaw_(ticket.TIPO))>=0;
 if(view==="execucao")return admin||(executor&&allowed&&ticket.STATUS!=="RASCUNHO");
 return admin||owner||ticket.STATUS!=="RASCUNHO";
}
function cmPublicTicket_(main){
 return {id:cmRaw_(main.ID),protocolo:cmRaw_(main.PROTOCOLO),numero:Number(main.NUMERO)||0,
  solicitante:cmRaw_(main.SOLICITANTE),nomeSolicitante:cmRaw_(main.NOME_SOLICITANTE),
  executor:cmRaw_(main.EXECUTOR),tipoSolicitacao:cmRaw_(main.TIPO)||"PEDIDO",
  status:cmRaw_(main.STATUS),criadoEm:cmRaw_(main.CRIADO_EM),
  atualizadoEm:cmRaw_(main.ATUALIZADO_EM),enviadoEm:cmRaw_(main.ENVIADO_EM),
  numeroPedidoSistema:"",motivo:"",dadosEspecificos:{},numeroPedidoOC:""};
}
function cmTicketForAudience_(ss,p,main){
 var ctx=p.context||{};
 // Monitor coletivo assinado pelo Worker: cards públicos não precisam de leitura
 // das 3 abas de detalhes, evitando lentidão em empresas com muitos chamados.
 if(ctx.sharedMonitor===true&&main.SOLICITANTE!==ctx.user)
  return cmPublicTicket_(main);
 var own=ctx.superAdmin===true||main.SOLICITANTE===ctx.user||
  (ctx.view==="execucao"&&ctx.executor===true&&
   (ctx.allowedKinds||[]).indexOf(cmRaw_(main.TIPO))>=0);
 return own?cmTicket_(ss,main):cmPublicTicket_(main);
}
function cmTicket_(ss,main){
 var out={
  id:cmRaw_(main.ID),protocolo:cmRaw_(main.PROTOCOLO),
  numero:Number(main.NUMERO)||0,solicitante:cmRaw_(main.SOLICITANTE),
  nomeSolicitante:cmRaw_(main.NOME_SOLICITANTE),
  executor:cmRaw_(main.EXECUTOR),tipoSolicitacao:cmRaw_(main.TIPO)||"PEDIDO",
  status:cmRaw_(main.STATUS),numeroPedidoSistema:cmRaw_(main.NUMERO_PEDIDO_SISTEMA),
  motivo:cmRaw_(main.MOTIVO),criadoEm:cmRaw_(main.CRIADO_EM),
  atualizadoEm:cmRaw_(main.ATUALIZADO_EM),enviadoEm:cmRaw_(main.ENVIADO_EM),
  excluidoEm:cmRaw_(main.EXCLUIDO_EM),excluidoPor:cmRaw_(main.EXCLUIDO_POR),
  dadosEspecificos:{}
 };
 var details=cmGet_(ss,"PEDIDOS_DETALHES","CHAMADO_ID",main.ID)||{};
 var corrections=cmGet_(ss,"CORRECOES","CHAMADO_ID",main.ID)||{};
 var payment=cmGet_(ss,"PAGAMENTOS","CHAMADO_ID",main.ID)||{};
 Object.keys(CM_FIELDS).forEach(function(k){out[k]=cmRaw_(details[CM_FIELDS[k]]);});
 Object.keys(CM_CORRECOES).forEach(function(k){
  if(corrections[CM_CORRECOES[k]])out.dadosEspecificos[k]=cmRaw_(corrections[CM_CORRECOES[k]]);
 });
 Object.keys(CM_FINANCEIRO).forEach(function(k){
  if(payment[CM_FINANCEIRO[k]])out.dadosEspecificos[k]=cmRaw_(payment[CM_FINANCEIRO[k]]);
 });
 return out;
}
function cmUpdateDetails_(ss,id,fields,extras){
 var details={CHAMADO_ID:id},corrections={CHAMADO_ID:id},payment={CHAMADO_ID:id};
 Object.keys(CM_FIELDS).forEach(function(k){if(fields&&Object.prototype.hasOwnProperty.call(fields,k))details[CM_FIELDS[k]]=cmRaw_(fields[k]);});
 Object.keys(CM_CORRECOES).forEach(function(k){if(extras&&Object.prototype.hasOwnProperty.call(extras,k))corrections[CM_CORRECOES[k]]=cmRaw_(extras[k]);});
 Object.keys(CM_FINANCEIRO).forEach(function(k){if(extras&&Object.prototype.hasOwnProperty.call(extras,k))payment[CM_FINANCEIRO[k]]=cmRaw_(extras[k]);});
 if(Object.keys(details).length>1)cmPut_(ss,"PEDIDOS_DETALHES",details,"CHAMADO_ID");
 if(Object.keys(corrections).length>1)cmPut_(ss,"CORRECOES",corrections,"CHAMADO_ID");
 if(Object.keys(payment).length>1)cmPut_(ss,"PAGAMENTOS",payment,"CHAMADO_ID");
}
function cmHist_(ss,p,ticket,status,description){
 cmPut_(ss,"HISTORICO",{ID:cmId_(),TRANSPORTADORA:p.tenant,CHAMADO_ID:ticket.ID,
  AUTOR:cmRaw_(p.context.user),STATUS:status,DESCRICAO:description,CRIADO_EM:cmNow_()},"ID");
}
function cmAudit_(ss,p,ticket,action,field,before,after){
 cmPut_(ss,"AUDITORIA",{ID:cmId_(),TRANSPORTADORA:p.tenant,CHAMADO_ID:ticket.ID,
  AUTOR:cmRaw_(p.context.user),ACAO:action,CAMPO:field||"",VALOR_ANTERIOR:before||"",
  VALOR_NOVO:after||"",CRIADO_EM:cmNow_()},"ID");
}
function cmSequence_(ss){
 var previous=Number(cmCfg_(ss,"ULTIMO_NUMERO"))||0;
 var max=cmRows_(ss,"SOLICITACOES").reduce(function(m,row){return Math.max(m,Number(row.NUMERO)||0);},0);
 var next=Math.max(previous,max)+1;cmCfgSet_(ss,"ULTIMO_NUMERO",String(next));return next;
}
function cmSaveMain_(ss,p,obj){
 var doc={
  ID:obj.id,TRANSPORTADORA:p.tenant,PROTOCOLO:obj.protocolo,NUMERO:obj.numero,
  TIPO:obj.tipoSolicitacao,STATUS:obj.status,SOLICITANTE:obj.solicitante,
  NOME_SOLICITANTE:obj.nomeSolicitante,EXECUTOR:obj.executor,
  NUMERO_PEDIDO_SISTEMA:obj.numeroPedidoSistema,MOTIVO:obj.motivo,
  CRIADO_EM:obj.criadoEm,ATUALIZADO_EM:obj.atualizadoEm,ENVIADO_EM:obj.enviadoEm,
  EXCLUIDO_EM:obj.excluidoEm,EXCLUIDO_POR:obj.excluidoPor,MOTIVO_EXCLUSAO:obj.excluidoMotivo
 };
 cmPut_(ss,"SOLICITACOES",doc,"ID");
 cmUpdateDetails_(ss,obj.id,obj,obj.dadosEspecificos||{});
}
function cmMessage_(ss,p,ticket,text,actor,date,id){
 cmPut_(ss,"MENSAGENS",{ID:id||cmId_(),TRANSPORTADORA:p.tenant,CHAMADO_ID:ticket.ID,
  AUTOR:actor||cmRaw_(p.context.user),TEXTO:text,CRIADO_EM:date||cmNow_()},"ID");
}
function cmHistoryResult_(ss,tenant,id){
 return cmRows_(ss,"HISTORICO").filter(function(x){return x.TRANSPORTADORA===tenant&&x.CHAMADO_ID===id;})
  .sort(function(a,b){return cmRaw_(a.CRIADO_EM).localeCompare(cmRaw_(b.CRIADO_EM));})
  .map(function(x){return {autor_id:x.AUTOR,status:x.STATUS,descricao:x.DESCRICAO,criado_em:x.CRIADO_EM};});
}
function cmMain_(ss,p,id){
 var item=cmGet_(ss,"SOLICITACOES","ID",id);
 if(!item||item.TRANSPORTADORA!==p.tenant)throw new Error("Chamado não encontrado.");
 if(!cmAllowed_(p,item,"read"))throw new Error("Chamado não autorizado.");
 return item;
}
function cmReply_(o){return result_(Object.assign({ok:true},o||{}));}
// Data da conclusão registrada no histórico, não da última alteração do chamado.
function cmBrazilDate_(value){
 var v=cmRaw_(value);
 if(!v)return "";
 var canonical=/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/.test(v)?
  v.replace(" ","T")+"Z":v;
 var date=new Date(canonical);
 return Number.isNaN(date.getTime())?"":Utilities.formatDate(date,"America/Sao_Paulo","yyyy-MM-dd");
}
function cmFinishedDates_(ss,tenant){
 var latest=Object.create(null);
 cmRows_(ss,"HISTORICO").forEach(function(row){
  if(row.TRANSPORTADORA!==tenant||row.STATUS!=="FINALIZADO")return;
  var id=cmRaw_(row.CHAMADO_ID),raw=cmRaw_(row.CRIADO_EM);
  var canonical=/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/.test(raw)?
    raw.replace(" ","T")+"Z":raw;
  var epoch=new Date(canonical).getTime();
  if(!Number.isFinite(epoch))return;
  if(!latest[id]||epoch>latest[id].time)latest[id]={time:epoch,value:raw};
 });
 return latest;
}
function cmFilterRows_(ss,p,history){
 var ctx=p.context||{},all=ctx.superAdmin===true&&p.data&&p.data.escopo==="todos";
 var removed=all&&p.data.removidos==="1",state=cmRaw_(p.data&&p.data.etapa).toUpperCase();
 var tipo=cmRaw_(p.data&&p.data.tipo).toUpperCase();
 var q=cmRaw_(p.data&&p.data.busca).trim().toUpperCase();
 var allowed=ctx.allowedKinds||[];
 var today=history?"":Utilities.formatDate(new Date(),"America/Sao_Paulo","yyyy-MM-dd");
 var finished=history?null:cmFinishedDates_(ss,p.tenant);
 var rows=cmRows_(ss,"SOLICITACOES").filter(function(item){
  if(item.TRANSPORTADORA!==p.tenant)return false;
  if(Boolean(item.EXCLUIDO_EM)!==removed)return false;
  if(ctx.view==="execucao"&&!ctx.superAdmin&&
     (allowed.indexOf(cmRaw_(item.TIPO))<0||item.STATUS==="RASCUNHO"))return false;
  if(!ctx.superAdmin&&ctx.view!=="execucao"&&item.STATUS==="RASCUNHO"&&item.SOLICITANTE!==ctx.user)return false;
  if(history){
   if(!all&&item.STATUS!=="FINALIZADO")return false;
   if(all&&state&&item.STATUS!==state)return false;
  }else{
   if(ctx.view==="execucao"&&item.STATUS==="RASCUNHO")return false;
   if(item.STATUS==="FINALIZADO"){
    var event=finished[cmRaw_(item.ID)];
    if(cmBrazilDate_(event?event.value:item.ATUALIZADO_EM)!==today)return false;
   }
  }
  if(tipo&&item.TIPO!==tipo)return false;
  if(q){
   var privateSearch=ctx.superAdmin===true||item.SOLICITANTE===ctx.user||
      (ctx.view==="execucao"&&ctx.executor===true&&allowed.indexOf(cmRaw_(item.TIPO))>=0);
   var searchable=[item.PROTOCOLO,item.NUMERO,item.NOME_SOLICITANTE,item.TIPO,cmRaw_(item.ID)];
   if(privateSearch)searchable.push(item.NUMERO_PEDIDO_SISTEMA,item.MOTIVO);
   var payload=searchable.join(" ").toUpperCase();
   if(payload.indexOf(q)<0){
    // Pesquisa pública não pode revelar existência de dados bancários, chaves PIX e CPFs.
    if(!privateSearch)return false;
    var detail=cmTicket_(ss,item);
    var haystack=(Object.keys(detail).map(function(k){
     var v=detail[k];return typeof v==="object"?JSON.stringify(v):cmRaw_(v);
    }).join(" ")).toUpperCase();
    if(haystack.indexOf(q)<0)return false;
   }
  }
  return true;
 });
 rows.sort(function(a,b){
  return cmRaw_(b.ATUALIZADO_EM).localeCompare(cmRaw_(a.ATUALIZADO_EM))||
   cmRaw_(b.ID).localeCompare(cmRaw_(a.ID));
 });
 return rows;
}
function cmFile_(ss,p,main){
 return cmRows_(ss,"ANEXOS").filter(function(x){return x.CHAMADO_ID===main.ID&&x.TRANSPORTADORA===p.tenant;})
  .map(function(x){return {id:x.ID,slot:x.TIPO_ANEXO,nome:x.NOME,mime:x.MIME,
   bytes:Number(x.BYTES)||0,criado_em:x.CRIADO_EM};});
}
function cmFingerprint_(ss,p){
 var items=cmRows_(ss,"SOLICITACOES").filter(function(x){return x.TRANSPORTADORA===p.tenant;});
 var sorted=items.map(function(x){return cmRaw_(x.ID)+"|"+cmRaw_(x.STATUS)+"|"+cmRaw_(x.ATUALIZADO_EM);}).sort();
 var digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,sorted.join("\n"),Utilities.Charset.UTF_8);
 return digest.map(function(x){return ("0"+(x&255).toString(16)).slice(-2);}).join("");
}
function cmChildDigest_(ss,p,name){
 var values=cmRows_(ss,name).filter(function(x){return x.TRANSPORTADORA===p.tenant;})
  .map(function(x){return cmRaw_(x.ID)+"|"+cmRaw_(x.CHAMADO_ID);}).sort();
 var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,values.join("\n"),Utilities.Charset.UTF_8);
 return {count:values.length,fingerprint:hash.map(function(x){return ("0"+(x&255).toString(16)).slice(-2);}).join("")};
}
function cmOperation_(ss,p){
 var op=p.action.replace(/^chamados\./,""),ctx=p.context||{},data=p.data||{};
 var user=cmRaw_(ctx.user),admin=ctx.superAdmin===true,executor=ctx.executor===true;
 if(op==="health")return {schema:1,count:cmRows_(ss,"SOLICITACOES").filter(function(x){return x.TRANSPORTADORA===p.tenant;}).length,
  fingerprint:cmFingerprint_(ss,p),transportadora:p.tenant,
  anexos:cmChildDigest_(ss,p,"ANEXOS"),mensagens:cmChildDigest_(ss,p,"MENSAGENS"),
  historico:cmChildDigest_(ss,p,"HISTORICO")};
 if(op==="import"){
  if(!admin||ctx.view!=="execucao")throw new Error("Importação restrita ao Super Admin.");
  if(!Array.isArray(data.chamados)||data.chamados.length>20)throw new Error("Lote inválido.");
  data.chamados.forEach(function(t){
   if(!/^[a-f0-9-]{36}$/.test(t.id||""))throw new Error("ID inválido na importação.");
   cmSaveMain_(ss,p,t);
  });
  ["anexos","mensagens","historico"].forEach(function(section){
   var source=data[section]||[];
   if(!Array.isArray(source)||source.length>500)throw new Error("Lote grande demais.");
   var target=section==="anexos"?"ANEXOS":section==="mensagens"?"MENSAGENS":"HISTORICO";
   source.forEach(function(x){
    if(!/^[a-f0-9-]{36}$/.test(x.id||""))throw new Error("Referência inválida.");
    var v=section==="anexos"?
      {ID:x.id,TRANSPORTADORA:p.tenant,CHAMADO_ID:x.ticket_id,TIPO_ANEXO:x.slot,
       DRIVE_ID:x.drive_id,NOME:x.nome,MIME:x.mime,BYTES:x.bytes,CRIADO_EM:x.criado_em}:
      section==="mensagens"?
      {ID:x.id,TRANSPORTADORA:p.tenant,CHAMADO_ID:x.ticket_id,AUTOR:x.autor_id,
       TEXTO:x.texto,CRIADO_EM:x.criado_em}:
      {ID:x.id,TRANSPORTADORA:p.tenant,CHAMADO_ID:x.ticket_id,AUTOR:x.autor_id,
       STATUS:x.status,DESCRICAO:x.descricao,CRIADO_EM:x.criado_em};
    cmPut_(ss,target,v,"ID");
   });
  });
  var max=cmRows_(ss,"SOLICITACOES").reduce(function(m,x){return Math.max(m,Number(x.NUMERO)||0);},0);
  if(max>Number(cmCfg_(ss,"ULTIMO_NUMERO")||0))cmCfgSet_(ss,"ULTIMO_NUMERO",String(max));
  return {importados:data.chamados.length};
 }
 if(op==="list"||op==="historico"){
  var rows=cmFilterRows_(ss,p,op==="historico");
  if(op==="list")return {chamados:rows.slice(0,500).map(function(x){return cmTicketForAudience_(ss,p,x);}),executor:executor};
  var page=Math.max(0,Math.min(1000,Number(data.pagina)||0));
  var offset=page*40,list=rows.slice(offset,offset+41);
  return {chamados:list.slice(0,40).map(function(x){return cmTicketForAudience_(ss,p,x);}),
   proximaPagina:list.length>40?page+1:null,pagina:page,escopo:data.escopo||"finalizados"};
 }
 if(op==="create"){
  if(ctx.view!=="solicitante"||!ctx.solicitar)throw new Error("Solicitação não autorizada.");
  var payload=data.fields||{},now=cmNow_(),id=cmId_(),number=cmSequence_(ss);
  var direct=data.enviarAgora===true&&payload.tipoSolicitacao!=="CTE_COMPLEMENTAR";
  var obj=Object.assign({},payload,{
   id:id,protocolo:"PED-"+now.slice(0,10).replace(/-/g,"")+"-"+id.slice(0,8).toUpperCase(),
   numero:number,solicitante:user,executor:"",status:direct?"FILA":"RASCUNHO",motivo:"",
   criadoEm:now,atualizadoEm:now,enviadoEm:direct?now:"",excluidoEm:"",excluidoPor:"",
   numeroPedidoSistema:"",nomeSolicitante:payload.nomeSolicitante||user
  });
  cmSaveMain_(ss,p,obj);
  var row=cmGet_(ss,"SOLICITACOES","ID",id);
  cmHist_(ss,p,row,direct?"FILA":"RASCUNHO",direct?
   "Nova solicitação criada e enviada para a fila":"Nova solicitação criada");
  if(direct&&payload.tipoSolicitacao==="CORRECAO_PEDIDO"){
   var correctionText=cmRaw_((payload.dadosEspecificos||{}).textoCorrecao);
   if(correctionText)cmMessage_(ss,p,row,correctionText,user);
  }
  return {chamado:cmTicket_(ss,row)};
 }
 var ticket=cmMain_(ss,p,cmRaw_(p.ticketId));
 var object=cmTicket_(ss,ticket),owner=ticket.SOLICITANTE===user;
 var isMine=executor&&ticket.EXECUTOR===user&&ctx.view==="execucao";
 if(op==="get"){
  var canReadPrivate=admin||owner||(ctx.view==="solicitante"&&ticket.STATUS==="PENDENTE")||
   (ctx.view==="execucao"&&executor&&
    (ctx.allowedKinds||[]).indexOf(cmRaw_(ticket.TIPO))>=0);
  if(!canReadPrivate)return {chamado:cmPublicTicket_(ticket),anexos:[],mensagens:[],
    historico:[],executor:false,consultaPublica:true};
  var docs=cmFile_(ss,p,ticket),messages=cmRows_(ss,"MENSAGENS")
    .filter(function(x){return x.CHAMADO_ID===ticket.ID&&x.TRANSPORTADORA===p.tenant;})
    .map(function(x){return {autor_id:x.AUTOR,texto:x.TEXTO,criado_em:x.CRIADO_EM};});
  return {chamado:object,anexos:docs,mensagens:messages,
   historico:cmHistoryResult_(ss,p.tenant,ticket.ID),executor:executor};
 }
 if(op==="updateDraft"){
  if(ctx.view==="execucao"||["RASCUNHO","PENDENTE"].indexOf(ticket.STATUS)<0||
   (ticket.STATUS==="RASCUNHO"&&!owner))
   throw new Error("Somente o autor edita rascunhos; chamados pendentes são colaborativos.");
  var vals=data.fields||{};
  if(vals.tipoSolicitacao!==ticket.TIPO)throw new Error("Não é possível trocar o tipo do chamado na correção.");
  cmUpdateDetails_(ss,ticket.ID,vals,vals.dadosEspecificos||{});
  ticket.NOME_SOLICITANTE=vals.nomeSolicitante||user;ticket.ATUALIZADO_EM=cmNow_();
  cmPut_(ss,"SOLICITACOES",ticket,"ID");
  cmHist_(ss,p,ticket,ticket.STATUS,ticket.STATUS==="PENDENTE"?
   "Dados da pendência corrigidos por "+user:"Dados do rascunho atualizados");
  return {atualizado:true,status:ticket.STATUS};
 }
 if(op==="enviar"){
  if(ctx.view==="execucao"||["RASCUNHO","PENDENTE"].indexOf(ticket.STATUS)<0||
   (ticket.STATUS==="RASCUNHO"&&!owner))
   throw new Error("Somente o autor envia rascunhos; pendências podem ser devolvidas pela equipe.");
  if(ticket.TIPO==="CTE_COMPLEMENTAR"&&!cmFile_(ss,p,ticket).some(function(x){return x.slot==="liberacao";}))
   throw new Error("Anexe a liberação do cliente antes de enviar.");
  var wasPending=ticket.STATUS==="PENDENTE";
  ticket.STATUS="FILA";ticket.EXECUTOR="";ticket.MOTIVO="";
  ticket.ENVIADO_EM=cmNow_();ticket.ATUALIZADO_EM=ticket.ENVIADO_EM;
  cmPut_(ss,"SOLICITACOES",ticket,"ID");
  cmHist_(ss,p,ticket,"FILA",wasPending?
   "Pendência corrigida por "+user+". Chamado devolvido à fila de execução":
   "Enviado para execução");
  if(!wasPending&&ticket.TIPO==="CORRECAO_PEDIDO"){
   var text=cmRaw_(object.dadosEspecificos.textoCorrecao);
   if(text)cmMessage_(ss,p,ticket,text,user);
  }
  return {numero:Number(ticket.NUMERO)||0,status:"FILA"};
 }
 if(op==="assumir"){
  if(!executor||ctx.view!=="execucao"||ticket.STATUS!=="FILA")throw new Error("Chamado já assumido ou não autorizado.");
  ticket.STATUS="ANDAMENTO";ticket.EXECUTOR=user;ticket.ATUALIZADO_EM=cmNow_();
  cmPut_(ss,"SOLICITACOES",ticket,"ID");cmHist_(ss,p,ticket,"ANDAMENTO","Chamado assumido");
  return {status:"ANDAMENTO"};
 }
 if(op==="situacao"){
  if(!isMine||!["ANDAMENTO","PENDENTE"].includes(ticket.STATUS))throw new Error("Executor responsável não autorizado.");
  var next=cmRaw_(data.status).toUpperCase(),reason=cmSafeText_(data.motivo||"",1800,false);
  if(!["ANDAMENTO","PENDENTE","FINALIZADO"].includes(next))throw new Error("Situação inválida.");
  if(next==="PENDENTE"&&reason.length<8)throw new Error("Descreva a pendência.");
  if(next==="FINALIZADO"&&ticket.TIPO==="PEDIDO"&&!cmSafeText_(data.numeroPedidoSistema||"",120,false))
   throw new Error("Número do pedido no sistema obrigatório.");
  ticket.STATUS=next;ticket.MOTIVO=reason;ticket.ATUALIZADO_EM=cmNow_();
  if(next==="FINALIZADO"&&ticket.TIPO==="PEDIDO")
   ticket.NUMERO_PEDIDO_SISTEMA=cmSafeText_(data.numeroPedidoSistema,120,true);
  cmPut_(ss,"SOLICITACOES",ticket,"ID");
  cmHist_(ss,p,ticket,next,reason||"Situação alterada para "+next);
  if(reason)cmMessage_(ss,p,ticket,reason,user);
  return {status:next,numeroPedidoSistema:cmRaw_(ticket.NUMERO_PEDIDO_SISTEMA)};
 }
 if(op==="mensagens"){
  if(["RASCUNHO","FINALIZADO"].includes(ticket.STATUS)||
   (!owner&&!isMine&&!(ctx.view==="solicitante"&&ticket.STATUS==="PENDENTE")))
   throw new Error("Chat não liberado.");
  var msg=cmSafeText_(data.texto,1800,true);
  cmMessage_(ss,p,ticket,msg,user);return {enviado:true};
 }
 if(op==="upload"){
  var slot=cmRaw_(data.slot),allowed=["nota","nota_coleta","liberacao","rota_pedagio","tabela_antt","comprovante_pagamento","comprovante_guia"];
  if(allowed.indexOf(slot)<0)throw new Error("Tipo de anexo inválido.");
  var proof=slot==="comprovante_pagamento"||slot==="comprovante_guia";
  var correctProof=(ticket.TIPO==="PAGAMENTO"&&slot==="comprovante_pagamento")||
    (ticket.TIPO==="PAGAMENTO_GUIA"&&slot==="comprovante_guia");
  if(proof?!(correctProof&&isMine&&ticket.STATUS==="FINALIZADO"):
    !(ctx.view==="solicitante"&&
    (ticket.STATUS==="PENDENTE"||(owner&&ticket.STATUS==="RASCUNHO"))))
   throw new Error("Anexo não autorizado.");
  var mime=cmRaw_(data.mime),accepted=["application/pdf","image/jpeg","image/png","image/webp"];
  if(accepted.indexOf(mime)<0||!/^[A-Za-z0-9+/]+={0,2}$/.test(cmRaw_(data.base64))||
     cmRaw_(data.base64).length>8500000)throw new Error("Arquivo inválido.");
  var bytes=Utilities.base64Decode(data.base64);
  if(!bytes.length||bytes.length>6*1024*1024)throw new Error("Arquivo muito grande.");
  var root=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("CADASTRO_DRIVE_FOLDER_ID"));
  var sub=getTicketFolder_(root,ticket.ID,true),file=sub.createFile(
   Utilities.newBlob(bytes,mime,cmSafeText_(data.nome,160,true).replace(/[\\/\u0000-\u001f]/g,"_")));
  file.setDescription("PORTAL FRETE "+p.tenant+" / "+ticket.ID+" / "+slot);
  cmPut_(ss,"ANEXOS",{ID:cmId_(),TRANSPORTADORA:p.tenant,CHAMADO_ID:ticket.ID,
   TIPO_ANEXO:slot,DRIVE_ID:file.getId(),NOME:file.getName(),MIME:mime,
   BYTES:bytes.length,CRIADO_EM:cmNow_()},"ID");
  cmHist_(ss,p,ticket,ticket.STATUS,"Documento anexado: "+slot);
  return {anexado:true,slot:slot};
 }
 if(op==="download"){
  if(!admin&&!owner&&!isMine&&!(ctx.view==="solicitante"&&ticket.STATUS==="PENDENTE"))
  throw new Error("Anexo privado do solicitante ou executor.");
  var doc=cmGet_(ss,"ANEXOS","ID",cmRaw_(data.docId));
  if(!doc||doc.CHAMADO_ID!==ticket.ID||doc.TRANSPORTADORA!==p.tenant)throw new Error("Documento não encontrado.");
  var directory=getTicketFolder_(DriveApp.getFolderById(
    PropertiesService.getScriptProperties().getProperty("CADASTRO_DRIVE_FOLDER_ID")),ticket.ID,false);
  if(!directory)throw new Error("Pasta do chamado não encontrada.");
  var files=directory.getFiles(),found=null;
  while(files.hasNext()){var item=files.next();if(item.getId()===doc.DRIVE_ID){found=item;break;}}
  if(!found)throw new Error("Documento não encontrado no Drive.");
  var content=found.getBlob().getBytes();
  if(content.length>6*1024*1024)throw new Error("Documento muito grande.");
  return {mime:doc.MIME,base64:Utilities.base64Encode(content)};
 }
 if(["ocultar","restaurar"].includes(op)){
  if(!admin||cmRaw_(data.protocolo)!==ticket.PROTOCOLO)throw new Error("Operação exclusiva do Super Admin.");
  var motivation=cmSafeText_(data.motivo,400,true);
  if(motivation.length<8)throw new Error("Motivo insuficiente.");
  if(op==="ocultar"){
   if(ticket.EXCLUIDO_EM)throw new Error("Chamado já removido.");
   ticket.EXCLUIDO_EM=cmNow_();ticket.EXCLUIDO_POR=user;ticket.MOTIVO_EXCLUSAO=motivation;
   cmPut_(ss,"EXCLUIDOS",{CHAMADO_ID:ticket.ID,TRANSPORTADORA:p.tenant,PROTOCOLO:ticket.PROTOCOLO,
    REMOVIDO_EM:ticket.EXCLUIDO_EM,REMOVIDO_POR:user,MOTIVO:motivation},"CHAMADO_ID");
  }else{
   if(!ticket.EXCLUIDO_EM)throw new Error("Chamado não removido.");
   ticket.EXCLUIDO_EM="";ticket.EXCLUIDO_POR="";ticket.MOTIVO_EXCLUSAO="";
   cmPut_(ss,"EXCLUIDOS",{CHAMADO_ID:ticket.ID,RESTAURADO_EM:cmNow_(),RESTAURADO_POR:user},"CHAMADO_ID");
  }
  ticket.ATUALIZADO_EM=cmNow_();cmPut_(ss,"SOLICITACOES",ticket,"ID");
  cmHist_(ss,p,ticket,ticket.STATUS,(op==="ocultar"?"Retirado da operação":"Restaurado pelo Super Admin")+". "+motivation);
  cmAudit_(ss,p,ticket,op.toUpperCase(),"EXCLUIDO_EM","",ticket.EXCLUIDO_EM);
  return {atualizado:true,removido:op==="ocultar"};
 }
 if(op==="corrigir"){
  if(!admin)throw new Error("Somente Super Admin pode corrigir.");
  var field=cmRaw_(data.campo),value=cmSafeText_(data.valor,1800,true);
  var explanation=cmSafeText_(data.motivo,400,true);
  if(explanation.length<8)throw new Error("Justificativa insuficiente.");
  var before="",location="";
  if(CM_FIELDS[field]){location="PEDIDOS_DETALHES";before=cmRaw_(object[field]);
   var record={CHAMADO_ID:ticket.ID};record[CM_FIELDS[field]]=value;
   cmPut_(ss,location,record,"CHAMADO_ID");
  }else if(CM_CORRECOES[field]){
   location="CORRECOES";before=cmRaw_(object.dadosEspecificos[field]);
   var correction={CHAMADO_ID:ticket.ID};correction[CM_CORRECOES[field]]=value;
   cmPut_(ss,location,correction,"CHAMADO_ID");
  }else if(CM_FINANCEIRO[field]){
   location="PAGAMENTOS";before=cmRaw_(object.dadosEspecificos[field]);
   if(field==="formaPagamento"&&value!==before)throw new Error("Não altere a modalidade diretamente.");
   var pay={CHAMADO_ID:ticket.ID};pay[CM_FINANCEIRO[field]]=value;
   cmPut_(ss,location,pay,"CHAMADO_ID");
  }else if(field==="numeroPedidoSistema"&&ticket.TIPO==="PEDIDO"){
   before=cmRaw_(ticket.NUMERO_PEDIDO_SISTEMA);ticket.NUMERO_PEDIDO_SISTEMA=value;
   cmPut_(ss,"SOLICITACOES",ticket,"ID");
  }else throw new Error("Campo de correção não permitido.");
  cmHist_(ss,p,ticket,ticket.STATUS,"Correção administrativa: "+field+". "+explanation);
  cmAudit_(ss,p,ticket,"CORRECAO",field,before,value);
  return {atualizado:true,campo:field};
 }
 throw new Error("Operação de chamados desconhecida.");
}
function chamadosDispatch_(p,props,tenant){
 var op=String(p.action||"").replace(/^chamados\./,"");
 var readOnly=["health","list","historico","get","download"].indexOf(op)>=0;
 var lock=readOnly?null:LockService.getScriptLock();
 if(lock&&!lock.tryLock(12000))return result_({ok:false,error:"Sistema ocupado. Tente novamente."});
 try{
  CM_CACHE_={};CM_TABS_={};CM_INDEX_={};
  var ss=cmSheet_(p);
  // Saúde e consultas não alteram registros. Todas as operações de escrita estão
  // serializadas por LockService para preservar números e evitar dupla execução.
  var answer=cmOperation_(ss,p);
  if(!readOnly)SpreadsheetApp.flush();
  return cmReply_(answer);
 }catch(err){
  console.warn("Falha no módulo de chamados:",err&&err.name);
  return result_({ok:false,error:cmRaw_(err&&err.message).slice(0,200)});
 }finally{if(lock)lock.releaseLock();}
}

/**
 * Auditoria de edições diretas na planilha.
 * Execução única pelo proprietário do Apps Script, depois da implantação:
 * - informe sheetId na função instalarAuditoriaChamados(sheetId).
 * - exige autorização da conta Google, não usa chaves no código.
 * - registros criados pelo próprio Apps Script não disparam onEdit.
 */
function instalarAuditoriaChamados(sheetId){
 var ss=SpreadsheetApp.openById(sheetId);
 var exists=ScriptApp.getProjectTriggers().some(function(t){
  return t.getHandlerFunction()==="cmOnEdit_"&&
   t.getTriggerSourceId()===sheetId;
 });
 if(!exists)ScriptApp.newTrigger("cmOnEdit_").forSpreadsheet(ss).onEdit().create();
}
function cmOnEdit_(event){
 if(!event||!event.range||!event.source)return;
 try{
  var ss=event.source,sh=event.range.getSheet(),name=sh.getName();
  if(["AUDITORIA","HISTORICO","CONFIG"].indexOf(name)>=0||!CM_SPECS[name])return;
  var rowIndex=event.range.getRow(),colIndex=event.range.getColumn();
  if(rowIndex<2||colIndex>CM_SPECS[name].length)return;
  var key=name==="SOLICITACOES"?"ID":
    ["PEDIDOS_DETALHES","CORRECOES","PAGAMENTOS","EXCLUIDOS"].indexOf(name)>=0?"CHAMADO_ID":"CHAMADO_ID";
  var headers=CM_SPECS[name],idColumn=headers.indexOf(key)+1;
  if(!idColumn)return;
  var ticketId=String(sh.getRange(rowIndex,idColumn).getValue()||"");
  if(!ticketId)return;
  var tenant=cmCfg_(ss,"TENANT_ID");
  if(!tenant)return;
  CM_CACHE_={};
  var after=event.range.getNumRows()===1&&event.range.getNumColumns()===1?
    String(event.value||""):"Várias células alteradas";
  var before=event.oldValue===undefined?"Valor anterior indisponível":String(event.oldValue);
  var column=headers[colIndex-1]||"";
  cmPut_(ss,"AUDITORIA",{ID:cmId_(),TRANSPORTADORA:tenant,CHAMADO_ID:ticketId,
   AUTOR:Session.getActiveUser().getEmail()||"EDITOR_PLANILHA",ACAO:"EDICAO_DIRETA",
   CAMPO:name+"."+column,VALOR_ANTERIOR:before,VALOR_NOVO:after,CRIADO_EM:cmNow_()},"ID");
 }catch(error){console.warn("Falha ao auditar edição:",error&&error.name);}
}
