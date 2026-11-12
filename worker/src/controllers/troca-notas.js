import {profileAllowsModule} from "../services/profile-access.js";
import {ALLOWED_ORIGINS} from "../config.js";
import {errorResponse,success} from "../utils/response.js";
import {tenantSession,hasTenantSessionCookie} from "../services/tenant-auth.js";
import {ownerSupportPrincipal} from "../services/tenant-owner-support.js";
import {getSession,readSessionId} from "../services/session.js";
import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";
import {readNovaFrotaModules} from "../services/nova-frota-modules.js";
import {sharedClientNamesController} from "../services/shared-client-catalog.js";
import {readTenantIntegration} from "../services/tenant-integration.js";
import {callAppsScript} from "../services/appscript.js";

const SLUG=/^[a-z][a-z0-9-]{2,63}$/;
const UUID=/^[a-f0-9-]{36}$/;
const FILEID=/^[A-Za-z0-9_-]{15,160}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const MAX_FILE=6*1024*1024;
const SLOTS=new Set(["nota_origem","laudo","ticket_pesagem","ordem","nf_trocada"]);
const REQUIRED=["nota_origem","laudo","ticket_pesagem","ordem"];
const STATUSES=new Set(["FILA","ANDAMENTO","PENDENTE","TROCADA"]);
const clean=(value,max=160)=>typeof value==="string"&&value.trim().length>0&&value.trim().length<=max&&!/[\u0000-\u001f\u007f]/.test(value)?value.trim():null;
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
  return s?{id:s.tenant_id,user:s.user_id,role:s.role,ownerSupport:true}:null;
 }
 if(hasTenantSessionCookie(req)){
  const s=await tenantSession(env.TENANTS_DB,req);
  return s?{id:s.tenant_id,user:s.user_id,role:s.role}:null;
 }
 const s=await getSession(env,readSessionId(req));
 return s&&tenantIdForLegacySession(s)===LEGACY_NOVA_FROTA.id?
   {id:LEGACY_NOVA_FROTA.id,user:s.usuario,role:s.perfil,
    ownerSupport:Boolean(env.SUPER_ADMIN_USER)&&
      String(s.usuario||"").trim().toUpperCase()===String(env.SUPER_ADMIN_USER).trim().toUpperCase()
   }:null;
}
async function flagsFor(env,id){
 if(id===LEGACY_NOVA_FROTA.id){
  const enabled=new Set((await readNovaFrotaModules(env)).modules);
  return {solicitar:enabled.has("solicitacao-troca-notas"),executar:enabled.has("execucao-troca-notas")};
 }
 const r=await env.TENANTS_DB.prepare("SELECT module_key FROM portal_tenant_modules WHERE tenant_id=? AND enabled=1 AND module_key IN ('solicitacao-troca-notas','execucao-troca-notas')").bind(id).all();
 const m=new Set((r.results||[]).map(x=>x.module_key));
 return {solicitar:m.has("solicitacao-troca-notas"),executar:m.has("execucao-troca-notas")};
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
function getRows(data,depth=0){
 if(Array.isArray(data))return data;
 if(!data||typeof data!=="object"||depth>6)return [];
 for(const key of ["data","rows","items","filiais","clientes","result"]){
  if(Object.hasOwn(data,key)){
   const rows=getRows(data[key],depth+1);
   if(rows.length||Array.isArray(data[key]))return rows;
  }
 }
 return [];
}
async function loadCatalog(env,tenantId){
 const clientsResponse=await sharedClientNamesController(env);
 if(!clientsResponse.ok)throw Error("Catálogo de clientes temporariamente indisponível.");
 const clientsData=await clientsResponse.json();
 const clientes=[...new Set(getRows(clientsData.clientes).map(row=>clean(row?.cliente,140)).filter(Boolean))].slice(0,2500);
 if(!clientes.length)throw Error("Não há clientes ativos cadastrados.");
 let provider={...env};
 let uf="GO";
 if(tenantId!==LEGACY_NOVA_FROTA.id){
  const cfg=await readTenantIntegration(env,tenantId);
  if(!cfg||!cfg.enabled)throw Error("Planilha da transportadora não está vinculada para consultar filiais.");
  provider={...env,APPS_SCRIPT_URL:cfg.scriptUrl,PORTAL_KEY:cfg.gatewayKey};
  uf=cfg.estado;
 }
 const reply=await callAppsScript(provider,{
  action:"portal_gateway",method:"POST",
  params:{module:"cadastros",action:"read",payload:{resource:"filiais",operation:"list"},
   auth:{usuario:"PORTAL-NOTAS",perfil:"ADMINISTRADOR",estado:uf,estados:[uf]}}
 });
 if(!reply?.ok)throw Error("Não foi possível consultar as filiais cadastradas.");
 const filiais=[...new Set(getRows(reply.data).filter(x=>x&&typeof x==="object").filter(x=>{
  const active=String(x.ativo??x.Ativo??"SIM").trim().toUpperCase();
  return !["NÃO","NAO","FALSE","0","INATIVO"].includes(active);
 }).map(x=>clean(x.filial??x.Filial??x.nome,140)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 if(!filiais.length)throw Error("Não há filiais ativas na planilha desta transportadora.");
 return {clientes,filiais};
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
   if(value?.error==="Arquivo inválido.")throw Error("O Apps Script precisa aceitar os novos tipos de documentos de Troca de Notas. Atualize a implantação.");
   throw Error("O Apps Script recusou o arquivo. Verifique permissões da pasta e a implantação.");
  }
  return value;
 }finally{clearTimeout(timeout);}
}
const ticketView=x=>({id:x.id,protocolo:x.protocolo,numero:x.numero,cliente:x.cliente,filial:x.filial,
 origem:x.origem,localColeta:x.local_coleta,destino:x.destino,localDescarga:x.local_descarga,
 solicitante:x.solicitante_id,executor:x.executor_id,status:x.status,motivo:x.motivo||"",
 criadoEm:x.criado_em,atualizadoEm:x.atualizado_em,enviadoEm:x.enviado_em});
const hist=(db,p,t,status,message)=>db.prepare("INSERT INTO portal_troca_history(id,tenant_id,ticket_id,autor_id,status,descricao) VALUES(?,?,?,?,?,?)")
 .bind(crypto.randomUUID(),p.id,t,p.user,status,message||"");
async function ticket(db,p,id){return db.prepare("SELECT * FROM portal_troca_tickets WHERE id=? AND tenant_id=?").bind(id,p.id).first();}
export async function trocaNotasController(req,env){
 if(!env.TENANTS_DB)return err("Banco de Troca de Notas indisponível.",503);
 const p=await principalFor(req,env);
 if(!p)return err("Sessão inválida ou expirada.",401);
 const db=env.TENANTS_DB,url=new URL(req.url);
 const path=url.pathname.slice("/v1/troca-notas".length),view=url.searchParams.get("visao")||"solicitante";
 if(!["solicitante","execucao"].includes(view))return err("Visão inválida.");
 if(req.method!=="GET"&&!originAllowed(req))return err("Origem não autorizada.",403);
 const flags=await flagsFor(env,p.id),conf=await driveConfig(env,p.id);
 flags.solicitar=flags.solicitar&&await profileAllowsModule(env,p.id,p.role,"solicitacao-troca-notas",p.ownerSupport===true);
 flags.executar=flags.executar&&await profileAllowsModule(env,p.id,p.role,"execucao-troca-notas",p.ownerSupport===true);
 const executor=flags.executar&&isExecutor(p,conf),execView=view==="execucao";
 if(path==="/config"&&req.method==="GET")
  return success({empresa:p.id,solicitacoesHabilitadas:flags.solicitar,execucaoHabilitada:flags.executar,executor,armazenamentoConfigurado:!!conf});
 if(execView&&!executor)return err("Execução de Troca de Notas não liberada para este usuário.",403);
 if(!execView&&!flags.solicitar)return err("Solicitação de Troca de Notas não liberada nesta transportadora.",403);
 try{
  if(path==="/opcoes"&&req.method==="GET"){
   const lists=await loadCatalog(env,p.id);
   return success(lists);
  }
  if((path===""||path==="/")&&req.method==="GET"){
   const list=execView?
    await db.prepare("SELECT * FROM portal_troca_tickets WHERE tenant_id=? AND status<>'RASCUNHO' ORDER BY atualizado_em DESC,id DESC LIMIT 500").bind(p.id).all():
    await db.prepare("SELECT * FROM portal_troca_tickets WHERE tenant_id=? AND solicitante_id=? ORDER BY atualizado_em DESC,id DESC LIMIT 500").bind(p.id,p.user).all();
   return success({chamados:(list.results||[]).map(ticketView),executor});
  }
  if((path===""||path==="/")&&req.method==="POST"){
   if(execView)return err("Abra a solicitação para criar um protocolo.",403);
   if(!conf)return err("Google Drive da transportadora não configurado. Acesse o Super Admin.",503);
   const b=await bodyJson(req);
   const cliente=clean(b.cliente,140),filial=clean(b.filial,140);
   const origem=clean(b.origem,160),coleta=clean(b.localColeta,200),destino=clean(b.destino,160),descarga=clean(b.localDescarga,200);
   if(!cliente||!filial||!origem||!coleta||!destino||!descarga)return err("Preencha cliente, filial, origem, coleta, destino e descarga.");
   const catalog=await loadCatalog(env,p.id);
   if(!catalog.clientes.includes(cliente)||!catalog.filiais.includes(filial))return err("Selecione cliente e filial cadastrados no Portal.",409);
   const id=crypto.randomUUID(),protocolo="TN-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+id.slice(0,8).toUpperCase();
   await db.prepare("INSERT INTO portal_troca_tickets(id,tenant_id,protocolo,solicitante_id,cliente,filial,origem,local_coleta,destino,local_descarga) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(id,p.id,protocolo,p.user,cliente,filial,origem,coleta,destino,descarga).run();
   const row=await ticket(db,p,id);
   await hist(db,p,id,"RASCUNHO","Solicitação criada").run();
   return success({chamado:ticketView(row)},201);
  }
  const match=path.match(/^\/([a-f0-9-]{36})(?:\/(anexos(?:\/([a-f0-9-]{36}))?|enviar|assumir|situacao|mensagens))?$/);
  if(!match)return err("Rota de Troca de Notas inexistente.",404);
  const id=match[1],action=match[2]||"",row=await ticket(db,p,id);
  if(!row)return err("Chamado não encontrado.",404);
  const owner=row.solicitante_id===p.user;
  if(execView?!executor:!owner)return err("Chamado não autorizado.",403);
  if(row.status==="RASCUNHO"&&!owner)return err("Rascunho privado.",403);
  if(action===""&&req.method==="GET"){
   const [docs,messages,history]=await Promise.all([
    db.prepare("SELECT id,slot,nome,mime,bytes,criado_em FROM portal_troca_docs WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id").bind(p.id,id).all(),
    db.prepare("SELECT autor_id,texto,criado_em FROM portal_troca_messages WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id LIMIT 500").bind(p.id,id).all(),
    db.prepare("SELECT autor_id,status,descricao,criado_em FROM portal_troca_history WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id").bind(p.id,id).all()
   ]);
   return success({chamado:ticketView(row),anexos:docs.results||[],mensagens:messages.results||[],historico:history.results||[],executor});
  }
  if(action==="anexos"&&req.method==="POST"){
   if(!conf)return err("Google Drive desta transportadora não configurado.",503);
   const b=await bodyJson(req,8500000);
   if(!SLOTS.has(b.slot)||!MIME.has(b.mime)||!clean(b.nome,160)||typeof b.base64!=="string"||
      b.base64.length>Math.ceil(MAX_FILE/3)*4+8||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64))return err("Anexo inválido. Envie PDF, JPG, PNG ou WebP de até 6 MB.");
   const size=Math.floor(b.base64.length*3/4)-(b.base64.endsWith("==")?2:b.base64.endsWith("=")?1:0);
   if(!size||size>MAX_FILE)return err("Arquivo acima de 6 MB.",413);
   const isFinal=b.slot==="nf_trocada";
   if(isFinal&&(!execView||row.executor_id!==p.user||!["ANDAMENTO","PENDENTE"].includes(row.status)))
    return err("Somente o executor responsável pode anexar a NF trocada.",403);
   if(!isFinal&&(!owner||!["RASCUNHO","PENDENTE"].includes(row.status)))
    return err("Somente o solicitante pode anexar documentos no rascunho ou pendência.",403);
   const saved=await drive(conf,p.id,"upload",{ticketId:id,slot:b.slot,nome:b.nome,mime:b.mime,base64:b.base64});
   if(!FILEID.test(saved.fileId||""))return err("Google Drive não confirmou o arquivo.",502);
   await db.batch([
    db.prepare("INSERT INTO portal_troca_docs(id,tenant_id,ticket_id,slot,drive_id,nome,mime,bytes) VALUES(?,?,?,?,?,?,?,?)")
     .bind(crypto.randomUUID(),p.id,id,b.slot,saved.fileId,b.nome,b.mime,size),
    hist(db,p,id,row.status,"Documento anexado: "+b.slot)
   ]);
   return success({anexado:true,slot:b.slot});
  }
  if(action==="enviar"&&req.method==="POST"){
   if(!owner||row.status!=="RASCUNHO")return err("Somente o solicitante pode enviar seu rascunho.",403);
   const docs=await db.prepare("SELECT DISTINCT slot FROM portal_troca_docs WHERE tenant_id=? AND ticket_id=?").bind(p.id,id).all();
   const have=new Set((docs.results||[]).map(x=>x.slot)),missing=REQUIRED.filter(x=>!have.has(x));
   if(missing.length)return err("Anexe os quatro documentos obrigatórios: "+missing.join(", ")+".",409);
   const update=await db.prepare("UPDATE portal_troca_tickets SET status='FILA',enviado_em=CURRENT_TIMESTAMP,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='RASCUNHO'").bind(id,p.id).run();
   if(update.meta?.changes!==1)return err("Chamado já enviado.",409);
   await hist(db,p,id,"FILA","Enviado para a fila de execução").run();
   return success({numero:row.numero,status:"FILA"});
  }
  if(action==="assumir"&&req.method==="POST"){
   if(!execView||!executor)return err("Ação exclusiva de executores.",403);
   const update=await db.prepare("UPDATE portal_troca_tickets SET status='ANDAMENTO',executor_id=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='FILA'")
    .bind(p.user,id,p.id).run();
   if(update.meta?.changes!==1)return err("Chamado já assumido por outro executor.",409);
   await hist(db,p,id,"ANDAMENTO","Chamado assumido").run();
   return success({status:"ANDAMENTO"});
  }
  if(action==="situacao"&&req.method==="POST"){
   if(!execView||!executor||row.executor_id!==p.user)return err("Apenas o executor responsável pode alterar a situação.",403);
   if(!["ANDAMENTO","PENDENTE"].includes(row.status))return err("Chamado já finalizado ou ainda na fila.",409);
   const b=await bodyJson(req,2300),status=String(b.status||"").toUpperCase(),motivo=clean(b.motivo,1800)||"";
   if(!["ANDAMENTO","PENDENTE","TROCADA"].includes(status))return err("Situação inválida.");
   if(status==="PENDENTE"&&motivo.length<8)return err("Informe o motivo detalhado da pendência.");
   if(status==="TROCADA"){
    const nf=await db.prepare("SELECT COUNT(1) AS total FROM portal_troca_docs WHERE tenant_id=? AND ticket_id=? AND slot='nf_trocada'").bind(p.id,id).first();
    if(!Number(nf?.total))return err("Anexe a NF trocada antes de concluir o chamado.",409);
   }
   const update=await db.prepare("UPDATE portal_troca_tickets SET status=?,motivo=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND executor_id=? AND status IN ('ANDAMENTO','PENDENTE')")
    .bind(status,motivo,id,p.id,p.user).run();
   if(update.meta?.changes!==1)return err("Chamado alterado por outra operação.",409);
   const statements=[hist(db,p,id,status,motivo||"Situação alterada para "+status)];
   if(motivo)statements.push(db.prepare("INSERT INTO portal_troca_messages(id,tenant_id,ticket_id,autor_id,texto) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),p.id,id,p.user,motivo));
   await db.batch(statements);
   return success({status});
  }
  if(action==="mensagens"&&req.method==="POST"){
   if(row.status==="RASCUNHO")return err("Envie a solicitação antes de conversar.",409);
   const b=await bodyJson(req,2400),message=clean(b.texto,1800);
   if(!message)return err("Mensagem vazia ou grande demais.");
   await db.prepare("INSERT INTO portal_troca_messages(id,tenant_id,ticket_id,autor_id,texto) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),p.id,id,p.user,message).run();
   return success({enviado:true});
  }
  if(action==="anexos/"+match[3]&&req.method==="GET"){
   if(!conf)return err("Google Drive não configurado.",503);
   const doc=await db.prepare("SELECT * FROM portal_troca_docs WHERE tenant_id=? AND ticket_id=? AND id=?").bind(p.id,id,match[3]).first();
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
  console.warn("[TROCA NOTAS] Falha operacional",{type:error?.name||"Error"});
  return err(["Envie JSON.","Dados inválidos."].includes(error?.message)?error.message:
    "Não foi possível concluir a operação. "+(error?.message?.includes("Apps Script")?"Verifique o Apps Script.":"Verifique a integração e tente novamente."),503);
 }
}
