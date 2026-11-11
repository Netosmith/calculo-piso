(function(){
"use strict";
const $=id=>document.getElementById(id);
const executionView=document.body.dataset.cadastroVisao==="execucao";
const view=executionView?"execucao":"solicitante";
const root="https://api.portalfrete.net.br/v1/cadastro-solicitacoes";
const SLOTS=["cavalo","carreta","antt","cnh","endereco","motorista","caminhao","motorista_caminhao"];
const STEPS=["RECEBIMENTO","CONFERENCIA DOCUMENTAL","CONSULTA REFERENCIAS","CADASTRO SISTEMA TERCEIRO","REVISAO","CONCLUIDO"];
let all=[],executor=false,storage=false,selected=null,draftId="",busy=false,userId="";
let previewBlobUrl=null,previewSequence=0,checklistBusy=false;
const CHECK_LABELS={criminal:"Consulta criminal",cnh:"Validação CNH",documentos:"Documentos",biometria:"Biometria",referencia1:"Referência 1",referencia2:"Referência 2",referencia3:"Referência 3",telefone_proprietario:"Telefone proprietário",telefone_motorista:"Telefone motorista"};
const CHECK_STATUS={OK:"Conferido",PENDENTE:"Pendente",REVISAR:"Revisar"};
function smallProgress(done){
 const value=Math.max(0,Math.min(9,Number(done)||0));
 const holder=el("div","","cad-mini-progress");
 const label=el("small",value+"/9 conferências");
 const track=el("div","","cad-mini-progress-track");
 const bar=el("span","","cad-mini-progress-fill");bar.style.width=(value*100/9)+"%";
 track.append(bar);holder.append(label,track);return holder;
}

const iso=d=>{if(!d)return"";const value=new Date(String(d).replace(" ","T")+"Z");return isNaN(value)?String(d):value.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})};
const titleStatus=s=>({RASCUNHO:"Rascunho",FILA:"Na fila",ANDAMENTO:"Em andamento","AGUARDANDO APROVACAO":"Aguardando aprovação",PENDENTE:"Pendente",REPROVADO:"Reprovado",APROVADO:"Aprovado"}[s]||s);
const el=(tag,txt="",cls="")=>{const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=txt;return node;};
function alertMsg(text,error=false){const box=$("cadAlert");box.textContent=text;box.className="cad-alert"+(error?" error":"");box.hidden=false;box.scrollIntoView({block:"nearest",behavior:"smooth"});}
async function api(path="",method="GET",body){
 const headers={"Accept":"application/json"};
 const support=window.__PORTAL_TENANT_SESSION?.ownerSupport===true?window.__PORTAL_TENANT_EXPECTED:"";
 if(support)headers["X-Portal-Support-Tenant"]=support;
 if(body!==undefined)headers["Content-Type"]="application/json";
 const resource=path!=="/config"?path+(path.includes("?")?"&":"?")+"visao="+view:path;
 const response=await fetch(root+resource,{method,credentials:"include",cache:"no-store",headers,body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.error||"Falha ao consultar o Portal (HTTP "+response.status+").");
 return data;
}
function showDialog(id){const d=$(id);if(!d.open)d.showModal();}
function closeDialog(id){$(id).close();}
function statusChip(s){const span=el("span",titleStatus(s),"cad-status");span.dataset.state=s;return span;}
function applyCounts(){for(const [id,statuses] of [["cadFila",["FILA"]],["cadAndamento",["ANDAMENTO","AGUARDANDO APROVACAO"]],["cadPendente",["PENDENTE","REPROVADO"]],["cadAprovados",["APROVADO"]]])$(id).textContent=all.filter(x=>statuses.includes(x.status)).length;}
function renderBoard(){
 if(!executionView)return;
 const board=$("cadKanban");board.replaceChildren();
 const search=$("cadBusca").value.trim().toUpperCase(),filter=$("cadFiltro").value;
 const base=all.filter(t=>(!filter||t.status===filter)&&
   [t.protocolo,t.motorista,t.placas,t.solicitante].some(v=>String(v||"").toUpperCase().includes(search)));
 const lanes=[
  ["FILA","Fila","#1475da"],["ANDAMENTO","Em andamento","#1c9d68"],
  ["AGUARDANDO APROVACAO","Aguardando aprovação","#6559d5"],
  ["PENDENTE","Pendente","#e2a329"],["REPROVADO","Reprovado","#da5156"],
  ["APROVADO","Aprovado","#16a46f"]
 ];
 for(const [status,label,color] of lanes){
  const items=base.filter(t=>t.status===status);
  const lane=el("section","","cad-lane");
  lane.style.setProperty("--cad-lane-color",color);
  const head=el("div","","cad-lane-head");
  head.append(el("strong",label),el("span",String(items.length),"cad-lane-count"));
  lane.append(head);
  const list=el("div","","cad-lane-items");
  if(!items.length)list.append(el("p","Sem chamados nesta etapa.","cad-lane-empty"));
  for(const ticket of items.slice(0,30)){
   const b=el("button","","cad-lane-ticket");b.type="button";
   const meta=el("div","","cad-lane-ticket-meta");
   meta.append(el("span",ticket.protocolo),el("span",iso(ticket.criadoEm)));
   b.append(meta,el("strong",ticket.motorista),el("span",ticket.placas),
     el("small",ticket.executor?"Executor: "+ticket.executor:"Aguardando responsável"),
     smallProgress(ticket.conferidos));
   if(ticket.status==="FILA")b.append(el("em","Clique para assumir →"));
   b.onclick=()=>openDetail(ticket.id);list.append(b);
  }
  lane.append(list);board.append(lane);
 }
}

async function assumeTicket(id){
 try{await api("/"+id+"/assumir","POST",{});await refresh();await openDetail(id);}
 catch(error){alertMsg(error.message,true);await refresh().catch(()=>{});}
}
function render(){
 applyCounts();renderBoard();
 const query=$("cadBusca").value.trim().toUpperCase(),filter=$("cadFiltro").value;
 const rows=all.filter(x=>(!filter||x.status===filter)&&[x.protocolo,x.motorista,x.placas,x.solicitante].some(v=>String(v||"").toUpperCase().includes(query)));
 const grid=$("cadTickets");grid.replaceChildren();
 if(!rows.length){grid.append(el("div","Nenhuma solicitação encontrada.","cad-empty"));return;}
 for(const c of rows){
  const b=el(executionView?"article":"button","","cad-ticket");if(!executionView)b.type="button";
  const head=el("div","","cad-ticket-head");head.append(el("strong",c.protocolo),statusChip(c.status));b.append(head);
  b.append(el("h3",c.motorista),el("p",c.placas),smallProgress(c.conferidos));
  if(!executionView)b.append(el("div",c.executor?"Responsável: "+c.executor:"Aguardando responsável","cad-ticket-assignee"));
  const foot=el("div","","cad-ticket-foot");foot.append(el("span",iso(c.criadoEm)),el("span",c.status==="RASCUNHO"?"Completar anexos":c.executor?"Executor: "+c.executor:"Abrir detalhes"));b.append(foot);
  if(executionView){
   const actions=el("div","","cad-ticket-actions"),details=el("button","Abrir análise","secondary");
   details.type="button";details.onclick=()=>openDetail(c.id);actions.append(details);
   if(c.status==="FILA"){const take=el("button","Assumir chamado","primary");take.type="button";take.onclick=()=>assumeTicket(c.id);actions.prepend(take);}
   b.append(actions);
  }else b.onclick=()=>c.status==="RASCUNHO"?resume(c):openDetail(c.id);
  grid.append(b);
 }
}
async function refresh(){
 const d=await api();
 if(executionView&&!d.executor)throw Error("Acesso restrito aos executores autorizados.");
 all=d.chamados||[];executor=!!d.executor;storage=!!d.armazenamento?.configurado;
 $("cadListaTitulo").textContent=executionView?"Todos os protocolos recebidos":"Minhas solicitações";
 $("cadListaSub").textContent=executionView?"Controle da fila geral e dos processos da transportadora.":"Acompanhe apenas os protocolos que você abriu.";
 const create=$("cadNovo");
 if(create){create.disabled=!storage;create.title=storage?"Abrir solicitação":"Configure o Google Drive no Super Admin";}
 render();
}
function resume(row){
 draftId=row.id;
 const form=$("cadForm");form.reset();
 for(const key of ["motorista","contatoMotorista","proprietario","contatoProprietario","placas","observacoes"])form.elements[key].value=row[key]||"";
 (row.referencias||[]).forEach((ref,i)=>{form.elements["ref"+(i+1)+"nome"].value=ref.nome;form.elements["ref"+(i+1)+"telefone"].value=ref.telefone});
 $("cadFormTitle").textContent="Complementar "+row.protocolo;
 $("cadFormProgress").textContent="Selecione os documentos faltantes. Os anexos já enviados permanecem salvos.";
 showDialog("cadFormDialog");
}
function newTicket(){
 draftId="";$("cadForm").reset();$("cadFormTitle").textContent="Solicitação de cadastro";
 $("cadFormProgress").textContent="Preencha todos os dados e anexe os documentos.";
 showDialog("cadFormDialog");
}
function filesSelected(){return [...document.querySelectorAll("[data-slot]")].flatMap(input=>[...input.files].map(file=>({slot:input.dataset.slot,file})));}
function validateFiles(list){
 for(const item of list){
  if(item.file.size<1||item.file.size>6*1024*1024)throw Error(item.file.name+" precisa ter até 6 MB.");
  if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(item.file.type))throw Error("Formato inválido: "+item.file.name);
 }
 if(!draftId){const present=new Set(list.map(item=>item.slot));const missing=SLOTS.filter(s=>!present.has(s));if(missing.length)throw Error("Anexe todos os documentos obrigatórios. Faltam: "+missing.join(", "));}
}
async function base64(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(Error("Não foi possível ler "+file.name));
  reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");reader.readAsDataURL(file);
 });
}
async function sendForm(event){
 event.preventDefault();if(busy)return;
 const form=$("cadForm"),btn=$("cadEnviar"),progress=$("cadFormProgress");
 try{
  const chosen=filesSelected();validateFiles(chosen);
  busy=true;btn.disabled=true;
  if(!draftId){
   const payload=Object.fromEntries(new FormData(form).entries());
   payload.referencias=[1,2,3].map(n=>({nome:payload["ref"+n+"nome"],telefone:payload["ref"+n+"telefone"]}));
   for(let n=1;n<=3;n++){delete payload["ref"+n+"nome"];delete payload["ref"+n+"telefone"];}
   progress.textContent="Criando protocolo de cadastro...";
   const result=await api("","POST",payload);draftId=result.chamado.id;
  }
  for(let i=0;i<chosen.length;i++){
   const {slot,file}=chosen[i];progress.textContent="Enviando "+(i+1)+" de "+chosen.length+": "+file.name;
   await api("/"+draftId+"/anexos","POST",{slot,nome:file.name,mime:file.type,base64:await base64(file)});
  }
  progress.textContent="Conferindo os anexos e encaminhando à fila...";
  const result=await api("/"+draftId+"/enviar","POST",{});
  closeDialog("cadFormDialog");alertMsg("Solicitação "+result.protocolo+" enviada! Situação: FILA.");
  draftId="";await refresh();
 }catch(error){progress.textContent="Envio incompleto. "+error.message+" O rascunho foi preservado.";await refresh().catch(()=>{});}
 finally{busy=false;btn.disabled=false;}
}
function itemInfo(label,value){const box=el("div");box.append(el("span",label),el("strong",value||"Não informado"));return box;}
async function openDetail(id){
 try{
  const d=await api("/"+id);selected=d.chamado;
  $("cadDetailProtocolo").textContent=selected.protocolo;
  $("cadDetailTitle").textContent=selected.motorista;
  $("cadDetailMeta").textContent=titleStatus(selected.status)+" · Aberto em "+iso(selected.criadoEm)+" · Solicitante: "+selected.solicitante;
  const badge=$("cadDetailStatus");badge.textContent=titleStatus(selected.status);badge.dataset.state=selected.status;
  $("cadDetailOwner").textContent=selected.executor?"Executor: "+selected.executor:"Aguardando responsável";
  const info=$("cadDetailInfo");info.replaceChildren();
  [["Motorista",selected.motorista],["Telefone do motorista",selected.contatoMotorista],
   ["Proprietário",selected.proprietario],["Telefone do proprietário",selected.contatoProprietario],
   ["Placas",selected.placas],["Solicitante",selected.solicitante]].forEach(values=>info.append(itemInfo(...values)));
  (selected.referencias||[]).forEach((ref,i)=>info.append(itemInfo("Referência "+(i+1),String(ref.nome||"")+" · "+String(ref.telefone||""))));
  if(selected.observacoes)info.append(itemInfo("Observações",selected.observacoes));
  const checklist=$("cadChecklist");checklist.replaceChildren();
  const checks=Array.isArray(d.checklist)?d.checklist:[];
  const done=checks.filter(item=>item.estado==="OK").length;
  $("cadChecklistCount").textContent=done+" / "+checks.length+" conferidos";
  const progress=$("cadProgressTrack");progress.setAttribute("aria-valuemax",String(checks.length||9));
  progress.setAttribute("aria-valuenow",String(done));
  $("cadProgressBar").style.width=(checks.length?Math.round(done*100/checks.length):0)+"%";
  const canMark=executionView&&executor&&selected.executor===userId&&
    !["FILA","RASCUNHO","APROVADO","REPROVADO"].includes(selected.status);
  $("cadChecklistHelp").textContent=canMark?
    "Marque cada conferência. O histórico registra automaticamente o usuário, o horário e o resultado.":
    "Acompanhe a análise da equipe. Cada mudança aparece no histórico do protocolo.";
  for(const check of checks){
   const line=el("div","","cad-check-row");
   line.dataset.checkState=check.estado;
   const leading=el("span",check.estado==="OK"?"✓":check.estado==="REVISAR"?"!":"·","cad-check-icon");
   const txt=el("div","","cad-check-text");
   txt.append(el("strong",check.label||CHECK_LABELS[check.key]||check.key));
   if(check.atualizadoEm)txt.append(el("small","Atualizado por "+check.autor+" · "+iso(check.atualizadoEm)));
   const result=el("span",CHECK_STATUS[check.estado]||"Pendente","cad-check-state");
   line.append(leading,txt,result);
   if(canMark){
    const options=el("select","","cad-check-select");
    options.setAttribute("aria-label","Resultado: "+(check.label||check.key));
    for(const [key,label] of [["PENDENTE","Pendente"],["OK","Conferido"],["REVISAR","Revisar"]]){
     const option=document.createElement("option");option.value=key;option.textContent=label;
     options.append(option);
    }
    options.value=check.estado;options.disabled=checklistBusy;
    options.onchange=async()=>{
     if(checklistBusy)return;
     checklistBusy=true;options.disabled=true;
     try{
      await api("/"+selected.id+"/checklist","POST",{item:check.key,estado:options.value});
      const id=selected.id;await refresh();await openDetail(id);
     }catch(error){alertMsg("Falha ao salvar conferência: "+error.message,true);options.value=check.estado;options.disabled=false;}
     finally{checklistBusy=false;}
    };
    line.append(options);
   }
   checklist.append(line);
  }
  const steps=$("cadEtapas");steps.replaceChildren();const current=STEPS.indexOf(selected.etapa);
  STEPS.forEach((name,i)=>steps.append(el("div",(i+1)+". "+name,"cad-step"+(i<=current?" done":""))));
  const docs=$("cadAnexos");docs.replaceChildren();
  if(!(d.anexos||[]).length)docs.append(el("p","Nenhum arquivo anexado ainda.","cad-tip"));
  for(const doc of d.anexos||[]){
   const row=el("div","","cad-file-item");
   const icon=el("span",doc.mime==="application/pdf"?"PDF":"IMG","cad-file-icon");
   const detail=el("div","","cad-file-details");
   detail.append(el("strong",doc.nome),el("small",String(doc.slot||"").replaceAll("_"," ")+" · "+(Number(doc.bytes||0)/1048576).toFixed(1)+" MB"));
   const actions=el("div","","cad-file-actions");
   const viewButton=el("button","Visualizar","secondary");viewButton.type="button";
   viewButton.onclick=()=>previewDoc(id,doc);
   const download=el("button","Baixar","secondary");download.type="button";
   download.onclick=()=>downloadDoc(id,doc);
   actions.append(viewButton,download);row.append(icon,detail,actions);docs.append(row);
  }
  const hist=$("cadHistorico");hist.replaceChildren();
  for(const entry of d.historico||[]){
   const box=el("div","","cad-history-item");
   box.append(el("strong",entry.motivo?.startsWith("Checklist:")?"Verificação atualizada":titleStatus(entry.status)+" · "+entry.etapa));
   if(entry.motivo)box.append(el("p",entry.motivo));
   box.append(el("small","Responsável: "+(entry.autor_id||"")+" · "+iso(entry.criado_em)));hist.append(box);
  }
  const chat=$("cadMensagens");chat.replaceChildren();
  if(!(d.mensagens||[]).length)chat.append(el("div","Nenhuma mensagem ainda.","cad-msg"));
  for(const m of d.mensagens||[]){
   const box=el("div","","cad-msg"+(m.autor_id===selected.solicitante?" mine":""));
   box.append(el("small",m.autor_id+" · "+iso(m.criado_em)),el("div",m.texto));chat.append(box);
  }
  const exec=$("cadExecucao");
  if(exec){
   exec.hidden=!executionView||!executor;
   $("cadAssumir").hidden=!executor||selected.status!=="FILA";
   $("cadStatusForm").hidden=!executor||["FILA","RASCUNHO"].includes(selected.status)||
     Boolean(selected.executor&&selected.executor!==userId);
   $("cadStatusForm").elements.status.value=["RASCUNHO","FILA"].includes(selected.status)?"ANDAMENTO":selected.status;
   $("cadStatusForm").elements.etapa.value=selected.etapa;
  }
  $("cadChatForm").hidden=selected.status==="RASCUNHO";
  if($("cadPendenciaForm"))$("cadPendenciaForm").hidden=selected.status!=="PENDENTE"||selected.solicitante!==userId;
  showDialog("cadDetailDialog");
 }catch(error){alertMsg(error.message,true);}
}
async function fetchPrivateDoc(id,doc){
 const headers={"Accept":doc.mime||"application/octet-stream"};
 const support=window.__PORTAL_TENANT_SESSION?.ownerSupport===true?window.__PORTAL_TENANT_EXPECTED:"";
 if(support)headers["X-Portal-Support-Tenant"]=support;
 const response=await fetch(root+"/"+id+"/anexos/"+doc.id+"?visao="+view,
   {credentials:"include",cache:"no-store",headers});
 if(!response.ok)throw Error("Não foi possível carregar este arquivo.");
 const blob=await response.blob();
 if(blob.size>6*1024*1024)throw Error("Arquivo excede o limite de visualização.");
 return blob;
}
function resetPreview(){
 previewSequence++;
 if(previewBlobUrl)URL.revokeObjectURL(previewBlobUrl);
 previewBlobUrl=null;
 $("cadPreviewBody").replaceChildren();
 $("cadPreviewDownload").onclick=null;
}
async function previewDoc(id,doc){
 resetPreview();const seq=previewSequence;
 const body=$("cadPreviewBody");body.append(el("p","Carregando visualização privada...","cad-tip"));
 $("cadPreviewTitle").textContent=doc.nome;
 $("cadPreviewDownload").onclick=()=>downloadDoc(id,doc);
 showDialog("cadPreviewDialog");
 try{
  const blob=await fetchPrivateDoc(id,doc);
  if(seq!==previewSequence)return;
  previewBlobUrl=URL.createObjectURL(blob);body.replaceChildren();
  if(doc.mime.startsWith("image/")){
   const img=document.createElement("img");img.src=previewBlobUrl;img.alt="Visualização de "+doc.nome;
   img.className="cad-preview-image";body.append(img);
  }else if(doc.mime==="application/pdf"){
   const frame=document.createElement("iframe");frame.src=previewBlobUrl;
   frame.title="Visualização do PDF";frame.className="cad-preview-pdf";
   frame.setAttribute("sandbox","allow-scripts");
   body.append(frame,el("small","Caso o PDF não apareça no navegador, use Baixar documento.","cad-tip"));
  }else body.append(el("p","Visualização indisponível para este formato. Use Baixar documento.","cad-tip"));
 }catch(error){
  if(seq===previewSequence){body.replaceChildren(el("p",error.message,"cad-tip"));}
 }
}
async function downloadDoc(id,doc){
 try{
  const headers={},support=window.__PORTAL_TENANT_SESSION?.ownerSupport===true?window.__PORTAL_TENANT_EXPECTED:"";
  if(support)headers["X-Portal-Support-Tenant"]=support;
  const resp=await fetch(root+"/"+id+"/anexos/"+doc.id+"?visao="+view,{credentials:"include",cache:"no-store",headers});
  if(!resp.ok)throw Error("Não foi possível acessar este documento.");
  const blob=await resp.blob(),url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=doc.nome;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 }catch(error){alertMsg(error.message,true);}
}
async function mutate(path,payload){
 try{await api("/"+selected.id+path,"POST",payload);await refresh();await openDetail(selected.id);}
 catch(error){alertMsg(error.message,true);}
}
async function boot(){
 try{
  const result=await fetch("https://api.portalfrete.net.br/v1/session",{credentials:"include",cache:"no-store"}).then(r=>r.json());
  const s=window.__PORTAL_TENANT_SESSION||result.session;
  if(!s?.usuario)throw Error("Sessão não autenticada.");
  userId=String(s.usuario||"");
  if($("cadCompany"))$("cadCompany").textContent=s.transportadoraNome||"NOVA FROTA";
  if($("cadProfile"))$("cadProfile").textContent=s.perfil||"USUÁRIO";
  if(typeof bindLogoutButton==="function")bindLogoutButton();
  const config=await api("/config");
  executor=!!config.executor;
  window.__PORTAL_CADASTRO_EXECUTOR=executor;
  if(executionView&&!config.execucaoHabilitada)throw Error("Módulo de Execução desativado para esta transportadora.");
  if(!executionView&&!config.solicitacoesHabilitadas)throw Error("Módulo de Solicitações desativado no Super Admin desta transportadora.");
  if(executionView&&!executor)throw Error("Central restrita aos executores autorizados.");
  if($("cadSwitchLink"))$("cadSwitchLink").hidden=!executor;
  if(typeof renderPortalGlobalNav==="function")renderPortalGlobalNav();
  await refresh();
  if(!storage)alertMsg(executionView?
    "A pasta Google Drive desta transportadora ainda precisa ser configurada.":
    "O formulário está pronto, mas a pasta e a chave Google Drive precisam ser configuradas no Super Admin desta transportadora.",true);
 }catch(error){alertMsg("Não foi possível abrir o módulo: "+error.message,true);if($("cadNovo"))$("cadNovo").disabled=true;}
}
for(const close of document.querySelectorAll("[data-close]"))close.onclick=()=>closeDialog(close.dataset.close);
$("cadPreviewDialog").addEventListener("close",resetPreview);
if($("cadNovo"))$("cadNovo").onclick=newTicket;
if($("cadForm"))$("cadForm").addEventListener("submit",sendForm);
$("cadAtualizar").onclick=()=>refresh().catch(e=>alertMsg(e.message,true));
$("cadBusca").addEventListener("input",render);$("cadFiltro").addEventListener("change",render);
if($("cadAssumir"))$("cadAssumir").onclick=()=>assumeTicket(selected.id);
if($("cadStatusForm"))$("cadStatusForm").addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget;await mutate("/situacao",{status:f.elements.status.value,etapa:f.elements.etapa.value,motivo:f.elements.motivo.value});});
$("cadChatForm").addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget;const texto=f.elements.texto.value.trim();if(!texto)return;await mutate("/mensagens",{texto});f.reset();});
if($("cadPendenciaForm"))$("cadPendenciaForm").addEventListener("submit",async event=>{
 event.preventDefault();if(!selected||busy)return;
 const f=event.currentTarget,slot=f.elements.slot.value,file=f.elements.arquivo.files?.[0],status=$("cadPendenciaProgress");
 if(!file)return;
 try{
  validateFiles([{slot,file}]);
  busy=true;f.querySelector('button[type="submit"]').disabled=true;
  status.textContent="Enviando documentação complementar...";
  await api("/"+selected.id+"/anexos","POST",{slot,nome:file.name,mime:file.type,base64:await base64(file)});
  await api("/"+selected.id+"/mensagens","POST",{texto:"Enviei documentação complementar: "+file.name});
  status.textContent="Documento recebido. Aguarde a revisão da equipe.";
  f.reset();await openDetail(selected.id);await refresh();
 }catch(error){status.textContent="Falha no complemento: "+error.message;}
 finally{busy=false;f.querySelector('button[type="submit"]').disabled=false;}
});
boot();
})();