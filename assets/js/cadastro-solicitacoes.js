(function(){
"use strict";
const $=id=>document.getElementById(id);
const executionView=document.body.dataset.cadastroVisao==="execucao";
const view=executionView?"execucao":"solicitante";
const root="https://api.portalfrete.net.br/v1/cadastro-solicitacoes";
const SLOTS=["cavalo","carreta","antt","cnh","endereco","motorista","caminhao","motorista_caminhao"];
const STEPS=["RECEBIMENTO","CONFERENCIA DOCUMENTAL","CONSULTA REFERENCIAS","CADASTRO SISTEMA TERCEIRO","REVISAO","CONCLUIDO"];
let all=[],executor=false,storage=false,selected=null,draftId="",busy=false,userId="";
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
 for(const [label,sub,statuses] of [
  ["01 · Na fila","Aguardando responsável",["FILA"]],
  ["02 · Em andamento","Cadastros em análise",["ANDAMENTO"]],
  ["03 · Aprovação","Validação final",["AGUARDANDO APROVACAO"]],
  ["04 · Pendências","Aguardando correção",["PENDENTE"]]
 ]){
  const lane=el("section","","cad-lane"),top=el("div","","cad-lane-head"),list=el("div","","cad-lane-items");
  const items=all.filter(t=>statuses.includes(t.status));
  top.append(el("strong",label),el("span",String(items.length),"cad-lane-count"));lane.append(top,el("small",sub));
  if(!items.length)list.append(el("p","Nenhum cadastro nesta etapa.","cad-lane-empty"));
  for(const t of items.slice(0,15)){
   const button=el("button","","cad-lane-ticket");button.type="button";
   button.append(el("small",t.protocolo),el("strong",t.motorista),el("span",t.placas),el("em",t.executor?"Responsável: "+t.executor:"Aguardando responsável"));
   button.onclick=()=>openDetail(t.id);list.append(button);
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
  b.append(el("h3",c.motorista),el("p",c.placas));
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
  const info=$("cadDetailInfo");info.replaceChildren();
  [["Contato do motorista",selected.contatoMotorista],["Proprietário",selected.proprietario],["Contato do proprietário",selected.contatoProprietario],["Placas",selected.placas],["Executor",selected.executor||"Não assumido"],["Situação",titleStatus(selected.status)]].forEach(x=>info.append(itemInfo(...x)));
  (selected.referencias||[]).forEach((ref,i)=>info.append(itemInfo("Referência "+(i+1),String(ref.nome||"")+" · "+String(ref.telefone||""))));
  if(selected.observacoes)info.append(itemInfo("Observações",selected.observacoes));
  const steps=$("cadEtapas");steps.replaceChildren();const current=STEPS.indexOf(selected.etapa);
  STEPS.forEach((name,i)=>steps.append(el("div",(i+1)+". "+name,"cad-step"+(i<=current?" done":""))));
  const docs=$("cadAnexos");docs.replaceChildren();
  if(!(d.anexos||[]).length)docs.append(el("small","Nenhum anexo."));
  for(const doc of d.anexos||[]){
   const button=el("button",doc.slot.toUpperCase()+" · "+doc.nome);button.type="button";
   button.onclick=()=>downloadDoc(id,doc);docs.append(button);
  }
  const hist=$("cadHistorico");hist.replaceChildren();
  for(const entry of d.historico||[]){
   const box=el("div","","cad-history-item");
   box.append(el("strong",titleStatus(entry.status)+" · "+entry.etapa));
   if(entry.motivo)box.append(el("p",entry.motivo));
   box.append(el("small",(entry.autor_id||"")+" · "+iso(entry.criado_em)));hist.append(box);
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
  $("cadCompany").textContent=s.transportadoraNome||"NOVA FROTA";
  $("cadProfile").textContent=s.perfil||"USUÁRIO";
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