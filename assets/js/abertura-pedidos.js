(function(){
"use strict";
const $=id=>document.getElementById(id);
const execution=document.body.dataset.pedidosVisao==="execucao";
const API="https://api.portalfrete.net.br/v1/abertura-pedidos";
const STATES=[["FILA","Fila","#227cde"],["ANDAMENTO","Em andamento","#15a16e"],["PENDENTE","Pendente","#e8a01b"],["FINALIZADO","Finalizado","#168a57"]];
const SLOTS={nota:"Nota",nota_coleta:"Nota de coleta",liberacao:"Liberação",rota_pedagio:"Print da rota de pedágio",tabela_antt:"Print da tabela ANTT"};
const FIELDS=["email","nomeSolicitante","telefoneWhats","unidadeEmbarque","numeroPedidoOC","nfeManifestada","tomadorCnpj","coletaIe","entregaCnpj","entregaIe","freteEmpresa","freteMotorista","adiantamentoPct","icms","produto","especie","tag","obs","coordenadasColeta","coordenadasEntrega"];
const LABELS=["E-mail","Nome do solicitante","Telefone / Whats","Unidade de embarque","Número do pedido OC","NF-e a manifestar","Tomador / CNPJ","Coleta / IE","Entrega / CNPJ","Entrega / IE","Frete empresa","Frete motorista","Adiantamento %","ICMS","Produto","Espécie","TAG","Observações","Coordenadas coleta","Coordenadas entrega"];
const MAX_FILE=6*1024*1024;
const MIMES=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
let user="",executor=false,chamados=[],selected=null,draft="",busy=false,draftsExpanded=false,previewUrl=null,previewSequence=0,canCreate=false;
const element=(tag,text="",className="")=>{const x=document.createElement(tag);x.textContent=text;if(className)x.className=className;return x;};
const number=p=>p?.numero?"#"+String(p.numero).padStart(5,"0"):p?.protocolo||"";
function time(value){
 if(!value)return "";
 const d=new Date(String(value).replace(" ","T")+(String(value).includes("Z")?"":"Z"));
 return Number.isFinite(d.getTime())?d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):String(value);
}
function inform(message,error=false){
 const box=$("tnAlert");box.hidden=false;box.textContent=message;box.className="cad-alert"+(error?" error":"");
}
function showDialog(name){const d=$(name);if(d&&!d.open)d.showModal();}
function hideDialog(name){const d=$(name);if(d?.open)d.close();}
async function request(path="",method="GET",data){
 const headers={Accept:"application/json"};
 if(window.__PORTAL_TENANT_SESSION?.ownerSupport===true&&window.__PORTAL_TENANT_EXPECTED)
  headers["X-Portal-Support-Tenant"]=window.__PORTAL_TENANT_EXPECTED;
 if(data!==undefined)headers["Content-Type"]="application/json";
 const url=API+path+(path.includes("?")?"&":"?")+"visao="+(execution?"execucao":"solicitante");
 const resp=await fetch(url,{method,credentials:"include",cache:"no-store",headers,
  ...(data!==undefined?{body:JSON.stringify(data)}:{})});
 const result=await resp.json().catch(()=>null);
 if(!resp.ok)throw Error(result?.error||"Falha de comunicação com o Portal (HTTP "+resp.status+").");
 return result;
}
function matches(p,q){
 return !q||[number(p),p.protocolo,p.unidadeEmbarque,p.numeroPedidoOC,p.nomeSolicitante,p.nfeManifestada,p.produto,p.numeroPedidoSistema,p.executor]
  .some(v=>String(v||"").toUpperCase().includes(q));
}
function card(p){
 const b=element("button","","cad-lane-ticket");b.type="button";
 const meta=element("div","","cad-lane-ticket-meta");
 meta.append(element("span",number(p),"cad-short-number"),element("span",time(p.criadoEm)));
 const foot=element("div","","tn-card-bottom");
 foot.append(element("small",p.executor?"Executor: "+p.executor:"Aguardando executor"),
  element("small",p.status==="FINALIZADO"?"Sistema: "+(p.numeroPedidoSistema||""): "OC: "+p.numeroPedidoOC));
 b.append(meta,element("strong",p.unidadeEmbarque,"tn-client"),
  element("span",p.nomeSolicitante+" · "+p.produto,"tn-branch"),foot);
 b.title=number(p)+" · OC "+p.numeroPedidoOC+" · "+p.unidadeEmbarque;
 b.onclick=()=>openDetail(p.id);return b;
}
function render(){
 const board=$("tnBoard"),f=$("tnFilter").value,q=$("tnSearch").value.trim().toUpperCase();
 board.replaceChildren();
 for(const [key,label,color] of STATES){
  const rows=chamados.filter(x=>x.status===key&&(!f||f===key)&&matches(x,q));
  const lane=element("section","","cad-lane");lane.style.setProperty("--cad-lane-color",color);
  const head=element("div","","cad-lane-head");
  head.append(element("strong",label),element("span",String(rows.length),"cad-lane-count"));
  lane.append(head);
  const items=element("div","","cad-lane-items");
  if(!rows.length)items.append(element("p","Nenhum pedido nesta etapa.","cad-lane-empty"));
  for(const row of rows)items.append(card(row));
  lane.append(items);board.append(lane);
 }
 const mine=$("tnMine");
 if(mine){
  mine.replaceChildren();
  const rows=chamados.filter(x=>x.executor===user&&["ANDAMENTO","PENDENTE"].includes(x.status));
  if(!rows.length)mine.append(element("p","Nenhum pedido sob sua responsabilidade.","cad-empty"));
  for(const row of rows)mine.append(card(row));
 }
 const button=$("tnDraftButton"),tray=$("tnDrafts"),drafts=chamados.filter(x=>x.status==="RASCUNHO");
 button.hidden=execution||!drafts.length;button.textContent="Rascunhos ("+drafts.length+")";
 if(!drafts.length)draftsExpanded=false;
 tray.hidden=!draftsExpanded;tray.replaceChildren();
 if(draftsExpanded)for(const row of drafts){
  const b=element("button",number(row)+" · OC "+row.numeroPedidoOC+" / "+row.unidadeEmbarque,"tn-draft");
  b.type="button";b.onclick=()=>resume(row);tray.append(b);
 }
}
async function refresh(){
 const result=await request();
 chamados=Array.isArray(result.chamados)?result.chamados:[];
 render();
}
function newForm(){
 if(!canCreate)return inform("Configure o Google Drive antes de solicitar a abertura de pedidos.",true);
 draft="";$("tnForm").reset();
 $("tnFormTitle").textContent="Nova abertura de pedido";
 $("tnFormProgress").textContent="Preencha os campos obrigatórios. Anexos podem ser enviados junto à solicitação.";
 showDialog("tnFormDialog");
}
async function resume(row){
 if(execution)return;
 draft=row.id;$("tnForm").reset();
 for(const name of FIELDS)$("tnForm").elements[name].value=row[name]||"";
 $("tnFormTitle").textContent="Retomar pedido "+number(row);
 $("tnFormProgress").textContent="Dados editáveis. Os anexos já recebidos são preservados.";
 showDialog("tnFormDialog");
 try{
  const detail=await request("/"+row.id);
  $("tnFormProgress").textContent=(detail.anexos||[]).length+" anexo(s) já salvos. Selecione somente arquivos adicionais.";
 }catch(e){inform(e.message,true);}
}
function checkFile(file){
 if(!file||!MIMES.has(file.type)||file.size<1||file.size>MAX_FILE)
  throw Error("Arquivo inválido ou acima de 6 MB: "+(file?.name||"documento")+". Use PDF, JPG, PNG ou WebP.");
}
function toBase64(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(Error("Falha ao ler arquivo."));
  reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
  reader.readAsDataURL(file);
 });
}
async function upload(id,slot,file){
 checkFile(file);
 return request("/"+id+"/anexos","POST",{slot,nome:file.name,mime:file.type,base64:await toBase64(file)});
}
async function submitForm(e){
 e.preventDefault();if(busy)return;
 const form=$("tnForm"),button=$("tnEnviar"),progress=$("tnFormProgress");
 const payload={};for(const field of FIELDS)payload[field]=String(form.elements[field].value||"").trim();
 const documents=[...form.querySelectorAll("[data-slot]")].flatMap(input=>
  [...input.files].map(file=>({slot:input.dataset.slot,file})));
 busy=true;button.disabled=true;
 try{
  if(!draft){
   progress.textContent="Criando protocolo...";
   const result=await request("","POST",payload);draft=result.chamado.id;
  }else{
   progress.textContent="Salvando alterações do rascunho...";
   await request("/"+draft+"/dados","POST",payload);
  }
  for(let i=0;i<documents.length;i++){
   progress.textContent="Enviando anexo "+(i+1)+"/"+documents.length+": "+SLOTS[documents[i].slot];
   await upload(draft,documents[i].slot,documents[i].file);
  }
  progress.textContent="Encaminhando o pedido para execução...";
  const result=await request("/"+draft+"/enviar","POST",{});
  hideDialog("tnFormDialog");draft="";
  inform("Pedido "+(result.numero?"#"+String(result.numero).padStart(5,"0"):"")+" enviado para a fila.");
  await refresh();
 }catch(error){
  progress.textContent="Envio incompleto. "+error.message+" O rascunho foi preservado.";
  try{await refresh();}catch(_){}
 }finally{busy=false;button.disabled=false;}
}
async function fileBlob(id,doc){
 const headers={Accept:doc.mime||"application/octet-stream"};
 if(window.__PORTAL_TENANT_SESSION?.ownerSupport===true)headers["X-Portal-Support-Tenant"]=window.__PORTAL_TENANT_EXPECTED;
 const resp=await fetch(API+"/"+id+"/anexos/"+doc.id+"?visao="+(execution?"execucao":"solicitante"),
  {credentials:"include",cache:"no-store",headers});
 if(!resp.ok)throw Error("Documento não disponível.");
 return resp.blob();
}
function clearPreview(){
 previewSequence++;if(previewUrl)URL.revokeObjectURL(previewUrl);
 previewUrl=null;$("tnPreviewBody").replaceChildren();
}
async function download(id,doc){
 try{
  const blob=await fileBlob(id,doc),u=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=u;a.download=doc.nome||"documento";a.click();
  setTimeout(()=>URL.revokeObjectURL(u),6000);
 }catch(e){inform(e.message,true);}
}
async function preview(id,doc){
 clearPreview();const current=previewSequence;
 $("tnPreviewTitle").textContent=doc.nome;
 $("tnPreviewBody").append(element("p","Carregando documento privado..."));
 $("tnDownload").onclick=()=>download(id,doc);showDialog("tnPreviewDialog");
 try{
  const blob=await fileBlob(id,doc);if(current!==previewSequence)return;
  previewUrl=URL.createObjectURL(blob);
  const body=$("tnPreviewBody");body.replaceChildren();
  if(doc.mime==="application/pdf"){
   const frame=document.createElement("iframe");frame.className="cad-preview-pdf";frame.src=previewUrl;
   frame.title="Documento PDF";frame.setAttribute("sandbox","allow-scripts");body.append(frame);
  }else{
   const img=document.createElement("img");img.className="cad-preview-image";img.src=previewUrl;img.alt="Documento privado";
   body.append(img);
  }
 }catch(e){if(current===previewSequence)$("tnPreviewBody").replaceChildren(element("p",e.message));}
}
function renderDocs(id,docs){
 const target=$("tnDetailDocs");target.replaceChildren();
 if(!docs.length)target.append(element("p","Nenhum documento anexado.","cad-tip"));
 for(const doc of docs){
  const row=element("div","","tn-file"),title=element("strong",(SLOTS[doc.slot]||doc.slot)+": "+doc.nome);
  const buttons=element("div"),pv=element("button","Visualizar","secondary"),dl=element("button","Baixar","secondary");
  pv.type=dl.type="button";pv.onclick=()=>preview(id,doc);dl.onclick=()=>download(id,doc);
  buttons.append(pv,dl);row.append(title,buttons);target.append(row);
 }
}
function renderChat(items){
 const root=$("tnMessages");root.replaceChildren();
 if(!items.length)root.append(element("div","Nenhuma mensagem ainda.","cad-msg"));
 for(const msg of items){
  const row=element("div","","cad-msg"+(msg.autor_id===user?" mine":""));
  row.append(element("small",msg.autor_id+" · "+time(msg.criado_em)),element("p",msg.texto));root.append(row);
 }
}
function renderHistory(items){
 const root=$("tnHistory");root.replaceChildren();
 for(const item of items){
  const row=element("div","","cad-history-item");
  row.append(element("strong",item.descricao),element("small",item.autor_id+" · "+time(item.criado_em)));
  root.append(row);
 }
}
const detailItem=(label,value)=>{
 const e=element("div");e.append(element("span",label),element("strong",value||"Não informado"));return e;
};
function updateSystemInput(){
 const form=$("tnStatusForm"),wrap=$("pedSystemNumberInputWrap"),final=form.elements.status.value==="FINALIZADO";
 wrap.hidden=!final;form.elements.numeroPedidoSistema.required=final;
}
async function openDetail(id){
 try{
  const data=await request("/"+id),row=data.chamado;selected=row;
  $("tnDetailProtocol").textContent="ABERTURA DE PEDIDO "+number(row);
  $("tnDetailTitle").textContent="OC "+row.numeroPedidoOC+" · "+row.unidadeEmbarque;
  $("tnDetailMeta").textContent="Solicitante: "+row.nomeSolicitante+" · "+time(row.criadoEm);
  $("tnDetailStatus").dataset.state=row.status;
  $("tnDetailStatus").textContent=({FILA:"Na fila",ANDAMENTO:"Em andamento",PENDENTE:"Pendente",FINALIZADO:"Finalizado",RASCUNHO:"Rascunho"})[row.status]||row.status;
  $("tnDetailOwner").textContent=row.executor?"Executor: "+row.executor:"Aguardando executor";
  $("pedSystemNumber").hidden=row.status!=="FINALIZADO"||!row.numeroPedidoSistema;
  $("pedSystemNumberValue").textContent=row.numeroPedidoSistema||"";
  const info=$("tnDetailInfo");info.replaceChildren();
  for(let i=0;i<FIELDS.length;i++)info.append(detailItem(LABELS[i],row[FIELDS[i]]));
  renderDocs(id,data.anexos||[]);renderChat(data.mensagens||[]);renderHistory(data.historico||[]);
  const isMine=execution&&executor&&row.executor===user;
  const canMove=isMine&&["ANDAMENTO","PENDENTE"].includes(row.status);
  $("tnExecution").hidden=!execution;
  $("tnAssumir").hidden=!(execution&&executor&&row.status==="FILA");
  $("tnStatusForm").hidden=!canMove;
  if(canMove){
   $("tnStatusForm").elements.status.value=row.status;
   $("tnStatusForm").elements.motivo.value="";
   $("tnStatusForm").elements.numeroPedidoSistema.value=row.numeroPedidoSistema||"";
   updateSystemInput();
  }
  $("tnChatForm").hidden=["RASCUNHO","FINALIZADO"].includes(row.status)||(execution&&!isMine);
  $("tnPendingUpload").hidden=execution||row.status!=="PENDENTE";
  showDialog("tnDetailDialog");
 }catch(e){inform(e.message,true);}
}
async function action(path,data,message){
 if(!selected)return;const id=selected.id;
 try{await request("/"+id+path,"POST",data);await refresh();await openDetail(id);inform(message||"Alteração salva.");}
 catch(e){inform(e.message,true);}
}
async function extraDocument(){
 if(!selected)return;
 const file=$("tnAdditionalFile").files[0];
 if(!file)return inform("Selecione um arquivo.",true);
 try{await upload(selected.id,$("tnAdditionalSlot").value,file);await openDetail(selected.id);inform("Documento anexado.");}
 catch(e){inform(e.message,true);}
}
async function boot(){
 try{
  const auth=window.portalAuthReady?await window.portalAuthReady:null;
  const session=window.__PORTAL_TENANT_SESSION||auth?.session||auth;
  if(!session)throw Error("Entre no Portal para acessar Abertura de Pedidos.");
  const expected=window.__PORTAL_TENANT_EXPECTED||"nova-frota";
  if(session.tenantMode===true&&session.transportadoraId!==expected)throw Error("Sessão de outra transportadora.");
  const state=await request("/config");
  if(state.empresa!==expected)throw Error("Sessão pertence a outra transportadora.");
  if(execution?(!state.execucaoHabilitada||!state.executor):!state.solicitacoesHabilitadas)
   throw Error("Abertura de Pedidos ainda não liberada pelo Super Admin para este perfil.");
  executor=state.executor===true;
  user=String(session.usuario||session.user||"").trim();
  if(!user)throw Error("Usuário não identificado.");
  canCreate=state.armazenamentoConfigurado===true;
  if($("tnSwitch"))$("tnSwitch").hidden=!executor;
  if($("tnNew"))$("tnNew").disabled=!canCreate;
  if(!canCreate)inform("Configure o Google Drive da transportadora no Super Admin antes de usar os anexos.",true);
  await refresh();
 }catch(e){
  if($("tnNew"))$("tnNew").disabled=true;
  $("tnBoard").replaceChildren(element("p",e.message,"cad-empty"));
  inform(e.message,true);
 }
}
document.querySelectorAll("[data-close]").forEach(btn=>btn.onclick=()=>hideDialog(btn.dataset.close));
$("tnPreviewDialog").addEventListener("close",clearPreview);
$("tnRefresh").onclick=()=>refresh().catch(e=>inform(e.message,true));
$("tnFilter").onchange=render;$("tnSearch").oninput=render;
$("tnDraftButton").onclick=()=>{draftsExpanded=!draftsExpanded;render();};
if($("tnNew"))$("tnNew").onclick=newForm;
if($("tnForm"))$("tnForm").onsubmit=submitForm;
$("tnAssumir").onclick=()=>action("/assumir",{},"Pedido assumido.");
$("tnStatusForm").elements.status.onchange=updateSystemInput;
$("tnStatusForm").onsubmit=e=>{
 e.preventDefault();const f=e.currentTarget;
 action("/situacao",{status:f.elements.status.value,motivo:f.elements.motivo.value.trim(),
  numeroPedidoSistema:f.elements.numeroPedidoSistema.value.trim()},"Situação atualizada.");
};
$("tnChatForm").onsubmit=e=>{
 e.preventDefault();const txt=e.currentTarget.elements.texto;
 if(!txt.value.trim())return;
 const message=txt.value.trim();txt.value="";
 action("/mensagens",{texto:message},"Mensagem enviada.");
};
$("tnAdditionalSend").onclick=extraDocument;
$("pedCopySystemNumber").onclick=()=>{
 const value=$("pedSystemNumberValue").textContent;
 if(value&&navigator.clipboard)navigator.clipboard.writeText(value).then(()=>inform("Número copiado.")).catch(()=>inform("Não foi possível copiar.",true));
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else void boot();
})();