import {errorResponse,success} from "../utils/response.js";

/**
 * Google Sheets é a fonte principal APENAS após importação D1 verificada e
 * atualização manual da implantação privada do Apps Script da transportadora.
 * Nunca confiar em usuário/empresa/tipo vindos do navegador.
 */
const KNOWN_SHEETS=Object.freeze({
 "nova-frota":"11bdFewENA_lUZ2pwIb295RmlubnW_cvVYRZKbo1vWa4",
 "teste-01":"1Lh8vkY5-8YUesv6xxPdhfFGpko3lVV8h5iT4cc4Gb6Y",
 "transvale-01":"13c8NE0P7SqURuvOvSJ3yRQhyxBpoGZUqrAMbazquQGY"
});
const MODE_KEY=id=>"tenant/"+id+"/private/chamados-sheets-v1.json";
const UUID=/^[a-f0-9-]{36}$/;
const MAX_FILE=6*1024*1024;
const SLOTS=new Set(["nota","nota_coleta","liberacao","rota_pedagio","tabela_antt","comprovante_pagamento","comprovante_guia"]);
const MIMES=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);

export async function sheetsConfig(env,tenantId){
 const defaultSheet=KNOWN_SHEETS[tenantId]||"";
 const obj=await env.TENANT_BRANDS?.get(MODE_KEY(tenantId));
 if(!obj)return {sheetId:defaultSheet,mode:"d1"};
 const conf=await obj.json();
 const sheetId=String(conf?.sheetId||defaultSheet);
 if(!/^[A-Za-z0-9_-]{25,120}$/.test(sheetId))throw Error("Configuração do Google Sheets inválida.");
 return {sheetId,mode:conf.mode==="sheets"?"sheets":"d1",verifiedAt:conf.verifiedAt||null};
}
function fail(error,code=503){
 return errorResponse(String(error?.message||error||"Erro de integração.").slice(0,210),code);
}
async function callScript(conf,tenantId,sheetId,action,context={},data={},ticketId=""){
 if(!conf?.url||!conf?.chave||!conf?.pasta)throw Error("Google Apps Script da transportadora não configurado.");
 if(!sheetId)throw Error("Planilha de chamados ainda não cadastrada.");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),105000);
 try{
  const payload={action:"chamados."+action,tenant:tenantId,sheetId,
   key:conf.chave,folderId:conf.pasta,context,data,ticketId};
  const response=await fetch(conf.url,{method:"POST",redirect:"follow",signal:controller.signal,
   headers:{"Content-Type":"text/plain;charset=UTF-8",Accept:"application/json"},
   body:JSON.stringify(payload)});
  if(!response.ok)throw Error("Falha no Apps Script ("+response.status+").");
  const raw=await response.text();
  if(raw.length>12500000)throw Error("Resposta do Apps Script muito grande.");
  let result;try{result=JSON.parse(raw);}catch{throw Error("Resposta inválida do Apps Script.");}
  if(result?.ok!==true){
   if(result?.error==="Operação desconhecida.")
    throw Error("Atualize a implantação do Apps Script com a versão de Solicitações / Chamados.");
   throw Error(result?.error||"Google Sheets recusou a operação.");
  }
  return result;
 }finally{clearTimeout(timer);}
}
const scope=(p,view,kinds,executor,flags)=>({
 user:String(p.user||""),superAdmin:p.ownerSupport===true,view,allowedKinds:kinds,
 executor:Boolean(executor),solicitar:Boolean(flags.solicitar),executar:Boolean(flags.executar)
});
const digest=async text=>{
 const data=new TextEncoder().encode(text);
 const array=new Uint8Array(await crypto.subtle.digest("SHA-256",data));
 return [...array].map(x=>x.toString(16).padStart(2,"0")).join("");
};
async function d1Fingerprint(db,tenant){
 const rows=await db.prepare("SELECT id,status,atualizado_em FROM portal_pedidos_tickets WHERE tenant_id=? ORDER BY id").bind(tenant).all();
 const strings=(rows.results||[]).map(x=>[x.id,x.status,x.atualizado_em].join("|")).sort();
 const child={};
 for(const [name,table] of [["anexos","portal_pedidos_docs"],["mensagens","portal_pedidos_messages"],["historico","portal_pedidos_history"]]){
  const rs=await db.prepare("SELECT id,ticket_id FROM "+table+" WHERE tenant_id=?").bind(tenant).all();
  const entries=(rs.results||[]).map(x=>x.id+"|"+x.ticket_id).sort();
  child[name]={count:entries.length,fingerprint:await digest(entries.join("\n"))};
 }
 return {count:strings.length,fingerprint:await digest(strings.join("\n")),...child};
}
export async function sheetsAdmin(request,env,p,view,flags,executor,kinds,conf,options){
 if(!p.ownerSupport)return errorResponse("Somente Super Admin pode migrar o armazenamento.",403);
 const url=new URL(request.url),path=url.pathname.replace(/^\/v1\/abertura-pedidos\/sheets\/?/,"");
 const ctx=scope(p,"execucao",kinds,executor,flags),db=env.TENANTS_DB;
 try{
  if(path==="vincular"&&request.method==="POST"){
   if(options.mode==="sheets")return errorResponse("Desative com migração reversa antes de trocar a planilha ativa.",409);
   const raw=await request.json().catch(()=>({}));
   const id=String(raw.sheetId||"").trim();
   if(!/^[A-Za-z0-9_-]{25,120}$/.test(id))return errorResponse("ID de planilha inválido.",400);
   const health=await callScript(conf,p.id,id,"health",ctx);
   if(health.schema!==1||health.transportadora!==p.id)return errorResponse("A planilha não pertence a esta transportadora.",403);
   await env.TENANT_BRANDS.put(MODE_KEY(p.id),JSON.stringify({version:1,sheetId:id,mode:"d1",
    verifiedAt:null,actor:p.user}),{httpMetadata:{contentType:"application/json"}});
   return success({sheetId:id,vinculado:true,mode:"d1"});
  }
  if(!options.sheetId)return errorResponse("Planilha ainda não provisionada para esta transportadora.",409);
  if(path==="status"&&request.method==="GET"){
   let remote=null,warning="";
   try{remote=await callScript(conf,p.id,options.sheetId,"health",ctx);}
   catch(e){warning=String(e.message||e);}
   return success({sheetId:options.sheetId,mode:options.mode,
    verifiedAt:options.verifiedAt||null,ready:Boolean(remote),
    origem:await d1Fingerprint(db,p.id),
    destino:remote?{count:remote.count,fingerprint:remote.fingerprint,
     anexos:remote.anexos,mensagens:remote.mensagens,historico:remote.historico}:null,
    aviso:warning||null});
  }
  if(path==="importar"&&request.method==="POST"){
   if(options.mode==="sheets")return errorResponse("Migração encerrada: Google Sheets já está ativo.",409);
   const body=await request.json().catch(()=>({}));
   const offset=Number(body.offset||0);
   if(!Number.isInteger(offset)||offset<0||offset>200000)return errorResponse("Offset inválido.",400);
   await callScript(conf,p.id,options.sheetId,"health",ctx);
   const data=await db.prepare("SELECT * FROM portal_pedidos_tickets WHERE tenant_id=? ORDER BY id LIMIT 20 OFFSET ?").bind(p.id,offset).all();
   const records=data.results||[];
   const ids=records.map(x=>x.id);
   const meta=await d1Fingerprint(db,p.id);
   if(!ids.length)return success({importados:0,nextOffset:null,total:meta.count});
   const binds=ids.map(()=>"?").join(",");
   const docs=await db.prepare("SELECT id,tenant_id,ticket_id,COALESCE(NULLIF(tipo_anexo,''),slot) AS slot,drive_id,nome,mime,bytes,criado_em FROM portal_pedidos_docs WHERE tenant_id=? AND ticket_id IN ("+binds+")").bind(p.id,...ids).all();
   const messages=await db.prepare("SELECT * FROM portal_pedidos_messages WHERE tenant_id=? AND ticket_id IN ("+binds+")").bind(p.id,...ids).all();
   const history=await db.prepare("SELECT * FROM portal_pedidos_history WHERE tenant_id=? AND ticket_id IN ("+binds+")").bind(p.id,...ids).all();
   // ticketView deve ser normalizado no controller, antes de chamar este serviço.
   const chamados=records.map(x=>({
    id:x.id,protocolo:x.protocolo,numero:x.numero,tipoSolicitacao:x.categoria_chamado||x.tipo_solicitacao,
    status:x.status,solicitante:x.solicitante_id,nomeSolicitante:x.nome_solicitante,
    executor:x.executor_id||"",numeroPedidoSistema:x.numero_pedido_sistema||"",
    motivo:x.motivo||"",criadoEm:x.criado_em,atualizadoEm:x.atualizado_em,enviadoEm:x.enviado_em||"",
    excluidoEm:x.excluido_em||"",excluidoPor:x.excluido_por||"",excluidoMotivo:x.excluido_motivo||"",
    ...Object.fromEntries(Object.entries({
     email:"email",telefoneWhats:"telefone_whats",unidadeEmbarque:"unidade_embarque",numeroPedidoOC:"numero_pedido_oc",
     nfeManifestada:"nfe_manifestada",tomadorCnpj:"tomador_cnpj",coletaIe:"coleta_ie",
     entregaCnpj:"entrega_cnpj",entregaIe:"entrega_ie",freteEmpresa:"frete_empresa",
     freteMotorista:"frete_motorista",adiantamentoPct:"adiantamento_pct",icms:"icms",
     produto:"produto",especie:"especie",tag:"tag",obs:"obs",
     coordenadasColeta:"coordenadas_coleta",coordenadasEntrega:"coordenadas_entrega"
    }).map(([dst,src])=>[dst,x[src]||""])),
    dadosEspecificos:(()=>{try{return JSON.parse(x.dados_especificos_json||"{}");}catch{return {};}})()
   }));
   const result=await callScript(conf,p.id,options.sheetId,"import",ctx,{
    chamados,anexos:docs.results||[],mensagens:messages.results||[],historico:history.results||[]});
   return success({importados:result.importados||0,nextOffset:records.length===20?offset+records.length:null,total:meta.count});
  }
  if(path==="ativar"&&request.method==="POST"){
   if(options.mode==="sheets")return success({mode:"sheets",alreadyActive:true});
   const d1=await d1Fingerprint(db,p.id);
   const sheet=await callScript(conf,p.id,options.sheetId,"health",ctx);
   const inconsistent=d1.count!==Number(sheet.count)||d1.fingerprint!==sheet.fingerprint||
    ["anexos","mensagens","historico"].some(name=>!sheet[name]||
      d1[name].count!==Number(sheet[name].count)||d1[name].fingerprint!==sheet[name].fingerprint);
   if(inconsistent)
    return errorResponse("Migração incompleta: chamados, anexos, mensagens ou histórico ainda divergem. Importe novamente e confira antes de ativar.",409);
   const verifiedAt=new Date().toISOString();
   await env.TENANT_BRANDS.put(MODE_KEY(p.id),JSON.stringify({
    version:1,sheetId:options.sheetId,mode:"sheets",verifiedAt,actor:p.user
   }),{httpMetadata:{contentType:"application/json"}});
   return success({mode:"sheets",sheetId:options.sheetId,verifiedAt,importados:d1.count});
  }
  return errorResponse("Operação de migração inválida.",405);
 }catch(error){return fail(error);}
}
export async function sheetsGateway(request,p,view,flags,executor,kinds,conf,options,normalizedFields){
 const url=new URL(request.url);
 const path=url.pathname.replace(/^\/v1\/abertura-pedidos\/?/,"");
 const ctx=scope(p,view,kinds,executor,flags);
 let action,data={},ticketId="";
 try{
  if(!path&&request.method==="GET")action="list";
  else if(path==="historico"&&request.method==="GET"){
   action="historico";
   data=Object.fromEntries(["pagina","tipo","etapa","escopo","removidos","busca"].map(k=>[k,url.searchParams.get(k)||""]));
  }
  else if(!path&&request.method==="POST"){
   if(view==="execucao")return errorResponse("Ação exclusiva do solicitante.",403);
   action="create";data={fields:normalizedFields(await request.json(),p.user)};
  }else{
   const match=path.match(/^([a-f0-9-]{36})(?:\/(anexos(?:\/([a-f0-9-]{36}))?|dados|enviar|assumir|situacao|mensagens|ocultar|restaurar|corrigir))?$/);
   if(!match)return errorResponse("Rota não encontrada.",404);
   ticketId=match[1];const sub=match[2]||"";
   const routes={"":"get","dados":"updateDraft","enviar":"enviar","assumir":"assumir",
    "situacao":"situacao","mensagens":"mensagens","ocultar":"ocultar","restaurar":"restaurar","corrigir":"corrigir"};
   if(sub==="anexos"&&request.method==="POST"){action="upload";data=await request.json();
    if(!SLOTS.has(data?.slot)||!MIMES.has(data?.mime)||
       typeof data?.base64!=="string"||data.base64.length>8500000)
     return errorResponse("Arquivo inválido.",400);
   }else if(sub.startsWith("anexos/")&&request.method==="GET"){action="download";data={docId:match[3]};}
   else if(request.method==="GET"&&sub==="")action="get";
   else if(request.method==="POST"&&Object.hasOwn(routes,sub)){
    action=routes[sub];
    data=await request.json();
    if(sub==="dados"){data={fields:normalizedFields(data,p.user)};}
   }
   else return errorResponse("Método não permitido.",405);
  }
  const result=await callScript(conf,p.id,options.sheetId,action,ctx,data,ticketId);
  if(action==="download"){
   if(typeof result.base64!=="string"||result.base64.length>Math.ceil(MAX_FILE/3)*4+8)
    return errorResponse("Anexo inválido.",502);
   const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));
   if(bytes.length>MAX_FILE)return errorResponse("Anexo acima do limite.",413);
   if(!MIMES.has(result.mime))return errorResponse("Tipo de anexo não permitido.",415);
   return new Response(bytes,{headers:{"Content-Type":result.mime,"Cache-Control":"private,no-store",
    "Content-Disposition":'attachment; filename="documento"',"X-Content-Type-Options":"nosniff"}});
  }
  // Os IDs da planilha não são acessíveis ao browser, só dados autorizados pelo script.
  const {ok,...payload}=result;
  return success(payload,action==="create"?201:200);
 }catch(error){return fail(error,503);}
}
