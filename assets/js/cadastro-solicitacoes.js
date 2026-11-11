(function(){
"use strict";
const $=id=>document.getElementById(id);
const root="https://api.portalfrete.net.br/v1/cadastro-solicitacoes";
const SLOTS=["cavalo","carreta","antt","cnh","endereco","motorista","caminhao","motorista_caminhao"];
const STEPS=["RECEBIMENTO","CONFERENCIA DOCUMENTAL","CONSULTA REFERENCIAS","CADASTRO SISTEMA TERCEIRO","REVISAO","CONCLUIDO"];
let all=[],executor=false,storage=false,selected=null,draftId="",busy=false;
const iso=d=>{if(!d)return"";const value=new Date(String(d).replace(" ","T")+"Z");return isNaN(value)?String(d):value.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})};
const titleStatus=s=>({RASCUNHO:"Rascunho",FILA:"Na fila",ANDAMENTO:"Em andamento","AGUARDANDO APROVACAO":"Aguardando aprovação",PENDENTE:"Pendente",REPROVADO:"Reprovado",APROVADO:"Aprovado"}[s]||s);
const el=(tag,txt="",cls="")=>{const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=txt;return node;};
function alertMsg(text,error=false){const box=$("cadAlert");box.textContent=text;box.className="cad-alert"+(error?" error":"");box.hidden=false;box.scrollIntoView({block:"nearest",behavior:"smooth"});}
async function api(path="",method="GET",body){
 const headers={"Accept":"application/json"};
 const support=window.__PORTAL_TENANT_SESSION?.ownerSupport===true?window.__PORTAL_TENANT_EXPECTED:"";
 if(support)headers["X-Portal-Support-Tenant"]=support;
 if(body!==undefined)headers["Content-Type"]="application/json";
 const response=await fetch(root+path,{method,credentials:"include",cache:"no-store",headers,body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.error||"Falha ao consultar o Portal (HTTP "+response.status+").");
 return data;
}
function showDialog(id){const d=$(id);if(!d.open)d.showModal();}
function closeDialog(id){$(id).close();}
function statusChip(s){const span=el("span",titleStatus(s),"cad-status");span.dataset.state=s;return span;}
function applyCounts(){for(const [id,statuses] of [["cadFila",["FILA"]],["cadAndamento",["ANDAMENTO","AGUARDANDO APROVACAO"]],["cadPendente",["PENDENTE","REPROVADO"]],["cadAprovados",["APROVADO"]]])$(id).textContent=all.filter(x=>statuses.includes(x.status)).length;}
function render(){
 applyCounts();
 const query=$("cadBusca").value.trim().toUpperCase(),filter=$("cadFiltro").value;
 const rows=all.filter(x=>(!filter||x.status===filter)&&[x.protocolo,x.motorista,x.placas,x.solicitante].some(v=>String(v||"").toUpperCase().includes(query)));
 const grid=$("cadTickets");grid.replaceChildren();
 if(!rows.length){grid.append(el("div","Nenhuma solicitação encontrada.","cad-empty"));return;}
 for(const c of rows){
  const b=el("button","","cad-ticket");b.type="button";
  const head=el("div","","cad-ticket-head");head.append(el("strong",c.protocolo),statusChip(c.status));b.append(head);
  b.append(el("h3",c.motorista),el("p",c.placas));
  const foot=el("div","","cad-ticket-foot");foot.append(el("span",iso(c.criadoEm)),el("span",c.status==="RASCUNHO"?"Completar anexos":c.executor?"Executor: "+c.executor:"Abrir detalhes"));b.append(foot);
  b.onclick=()=>c.status==="RASCUNHO"?resume(c):openDetail(c.id);
  grid.append(b);
 }
}
async function refresh(){
 const d=await api();
 all=d.chamados||[];executor=!!d.executor;storage=!!d.armazenamento?.configurado;
 $("cadListaTitulo").textContent=executor?"Fila e execução de cadastros":"Minhas solicitações";
 $("cadListaSub").textContent=executor?"Assuma os chamados na fila e acompanhe os processos da transportadora.":"Acompanhe todos os cadastros que você solicitou.";
 $("cadNovo").disabled=!storage;
 $("cadNovo").title=storage?"Abrir nova solicitação":"Configure o Google Drive no Super Admin antes de enviar documentos";
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
  const exec=$("cadExecucao");exec.hidden=!executor;
  $("cadAssumir").hidden=!executor||selected.status!=="FILA";
  $("cadStatusForm").hidden=!executor||selected.status==="FILA"||selected.status==="RASCUNHO"||
   !!(selected.executor&&selected.executor!==String(window.__PORTAL_TENANT_SESSION?.usuario||(typeof getUser==="function"?getUser():"")));
  $("cadStatusForm").elements.status.value=selected.status==="RASCUNHO"?"ANDAMENTO":selected.status;
  $("cadStatusForm").elements.etapa.value=selected.etapa;
  $("cadChatForm").hidden=selected.status==="RASCUNHO";
  showDialog("cadDetailDialog");
 }catch(error){alertMsg(error.message,true);}
}
async function downloadDoc(id,doc){
 try{
  const headers={},support=window.__PORTAL_TENANT_SESSION?.ownerSupport===true?window.__PORTAL_TENANT_EXPECTED:"";
  if(support)headers["X-Portal-Support-Tenant"]=support;
  const resp=await fetch(root+"/"+id+"/anexos/"+doc.id,{credentials:"include",cache:"no-store",headers});
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
  $("cadCompany").textContent=s.transportadoraNome||"NOVA FROTA";
  $("cadProfile").textContent=s.perfil||"USUÁRIO";
  if(typeof bindLogoutButton==="function")bindLogoutButton();
  await refresh();
  if(!storage)alertMsg("O formulário está pronto, mas a pasta e a chave do Google Drive precisam ser configuradas no Super Admin desta transportadora.",true);
 }catch(error){alertMsg("Não foi possível abrir o módulo: "+error.message,true);$("cadNovo").disabled=true;}
}
for(const close of document.querySelectorAll("[data-close]"))close.onclick=()=>closeDialog(close.dataset.close);
$("cadNovo").onclick=newTicket;$("cadForm").addEventListener("submit",sendForm);
$("cadAtualizar").onclick=()=>refresh().catch(e=>alertMsg(e.message,true));
$("cadBusca").addEventListener("input",render);$("cadFiltro").addEventListener("change",render);
$("cadAssumir").onclick=()=>mutate("/assumir",{});
$("cadStatusForm").addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget;await mutate("/situacao",{status:f.elements.status.value,etapa:f.elements.etapa.value,motivo:f.elements.motivo.value});});
$("cadChatForm").addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget;const texto=f.elements.texto.value.trim();if(!texto)return;await mutate("/mensagens",{texto});f.reset();});
boot();
})();