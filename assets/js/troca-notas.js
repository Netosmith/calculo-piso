(function(){
"use strict";
const $=id=>document.getElementById(id);
const execMode=document.body.dataset.trocaVisao==="execucao";
const API="https://api.portalfrete.net.br/v1/troca-notas";
const STATUSES=[["FILA","Fila","#1876d2"],["ANDAMENTO","Em andamento","#17a273"],
 ["PENDENTE","Pendente","#eb9c19"],["TROCADA","Trocada","#14a36c"]];
const SLOT_LABEL={nota_origem:"Nota de origem",laudo:"Laudo",ticket_pesagem:"Ticket de pesagem",
 ordem:"Ordem",nf_trocada:"NF trocada"};
const REQUIRED=["nota_origem","laudo","ticket_pesagem","ordem"];
const MAX_SIZE=6*1024*1024;
const MIMES=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
let user="",tenant="",executor=false,all=[],current=null,draftId="",busy=false,draftsOpen=false,previewUrl=null,previewSerial=0;
const el=(tag,text="",className="")=>{const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;};
const serial=item=>item?.numero?"#"+String(item.numero).padStart(5,"0"):item?.protocolo||"";
function time(value){if(!value)return "";const d=new Date(String(value).replace(" ","T")+(String(value).includes("Z")?"":"Z"));
 return Number.isFinite(d.getTime())?d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):String(value);}
function alertUser(message,isError=false){const p=$("tnAlert");p.textContent=message;p.className="cad-alert"+(isError?" error":"");p.hidden=false;p.scrollIntoView({block:"nearest",behavior:"smooth"});}
function dialog(id){const x=$(id);if(x&&!x.open)x.showModal();}
function close(id){const x=$(id);if(x?.open)x.close();}
async function api(path="",method="GET",body){
 const headers={Accept:"application/json"},support=window.__PORTAL_TENANT_SESSION?.ownerSupport===true?window.__PORTAL_TENANT_EXPECTED:"";
 if(support)headers["X-Portal-Support-Tenant"]=support;
 if(body!==undefined)headers["Content-Type"]="application/json";
 const uri=API+path+(path.includes("?")?"&":"?")+"visao="+(execMode?"execucao":"solicitante");
 const response=await fetch(uri,{method,headers,credentials:"include",cache:"no-store",
  ...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const result=await response.json().catch(()=>null);
 if(!response.ok)throw Error(result?.error||"Falha ao consultar o Portal (HTTP "+response.status+").");
 return result;
}
function matches(item,query){
 if(!query)return true;
 return [serial(item),item.protocolo,item.cliente,item.filial,item.origem,item.destino,item.executor]
  .some(x=>String(x||"").toUpperCase().includes(query));
}
function card(item){
 const b=el("button","","cad-lane-ticket");b.type="button";
 const top=el("div","","cad-lane-ticket-meta");
 const num=el("span",serial(item),"cad-short-number"),stamp=el("span",time(item.criadoEm));
 top.append(num,stamp);
 const bottom=el("div","","tn-card-bottom");
 bottom.append(el("small",item.executor?"Executor: "+item.executor:"Aguardando executor"),
  el("small",item.status==="TROCADA"?"NF trocada":"Abrir detalhes"));
 b.append(top,el("strong",item.cliente,"tn-client"),el("span",item.filial,"tn-branch"),bottom);
 b.title=serial(item)+" · "+item.cliente+" / "+item.filial;
 b.onclick=()=>openDetail(item.id);
 return b;
}
function render(){
 const board=$("tnBoard");board.replaceChildren();
 const filter=$("tnFilter").value,q=$("tnSearch").value.toUpperCase().trim();
 for(const [key,label,color] of STATUSES){
  const items=all.filter(t=>t.status===key&&(!filter||filter===key)&&matches(t,q));
  const lane=el("section","","cad-lane");lane.style.setProperty("--cad-lane-color",color);
  const head=el("div","","cad-lane-head");head.append(el("strong",label),el("span",String(items.length),"cad-lane-count"));
  lane.append(head);
  const list=el("div","","cad-lane-items");
  if(!items.length)list.append(el("p","Sem solicitações nesta etapa.","cad-lane-empty"));
  for(const item of items)list.append(card(item));
  lane.append(list);board.append(lane);
 }
 const mine=$("tnMine");
 if(mine){
  mine.replaceChildren();
  const mineItems=all.filter(t=>t.executor===user&&["ANDAMENTO","PENDENTE"].includes(t.status));
  if(!mineItems.length)mine.append(el("div","Você não tem trocas de notas em execução.","cad-empty"));
  for(const item of mineItems)mine.append(card(item));
 }
 const toggle=$("tnDraftButton"),tray=$("tnDrafts");
 const drafts=all.filter(t=>t.status==="RASCUNHO");
 if(toggle&&tray){
  toggle.hidden=execMode||!drafts.length;toggle.textContent="Rascunhos ("+drafts.length+")";
  if(!drafts.length)draftsOpen=false;
  tray.hidden=!draftsOpen;tray.replaceChildren();
  if(draftsOpen)for(const t of drafts){
   const b=el("button",serial(t)+" · "+t.cliente+" / "+t.filial,"tn-draft");
   b.type="button";b.onclick=()=>resume(t);tray.append(b);
  }
 }
}
async function refresh(){
 const response=await api();
 all=Array.isArray(response.chamados)?response.chamados:[];
 render();
}
function uploadQueue(){
 return [...document.querySelectorAll("#tnForm [data-slot]")].flatMap(input=>
  [...input.files].map(file=>({slot:input.dataset.slot,file})));
}
function validateFile(file){
 if(!file||!MIMES.has(file.type)||file.size<1||file.size>MAX_SIZE)
  throw Error("Envie PDF, JPG, PNG ou WebP com até 6 MB: "+(file?.name||"arquivo"));
}
function base64(file){
 return new Promise((resolve,reject)=>{
  const r=new FileReader();r.onerror=()=>reject(Error("Não foi possível ler o arquivo."));
  r.onload=()=>resolve(String(r.result).split(",")[1]||"");
  r.readAsDataURL(file);
 });
}
async function upload(id,slot,file){
 validateFile(file);
 return api("/"+id+"/anexos","POST",{slot,nome:file.name,mime:file.type,base64:await base64(file)});
}
function populate(select,values,placeholder,desired=""){
 select.replaceChildren();
 const empty=document.createElement("option");empty.value="";empty.textContent=placeholder;select.append(empty);
 for(const val of values){
  const o=document.createElement("option");o.value=val;o.textContent=val;select.append(o);
 }
 if(values.includes(desired))select.value=desired;
}
async function loadOptions(row=null){
 const r=await api("/opcoes");
 const clients=Array.isArray(r.clientes)?r.clientes:[];
 const branches=Array.isArray(r.filiais)?r.filiais:[];
 if(!clients.length||!branches.length)throw Error("Cadastre clientes e filiais ativos no Portal antes de abrir uma troca.");
 populate($("tnCliente"),clients,"Selecione o cliente",row?.cliente);
 populate($("tnFilial"),branches,"Selecione a filial",row?.filial);
}
async function newForm(){
 draftId="";const f=$("tnForm");f.reset();
 $("tnFormTitle").textContent="Nova solicitação de troca de notas";
 $("tnFormProgress").textContent="Carregando clientes e filiais...";
 $("tnEnviar").disabled=true;dialog("tnFormDialog");
 try{await loadOptions();$("tnFormProgress").textContent="Preencha os campos e anexe os documentos."; $("tnEnviar").disabled=false;}
 catch(e){$("tnFormProgress").textContent=e.message;alertUser(e.message,true);}
}
async function resume(row){
 if(execMode)return;
 draftId=row.id;
 const f=$("tnForm");f.reset();dialog("tnFormDialog");
 $("tnFormTitle").textContent="Continuar solicitação "+serial(row);
 $("tnFormProgress").textContent="Consultando dados e anexos já recebidos...";
 $("tnEnviar").disabled=true;
 try{
  await loadOptions(row);
  for(const name of ["origem","localColeta","destino","localDescarga"])f.elements[name].value=row[name]||"";
  const details=await api("/"+row.id);
  const done=new Set((details.anexos||[]).map(x=>x.slot));
  $("tnFormProgress").textContent=done.size+" anexo(s) já salvos. Selecione somente os que faltam.";
  $("tnEnviar").disabled=false;
 }catch(e){$("tnFormProgress").textContent=e.message;alertUser(e.message,true);}
}
async function submit(event){
 event.preventDefault();if(busy)return;
 const button=$("tnEnviar"),progress=$("tnFormProgress"),form=$("tnForm"),selected=uploadQueue();
 busy=true;button.disabled=true;
 try{
  if(!draftId){
   const payload=Object.fromEntries(new FormData(form).entries());
   for(const key of ["cliente","filial","origem","localColeta","destino","localDescarga"])
    payload[key]=String(payload[key]||"").trim();
   progress.textContent="Criando protocolo...";
   const response=await api("","POST",payload);
   draftId=response.chamado.id;
  }
  for(let i=0;i<selected.length;i++){
   progress.textContent="Enviando "+(i+1)+"/"+selected.length+": "+SLOT_LABEL[selected[i].slot];
   await upload(draftId,selected[i].slot,selected[i].file);
  }
  progress.textContent="Verificando os quatro documentos...";
  const result=await api("/"+draftId+"/enviar","POST",{});
  draftId="";close("tnFormDialog");
  alertUser("Troca de Notas "+(result.numero?"#"+String(result.numero).padStart(5,"0"):"")+" enviada para a fila.");
  await refresh();
 }catch(error){
  progress.textContent="Envio incompleto. "+error.message+" Seu rascunho e os anexos concluídos foram preservados.";
  try{await refresh()}catch(_){}
 }finally{busy=false;button.disabled=false;}
}
function infoItem(label,value){const x=el("div");x.append(el("span",label),el("strong",value||"Não informado"));return x;}
async function fetchDoc(ticketId,doc){
 const headers={Accept:doc.mime||"application/octet-stream"};
 if(window.__PORTAL_TENANT_SESSION?.ownerSupport===true)headers["X-Portal-Support-Tenant"]=window.__PORTAL_TENANT_EXPECTED;
 const r=await fetch(API+"/"+ticketId+"/anexos/"+doc.id+"?visao="+(execMode?"execucao":"solicitante"),
  {credentials:"include",cache:"no-store",headers});
 if(!r.ok)throw Error("Documento privado não disponível.");
 return r.blob();
}
function clearPreview(){
 previewSerial++;if(previewUrl)URL.revokeObjectURL(previewUrl);
 previewUrl=null;$("tnPreviewBody").replaceChildren();
}
async function downloadDoc(id,doc){
 try{
  const blob=await fetchDoc(id,doc),url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=doc.nome||"documento";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),6000);
 }catch(e){alertUser(e.message,true);}
}
async function preview(id,doc){
 clearPreview();const seq=previewSerial;
 $("tnPreviewTitle").textContent=doc.nome;
 $("tnPreviewBody").append(el("p","Carregando documento privado..."));
 $("tnDownload").onclick=()=>downloadDoc(id,doc);
 dialog("tnPreviewDialog");
 try{
  const blob=await fetchDoc(id,doc);if(seq!==previewSerial)return;
  previewUrl=URL.createObjectURL(blob);const body=$("tnPreviewBody");body.replaceChildren();
  if(doc.mime==="application/pdf"){
   const frame=document.createElement("iframe");frame.className="cad-preview-pdf";frame.src=previewUrl;
   frame.title="Pré-visualização PDF";frame.setAttribute("sandbox","allow-scripts");body.append(frame);
  }else{const img=document.createElement("img");img.className="cad-preview-image";img.alt="Documento privado";img.src=previewUrl;body.append(img);}
 }catch(e){if(seq===previewSerial)$("tnPreviewBody").replaceChildren(el("p",e.message));}
}
function renderFiles(id,docs){
 const root=$("tnDetailDocs");root.replaceChildren();
 if(!docs.length)root.append(el("p","Nenhum documento ainda.","cad-tip"));
 for(const doc of docs){
  const line=el("div","","tn-file"),title=el("strong",SLOT_LABEL[doc.slot]+": "+doc.nome);
  const buttons=el("div");
  const view=el("button","Visualizar","secondary"),dl=el("button","Baixar","secondary");
  view.type=dl.type="button";view.onclick=()=>preview(id,doc);dl.onclick=()=>downloadDoc(id,doc);
  buttons.append(view,dl);line.append(title,buttons);root.append(line);
 }
}
function renderMessages(items){
 const root=$("tnMessages");root.replaceChildren();
 if(!items.length)root.append(el("div","Nenhuma mensagem ainda.","cad-msg"));
 for(const entry of items){
  const msg=el("div","","cad-msg"+(entry.autor_id===user?" mine":""));
  msg.append(el("small",entry.autor_id+" · "+time(entry.criado_em)),el("p",entry.texto));
  root.append(msg);
 }
}
function renderHistory(items){
 const root=$("tnHistory");root.replaceChildren();
 for(const entry of items){
  const line=el("div","","cad-history-item");
  line.append(el("strong",entry.descricao),el("small",entry.autor_id+" · "+time(entry.criado_em)));
  root.append(line);
 }
}
async function openDetail(id){
 try{
  const data=await api("/"+id),r=data.chamado;
  current=r;
  $("tnDetailProtocol").textContent="TROCA DE NOTAS "+serial(r);
  $("tnDetailTitle").textContent=r.cliente+" · "+r.filial;
  $("tnDetailMeta").textContent="Solicitado por "+r.solicitante+" · "+time(r.criadoEm);
  $("tnDetailStatus").textContent=r.status==="TROCADA"?"Trocada":r.status==="ANDAMENTO"?"Em andamento":r.status==="PENDENTE"?"Pendente":r.status==="FILA"?"Na fila":"Rascunho";
  $("tnDetailStatus").dataset.state=r.status;
  $("tnDetailOwner").textContent=r.executor?"Executor: "+r.executor:"Aguardando responsável";
  const inf=$("tnDetailInfo");inf.replaceChildren();
  for(const [key,value] of [["Cliente",r.cliente],["Filial",r.filial],["Origem",r.origem],
   ["Local de coleta",r.localColeta],["Destino",r.destino],["Local de descarga",r.localDescarga],
   ["Solicitante",r.solicitante]])inf.append(infoItem(key,value));
  renderFiles(id,data.anexos||[]);renderMessages(data.mensagens||[]);renderHistory(data.historico||[]);
  const canAssume=execMode&&executor&&r.status==="FILA";
  const canExecute=execMode&&executor&&r.executor===user&&["ANDAMENTO","PENDENTE"].includes(r.status);
  $("tnExecution").hidden=!execMode;
  $("tnAssumir").hidden=!canAssume;
  $("tnStatusForm").hidden=!canExecute;
  if(canExecute){
   $("tnStatusForm").elements.status.value=r.status;
   $("tnStatusForm").elements.motivo.value="";
  }
  $("tnChatForm").hidden=r.status==="RASCUNHO";
  $("tnPendingUpload").hidden=execMode||r.status!=="PENDENTE";
  dialog("tnDetailDialog");
 }catch(e){alertUser(e.message,true);}
}
async function action(path,payload,successText="Atualização salva."){
 if(!current)return;
 const id=current.id;
 try{await api("/"+id+path,"POST",payload);await refresh();await openDetail(id);alertUser(successText);}
 catch(e){alertUser(e.message,true);}
}
async function sendExtra(){
 if(!current)return;
 const file=$("tnAdditionalFile").files[0];
 if(!file)return alertUser("Selecione um documento.",true);
 try{await upload(current.id,$("tnAdditionalSlot").value,file);await openDetail(current.id);alertUser("Documento anexado.");}
 catch(e){alertUser(e.message,true);}
}
async function sendFinal(){
 if(!current)return;
 const file=$("tnFinalFile").files[0];
 if(!file)return alertUser("Selecione a NF trocada.",true);
 try{await upload(current.id,"nf_trocada",file);await openDetail(current.id);alertUser("NF trocada anexada. Agora você pode concluir o processo.");}
 catch(e){alertUser(e.message,true);}
}
async function boot(){
 try{
  const auth=window.portalAuthReady?await window.portalAuthReady:null;
  const session=window.__PORTAL_TENANT_SESSION||auth?.session||auth;
  if(!session)throw Error("Entre no Portal para acessar Troca de Notas.");
  const expected=window.__PORTAL_TENANT_EXPECTED||"nova-frota";
  if(session.tenantMode===true&&session.transportadoraId!==expected)throw Error("Sessão pertence a outra transportadora.");
  const result=await api("/config");
  tenant=result.empresa;
  if(tenant!==expected)throw Error("Sessão de outra transportadora.");
  if(execMode?!result.execucaoHabilitada||!result.executor:!result.solicitacoesHabilitadas)
   throw Error("Módulo de Troca de Notas ainda não liberado pelo Super Admin para este perfil.");
  executor=result.executor===true;
  user=String(session.usuario||session.user||"").trim();
  if(!user)throw Error("Não foi possível identificar o usuário.");
  if($("tnSwitch"))$("tnSwitch").hidden=!executor;
  if($("tnNew"))$("tnNew").disabled=!result.armazenamentoConfigurado;
  if(!result.armazenamentoConfigurado)alertUser("Configure o Google Drive da empresa no Super Admin antes de enviar documentos.",true);
  await refresh();
 }catch(error){
  if($("tnNew"))$("tnNew").disabled=true;
  $("tnBoard").replaceChildren(el("p",error.message,"cad-empty"));
  alertUser(error.message,true);
 }
}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>close(b.dataset.close));
$("tnPreviewDialog").addEventListener("close",clearPreview);
$("tnRefresh").onclick=refresh;
$("tnFilter").onchange=render;
$("tnSearch").oninput=render;
if($("tnDraftButton"))$("tnDraftButton").onclick=()=>{draftsOpen=!draftsOpen;render();};
if($("tnNew"))$("tnNew").onclick=newForm;
if($("tnForm"))$("tnForm").onsubmit=submit;
$("tnAssumir").onclick=()=>action("/assumir",{},"Chamado assumido e movido para Andamento.");
$("tnStatusForm").onsubmit=e=>{
 e.preventDefault();const f=e.currentTarget;
 action("/situacao",{status:f.elements.status.value,motivo:f.elements.motivo.value.trim()},"Situação atualizada.");
};
$("tnChatForm").onsubmit=e=>{
 e.preventDefault();const input=e.currentTarget.elements.texto;
 if(!input.value.trim())return;
 const text=input.value.trim();action("/mensagens",{texto:text},"Mensagem enviada.");input.value="";
};
$("tnAdditionalSend").onclick=sendExtra;
$("tnFinalUpload").onclick=sendFinal;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else void boot();
})();
