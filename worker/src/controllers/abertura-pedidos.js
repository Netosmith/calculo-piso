import {profileAllowsModule} from "../services/profile-access.js";
import {ALLOWED_ORIGINS} from "../config.js";
import {errorResponse,success} from "../utils/response.js";
import {tenantSession,hasTenantSessionCookie} from "../services/tenant-auth.js";
import {ownerSupportPrincipal} from "../services/tenant-owner-support.js";
import {getSession,readSessionId} from "../services/session.js";
import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";
import {readNovaFrotaModules} from "../services/nova-frota-modules.js";

const SLUG=/^[a-z][a-z0-9-]{2,63}$/;
const FILEID=/^[A-Za-z0-9_-]{15,160}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const MAX_FILE=6*1024*1024;
const SLOTS=new Set(["nota","nota_coleta","liberacao","rota_pedagio","tabela_antt"]);
export const TIPOS_SOLICITACAO=Object.freeze({
 PEDIDO:"Abertura de pedido",
 CORRECAO_PEDIDO:"Correção de pedido",
 CTE_COMPLEMENTAR:"CT-e complementar",
 CARTA_CORRECAO:"Carta de correção"
});
const EXTRA_FIELDS=Object.freeze({
 CORRECAO_PEDIDO:[["numeroPedidoCorrecao",120],["textoCorrecao",1800]],
 CTE_COMPLEMENTAR:[["numeroCte",120],["descricaoComplemento",1800]],
 CARTA_CORRECAO:[["documentoTipo",8],["numeroDocumento",120],["textoCarta",1800]]
});


const clean=(value,max=160)=>typeof value==="string"&&value.trim().length>0&&value.trim().length<=max&&!/[\u0000-\u001f\u007f]/.test(value)?value.trim():null;
// Texto livre permite parágrafos mas recusa caracteres de controle inválidos.
const cleanMultiline=(value,max)=>typeof value==="string"&&value.trim().length>0&&
 value.trim().length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
 ? value.trim().replace(/\r\n?/g,"\n"):null;
const err=(m,c=400)=>errorResponse(m,c);
const driveConfigKey=id=>"tenant/"+id+"/private/cadastro-drive-v1.json";
const nfFlagsKey="tenant/nova-frota/private/optional-modules-v1.json";
async function bodyJson(req,max=24000){
 if((req.headers.get("Content-Type")||"").split(";")[0].trim()!=="application/json")throw Error("Envie JSON.");
 const raw=await req.text();if(raw.length>max)throw Error("Requisição muito grande.");
 const data=JSON.parse(raw);
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Dados inválidos.");
 return data;
}
function originAllowed(req){
 const origin=req.headers.get("Origin")||"",site=req.headers.get("Sec-Fetch-Site");
 return ALLOWED_ORIGINS.has(origin)&&(!site||["same-site","same-origin"].includes(site));
}
async function principalFor(req,env){
 const supported=req.headers.get("X-Portal-Support-Tenant");
 if(supported){
  if(!SLUG.test(supported)||supported===LEGACY_NOVA_FROTA.id)return null;
  const s=await ownerSupportPrincipal(req,env,supported);
  return s?{id:s.tenant_id,user:s.user_id,role:s.role}:null;
 }
 if(hasTenantSessionCookie(req)){
  const s=await tenantSession(env.TENANTS_DB,req);
  return s?{id:s.tenant_id,user:s.user_id,role:s.role}:null;
 }
 const s=await getSession(env,readSessionId(req));
 return s&&tenantIdForLegacySession(s)===LEGACY_NOVA_FROTA.id?
   {id:LEGACY_NOVA_FROTA.id,user:s.usuario,role:s.perfil}:null;
}
async function flagsFor(env,id){
 if(id===LEGACY_NOVA_FROTA.id){
  const enabled=new Set((await readNovaFrotaModules(env)).modules);
  return {solicitar:enabled.has("solicitacao-pedidos"),executar:enabled.has("execucao-pedidos")};
 }
 const r=await env.TENANTS_DB.prepare("SELECT module_key FROM portal_tenant_modules WHERE tenant_id=? AND enabled=1 AND module_key IN ('solicitacao-pedidos','execucao-pedidos')").bind(id).all();
 const m=new Set((r.results||[]).map(x=>x.module_key));
 return {solicitar:m.has("solicitacao-pedidos"),executar:m.has("execucao-pedidos")};
}
async function driveConfig(env,id){
 const obj=await env.TENANT_BRANDS?.get(driveConfigKey(id));
 if(!obj)return null;
 const x=await obj.json();
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,250}\/exec$/.test(x.url||"")||
    !FILEID.test(x.pasta||"")||typeof x.chave!=="string"||x.chave.length<24)return null;
 return x;
}
function isExecutor(p,conf){
 const role=String(p.role||"").toUpperCase();
 return role!=="PISO"&&(["ADMINISTRADOR","GOADM"].includes(role)||
  (conf?.executores||[]).includes(String(p.user).toUpperCase()));
}
async function drive(conf,tenantId,action,data){
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),95000);
 try{
  const r=await fetch(conf.url,{method:"POST",redirect:"follow",signal:ctl.signal,
   headers:{"Content-Type":"text/plain;charset=UTF-8",Accept:"application/json"},
   body:JSON.stringify({key:conf.chave,tenant:tenantId,folderId:conf.pasta,action,...data})});
  if(!r.ok)throw Error("O Apps Script não respondeu ao envio.");
  const raw=await r.text();if(raw.length>12000000)throw Error("Resposta do Google Drive muito grande.");
  let value;try{value=JSON.parse(raw)}catch{throw Error("Resposta inválida. Confira a versão implantada do Apps Script.");}
  if(value?.ok!==true){
   if(value?.error==="Não autorizado.")throw Error("Chave, identificador da empresa ou pasta divergente no Apps Script.");
   if(value?.error==="Arquivo inválido.")throw Error("Atualize o Apps Script para os anexos de Abertura de Pedidos.");
   throw Error("O Apps Script recusou o arquivo. Verifique permissões da pasta e a implantação.");
  }
  return value;
 }finally{clearTimeout(timeout);}
}
const FIELDS=[["email",150,0],["nomeSolicitante",140,1],["telefoneWhats",65,1],["unidadeEmbarque",140,1],["numeroPedidoOC",120,1],["nfeManifestada",140,1],["tomadorCnpj",140,1],["coletaIe",140,1],["entregaCnpj",140,1],["entregaIe",140,1],["freteEmpresa",80,1],["freteMotorista",80,1],["adiantamentoPct",50,1],["icms",80,0],["produto",140,1],["especie",140,1],["tag",140,1],["obs",2200,0],["coordenadasColeta",160,0],["coordenadasEntrega",160,0]];
const COLUMNS={"email":"email","nomeSolicitante":"nome_solicitante","telefoneWhats":"telefone_whats","unidadeEmbarque":"unidade_embarque","numeroPedidoOC":"numero_pedido_oc","nfeManifestada":"nfe_manifestada","tomadorCnpj":"tomador_cnpj","coletaIe":"coleta_ie","entregaCnpj":"entrega_cnpj","entregaIe":"entrega_ie","freteEmpresa":"frete_empresa","freteMotorista":"frete_motorista","adiantamentoPct":"adiantamento_pct","icms":"icms","produto":"produto","especie":"especie","tag":"tag","obs":"obs","coordenadasColeta":"coordenadas_coleta","coordenadasEntrega":"coordenadas_entrega"};
export function normalizedFields(b,requester=""){
 const kind=String(b.tipoSolicitacao||"PEDIDO").trim().toUpperCase();
 if(!Object.hasOwn(TIPOS_SOLICITACAO,kind))throw Error("Tipo de solicitação inválido.");
 const result={tipoSolicitacao:kind,dadosEspecificos:{}};
 for(const [name,max,required] of FIELDS){
  const input=b[name];
  if(input===undefined||input===null||input===""){
   if(required&&kind==="PEDIDO")throw Error("Campo obrigatório: "+name);
   result[name]="";continue;
  }
  const value=clean(input,max);if(!value)throw Error("Campo inválido: "+name);
  result[name]=value;
 }
 if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw Error("E-mail inválido.");
 if(kind!=="PEDIDO"){
  const extras=b.dadosEspecificos;
  if(!extras||typeof extras!=="object"||Array.isArray(extras))throw Error("Dados específicos da solicitação não informados.");
  for(const [key,max] of EXTRA_FIELDS[kind]){
   const value=["textoCorrecao","descricaoComplemento","textoCarta"].includes(key)
    ? cleanMultiline(extras[key],max) : clean(extras[key],max);
   if(!value)throw Error("Campo obrigatório ou inválido: "+key);
   result.dadosEspecificos[key]=value;
  }
  if(kind==="CARTA_CORRECAO"&&!["CTE","MDFE"].includes(result.dadosEspecificos.documentoTipo))
   throw Error("Selecione CT-e ou MDF-e.");
  result.nomeSolicitante=result.nomeSolicitante||requester;
  if(kind==="CORRECAO_PEDIDO")result.numeroPedidoOC=result.dadosEspecificos.numeroPedidoCorrecao;
 }
 return result;
}
const ticketView=x=>{
 let extras={};try{extras=JSON.parse(x.dados_especificos_json||"{}");}catch{extras={};}
 const tipo=Object.hasOwn(TIPOS_SOLICITACAO,x.tipo_solicitacao)?x.tipo_solicitacao:"PEDIDO";
 const item={id:x.id,protocolo:x.protocolo,numero:x.numero,solicitante:x.solicitante_id,executor:x.executor_id,
  tipoSolicitacao:tipo,dadosEspecificos:extras,
  status:x.status,motivo:x.motivo||"",numeroPedidoSistema:x.numero_pedido_sistema||"",
  criadoEm:x.criado_em,atualizadoEm:x.atualizado_em,enviadoEm:x.enviado_em};
 for(const [k,col] of Object.entries(COLUMNS))item[k]=x[col]||"";
 return item;
};
const hist=(db,p,t,status,message)=>db.prepare("INSERT INTO portal_pedidos_history(id,tenant_id,ticket_id,autor_id,status,descricao) VALUES(?,?,?,?,?,?)")
 .bind(crypto.randomUUID(),p.id,t,p.user,status,message||"");
async function ticket(db,p,id){return db.prepare("SELECT * FROM portal_pedidos_tickets WHERE id=? AND tenant_id=?").bind(id,p.id).first();}
export async function aberturaPedidosController(req,env){
 if(!env.TENANTS_DB)return err("Banco de Abertura de Pedidos indisponível.",503);
 const p=await principalFor(req,env);
 if(!p)return err("Sessão inválida ou expirada.",401);
 const db=env.TENANTS_DB,url=new URL(req.url);
 const path=url.pathname.slice("/v1/abertura-pedidos".length),view=url.searchParams.get("visao")||"solicitante";
 if(!["solicitante","execucao"].includes(view))return err("Visão inválida.");
 if(req.method!=="GET"&&!originAllowed(req))return err("Origem não autorizada.",403);
 const flags=await flagsFor(env,p.id),conf=await driveConfig(env,p.id);
 flags.solicitar=flags.solicitar&&await profileAllowsModule(env,p.id,p.role,"solicitacao-pedidos");
 flags.executar=flags.executar&&await profileAllowsModule(env,p.id,p.role,"execucao-pedidos");
 const executor=flags.executar&&isExecutor(p,conf),execView=view==="execucao";
 if(path==="/config"&&req.method==="GET")
  return success({empresa:p.id,solicitacoesHabilitadas:flags.solicitar,execucaoHabilitada:flags.executar,executor,armazenamentoConfigurado:!!conf});
 if(execView&&!executor)return err("Execução de Abertura de Pedidos não liberada para este usuário.",403);
 if(!execView&&!flags.solicitar)return err("Solicitação de Abertura de Pedidos não liberada nesta transportadora.",403);
 try{
  if((path===""||path==="/")&&req.method==="GET"){
   const list=execView?
    await db.prepare("SELECT * FROM portal_pedidos_tickets WHERE tenant_id=? AND status<>'RASCUNHO' ORDER BY atualizado_em DESC,id DESC LIMIT 500").bind(p.id).all():
    await db.prepare("SELECT * FROM portal_pedidos_tickets WHERE tenant_id=? AND solicitante_id=? ORDER BY atualizado_em DESC,id DESC LIMIT 500").bind(p.id,p.user).all();
   return success({chamados:(list.results||[]).map(ticketView),executor});
  }
  if((path===""||path==="/")&&req.method==="POST"){
    if(execView)return err("Solicitação exclusiva do solicitante.",403);
    const b=await bodyJson(req,12000),values=normalizedFields(b,p.user),id=crypto.randomUUID();
    const protocolo="PED-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+id.slice(0,8).toUpperCase();
    const columns=[...Object.values(COLUMNS),"tipo_solicitacao","dados_especificos_json"],keys=Object.keys(COLUMNS);
    const params=[id,p.id,protocolo,p.user,...keys.map(k=>values[k]),values.tipoSolicitacao,JSON.stringify(values.dadosEspecificos)];
    await db.prepare("INSERT INTO portal_pedidos_tickets(id,tenant_id,protocolo,solicitante_id,"+
      columns.join(",")+") VALUES("+params.map(()=>"?").join(",")+")").bind(...params).run();
    const row=await ticket(db,p,id);
    await hist(db,p,id,"RASCUNHO",TIPOS_SOLICITACAO[values.tipoSolicitacao]+" criada").run();
    return success({chamado:ticketView(row)},201);
   }
   const match=path.match(/^\/([a-f0-9-]{36})(?:\/(anexos(?:\/([a-f0-9-]{36}))?|dados|enviar|assumir|situacao|mensagens))?$/);
  if(!match)return err("Rota de Abertura de Pedidos inexistente.",404);
  const id=match[1],action=match[2]||"",row=await ticket(db,p,id);
  if(!row)return err("Chamado não encontrado.",404);
  const owner=row.solicitante_id===p.user;
  if(execView?!executor:!owner)return err("Chamado não autorizado.",403);
  if(row.status==="RASCUNHO"&&!owner)return err("Rascunho privado.",403);
  if(action===""&&req.method==="GET"){
   const [docs,messages,history]=await Promise.all([
    db.prepare("SELECT id,slot,nome,mime,bytes,criado_em FROM portal_pedidos_docs WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id").bind(p.id,id).all(),
    db.prepare("SELECT autor_id,texto,criado_em FROM portal_pedidos_messages WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id LIMIT 500").bind(p.id,id).all(),
    db.prepare("SELECT autor_id,status,descricao,criado_em FROM portal_pedidos_history WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id").bind(p.id,id).all()
   ]);
   return success({chamado:ticketView(row),anexos:docs.results||[],mensagens:messages.results||[],historico:history.results||[],executor});
  }
  if(action==="dados"&&req.method==="POST"){
    if(execView||!owner||row.status!=="RASCUNHO")
     return err("Somente o autor pode editar o rascunho de um pedido.",403);
    const b=await bodyJson(req,12000),values=normalizedFields(b,p.user);
    const columns=[...Object.values(COLUMNS),"tipo_solicitacao","dados_especificos_json"],keys=Object.keys(COLUMNS);
    const changed=await db.prepare("UPDATE portal_pedidos_tickets SET "+
      columns.map(c=>c+"=?").join(",")+
      ",atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND solicitante_id=? AND status='RASCUNHO'")
     .bind(...keys.map(k=>values[k]),values.tipoSolicitacao,JSON.stringify(values.dadosEspecificos),id,p.id,p.user).run();
    if(changed.meta?.changes!==1)return err("Não foi possível atualizar o rascunho.",409);
    return success({atualizado:true});
   }
   if(action==="anexos"&&req.method==="POST"){
   if(!conf)return err("Google Drive desta transportadora não configurado.",503);
   const b=await bodyJson(req,8500000);
   if(!SLOTS.has(b.slot)||!MIME.has(b.mime)||!clean(b.nome,160)||typeof b.base64!=="string"||
      b.base64.length>Math.ceil(MAX_FILE/3)*4+8||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64))return err("Anexo inválido. Envie PDF, JPG, PNG ou WebP de até 6 MB.");
   const size=Math.floor(b.base64.length*3/4)-(b.base64.endsWith("==")?2:b.base64.endsWith("=")?1:0);
   if(!size||size>MAX_FILE)return err("Arquivo acima de 6 MB.",413);
   if(!owner||!["RASCUNHO","PENDENTE"].includes(row.status))
     return err("Somente solicitante pode anexar no rascunho ou pendência.",403);
    const saved=await drive(conf,p.id,"upload",{ticketId:id,slot:b.slot,nome:b.nome,mime:b.mime,base64:b.base64});
   if(!FILEID.test(saved.fileId||""))return err("Google Drive não confirmou o arquivo.",502);
   await db.batch([
    db.prepare("INSERT INTO portal_pedidos_docs(id,tenant_id,ticket_id,slot,drive_id,nome,mime,bytes) VALUES(?,?,?,?,?,?,?,?)")
     .bind(crypto.randomUUID(),p.id,id,b.slot,saved.fileId,b.nome,b.mime,size),
    hist(db,p,id,row.status,"Documento anexado: "+b.slot)
   ]);
   return success({anexado:true,slot:b.slot});
  }
  if(action==="enviar"&&req.method==="POST"){
   if(!owner||row.status!=="RASCUNHO")return err("Somente o solicitante pode enviar seu rascunho.",403);
   if(row.tipo_solicitacao==="CTE_COMPLEMENTAR"){
    const lib=await db.prepare("SELECT id FROM portal_pedidos_docs WHERE tenant_id=? AND ticket_id=? AND slot='liberacao' LIMIT 1").bind(p.id,id).first();
    if(!lib)return err("Anexe a liberação do cliente antes de enviar o CT-e complementar.",409);
   }
   const update=await db.prepare("UPDATE portal_pedidos_tickets SET status='FILA',enviado_em=CURRENT_TIMESTAMP,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='RASCUNHO'").bind(id,p.id).run();
   if(update.meta?.changes!==1)return err("Chamado já enviado.",409);
   await hist(db,p,id,"FILA","Enviado para a fila de execução").run();
   // A descrição da correção já chega como primeira mensagem do chat.
   if(row.tipo_solicitacao==="CORRECAO_PEDIDO"){
    let extras={};try{extras=JSON.parse(row.dados_especificos_json||"{}");}catch{}
    const message=cleanMultiline(extras.textoCorrecao,1800);
    if(message)await db.prepare("INSERT INTO portal_pedidos_messages(id,tenant_id,ticket_id,autor_id,texto) VALUES(?,?,?,?,?)")
     .bind(crypto.randomUUID(),p.id,id,p.user,message).run();
   }
   return success({numero:row.numero,status:"FILA"});
  }
  if(action==="assumir"&&req.method==="POST"){
   if(!execView||!executor)return err("Ação exclusiva de executores.",403);
   const update=await db.prepare("UPDATE portal_pedidos_tickets SET status='ANDAMENTO',executor_id=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='FILA'")
    .bind(p.user,id,p.id).run();
   if(update.meta?.changes!==1)return err("Chamado já assumido por outro executor.",409);
   await hist(db,p,id,"ANDAMENTO","Chamado assumido").run();
   return success({status:"ANDAMENTO"});
  }
  if(action==="situacao"&&req.method==="POST"){
   if(!execView||!executor||row.executor_id!==p.user)return err("Apenas o executor responsável pode alterar a situação.",403);
   if(!["ANDAMENTO","PENDENTE"].includes(row.status))return err("Chamado já finalizado ou ainda na fila.",409);
   const b=await bodyJson(req,2300),status=String(b.status||"").toUpperCase(),motivo=clean(b.motivo,1800)||"";
   if(!["ANDAMENTO","PENDENTE","FINALIZADO"].includes(status))return err("Situação inválida.");
   if(status==="PENDENTE"&&motivo.length<8)return err("Informe o motivo detalhado da pendência.");
   const numeroPedidoSistema=clean(b.numeroPedidoSistema,120);
    if(status==="FINALIZADO"&&(row.tipo_solicitacao||"PEDIDO")==="PEDIDO"&&!numeroPedidoSistema)
     return err("Informe o número do pedido no sistema antes de finalizar.",409);
    const update=await db.prepare("UPDATE portal_pedidos_tickets SET status=?,motivo=?,numero_pedido_sistema=CASE WHEN ?='FINALIZADO' THEN ? ELSE numero_pedido_sistema END,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND executor_id=? AND status IN ('ANDAMENTO','PENDENTE')")
    .bind(status,motivo,status,status==="FINALIZADO"?numeroPedidoSistema:"",id,p.id,p.user).run();
   if(update.meta?.changes!==1)return err("Chamado alterado por outra operação.",409);
   const statements=[hist(db,p,id,status,motivo||"Situação alterada para "+status)];
   if(motivo)statements.push(db.prepare("INSERT INTO portal_pedidos_messages(id,tenant_id,ticket_id,autor_id,texto) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),p.id,id,p.user,motivo));
   await db.batch(statements);
   return success({status,numeroPedidoSistema:status==="FINALIZADO"?numeroPedidoSistema:null});
  }
  if(action==="mensagens"&&req.method==="POST"){
   if(row.status==="RASCUNHO"||row.status==="FINALIZADO")return err("Chat indisponível nesta situação.",409);
    if(execView&&row.executor_id!==p.user)return err("Somente executor responsável pode responder.",403);
   const b=await bodyJson(req,2400),message=clean(b.texto,1800);
   if(!message)return err("Mensagem vazia ou grande demais.");
   await db.prepare("INSERT INTO portal_pedidos_messages(id,tenant_id,ticket_id,autor_id,texto) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),p.id,id,p.user,message).run();
   return success({enviado:true});
  }
  if(action==="anexos/"+match[3]&&req.method==="GET"){
   if(!conf)return err("Google Drive não configurado.",503);
   const doc=await db.prepare("SELECT * FROM portal_pedidos_docs WHERE tenant_id=? AND ticket_id=? AND id=?").bind(p.id,id,match[3]).first();
   if(!doc)return err("Anexo não encontrado.",404);
   const loaded=await drive(conf,p.id,"download",{ticketId:id,fileId:doc.drive_id});
   if(typeof loaded.base64!=="string"||loaded.base64.length>8500000)throw Error("Download inválido.");
   const bytes=Uint8Array.from(atob(loaded.base64),c=>c.charCodeAt(0));
   if(bytes.length>MAX_FILE)return err("Arquivo grande demais.",413);
   return new Response(bytes,{headers:{"Content-Type":doc.mime,"Cache-Control":"private,no-store",
    "Content-Disposition":"attachment; filename=\"documento\"","X-Content-Type-Options":"nosniff"}});
  }
  return err("Operação não permitida.",405);
 }catch(error){
  console.warn("[ABERTURA PEDIDOS] Falha operacional",{type:error?.name||"Error"});
  const message=String(error?.message||"");
  if(message==="Envie JSON."||message==="Dados inválidos."||message==="E-mail inválido."||
     message==="Tipo de solicitação inválido."||message==="Dados específicos da solicitação não informados."||
     message==="Selecione CT-e ou MDF-e."||
     message.startsWith("Campo obrigatório:")||message.startsWith("Campo inválido:")||
     message.startsWith("Campo obrigatório ou inválido:"))
   return err(message,400);
  return err("Não foi possível concluir a operação. "+
    (message.includes("Apps Script")?"Verifique o Apps Script.":"Verifique a integração e tente novamente."),503);
 }
}
