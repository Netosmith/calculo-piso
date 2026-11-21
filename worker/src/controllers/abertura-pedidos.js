import {profileAllowsModule} from "../services/profile-access.js";
import {effectiveSolicRole} from "../services/solicitacoes-user-access.js";
import {PEDIDOS_EXEC_KINDS,PEDIDOS_EXEC_LEGACY_KINDS,readPedidosExecAccess} from "../services/pedidos-exec-access.js";
import {ALLOWED_ORIGINS} from "../config.js";
import {errorResponse,success} from "../utils/response.js";
import {tenantSession,hasTenantSessionCookie} from "../services/tenant-auth.js";
import {ownerSupportPrincipal} from "../services/tenant-owner-support.js";
import {getSession,readSessionId} from "../services/session.js";
import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";
import {readNovaFrotaModules} from "../services/nova-frota-modules.js";
import {sheetsConfig,sheetsAdmin,sheetsGateway} from "../services/chamados-sheets.js";

const SLUG=/^[a-z][a-z0-9-]{2,63}$/;
const FILEID=/^[A-Za-z0-9_-]{15,160}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const MAX_FILE=6*1024*1024;
const SLOTS=new Set(["nota","nota_coleta","liberacao","rota_pedagio","tabela_antt","comprovante_pagamento","comprovante_guia"]);
export const TIPOS_SOLICITACAO=Object.freeze({
 PEDIDO:"Abertura de pedido",
 CORRECAO_PEDIDO:"Correção de pedido",
 CTE_COMPLEMENTAR:"CT-e complementar",
 CARTA_CORRECAO:"Carta de correção",
 PAGAMENTO:"Solicitação de pagamento",
 PAGAMENTO_GUIA:"Pagamento de GUIA"
});
const EXTRA_FIELDS=Object.freeze({
 CORRECAO_PEDIDO:[["numeroPedidoCorrecao",120],["textoCorrecao",1800]],
 CTE_COMPLEMENTAR:[["numeroCte",120],["descricaoComplemento",1800]],
 CARTA_CORRECAO:[["documentoTipo",8],["numeroDocumento",120],["textoCarta",1800]],
 PAGAMENTO:[["ctePagamento",120],["placaPagamento",40],["nomeBeneficiario",160],["cpfCnpjPagamento",24],["formaPagamento",20],["etapaPagamento",20],["pixPagamento",160],["bancoPagamento",120],["agenciaPagamento",40],["contaPagamento",60]],
 PAGAMENTO_GUIA:[["cteGuia",120],["nfGuia",120]]
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
  return s?{id:s.tenant_id,user:s.user_id,role:s.role,ownerSupport:true}:null;
 }
 if(hasTenantSessionCookie(req)){
  const s=await tenantSession(env.TENANTS_DB,req,env);
  return s?{id:s.tenant_id,user:s.user_id,role:s.role}:null;
 }
 const s=await getSession(env,readSessionId(req));
 return s&&tenantIdForLegacySession(s)===LEGACY_NOVA_FROTA.id?
   {id:LEGACY_NOVA_FROTA.id,user:s.usuario,role:await effectiveSolicRole(env,LEGACY_NOVA_FROTA.id,s.usuario,s.perfil),
    ownerSupport:Boolean(env.SUPER_ADMIN_USER)&&
      String(s.usuario||"").trim().toUpperCase()===String(env.SUPER_ADMIN_USER).trim().toUpperCase()
   }:null;
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
   const optionalPayment=kind==="PAGAMENTO"&&(
    (extras.formaPagamento==="DEPOSITO"&&key==="pixPagamento"));
   if(optionalPayment){result.dadosEspecificos[key]="";continue;}
   const value=["textoCorrecao","descricaoComplemento","textoCarta"].includes(key)
    ? cleanMultiline(extras[key],max) : clean(extras[key],max);
   if(!value)throw Error("Campo obrigatório ou inválido: "+key);
   result.dadosEspecificos[key]=kind==="PAGAMENTO"&&key==="formaPagamento"&&value==="PIX_IRION"?"PIX_IRIOM":value;
  }
  if(kind==="PAGAMENTO"&&(!["PIX_IRIOM","DEPOSITO"].includes(result.dadosEspecificos.formaPagamento)||
    !["ADIANTAMENTO","SALDO","ADIANTAMENTO_E_SALDO"].includes(result.dadosEspecificos.etapaPagamento)))
   throw Error("Forma ou etapa do pagamento inválida.");
  if(kind==="CARTA_CORRECAO"&&!["CTE","MDFE"].includes(result.dadosEspecificos.documentoTipo))
   throw Error("Selecione CT-e ou MDF-e.");
  result.nomeSolicitante=result.nomeSolicitante||requester;
  if(kind==="CORRECAO_PEDIDO")result.numeroPedidoOC=result.dadosEspecificos.numeroPedidoCorrecao;
 }
 return result;
}
const effectiveKind=row=>row.categoria_chamado||row.tipo_solicitacao||"PEDIDO";
const ticketView=x=>{
 let extras={};try{extras=JSON.parse(x.dados_especificos_json||"{}");}catch{extras={};}
 const tipo=Object.hasOwn(TIPOS_SOLICITACAO,effectiveKind(x))?effectiveKind(x):"PEDIDO";
 const item={id:x.id,protocolo:x.protocolo,numero:x.numero,solicitante:x.solicitante_id,executor:x.executor_id,
  tipoSolicitacao:tipo,dadosEspecificos:extras,
  status:x.status,motivo:x.motivo||"",numeroPedidoSistema:x.numero_pedido_sistema||"",
  criadoEm:x.criado_em,atualizadoEm:x.atualizado_em,enviadoEm:x.enviado_em,
  excluidoEm:x.excluido_em||"",excluidoPor:x.excluido_por||""};
 for(const [k,col] of Object.entries(COLUMNS))item[k]=x[col]||"";
 return item;
};
// Público = andamento e identificadores, nunca dados bancários, CPF, chat e documentos.
const publicTicket=row=>{
 const x=ticketView(row);
 return {id:x.id,protocolo:x.protocolo,numero:x.numero,tipoSolicitacao:x.tipoSolicitacao,
  status:x.status,solicitante:x.solicitante,nomeSolicitante:x.nomeSolicitante,
  executor:x.executor,criadoEm:x.criadoEm,atualizadoEm:x.atualizadoEm,
  enviadoEm:x.enviadoEm,numeroPedidoSistema:"",dadosEspecificos:{},numeroPedidoOC:"",motivo:""};
};
// A consulta do quadro é enxuta; documentos e dados pessoais completos só
// saem da rota autenticada /:id quando o usuário abre o atendimento.
const executionBoardTicket=row=>{
 const kind=Object.hasOwn(TIPOS_SOLICITACAO,effectiveKind(row))?effectiveKind(row):"PEDIDO";
 const item={
  id:row.id,protocolo:row.protocolo,numero:row.numero,
  tipoSolicitacao:kind,status:row.status,solicitante:row.solicitante_id,
  nomeSolicitante:row.nome_solicitante||row.solicitante_id||"",
  executor:row.executor_id||"",criadoEm:row.criado_em,
  atualizadoEm:row.atualizado_em,enviadoEm:row.enviado_em,
  numeroPedidoSistema:row.numero_pedido_sistema||"",dadosEspecificos:{}
 };
 if(kind==="PEDIDO"){
  item.unidadeEmbarque=row.unidade_embarque||"";
  item.numeroPedidoOC=row.numero_pedido_oc||"";
  item.produto=row.produto||"";
 }else{
  let extras={};
  try{extras=JSON.parse(row.dados_especificos_json||"{}");}catch{extras={};}
  const keys={
   PAGAMENTO:["ctePagamento","placaPagamento","nomeBeneficiario"],
   PAGAMENTO_GUIA:["cteGuia","nfGuia"],
   CORRECAO_PEDIDO:["numeroPedidoCorrecao"],
   CTE_COMPLEMENTAR:["numeroCte"],
   CARTA_CORRECAO:["numeroDocumento"]
  }[kind]||[];
  for(const key of keys)item.dadosEspecificos[key]=String(extras[key]||"");
 }
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
 // Leituras KV/D1 independentes em paralelo, sem serializar todo clique.
 const [flags,conf,execProfile,googleSheets]=await Promise.all([
  flagsFor(env,p.id),driveConfig(env,p.id),readPedidosExecAccess(env,p.id),sheetsConfig(env,p.id)
 ]);
 flags.publico=flags.solicitar;
 const [solicitPermit,execPermit]=await Promise.all([
  flags.solicitar?profileAllowsModule(env,p.id,p.role,"solicitacao-pedidos",p.ownerSupport===true,p.user):false,
  flags.executar?profileAllowsModule(env,p.id,p.role,"execucao-pedidos",p.ownerSupport===true,p.user):false
 ]);
 flags.solicitar=flags.solicitar&&solicitPermit;
 flags.executar=flags.executar&&execPermit;
 const userKey=String(p.user||"").trim().toUpperCase();
 const kinds=p.ownerSupport===true?[...PEDIDOS_EXEC_KINDS]:
  execProfile.configured&&Object.prototype.hasOwnProperty.call(execProfile.usuarios,userKey)?
    [...execProfile.usuarios[userKey]]:p.role==="SOLICITACOES"?[...PEDIDOS_EXEC_KINDS]:[...PEDIDOS_EXEC_LEGACY_KINDS];
 const executor=flags.executar&&kinds.length>0&&String(p.role||"").toUpperCase()!=="PISO"&&
  (p.role==="SOLICITACOES"||p.ownerSupport===true||isExecutor(p,conf)||(execProfile.configured&&kinds.length>0));
 const execView=view==="execucao";

 if(path.startsWith("/sheets/"))
  return sheetsAdmin(req,env,p,view,flags,executor,kinds,conf,googleSheets);
 if(path==="/config"&&req.method==="GET")
  return success({empresa:p.id,solicitacoesHabilitadas:flags.publico,podeCriar:flags.solicitar,execucaoHabilitada:flags.executar,executor,tiposLiberados:execView?kinds:[],superAdmin:p.ownerSupport===true,armazenamentoConfigurado:!!conf,armazenamentoChamados:googleSheets.mode});
 if(execView&&!executor)return err("Execução de Abertura de Pedidos não liberada para este usuário.",403);
 if(!execView&&!flags.publico)return err("Solicitações / Chamados não habilitado nesta transportadora.",403);
 const collaborativePendingWrite=!execView&&req.method==="POST"&&
   /^\/[a-f0-9-]{36}\/(?:dados|enviar|anexos)$/.test(path);
  if(!execView&&req.method!=="GET"&&!flags.solicitar&&!collaborativePendingWrite)
   return err("Você pode acompanhar os chamados, mas não criar novas solicitações.",403);
 try{
  if(googleSheets.mode==="sheets")
   return await sheetsGateway(req,p,view,flags,executor,kinds,conf,googleSheets,normalizedFields);
  if(path==="/historico"&&req.method==="GET"){
   // Consulta independente do quadro de 500 registros. Finalizados não expiram.
   // Somente o Super Admin acessa "todos" e os retirados da operação.
   const admin=p.ownerSupport===true&&url.searchParams.get("escopo")==="todos";
   if(url.searchParams.get("escopo")==="todos"&&!admin)return err("Consulta administrativa restrita.",403);
   const removed=admin&&url.searchParams.get("removidos")==="1";
   const pageRaw=Number(url.searchParams.get("pagina")||0);
   if(!Number.isInteger(pageRaw)||pageRaw<0||pageRaw>1000)return err("Página inválida.");
   const kind=String(url.searchParams.get("tipo")||"").toUpperCase();
   if(kind&&!Object.hasOwn(TIPOS_SOLICITACAO,kind))return err("Tipo inválido.");
   if(execView&&kind&&!kinds.includes(kind))return err("Tipo não liberado.",403);
   const etapa=String(url.searchParams.get("etapa")||"").toUpperCase();
   if(etapa&&!["RASCUNHO","FILA","ANDAMENTO","PENDENTE","FINALIZADO"].includes(etapa))return err("Etapa inválida.");
   const busca=String(url.searchParams.get("busca")||"").trim().slice(0,90).toUpperCase();
   const cond=["tenant_id=?"],bind=[p.id];
   cond.push(removed?"excluido_em<>''":"excluido_em=''");
   if(!admin){cond.push("status='FINALIZADO'");}
   else if(etapa){cond.push("status=?");bind.push(etapa);}
   // Finalizados disponíveis a todos os usuários autenticados desta transportadora.
   if(execView&&!p.ownerSupport){
    cond.push("COALESCE(NULLIF(categoria_chamado,''),tipo_solicitacao) IN ("+kinds.map(()=>"?").join(",")+")");
    bind.push(...kinds);
   }
   if(kind){cond.push("COALESCE(NULLIF(categoria_chamado,''),tipo_solicitacao)=?");bind.push(kind);}
   if(busca){
    const pattern="%"+busca+"%";
    if(execView&&executor||p.ownerSupport){
     cond.push("(UPPER(protocolo) LIKE ? OR CAST(numero AS TEXT) LIKE ? OR UPPER(nome_solicitante) LIKE ? OR UPPER(numero_pedido_oc) LIKE ? OR UPPER(dados_especificos_json) LIKE ?)");
     bind.push(pattern,pattern,pattern,pattern,pattern);
    }else{
     // Pesquisa compartilhada nunca revela se CPF, chave PIX ou conta oculta coincide.
     cond.push("(UPPER(protocolo) LIKE ? OR CAST(numero AS TEXT) LIKE ? OR UPPER(nome_solicitante) LIKE ?)");
     bind.push(pattern,pattern,pattern);
    }
   }
   const query="SELECT * FROM portal_pedidos_tickets WHERE "+cond.join(" AND ")+
    " ORDER BY atualizado_em DESC,id DESC LIMIT ? OFFSET ?";
   const result=await db.prepare(query).bind(...bind,41,pageRaw*40).all();
   const rows=result.results||[];
   return success({chamados:rows.slice(0,40).map(row=>(p.ownerSupport||row.solicitante_id===p.user||execView&&executor)?ticketView(row):publicTicket(row)),proximaPagina:rows.length>40?pageRaw+1:null,
    pagina:pageRaw,escopo:admin?"todos":"finalizados",removidos:removed});
  }
  if((path===""||path==="/")&&req.method==="GET"){
   // Finalizações do dia em Goiás/Brasília. O evento FINALIZADO evita confundir
   // pagamentos/comprovantes anexados depois com a data de conclusão.
   const finalizedToday="EXISTS (SELECT 1 FROM portal_pedidos_history final_event WHERE "+
    "final_event.tenant_id=portal_pedidos_tickets.tenant_id AND "+
    "final_event.ticket_id=portal_pedidos_tickets.id AND "+
    "final_event.status='FINALIZADO' AND "+
    "date(final_event.criado_em,'-3 hours')=date('now','-3 hours'))";
   // Evitar SELECT * no quadro: reduzir bytes lidos e serializados por acesso.
   const boardColumns="id,protocolo,numero,solicitante_id,executor_id,nome_solicitante,"+
    "criado_em,atualizado_em,enviado_em,numero_pedido_sistema,tipo_solicitacao,"+
    "categoria_chamado,status,unidade_embarque,numero_pedido_oc,produto,dados_especificos_json";
   const list=execView?
    await db.prepare("SELECT "+boardColumns+" FROM portal_pedidos_tickets WHERE tenant_id=? AND excluido_em='' AND (status NOT IN ('RASCUNHO','FINALIZADO') OR (status='FINALIZADO' AND "+finalizedToday+")) AND COALESCE(NULLIF(categoria_chamado,''),tipo_solicitacao) IN ("+kinds.map(()=>"?").join(",")+") ORDER BY atualizado_em DESC,id DESC LIMIT 500").bind(p.id,...kinds).all():
    await db.prepare("SELECT * FROM portal_pedidos_tickets WHERE tenant_id=? AND excluido_em='' AND (status<>'RASCUNHO' OR solicitante_id=?) AND (status<>'FINALIZADO' OR "+finalizedToday+") ORDER BY atualizado_em DESC,id DESC LIMIT 500").bind(p.id,p.user).all();
   return success({chamados:(list.results||[]).map(row=>execView?executionBoardTicket(row):(p.ownerSupport||row.solicitante_id===p.user?ticketView(row):publicTicket(row))),executor});
  }
  if((path===""||path==="/")&&req.method==="POST"){
    if(execView)return err("Solicitação exclusiva do solicitante.",403);
    const b=await bodyJson(req,12000),values=normalizedFields(b,p.user),id=crypto.randomUUID();
    const direct=b.enviarAgora===true&&values.tipoSolicitacao!=="CTE_COMPLEMENTAR";
    const protocolo="PED-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+id.slice(0,8).toUpperCase();
    const columns=[...Object.values(COLUMNS),"tipo_solicitacao","categoria_chamado","dados_especificos_json"],keys=Object.keys(COLUMNS);
    const params=[id,p.id,protocolo,p.user,...keys.map(k=>values[k]),(values.tipoSolicitacao==="PAGAMENTO"||values.tipoSolicitacao==="PAGAMENTO_GUIA"?"PEDIDO":values.tipoSolicitacao),(values.tipoSolicitacao==="PAGAMENTO"||values.tipoSolicitacao==="PAGAMENTO_GUIA"?values.tipoSolicitacao:""),JSON.stringify(values.dadosEspecificos)];
    const statements=[
     db.prepare("INSERT INTO portal_pedidos_tickets(id,tenant_id,protocolo,solicitante_id,"+
      columns.join(",")+") VALUES("+params.map(()=>"?").join(",")+")").bind(...params)
    ];
    if(direct){
     statements.push(db.prepare("UPDATE portal_pedidos_tickets SET status='FILA',enviado_em=CURRENT_TIMESTAMP,atualizado_em=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND status='RASCUNHO'").bind(p.id,id));
     statements.push(hist(db,p,id,"FILA","Solicitação enviada diretamente para execução"));
     if(values.tipoSolicitacao==="CORRECAO_PEDIDO"&&values.dadosEspecificos?.textoCorrecao)
      statements.push(db.prepare("INSERT INTO portal_pedidos_messages(id,tenant_id,ticket_id,autor_id,texto) VALUES(?,?,?,?,?)")
       .bind(crypto.randomUUID(),p.id,id,p.user,values.dadosEspecificos.textoCorrecao));
    }else statements.push(hist(db,p,id,"RASCUNHO",TIPOS_SOLICITACAO[values.tipoSolicitacao]+" criada"));
    // Commit único: nunca responde com protocolo se parte do registro falhou.
    await db.batch(statements);
    const row=await ticket(db,p,id);
    return success({chamado:ticketView(row)},201);
   }
   const match=path.match(/^\/([a-f0-9-]{36})(?:\/(anexos(?:\/([a-f0-9-]{36}))?|dados|enviar|assumir|situacao|mensagens|ocultar|restaurar|corrigir))?$/);
  if(!match)return err("Rota de Abertura de Pedidos inexistente.",404);
  const id=match[1],action=match[2]||"",row=await ticket(db,p,id);
  if(!row)return err("Chamado não encontrado.",404);
  if(row.excluido_em&&!p.ownerSupport)return err("Chamado indisponível.",404);
  if(execView&&!p.ownerSupport&&!kinds.includes(effectiveKind(row)))return err("Tipo de chamado não autorizado.",403);
  const owner=row.solicitante_id===p.user;
  // Pendência compartilhada para correção por qualquer conta do tenant.
   const pendingEditor=!execView&&row.status==="PENDENTE";
   const privateAccess=p.ownerSupport||owner||(execView&&executor)||pendingEditor;
  if(!privateAccess&&(req.method!=="GET"||action!==""))return err("Chamado não autorizado.",403);
  if(row.status==="RASCUNHO"&&!owner&&!p.ownerSupport)return err("Rascunho privado.",403);
  if(row.excluido_em&&!["","restaurar"].includes(action)&&req.method!=="GET")
   return err("Chamado removido da operação. Restaure antes de alterar.",409);
  if(["ocultar","restaurar"].includes(action)&&req.method==="POST"){
   if(!p.ownerSupport)return err("Somente o Super Admin pode remover ou restaurar.",403);
   const body=await bodyJson(req,1300);
   if(String(body.protocolo||"")!==row.protocolo)return err("Confirme o protocolo completo do chamado.",400);
   const motivo=clean(body.motivo,400);
   if(!motivo||motivo.length<8)return err("Informe motivo com pelo menos 8 caracteres.",400);
   const removing=action==="ocultar";
   if(removing ? Boolean(row.excluido_em) : !row.excluido_em)return err("Chamado já está nesta situação.",409);
   const sql=removing?
    "UPDATE portal_pedidos_tickets SET excluido_em=CURRENT_TIMESTAMP,excluido_por=?,excluido_motivo=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND excluido_em=''":
    "UPDATE portal_pedidos_tickets SET excluido_em='',excluido_por='',excluido_motivo='',atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND excluido_em<>''";
   const params=removing?[p.user,motivo,id,p.id]:[id,p.id];
   const updates=await db.batch([
    db.prepare(sql).bind(...params),
    hist(db,p,id,row.status,(removing?"Retirado da operação":"Restaurado à operação")+
      " pelo Super Admin. Motivo: "+motivo)
   ]);
   if(updates[0]?.meta?.changes!==1)return err("O chamado foi atualizado por outra operação.",409);
   return success({atualizado:true,removido:removing,protocolo:row.protocolo,
    aviso:"Registro, anexos e histórico foram preservados para auditoria."});
  }
  if(action==="corrigir"&&req.method==="POST"){
   if(!p.ownerSupport)return err("Somente o Super Admin pode corrigir dados.",403);
   const body=await bodyJson(req,3000),campo=String(body.campo||"");
   const motivo=clean(body.motivo,400),novo=String(body.valor??"").trim();
   if(!motivo||motivo.length<8)return err("Informe o motivo da correção.",400);
   const normal=FIELDS.find(([name])=>name===campo);
   const extra=(EXTRA_FIELDS[effectiveKind(row)]||[]).find(([name])=>name===campo);
   if(!normal&&!extra&&campo!=="numeroPedidoSistema")return err("Campo indisponível para correção.",400);
   const max=normal?.[1]||extra?.[1]||120;
   if(!novo||novo.length>max||/[\u0000-\u001f\u007f]/.test(novo))
    return err("Valor corrigido inválido.",400);
   if(campo==="formaPagamento"&&!["PIX_IRIOM","DEPOSITO"].includes(novo))return err("Forma de pagamento inválida.",400);
   if(campo==="etapaPagamento"&&!["ADIANTAMENTO","SALDO","ADIANTAMENTO_E_SALDO"].includes(novo))return err("Etapa de pagamento inválida.",400);
   if(campo==="documentoTipo"&&!["CTE","MDFE"].includes(novo))return err("Tipo de documento inválido.",400);
   let statement;
   if(extra){
    let data={};try{data=JSON.parse(row.dados_especificos_json||"{}")}catch{}
    if(campo==="formaPagamento"&&novo!==(data.formaPagamento==="PIX_IRION"?"PIX_IRIOM":data.formaPagamento))
     return err("Para mudar a forma de pagamento, crie um novo chamado ou solicite suporte técnico.",409);
    data[campo]=novo;
    statement=db.prepare("UPDATE portal_pedidos_tickets SET dados_especificos_json=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?")
     .bind(JSON.stringify(data),id,p.id);
   }else{
    const column=campo==="numeroPedidoSistema"?"numero_pedido_sistema":COLUMNS[campo];
    statement=db.prepare("UPDATE portal_pedidos_tickets SET "+column+"=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?")
     .bind(novo,id,p.id);
   }
   await db.batch([statement,hist(db,p,id,row.status,"Correção administrativa: "+campo+". Motivo: "+motivo)]);
   return success({atualizado:true,campo,protocolo:row.protocolo});
  }
  if(action===""&&req.method==="GET"){
   if(!privateAccess)return success({chamado:publicTicket(row),anexos:[],mensagens:[],historico:[],executor:false,consultaPublica:true});
   const [docs,messages,history]=await Promise.all([
    db.prepare("SELECT id,COALESCE(NULLIF(tipo_anexo,''),slot) AS slot,nome,mime,bytes,criado_em FROM portal_pedidos_docs WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id").bind(p.id,id).all(),
    db.prepare("SELECT autor_id,texto,criado_em FROM portal_pedidos_messages WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id LIMIT 500").bind(p.id,id).all(),
    db.prepare("SELECT autor_id,status,descricao,criado_em FROM portal_pedidos_history WHERE tenant_id=? AND ticket_id=? ORDER BY criado_em,id").bind(p.id,id).all()
   ]);
   return success({chamado:ticketView(row),anexos:docs.results||[],mensagens:messages.results||[],historico:history.results||[],executor});
  }
  if(action==="dados"&&req.method==="POST"){
    if(execView||!["RASCUNHO","PENDENTE"].includes(row.status)||
      (row.status==="RASCUNHO"&&!owner))
     return err("Somente o autor edita rascunhos; pendências podem ser corrigidas pela equipe.",403);
    const b=await bodyJson(req,12000),values=normalizedFields(b,p.user);
    if(values.tipoSolicitacao!==effectiveKind(row))
     return err("O tipo do chamado não pode ser alterado durante a correção.",409);
    const columns=[...Object.values(COLUMNS),"tipo_solicitacao","categoria_chamado","dados_especificos_json"],keys=Object.keys(COLUMNS);
    const changed=await db.prepare("UPDATE portal_pedidos_tickets SET "+
      columns.map(c=>c+"=?").join(",")+
      ",atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status IN ('RASCUNHO','PENDENTE') AND (status='PENDENTE' OR solicitante_id=?)")
     .bind(...keys.map(k=>values[k]),(values.tipoSolicitacao==="PAGAMENTO"||values.tipoSolicitacao==="PAGAMENTO_GUIA"?"PEDIDO":values.tipoSolicitacao),(values.tipoSolicitacao==="PAGAMENTO"||values.tipoSolicitacao==="PAGAMENTO_GUIA"?values.tipoSolicitacao:""),JSON.stringify(values.dadosEspecificos),id,p.id,p.user).run();
    if(changed.meta?.changes!==1)return err("Chamado alterado por outra operação. Atualize a página.",409);
    if(row.status==="PENDENTE")
     await hist(db,p,id,"PENDENTE","Dados da pendência corrigidos por "+p.user).run();
    return success({atualizado:true,status:row.status});
   }
   if(action==="anexos"&&req.method==="POST"){
   if(!conf)return err("Google Drive desta transportadora não configurado.",503);
   const b=await bodyJson(req,8500000);
   if(!SLOTS.has(b.slot)||!MIME.has(b.mime)||!clean(b.nome,160)||typeof b.base64!=="string"||
      b.base64.length>Math.ceil(MAX_FILE/3)*4+8||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64))return err("Anexo inválido. Envie PDF, JPG, PNG ou WebP de até 6 MB.");
   const size=Math.floor(b.base64.length*3/4)-(b.base64.endsWith("==")?2:b.base64.endsWith("=")?1:0);
   if(!size||size>MAX_FILE)return err("Arquivo acima de 6 MB.",413);
   const proofSlot=effectiveKind(row)==="PAGAMENTO"?"comprovante_pagamento":
    effectiveKind(row)==="PAGAMENTO_GUIA"?"comprovante_guia":null;
   const proof=proofSlot!==null&&b.slot===proofSlot;
   const canProof=proof&&execView&&executor&&row.executor_id===p.user&&row.status==="FINALIZADO";
   if((b.slot==="comprovante_pagamento"||b.slot==="comprovante_guia")?!canProof:
      ((row.status==="RASCUNHO"&&!owner)||execView||!["RASCUNHO","PENDENTE"].includes(row.status)))
     return err("Anexo não autorizado para este usuário ou etapa.",403);
    const saved=await drive(conf,p.id,"upload",{ticketId:id,slot:proof?"liberacao":b.slot,nome:b.nome,mime:b.mime,base64:b.base64});
   if(!FILEID.test(saved.fileId||""))return err("Google Drive não confirmou o arquivo.",502);
   await db.batch([
    db.prepare("INSERT INTO portal_pedidos_docs(id,tenant_id,ticket_id,slot,tipo_anexo,drive_id,nome,mime,bytes) VALUES(?,?,?,?,?,?,?,?,?)")
     .bind(crypto.randomUUID(),p.id,id,proof?"liberacao":b.slot,proof?b.slot:"",saved.fileId,b.nome,b.mime,size),
    hist(db,p,id,row.status,"Documento anexado: "+b.slot)
   ]);
   return success({anexado:true,slot:b.slot});
  }
  if(action==="enviar"&&req.method==="POST"){
   if(execView||!["RASCUNHO","PENDENTE"].includes(row.status)||(row.status==="RASCUNHO"&&!owner))
    return err("Somente o autor envia rascunhos; a equipe pode devolver pendências corrigidas à fila.",403);
   if(row.tipo_solicitacao==="CTE_COMPLEMENTAR"){
    const lib=await db.prepare("SELECT id FROM portal_pedidos_docs WHERE tenant_id=? AND ticket_id=? AND slot='liberacao' LIMIT 1").bind(p.id,id).first();
    if(!lib)return err("Anexe a liberação do cliente antes de enviar o CT-e complementar.",409);
   }
   const wasPending=row.status==="PENDENTE";
   const update=await db.prepare("UPDATE portal_pedidos_tickets SET status='FILA',executor_id=NULL,motivo='',enviado_em=CURRENT_TIMESTAMP,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status=? AND (status='PENDENTE' OR solicitante_id=?)").bind(id,p.id,row.status,p.user).run();
   if(update.meta?.changes!==1)return err("Chamado alterado por outra operação. Atualize a fila.",409);
   await hist(db,p,id,"FILA",wasPending?
    "Pendência corrigida por "+p.user+". Chamado devolvido à fila de execução":
    "Enviado para a fila de execução").run();
   // Evita duplicar a mensagem inicial ao reenviar a correção de pedido.
   if(!wasPending&&row.tipo_solicitacao==="CORRECAO_PEDIDO"){
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
    if(status==="FINALIZADO"&&effectiveKind(row)==="PEDIDO"&&!numeroPedidoSistema)
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
     message==="Selecione CT-e ou MDF-e."||message==="Forma ou etapa do pagamento inválida."||
     message.startsWith("Campo obrigatório:")||message.startsWith("Campo inválido:")||
     message.startsWith("Campo obrigatório ou inválido:"))
   return err(message,400);
  return err("Não foi possível concluir a operação. "+
    (message.includes("Apps Script")?"Verifique o Apps Script.":"Verifique a integração e tente novamente."),503);
 }
}
