import {ALLOWED_ORIGINS} from "../config.js";
import {errorResponse,success} from "../utils/response.js";
import {tenantSession,hasTenantSessionCookie} from "../services/tenant-auth.js";
import {ownerSupportPrincipal} from "../services/tenant-owner-support.js";
import {getSession,readSessionId} from "../services/session.js";
import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";

const ID=/^[a-z][a-z0-9-]{2,63}$/;
const DRIVE_URL=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,250}\/exec$/;
const DRIVE_ID=/^[A-Za-z0-9_-]{15,160}$/;
const KEY=/^[A-Za-z0-9_\-!@#$%^&*+=]{24,256}$/;
const SLOTS=new Set(["cavalo","carreta","antt","cnh","endereco","motorista","caminhao","motorista_caminhao"]);
const REQUIRED=[...SLOTS];
const STATUSES=new Set(["FILA","ANDAMENTO","AGUARDANDO APROVACAO","PENDENTE","REPROVADO","APROVADO"]);
const ETAPAS=new Set(["RECEBIMENTO","CONFERENCIA DOCUMENTAL","CONSULTA REFERENCIAS","CADASTRO SISTEMA TERCEIRO","REVISAO","CONCLUIDO"]);
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const MAX_FILE=6*1024*1024;
const clean=(v,n=150)=>typeof v==="string"&&v.trim().length>0&&v.trim().length<=n&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim():null;
const isAdmin=role=>["ADMINISTRADOR","GOADM"].includes(String(role||"").toUpperCase());
const configKey=id=>"tenant/"+id+"/private/cadastro-drive-v1.json";
function err(t,c=400){return errorResponse(t,c);}
function safeWrite(request){
 const origin=request.headers.get("Origin")||"";
 const site=request.headers.get("Sec-Fetch-Site");
 return ALLOWED_ORIGINS.has(origin)&&(!site||["same-site","same-origin"].includes(site));
}
async function json(request,max=25000){
 if((request.headers.get("Content-Type")||"").split(";")[0].trim().toLowerCase()!=="application/json")throw Error("Envie JSON.");
 const str=await request.text();
 if(str.length>max)throw Error("Dados maiores que o limite.");
 const obj=JSON.parse(str);
 if(!obj||typeof obj!=="object"||Array.isArray(obj))throw Error("Dados inválidos.");
 return obj;
}
async function configFor(env,id){
 if(!env.TENANT_BRANDS)return null;
 const item=await env.TENANT_BRANDS.get(configKey(id));
 if(!item)return null;
 const v=await item.json();
 if(!DRIVE_URL.test(v.url||"")||!KEY.test(v.chave||"")||!DRIVE_ID.test(v.pasta||""))return null;
 return v;
}
function publicConfig(conf){
 return {configurado:!!conf,executores:(conf?.executores||[]).length,drive:"Google Drive",chaveConfigurada:!!conf?.chave};
}
export async function cadastroAdminRead(env,id){
 if(!ID.test(id))return err("Empresa inválida.");
 if(id!==LEGACY_NOVA_FROTA.id){
  const found=await env.TENANTS_DB?.prepare("SELECT id FROM portal_tenants WHERE id=?").bind(id).first();
  if(!found)return err("Empresa não encontrada.",404);
 }
 const config=await configFor(env,id);
 return success({empresa:id,...publicConfig(config),pasta:config?.pasta||"",urlConfigurada:!!config?.url,executoresUsuarios:config?.executores||[]});
}
export async function cadastroAdminSave(request,env,id){
 if(!ID.test(id)||!env.TENANT_BRANDS)return err("Armazenamento não habilitado.",503);
 if(id!==LEGACY_NOVA_FROTA.id){
  const found=await env.TENANTS_DB?.prepare("SELECT id FROM portal_tenants WHERE id=?").bind(id).first();
  if(!found)return err("Empresa não encontrada.",404);
 }
 let payload;
 try{payload=await json(request,3500);}catch{return err("Configuração inválida.");}
 if(Object.keys(payload).some(k=>!["url","pasta","chave","executores"].includes(k)))return err("Campos não permitidos.");
 const previous=await configFor(env,id);
 const url=payload.url||previous?.url;
 const pasta=payload.pasta||previous?.pasta;
 const chave=payload.chave||previous?.chave;
 const executores=payload.executores===undefined?(previous?.executores||[]):payload.executores;
 if(!DRIVE_URL.test(url||"")||!DRIVE_ID.test(pasta||"")||!KEY.test(chave||"")||
    !Array.isArray(executores)||executores.length>50||
    executores.some(u=>typeof u!=="string"||!/^[A-Za-z0-9_.@-]{2,100}$/.test(u))||
    new Set(executores.map(u=>u.toUpperCase())).size!==executores.length)
   return err("Informe URL do Apps Script, pasta Drive, chave de 24+ caracteres e executores válidos.");
 await env.TENANT_BRANDS.put(configKey(id),JSON.stringify({url,pasta,chave,executores:executores.map(x=>x.toUpperCase())}),{
  httpMetadata:{contentType:"application/json"}
 });
 return success({empresa:id,...publicConfig({url,pasta,chave,executores}),pasta});
}
async function principalFor(request,env){
 // Cookie de empresa, mesmo expirado, nunca concede acesso à empresa legada.
 const scope=request.headers.get("X-Portal-Support-Tenant");
 if(scope){
  if(!ID.test(scope)||scope===LEGACY_NOVA_FROTA.id)return null;
  const o=await ownerSupportPrincipal(request,env,scope);
  return o?{tenantId:o.tenant_id,user:o.user_id,role:o.role,ownerSupport:true}:null;
 }
 if(hasTenantSessionCookie(request)){
  const s=await tenantSession(env.TENANTS_DB,request);
  return s?{tenantId:s.tenant_id,user:s.user_id,role:s.role}:null;
 }
 const s=await getSession(env,readSessionId(request));
 return s&&tenantIdForLegacySession(s)===LEGACY_NOVA_FROTA.id?
  {tenantId:LEGACY_NOVA_FROTA.id,user:s.usuario,role:s.perfil}:null;
}
function isExecutor(p,conf){
 return isAdmin(p.role)||(conf?.executores||[]).includes(String(p.user).toUpperCase());
}
async function drive(conf,tenantId,op,data={}){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),95000);
 try{
  const response=await fetch(conf.url,{
   method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8","Accept":"application/json"},
   body:JSON.stringify({key:conf.chave,tenant:tenantId,folderId:conf.pasta,action:op,...data}),
   signal:controller.signal,redirect:"follow"
  });
  if(!response.ok)throw Error("Serviço de documentos indisponível.");
  const body=await response.text();
  if(body.length>12000000)throw Error("Resposta do armazenamento excedeu o limite.");
  const result=JSON.parse(body);
  if(!result?.ok)throw Error("Google Drive recusou a operação.");
  return result;
 }finally{clearTimeout(timer);}
}
const formatTicket=r=>({
 id:r.id,protocolo:r.protocolo,motorista:r.motorista,contatoMotorista:r.contato_motorista,
 proprietario:r.proprietario,contatoProprietario:r.contato_proprietario,placas:r.placas,
 referencias:JSON.parse(r.referencias_json||"[]"),observacoes:r.observacoes,
 status:r.status,etapa:r.etapa,solicitante:r.solicitante_id,executor:r.executor_id,
 criadoEm:r.criado_em,atualizadoEm:r.atualizado_em,enviadoEm:r.enviado_em
});
async function ticket(db,p,id){return db.prepare("SELECT * FROM portal_cadastro_tickets WHERE tenant_id=? AND id=?").bind(p.tenantId,id).first();}
async function history(db,p,id,status,etapa,motivo=""){
 return db.prepare("INSERT INTO portal_cadastro_history(id,tenant_id,ticket_id,autor_id,status,etapa,motivo) VALUES(?,?,?,?,?,?,?)")
 .bind(crypto.randomUUID(),p.tenantId,id,p.user,status,etapa,motivo).run();
}
export async function cadastroController(request,env){
 if(!env.TENANTS_DB)return err("Banco de chamados ainda não provisionado.",503);
 const p=await principalFor(request,env);
 if(!p)return err("Sessão inválida.",401);
 const conf=await configFor(env,p.tenantId);
 const executor=isExecutor(p,conf),db=env.TENANTS_DB;
 const path=new URL(request.url).pathname.slice("/v1/cadastro-solicitacoes".length);
 const method=request.method;
 if(method!=="GET"&&!safeWrite(request))return err("Origem não autorizada.",403);
 try{
  if(path==="/config"&&method==="GET")
    return success({empresa:p.tenantId,executor,armazenamento:publicConfig(conf)});
  if((path===""||path==="/")&&method==="GET"){
   const rows=await (executor?
    db.prepare("SELECT * FROM portal_cadastro_tickets WHERE tenant_id=? AND status<>'RASCUNHO' ORDER BY criado_em DESC LIMIT 250").bind(p.tenantId):
    db.prepare("SELECT * FROM portal_cadastro_tickets WHERE tenant_id=? AND solicitante_id=? ORDER BY criado_em DESC LIMIT 250").bind(p.tenantId,p.user)).all();
   return success({chamados:(rows.results||[]).map(formatTicket),executor,armazenamento:publicConfig(conf)});
  }
  if((path===""||path==="/")&&method==="POST"){
   if(!conf)return err("Google Drive desta transportadora não configurado. Acione o Super Admin.",503);
   const b=await json(request);
   const motorista=clean(b.motorista),contato=clean(b.contatoMotorista,30);
   const proprietario=clean(b.proprietario),contatoProprietario=clean(b.contatoProprietario,30);
   const placas=clean(b.placas,120),observacoes=typeof b.observacoes==="string"&&b.observacoes.length<=1500?b.observacoes.trim():"";
   if(!motorista||!contato||!proprietario||!contatoProprietario||!placas||
      !Array.isArray(b.referencias)||b.referencias.length!==3||
      b.referencias.some(r=>!clean(r?.nome)||!clean(r?.telefone,30)))
      return err("Preencha motorista, proprietário, contatos, placas e as três referências.");
   const id=crypto.randomUUID(),today=new Date().toISOString().slice(0,10).replaceAll("-","");
   const protocolo="CAD-"+today+"-"+id.slice(0,8).toUpperCase();
   await db.prepare("INSERT INTO portal_cadastro_tickets(id,tenant_id,protocolo,solicitante_id,motorista,contato_motorista,proprietario,contato_proprietario,placas,referencias_json,observacoes) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,p.tenantId,protocolo,p.user,motorista,contato,proprietario,contatoProprietario,placas,JSON.stringify(b.referencias.map(x=>({nome:x.nome.trim(),telefone:x.telefone.trim()}))),observacoes).run();
   await history(db,p,id,"RASCUNHO","RECEBIMENTO");
   return success({chamado:{id,protocolo,status:"RASCUNHO"}},201);
  }
  const m=path.match(/^\/([a-f0-9-]{36})(?:\/(anexos(?:\/([a-f0-9-]{36}))?|enviar|assumir|situacao|mensagens))?$/);
  if(!m)return err("Rota inexistente.",404);
  const id=m[1],action=m[2]||"";
  const row=await ticket(db,p,id);
  if(!row)return err("Chamado não encontrado.",404);
  if(!executor&&row.solicitante_id!==p.user)return err("Chamado não autorizado.",403);
  if(row.status==="RASCUNHO"&&row.solicitante_id!==p.user)return err("Rascunho privado do solicitante.",403);
  if(action===""&&method==="GET"){
   const [docs,mensagens,historico]=await Promise.all([
    db.prepare("SELECT id,slot,nome,mime,bytes,criado_em FROM portal_cadastro_docs WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id").bind(p.tenantId,id).all(),
    db.prepare("SELECT autor_id,autor_perfil,texto,criado_em FROM portal_cadastro_messages WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id LIMIT 500").bind(p.tenantId,id).all(),
    db.prepare("SELECT autor_id,status,etapa,motivo,criado_em FROM portal_cadastro_history WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id").bind(p.tenantId,id).all()
   ]);
   return success({chamado:formatTicket(row),anexos:docs.results||[],mensagens:mensagens.results||[],historico:historico.results||[],executor});
  }
  if(action==="anexos"&&method==="POST"){
   if(row.solicitante_id!==p.user||!["RASCUNHO","PENDENTE"].includes(row.status))return err("Anexo permitido somente no rascunho ou na pendência do próprio solicitante.",403);
   if(!conf)return err("Google Drive não configurado.",503);
   const b=await json(request,8500000);
   if(!SLOTS.has(b.slot)||!MIME.has(b.mime)||!clean(b.nome,160)||
      typeof b.base64!=="string"||b.base64.length>Math.ceil(MAX_FILE/3)*4+8||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64))return err("Arquivo inválido. Use PDF, JPG, PNG ou WebP de até 6 MB.");
   const estimated=Math.floor(b.base64.length*3/4)-(b.base64.endsWith("==")?2:b.base64.endsWith("=")?1:0);
   if(estimated<1||estimated>MAX_FILE)return err("Arquivo excede 6 MB.");
   const uploaded=await drive(conf,p.tenantId,"upload",{ticketId:id,slot:b.slot,nome:b.nome,mime:b.mime,base64:b.base64});
   if(!DRIVE_ID.test(uploaded.fileId||""))return err("Google Drive não confirmou o arquivo.",502);
   await db.prepare("INSERT INTO portal_cadastro_docs(id,tenant_id,ticket_id,slot,drive_id,nome,mime,bytes) VALUES(?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),p.tenantId,id,b.slot,uploaded.fileId,b.nome,b.mime,estimated).run();
   return success({anexado:true});
  }
  if(action==="enviar"&&method==="POST"){
   if(row.solicitante_id!==p.user||row.status!=="RASCUNHO")return err("Somente o solicitante envia seu rascunho.",403);
   const slots=await db.prepare("SELECT DISTINCT slot FROM portal_cadastro_docs WHERE tenant_id=? AND ticket_id=?").bind(p.tenantId,id).all();
   const present=new Set((slots.results||[]).map(r=>r.slot));
   const faltantes=REQUIRED.filter(slot=>!present.has(slot));
   if(faltantes.length)return err("Documentação incompleta: "+faltantes.join(", ")+".",409);
   const changed=await db.prepare("UPDATE portal_cadastro_tickets SET status='FILA',enviado_em=CURRENT_TIMESTAMP,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='RASCUNHO'").bind(id,p.tenantId).run();
   if(changed.meta?.changes!==1)return err("Chamado já enviado.",409);
   await history(db,p,id,"FILA","RECEBIMENTO");
   return success({protocolo:row.protocolo,status:"FILA"});
  }
  if(action==="assumir"&&method==="POST"){
   if(!executor)return err("Acesso exclusivo da execução.",403);
   const changed=await db.prepare("UPDATE portal_cadastro_tickets SET status='ANDAMENTO',etapa='CONFERENCIA DOCUMENTAL',executor_id=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='FILA'").bind(p.user,id,p.tenantId).run();
   if(changed.meta?.changes!==1)return err("Este chamado já foi assumido.",409);
   await history(db,p,id,"ANDAMENTO","CONFERENCIA DOCUMENTAL");
   return success({status:"ANDAMENTO"});
  }
  if(action==="situacao"&&method==="POST"){
   if(!executor)return err("Acesso exclusivo da execução.",403);
   if(row.status==="RASCUNHO"||row.status==="FILA")return err("Primeiro assuma o chamado.",409);
   if(row.executor_id!==p.user)return err("Chamado atribuído a outro executor.",403);
   const b=await json(request,2500);
   if(!STATUSES.has(b.status)||!ETAPAS.has(b.etapa))return err("Situação ou etapa inválida.");
   const motivo=String(b.motivo||"").trim();
   if(motivo.length>1800||(["PENDENTE","REPROVADO"].includes(b.status)&&motivo.length<8))
    return err("Informe um motivo detalhado para pendência ou reprovação.");
   await db.prepare("UPDATE portal_cadastro_tickets SET status=?,etapa=?,atualizado_em=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND executor_id=?")
    .bind(b.status,b.etapa,p.tenantId,id,p.user).run();
   await history(db,p,id,b.status,b.etapa,motivo);
   if(motivo)await db.prepare("INSERT INTO portal_cadastro_messages(id,tenant_id,ticket_id,autor_id,autor_perfil,texto) VALUES(?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),p.tenantId,id,p.user,p.role,motivo).run();
   return success({status:b.status,etapa:b.etapa});
  }
  if(action==="mensagens"&&method==="POST"){
   if(row.status==="RASCUNHO")return err("Envie o chamado antes de conversar.",409);
   const b=await json(request,2500),texto=clean(b.texto,1800);
   if(!texto)return err("Mensagem inválida.");
   await db.prepare("INSERT INTO portal_cadastro_messages(id,tenant_id,ticket_id,autor_id,autor_perfil,texto) VALUES(?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),p.tenantId,id,p.user,p.role,texto).run();
   return success({enviado:true});
  }
  if(action==="anexos/"+m[3]&&method==="GET"){
   if(!conf)return err("Google Drive não configurado.",503);
   const file=await db.prepare("SELECT * FROM portal_cadastro_docs WHERE tenant_id=? AND ticket_id=? AND id=?")
    .bind(p.tenantId,id,m[3]).first();
   if(!file)return err("Anexo não encontrado.",404);
   const retrieved=await drive(conf,p.tenantId,"download",{fileId:file.drive_id,ticketId:id});
   if(typeof retrieved.base64!=="string"||retrieved.base64.length>8500000)throw Error("Arquivo inválido.");
   const bytes=Uint8Array.from(atob(retrieved.base64),c=>c.charCodeAt(0));
   if(bytes.length>MAX_FILE)return err("Arquivo excede limite.",413);
   return new Response(bytes,{headers:{"Content-Type":file.mime,"Cache-Control":"private,no-store","Content-Disposition":"attachment; filename=\"documento\"","X-Content-Type-Options":"nosniff"}});
  }
  return err("Operação não permitida.",405);
 }catch(error){
  console.error("[CADASTRO] Erro operacional",error?.name||"Error");
  return err("Não foi possível concluir a operação. Verifique a configuração ou tente novamente.",503);
 }
}
