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
    if(!/^[a-f0-9-]{36}$/.test(p.ticketId||""))return result_({ok:false,error:"Protocolo inválido."});
    var folder=DriveApp.getFolderById(root);
    if(p.action==="upload"){
      var slots=["cavalo","carreta","antt","cnh","endereco","motorista","caminhao","motorista_caminhao","nota_origem","laudo","ticket_pesagem","ordem","nf_trocada","nota","nota_coleta","liberacao","rota_pedagio","tabela_antt"];
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
