(function(){
"use strict";
const $=id=>document.getElementById(id);
const execution=document.body.dataset.pedidosVisao==="execucao";
const API="https://api.portalfrete.net.br/v1/abertura-pedidos";
const STATES=[["FILA","Fila","#227cde"],["ANDAMENTO","Em andamento","#15a16e"],["PENDENTE","Pendente","#e8a01b"],["FINALIZADO","Finalizado (hoje)","#168a57"]];
const SLOTS={nota:"Nota",nota_coleta:"Nota de coleta",liberacao:"Liberação",rota_pedagio:"Print da rota de pedágio",tabela_antt:"Print da tabela ANTT",comprovante_pagamento:"Comprovante de pagamento",comprovante_guia:"Comprovante de GUIA"};
const FIELDS=["email","nomeSolicitante","telefoneWhats","unidadeEmbarque","numeroPedidoOC","nfeManifestada","tomadorCnpj","coletaIe","entregaCnpj","entregaIe","freteEmpresa","freteMotorista","adiantamentoPct","icms","produto","especie","tag","obs","coordenadasColeta","coordenadasEntrega"];
const LABELS=["E-mail","Nome do solicitante","Telefone / Whats","Unidade de embarque","Número do pedido OC","NF-e a manifestar","Tomador / CNPJ","Coleta / IE","Entrega / CNPJ","Entrega / IE","Frete empresa","Frete motorista","Adiantamento %","ICMS","Produto","Espécie","TAG","Observações","Coordenadas coleta","Coordenadas entrega"];
const KINDS={
 PEDIDO:{title:"Abertura de pedido",short:"Pedido",hint:"Preencha os dados do pedido e anexe os documentos disponíveis."},
 CORRECAO_PEDIDO:{title:"Correção de pedido",short:"Correção",hint:"Informe o pedido e descreva o que deve ser corrigido. A mensagem abre o chat do chamado."},
 CTE_COMPLEMENTAR:{title:"CT-e complementar",short:"CT-e complementar",hint:"Informe o CT-e, descreva o complemento e anexe a liberação do cliente."},
 CARTA_CORRECAO:{title:"Carta de correção",short:"Carta de correção",hint:"Selecione CT-e ou MDF-e e escreva o texto da carta."},
 PAGAMENTO:{title:"Solicitação de pagamento",short:"Pagamento",hint:"Informe o CT-e, beneficiário e os dados para PIX IRIOM ou depósito."},
 PAGAMENTO_GUIA:{title:"Pagamento de GUIA",short:"GUIA",hint:"Informe o CT-e e a NF. O comprovante será anexado pela execução após finalizar."}
};
const EXTRA_LABELS={
 numeroPedidoCorrecao:"Número do pedido",textoCorrecao:"Solicitação de correção",
 numeroCte:"Número do CT-e",descricaoComplemento:"Complemento solicitado",
 documentoTipo:"Tipo de documento",numeroDocumento:"Número do documento",textoCarta:"Texto da carta",
 ctePagamento:"CT-e",placaPagamento:"Placa",nomeBeneficiario:"Nome",cpfCnpjPagamento:"CPF/CNPJ",formaPagamento:"Forma de pagamento",etapaPagamento:"Adiantamento / Saldo",pixPagamento:"PIX",bancoPagamento:"Banco",agenciaPagamento:"Agência",contaPagamento:"Conta",cteGuia:"CT-e",nfGuia:"NF"
};
const EXTRA_FIELDS={
 CORRECAO_PEDIDO:["numeroPedidoCorrecao","textoCorrecao"],
 CTE_COMPLEMENTAR:["numeroCte","descricaoComplemento"],
 CARTA_CORRECAO:["documentoTipo","numeroDocumento","textoCarta"],
 PAGAMENTO:["ctePagamento","placaPagamento","nomeBeneficiario","cpfCnpjPagamento","formaPagamento","etapaPagamento","pixPagamento","bancoPagamento","agenciaPagamento","contaPagamento"],
 PAGAMENTO_GUIA:["cteGuia","nfGuia"]
};
const kindOf=p=>Object.hasOwn(KINDS,p?.tipoSolicitacao)?p.tipoSolicitacao:"PEDIDO";
const kindTitle=p=>KINDS[kindOf(p)].title;
const kindRef=p=>p?.dadosEspecificos?.numeroPedidoCorrecao||
 p?.dadosEspecificos?.numeroCte||p?.dadosEspecificos?.numeroDocumento||p?.dadosEspecificos?.ctePagamento||p?.dadosEspecificos?.cteGuia||p?.numeroPedidoOC||"";
function agencyLooksLikeDate(value){
 const v=String(value||"").trim();
 return /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}/i.test(v)||
 /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/.test(v)||
 /^\d{1,2}\/\d{1,2}\/\d{4}(?:\s|$)/.test(v)||
 /(?:GMT[+-]\d{4}|Horário Padrão de Brasília)/i.test(v);
}
const MAX_FILE=6*1024*1024;
const MIMES=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
let user="",executor=false,superAdmin=false,chamados=[],selected=null,draft="",revisionPending=false,busy=false,draftsExpanded=false,previewUrl=null,previewSequence=0,canCreate=false,formKind="PEDIDO";
let historyLoaded=false,historyNext=0,historyRows=[],historyBusy=false,boardSerial=0,detailSerial=0,actionBusy=false;
const lanes=new Map();
let boardLoaded=false,refreshInFlight=null,autoTimer=null,lastBoardRefresh=0,autoEvery=30000;
let draggedTicket=null,moveTicket=null,moveTarget="",moveBusy=false,ignoreClickUntil=0,mineSignature="",canCorrectPending=false;
let searchFrame=0;
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
function syncConnection(ok){
 const text=$("tnCommandStatus");
 if(!text)return;
 text.textContent=ok?"Central sincronizada":"Falha na sincronização";
 text.closest(".tn-command-connected").dataset.state=ok?"online":"error";
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
 return !q||[number(p),p.protocolo,kindTitle(p),kindRef(p),...Object.values(p.dadosEspecificos||{}),p.unidadeEmbarque,p.numeroPedidoOC,p.nomeSolicitante,p.nfeManifestada,p.produto,p.numeroPedidoSistema,p.executor]
  .some(v=>String(v||"").toUpperCase().includes(q));
}
function card(p){
 const b=element("button","","cad-lane-ticket pedido-category-ticket");b.type="button";
 b.dataset.kind=kindOf(p);
 b.dataset.ticketId=p.id;b.dataset.stage=p.status;
 const movable=execution?executor&&STATES.some(stage=>stage[0]===p.status):
   p.status==="PENDENTE"&&canCorrectPending;
 if(movable){
  b.draggable=true;b.classList.add("tn-movable");
  b.title="Segure e arraste para uma etapa permitida ou clique para abrir";
  b.addEventListener("dragstart",event=>{
   if(actionBusy||moveBusy){event.preventDefault();return;}
   draggedTicket=p;ignoreClickUntil=Date.now()+450;
   event.dataTransfer.effectAllowed="move";
   event.dataTransfer.setData("text/plain",p.id);
   requestAnimationFrame(()=>b.classList.add("tn-dragging"));
   markDropTargets(p);
  });
  b.addEventListener("dragend",()=>{
   ignoreClickUntil=Date.now()+450;
   clearDragTargets();
  });
 }
 const meta=element("div","","cad-lane-ticket-meta");
 meta.append(element("span",number(p),"cad-short-number"),element("span",time(p.criadoEm)));
 const badge=element("span",kindTitle(p),"pedido-category-label");
 const foot=element("div","","tn-card-bottom");
 foot.append(element("small",p.executor?"Executor: "+p.executor:"Aguardando executor"),
  element("small",kindOf(p)==="PEDIDO"?(p.status==="FINALIZADO"?"Sistema: "+(p.numeroPedidoSistema||""):"OC: "+p.numeroPedidoOC):"Ref.: "+kindRef(p)));
 const title=kindOf(p)==="PEDIDO"?(p.unidadeEmbarque||"Nova abertura"):kindRef(p);
 const subtitle=kindOf(p)==="PEDIDO"?
  [p.nomeSolicitante,p.produto].filter(Boolean).join(" · "):
  [p.nomeSolicitante,p.solicitante].filter(Boolean).join(" · ");
 b.append(meta,badge,element("strong",title||kindTitle(p),"tn-client"),
  element("span",subtitle,"tn-branch"),foot);
 if(execution&&p.status==="PENDENTE"&&String(p.motivo||"").trim().length>=8)
  b.append(element("small","Motivo já registrado ✓","tn-reason-saved"));
 b.title=number(p)+" · "+kindTitle(p)+" · "+(kindRef(p)||p.unidadeEmbarque||"")+(movable?" · Arraste para mudar a etapa":"");
 b.onclick=()=>{if(Date.now()>=ignoreClickUntil)void openDetail(p.id);};return b;
}

/* Movimentação livre, autorizada exclusivamente na Execução. A API persiste
   a etapa antes de a interface atualizar o card; qualquer erro mantém a fila. */
function canMoveTicket(row,destination){
 if(!row||row.status===destination||actionBusy||moveBusy)return false;
 if(!STATES.some(item=>item[0]===destination)||!STATES.some(item=>item[0]===row.status))return false;
 if(execution)return executor;
 return canCorrectPending&&row.status==="PENDENTE"&&destination==="FILA";
}
function markDropTargets(row){
 for(const [stage,lane] of lanes){
  lane.lane.classList.toggle("tn-drop-valid",canMoveTicket(row,stage));
  lane.lane.classList.toggle("tn-drop-blocked",row.status!==stage&&!canMoveTicket(row,stage));
 }
 document.body.classList.add("tn-drag-active");
}
function clearDragTargets(){
 draggedTicket=null;
 document.body.classList.remove("tn-drag-active");
 for(const lane of lanes.values())lane.lane.classList.remove("tn-drop-valid","tn-drop-blocked");
 document.querySelectorAll(".tn-dragging").forEach(node=>node.classList.remove("tn-dragging"));
}
function savedPendingReason(row){
 const stored=String(row?.motivo||"").trim();
 const current=selected?.id===row?.id&&$("tnDetailDialog")?.open?
  String($("tnStatusForm")?.elements.motivo?.value||"").trim():"";
 return current.length>=8?current:stored.length>=8?stored:"";
}
function ensureMoveDialog(){
 let dialog=$("tnMoveDialog");
 if(dialog)return dialog;
 dialog=document.createElement("dialog");dialog.id="tnMoveDialog";dialog.className="tn-move-dialog";
 dialog.innerHTML=`
  <form id="tnMoveForm">
   <div class="tn-move-head"><span class="tn-move-kicker">PENDÊNCIA DO CHAMADO</span>
    <h2 id="tnMoveTitle">Informe o motivo</h2>
    <p id="tnMoveDescription">Registre o que precisa ser corrigido para encaminhar o atendimento.</p></div>
   <div class="tn-move-body">
    <label>Motivo ou justificativa
     <textarea id="tnMoveReason" rows="3" maxlength="1800" required placeholder="Descreva a pendência para quem fará a correção"></textarea>
    </label>
    <p id="tnMoveMessage" role="status" aria-live="polite">O motivo será registrado no histórico e no chamado.</p>
   </div>
   <div class="tn-move-actions"><button id="tnMoveCancel" type="button" class="secondary">Cancelar</button>
    <button id="tnMoveConfirm" class="primary" type="submit">Registrar pendência</button></div>
  </form>`;
 document.body.append(dialog);
 dialog.querySelector("#tnMoveCancel").onclick=()=>{if(!moveBusy)dialog.close();};
 dialog.querySelector("#tnMoveForm").onsubmit=event=>{
  event.preventDefault();
  if(moveBusy||!moveTicket||moveTarget!=="PENDENTE")return;
  const reason=$("tnMoveReason").value.trim();
  if(reason.length<8){
   $("tnMoveMessage").textContent="Descreva a pendência com pelo menos 8 caracteres.";
   $("tnMoveReason").focus();return;
  }
  void executeMove(moveTicket,moveTarget,reason);
 };
 dialog.addEventListener("close",()=>{if(!moveBusy){moveTicket=null;moveTarget="";}});
 return dialog;
}
async function executeMove(ticket,target,reason="",systemNumber=""){
 if(!canMoveTicket(ticket,target))return inform("Atualize o quadro antes de movimentar este chamado.",true);
 if(!execution)return;
 const original=ticket.status;
 moveBusy=true;actionBusy=true;
 const confirm=$("tnMoveConfirm"),cancel=$("tnMoveCancel");
 if(confirm)confirm.disabled=true;
 if(cancel)cancel.disabled=true;
 if($("tnMoveMessage")&&$("tnMoveDialog")?.open)
  $("tnMoveMessage").textContent="Registrando pendência...";
 else inform("Movendo "+number(ticket)+" para "+(STATES.find(x=>x[0]===target)?.[1]||target)+"...");
 try{
  const saved=await request("/"+ticket.id+"/mover","POST",{
   origem:original,status:target,motivo:reason,numeroPedidoSistema:systemNumber
  });
  const current=chamados.find(x=>x.id===ticket.id);
  if(current){
   current.status=saved.status||target;
   current.executor=saved.executor||"";
   current.motivo=saved.motivo||"";
   if(saved.numeroPedidoSistema)current.numeroPedidoSistema=saved.numeroPedidoSistema;
   current.atualizadoEm=new Date().toISOString();
  }
  boardSerial++;mineSignature="";lastBoardRefresh=Date.now();syncConnection(true);
  if($("tnMoveDialog")?.open)hideDialog("tnMoveDialog");
  if($("tnDetailDialog")?.open&&selected?.id===ticket.id)hideDialog("tnDetailDialog");
  moveTicket=null;moveTarget="";
  render();
  inform(number(ticket)+" movimentado para "+(STATES.find(x=>x[0]===target)?.[1]||target)+".");
 }catch(error){
  const message="Movimentação não confirmada: "+error.message;
  if($("tnMoveDialog")?.open)$("tnMoveMessage").textContent=message;
  inform(message,true);
  void refresh().catch(()=>{});
 }finally{
  moveBusy=false;actionBusy=false;
  if(confirm)confirm.disabled=false;
  if(cancel)cancel.disabled=false;
 }
}
async function planMove(row,target){
 if(!row||row.status===target)return;
 if(!canMoveTicket(row,target))
  return inform("Você não tem acesso a essa movimentação. Atualize a fila.",true);
 // Na visão de solicitações, PENDENTE -> FILA exige corrigir os campos.
 if(!execution){
  try{
   const detail=await request("/"+row.id);
   if(detail.chamado?.status!=="PENDENTE"||detail.consultaPublica===true)
    throw Error("Esta pendência não está disponível para correção.");
   await resume(detail.chamado,detail);
  }catch(error){inform("Correção não aberta: "+error.message,true);}
  return;
 }
 if(target==="PENDENTE"){
  const reason=savedPendingReason(row);
  if(reason){void executeMove(row,target,reason);return;}
  moveTicket=row;moveTarget=target;
  const dialog=ensureMoveDialog();
  $("tnMoveTitle").textContent=number(row)+" → Pendente";
  $("tnMoveDescription").textContent=kindTitle(row)+" · Descreva o que precisa ser corrigido.";
  $("tnMoveReason").value="";
  $("tnMoveMessage").textContent="O motivo será registrado para a transportadora.";
  dialog.showModal();
  return;
 }
 // As demais movimentações são diretas, inclusive voltar de FINALIZADO.
 void executeMove(row,target);
}
function ensureBoard(){
 if(lanes.size)return;
 const board=$("tnBoard");
 for(const [key,label,color] of STATES){
  const lane=element("section","","cad-lane");
  lane.style.setProperty("--cad-lane-color",color);
  const head=element("div","","cad-lane-head");
  const count=element("span","0","cad-lane-count");
  head.append(element("strong",label),count);
  const items=element("div","","cad-lane-items");
  items.append(element("p","Aguardando atualização...","cad-lane-empty"));
  lane.dataset.stage=key;lane.append(head,items);board.append(lane);
  lane.addEventListener("dragover",event=>{
   if(!draggedTicket)return;
   event.preventDefault();
   event.dataTransfer.dropEffect=canMoveTicket(draggedTicket,key)?"move":"none";
  });
  lane.addEventListener("drop",event=>{
   event.preventDefault();event.stopPropagation();
   const row=draggedTicket,source=event.dataTransfer.getData("text/plain");
   clearDragTargets();
   if(!row||source!==row.id)return;
   ignoreClickUntil=Date.now()+450;
   void planMove(row,key);
  });
  lanes.set(key,{lane,items,count,signature:null});
 }
}
function render(){
 ensureBoard();
 const f=$("tnFilter").value,t=$("tnTypeFilter")?.value||"",q=$("tnSearch").value.trim().toUpperCase();
 const groups=Object.fromEntries(STATES.map(([key])=>[key,[]]));
 const totals=Object.fromEntries(STATES.map(([key])=>[key,0]));
 const mine=[];
 const drafts=[];
 for(const row of chamados){
  if(Object.hasOwn(totals,row.status))totals[row.status]++;
  const visible=(!t||kindOf(row)===t)&&matches(row,q);
  if(!visible)continue;
  if(row.status==="RASCUNHO")drafts.push(row);
  if(row.executor===user&&["ANDAMENTO","PENDENTE"].includes(row.status))mine.push(row);
  if(groups[row.status]&&(!f||f===row.status))groups[row.status].push(row);
 }
 for(const [key] of STATES){
  const rows=groups[key],lane=lanes.get(key);
  // Assinatura leve: não serializar dados privados nem recriar centenas de cards
  // se apenas a atualização automática retornou os mesmos chamados.
  const signature=rows.map(x=>[
   x.id,x.atualizadoEm,x.status,x.executor,x.nomeSolicitante,
   x.numeroPedidoOC,kindRef(x),x.numeroPedidoSistema,x.motivo
  ].join("|")).join("~")+"|"+boardLoaded;
  lane.count.textContent=String(rows.length);
  if(lane.signature!==signature){
   lane.signature=signature;
   lane.items.replaceChildren(...(rows.length?rows.map(card):[
    element("p",boardLoaded?"Nenhuma solicitação nesta etapa.":"Carregando chamados...","cad-lane-empty")
   ]));
  }
 }
 const metrics=$("tnOpsOverview");
 if(metrics){
  for(const button of metrics.querySelectorAll("[data-metric-status]")){
   const key=button.dataset.metricStatus;
   const count=button.querySelector("[data-metric-count]");
   if(count)count.textContent=String(totals[key]||0);
   button.classList.toggle("is-selected",f===key);
  }
  const total=metrics.querySelector("[data-ops-total]");
  if(total)total.textContent=String(Object.values(totals).reduce((a,b)=>a+b,0));
 }
 const mineRoot=$("tnMine");
 if(mineRoot){
  const sig=mine.map(x=>x.id+"|"+x.status+"|"+x.atualizadoEm).join("~")+"|"+q+"|"+t;
  if(mineSignature!==sig){
   mineSignature=sig;mineRoot.replaceChildren();
   if(!mine.length)mineRoot.append(element("p","Nenhum chamado atribuído a você. A fila acima está disponível para assumir.","cad-empty"));
   for(const row of mine){
    const b=element("button","","tn-focus-item");
    b.type="button";
    b.append(element("strong",number(row)),
      element("span",kindTitle(row)),
      element("small",row.status==="PENDENTE"?"Aguardando correção":"Em execução"));
    b.onclick=()=>void openDetail(row.id);mineRoot.append(b);
   }
  }
 }
 const button=$("tnDraftButton"),tray=$("tnDrafts");
 button.hidden=execution||!drafts.length;button.textContent="Rascunhos ("+drafts.length+")";
 if(!drafts.length)draftsExpanded=false;
 tray.hidden=!draftsExpanded;tray.replaceChildren();
 if(draftsExpanded)for(const row of drafts){
  const b=element("button",number(row)+" · "+kindTitle(row)+" / "+kindRef(row),"tn-draft");
  b.type="button";b.onclick=()=>resume(row);tray.append(b);
 }
}
function refresh(){
 if(refreshInFlight)return refreshInFlight;
 const job=(async()=>{
  const serial=++boardSerial;
  try{
   const result=await request();
   if(serial!==boardSerial)return;
   chamados=Array.isArray(result.chamados)?result.chamados:[];
   boardLoaded=true;lastBoardRefresh=Date.now();
   render();syncConnection(true);
   if($("tnAutoStatus"))
    $("tnAutoStatus").textContent="Atualizado às "+new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+" · automático "+(autoEvery/1000)+" s";
  }catch(error){
   if($("tnAutoStatus"))$("tnAutoStatus").textContent="Falha na atualização · tente novamente";
   syncConnection(false);
   throw error;
  }
 })();
 refreshInFlight=job;
 void job.finally(()=>{if(refreshInFlight===job)refreshInFlight=null;}).catch(()=>{});
 return job;
}
function startAutoRefresh(){
 if(autoTimer)return;
 autoTimer=window.setInterval(()=>{
  if(!document.hidden&&!document.querySelector("dialog[open]")&&!refreshInFlight&&!busy&&!actionBusy&&(!lastBoardRefresh||Date.now()-lastBoardRefresh>=autoEvery))
   void refresh().catch(()=>{});
 },15000);
 document.addEventListener("visibilitychange",()=>{
  if(!document.hidden&&lastBoardRefresh&&Date.now()-lastBoardRefresh>=autoEvery&&!refreshInFlight&&!document.querySelector("dialog[open]"))
   void refresh().catch(()=>{});
 });
}
function syncPaymentMethod(){
 const active=formKind==="PAGAMENTO",deposit=$("pedFormaPagamento")?.value==="DEPOSITO";
 const method=$("pedFormaPagamento"),stage=$("pedEtapaPagamento");
 if(method)method.dataset.method=method.value;
 if(stage)stage.dataset.stage=stage.value;
 const group=$("pedidoExtraFields");if(!group)return;
 for(const label of group.querySelectorAll("[data-ped-payment]")){
  const visible=active&&(label.dataset.pedPayment==="bank"||!deposit);
  label.hidden=!visible;const input=label.querySelector("input");
  if(input){input.disabled=!visible;input.required=visible;}
 }
}
function setKind(kind,{syncPicker=true}={}){
 formKind=Object.hasOwn(KINDS,kind)?kind:"PEDIDO";
 const selector=$("tnKindSelect");
 if(selector){
  if(syncPicker)selector.value=formKind;
  selector.dataset.kind=formKind;
  selector.closest(".pedido-kind-picker")?.setAttribute("data-kind",formKind);
 }
 const form=$("tnForm");if(!form)return;
 form.elements.tipoSolicitacao.value=formKind;
 $("pedidoOriginalFields").hidden=formKind!=="PEDIDO";
 $("pedidoOriginalDocs").hidden=formKind!=="PEDIDO";
 $("pedidoExtraFields").hidden=formKind==="PEDIDO";
 const complement=formKind==="CTE_COMPLEMENTAR";
 $("pedidoComplementDoc").hidden=!complement;
 for(const input of $("pedidoOriginalFields").querySelectorAll("input,textarea,select"))
  input.disabled=formKind!=="PEDIDO";
 for(const input of $("pedidoOriginalDocs").querySelectorAll("input"))
  input.disabled=formKind!=="PEDIDO";
 for(const group of $("pedidoExtraFields").querySelectorAll("[data-kind-fields]")){
  const active=group.dataset.kindFields===formKind;
  group.hidden=!active;
  for(const input of group.querySelectorAll("input,textarea,select"))input.disabled=!active;
 }
 syncPaymentMethod();
 for(const input of $("pedidoComplementDoc").querySelectorAll("input")){
  input.disabled=!complement;
  // Rascunho pode conter anexo salvo no Drive. O Worker verifica a presença.
  input.required=complement&&!draft;
 }
 $("tnFormTitle").textContent="Nova solicitação: "+KINDS[formKind].title;
 $("pedFormTypeBadge").textContent=KINDS[formKind].title.toUpperCase();
 $("pedFormHint").textContent=KINDS[formKind].hint;
 $("pedDocumentsTitle").hidden=formKind!=="PEDIDO";
 const privacy=form.querySelector(".cad-privacy");
 if(privacy)privacy.hidden=!(formKind==="PEDIDO"||complement);
 $("tnEnviar").textContent="Enviar "+(formKind==="PEDIDO"?"pedido":"solicitação");
 $("tnFormDialog").dataset.kind=formKind;
 if(selector){
  $("tnNew").textContent="+ Nova solicitação";
 }
}
function newForm(){
 if(!canCreate)return inform("Configure o Google Drive antes de solicitar documentos.",true);
 draft="";revisionPending=false;$("tnForm").reset();
 setKind($("tnKindSelect")?.value||"PEDIDO");
 $("tnFormProgress").textContent="Preencha os campos obrigatórios."+(["PEDIDO","CTE_COMPLEMENTAR"].includes(formKind)?" Anexos podem ser enviados junto à solicitação.":"");
 showDialog("tnFormDialog");
}
async function resume(row,existingDetail=null){
 if(execution)return;
 draft=row.id;revisionPending=row.status==="PENDENTE";$("tnForm").reset();setKind(kindOf(row));
 for(const name of FIELDS)$("tnForm").elements[name].value=row[name]||"";
 for(const name of EXTRA_FIELDS[formKind]||[]){
  const input=$("tnForm").elements[name];
  if(input){const value=name==="formaPagamento"&&row.dadosEspecificos?.[name]==="PIX_IRION"?"PIX_IRIOM":(row.dadosEspecificos?.[name]||"");input.value=name==="agenciaPagamento"&&agencyLooksLikeDate(value)?"":value;}
 }
 syncPaymentMethod();
 const corruptedAgency=formKind==="PAGAMENTO"&&agencyLooksLikeDate(row.dadosEspecificos?.agenciaPagamento);
 $("tnFormTitle").textContent=revisionPending?
  "Corrigir pendência: "+kindTitle(row)+" "+number(row):
  "Retomar "+kindTitle(row)+" "+number(row);
 $("tnEnviar").textContent=revisionPending?"Salvar correções e devolver à fila":"Enviar solicitação";
 $("tnFormProgress").textContent=revisionPending?
  "Qualquer usuário desta transportadora pode corrigir a pendência. Revise os campos"+(formKind==="PAGAMENTO"?" bancários.":" e anexe documentos novos se necessário.")+" Ao enviar, o chamado retorna à FILA com o mesmo protocolo.":
  formKind==="PAGAMENTO"?"Dados editáveis. Confira as informações para pagamento.":"Dados editáveis. Os anexos já recebidos são preservados.";
 if(corruptedAgency)$("tnFormProgress").textContent="ATENÇÃO: a agência anterior foi convertida em data pelo Google Sheets. Informe a agência correta antes de salvar.";
 showDialog("tnFormDialog");
 try{
  const detail=existingDetail||await request("/"+row.id);
  $("tnFormProgress").textContent=(corruptedAgency?"ATENÇÃO: agência convertida em data. Digite a agência correta. ":"")+(formKind==="PAGAMENTO"?"Revise os dados para pagamento e salve a correção.":(detail.anexos||[]).length+" anexo(s) já salvos. Selecione somente arquivos adicionais.");
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
 const payload={tipoSolicitacao:formKind};
 for(const field of FIELDS)payload[field]=String(form.elements[field].value||"").trim();
 payload.dadosEspecificos={};
 for(const name of EXTRA_FIELDS[formKind]||[])
  payload.dadosEspecificos[name]=form.elements[name].disabled?"":String(form.elements[name].value||"").trim();
 if(formKind==="PAGAMENTO"&&agencyLooksLikeDate(payload.dadosEspecificos.agenciaPagamento)){progress.textContent="Agência inválida: foi convertida em data. Informe novamente o número correto da agência.";form.elements.agenciaPagamento.focus();return;}
 const documents=[...form.querySelectorAll("[data-slot]:not([disabled])")].flatMap(input=>
  [...input.files].map(file=>({slot:input.dataset.slot,file})));
 if(formKind==="CTE_COMPLEMENTAR"&&!draft&&!documents.some(x=>x.slot==="liberacao")){
  progress.textContent="Anexe a liberação do cliente para solicitar um CT-e complementar.";return;
 }
 busy=true;button.disabled=true;
 if($("tnNew"))$("tnNew").disabled=true;
 // Fecha o formulário antes da rede, mas só confirma sucesso após persistência.
 hideDialog("tnFormDialog");
 inform("Enviando solicitação... Aguardando confirmação do protocolo. Mantenha a página aberta.");
 try{
  if(!draft){
   progress.textContent="Registrando o número do protocolo...";
   const direct=documents.length===0&&formKind!=="CTE_COMPLEMENTAR";
   const result=await request("","POST",{...payload,enviarAgora:direct});
   draft=result.chamado.id;
   const issued=number(result.chamado);
   progress.textContent="Protocolo "+issued+" registrado."+
    (result.chamado.status==="FILA"?" Já está na fila.":" Processando documentos...");
   inform("Protocolo "+issued+" criado."+
    (result.chamado.status==="FILA"?" Chamado disponível na fila.":
     " O processamento continua nesta página. Mantenha-a aberta até confirmar o envio."));
   if(result.chamado.status==="FILA"){
    hideDialog("tnFormDialog");draft="";void refresh();
    return;
   }
  }else{
   progress.textContent=revisionPending?"Salvando dados corrigidos...":"Salvando alterações do rascunho...";
   await request("/"+draft+"/dados","POST",payload);
  }
  for(let i=0;i<documents.length;i++){
   progress.textContent="Enviando anexo "+(i+1)+"/"+documents.length+": "+SLOTS[documents[i].slot];
   await upload(draft,documents[i].slot,documents[i].file);
  }
  progress.textContent="Encaminhando a solicitação para execução...";
  const result=await request("/"+draft+"/enviar","POST",{});
  hideDialog("tnFormDialog");draft="";
  inform(revisionPending?
   "Correção registrada: chamado "+(result.numero?"#"+String(result.numero).padStart(5,"0"):"")+
   " retornou à FILA, aguardando novo executor.":
   KINDS[formKind].title+" "+(result.numero?"#"+String(result.numero).padStart(5,"0"):"")+" encaminhada para a fila.");
  revisionPending=false;
  void refresh();
 }catch(error){
  progress.textContent="Envio incompleto. "+error.message+" O rascunho foi preservado.";
  showDialog("tnFormDialog");
  inform("Envio não confirmado: "+error.message+" Confira o rascunho antes de tentar novamente.",true);
  void refresh().catch(()=>{});
 }finally{
  busy=false;button.disabled=false;
  if($("tnNew"))$("tnNew").disabled=!canCreate;
 }
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
function renderDocs(id,docs,kind="PEDIDO"){
 const target=$("tnDetailDocs");target.replaceChildren();
 if(!docs.length)target.append(element("p","Nenhum documento anexado.","cad-tip"));
 for(const doc of docs){
  const row=element("div","","tn-file"),title=element("strong",(kind==="CTE_COMPLEMENTAR"&&doc.slot==="liberacao"?"Liberação do cliente":SLOTS[doc.slot]||doc.slot)+": "+doc.nome);
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
function historicFilters(){
 const params=new URLSearchParams();
 params.set("pagina",String(historyNext??0));
 const all=superAdmin&&$("tnHistoryAll").checked;
 if(all)params.set("escopo","todos");
 if(all&&$("tnHistoryRemoved").checked)params.set("removidos","1");
 if(all&&$("tnHistoryStatus").value)params.set("etapa",$("tnHistoryStatus").value);
 if($("tnHistoryType").value)params.set("tipo",$("tnHistoryType").value);
 const query=$("tnHistorySearch").value.trim();
 if(query)params.set("busca",query);
 return params.toString();
}
function renderHistoricList(){
 const list=$("tnHistoryList");list.replaceChildren();
 if(!historyRows.length)list.append(element("p","Nenhum chamado encontrado com estes filtros.","cad-empty"));
 for(const record of historyRows){
  const block=element("div","","pedidos-history-entry");
  if(record.excluidoEm)block.classList.add("pedidos-history-removed");
  const head=element("div","","pedidos-history-entry-head");
  head.append(element("strong",record.excluidoEm?"Excluído da operação":
   record.status==="FINALIZADO"?"Finalizado":record.status),
   element("small","Atualizado: "+time(record.atualizadoEm)));
  if(record.excluidoEm)head.append(element("small","Retirado: "+time(record.excluidoEm)));
  block.append(head,card(record));list.append(block);
 }
 $("tnHistoryMore").hidden=historyNext===null;
}
async function fetchHistoric(reset=true){
 if(historyBusy)return;
 if(reset){historyNext=0;historyRows=[];}
 if(historyNext===null)return;
 const page=historyNext;
 historyBusy=true;$("tnHistoryRefresh").disabled=true;$("tnHistoryMore").disabled=true;
 $("tnHistoryNotice").textContent="Consultando chamados arquivados...";
 try{
  const result=await request("/historico?"+historicFilters());
  historyRows=page===0?(result.chamados||[]):[...historyRows,...(result.chamados||[])];
  historyNext=result.proximaPagina;
  historyLoaded=true;renderHistoricList();
  $("tnHistoryNotice").textContent=historyRows.length+" registro(s) carregado(s). "+
   (historyNext!==null?"Há mais resultados disponíveis.":"Fim dos resultados encontrados.");
 }catch(e){$("tnHistoryNotice").textContent=e.message;inform(e.message,true);}
 finally{historyBusy=false;$("tnHistoryRefresh").disabled=false;$("tnHistoryMore").disabled=false;}
}
function syncHistoryAdmin(){
 const all=superAdmin&&$("tnHistoryAll").checked;
 $("tnHistoryStatus").disabled=!all;
 $("tnHistoryRemoved").disabled=!all;
 if(!all){$("tnHistoryRemoved").checked=false;$("tnHistoryStatus").value="";}
 if($("pedidosHistoric").open&&historyLoaded)void fetchHistoric(true);
}
function setupAdminFields(row){
 const select=$("pedAdminField");select.replaceChildren();
 const choices=FIELDS.map((name,i)=>[name,LABELS[i]]);
 for(const name of EXTRA_FIELDS[kindOf(row)]||[])choices.push([name,EXTRA_LABELS[name]||name]);
 if(kindOf(row)==="PEDIDO")choices.push(["numeroPedidoSistema","Número do pedido no sistema"]);
 for(const [key,label] of choices){
  const op=document.createElement("option");op.value=key;op.textContent=label;select.append(op);
 }
 const update=()=>{
  const key=select.value;
  $("pedAdminValue").value=String(
   key==="numeroPedidoSistema"?row.numeroPedidoSistema:
    Object.hasOwn(row.dadosEspecificos||{},key)?row.dadosEspecificos[key]:row[key]||"");
 };
 select.onchange=update;update();
}
async function adminCorrection(){
 if(!superAdmin||!selected)return;
 const field=$("pedAdminField").value,val=$("pedAdminValue").value.trim();
 const reason=$("pedAdminEditReason").value.trim();
 if(!field||!val||reason.length<8)return inform("Informe o campo, o novo valor e uma justificativa de pelo menos 8 caracteres.",true);
 try{
  await request("/"+selected.id+"/corrigir","POST",{campo:field,valor:val,motivo:reason});
  await openDetail(selected.id);await refresh();inform("Informação corrigida. Justificativa incluída no histórico.");
 }catch(e){inform(e.message,true);}
}
async function adminRemove(restore){
 if(!superAdmin||!selected)return;
 const protocol=$("pedAdminProtocol").value.trim(),reason=$("pedAdminReason").value.trim();
 if(protocol!==selected.protocolo)return inform("Digite exatamente o protocolo "+selected.protocolo+" para confirmar.",true);
 if(reason.length<8)return inform("Informe o motivo com pelo menos 8 caracteres.",true);
 const action=restore?"restaurar":"ocultar";
 if(!window.confirm(restore?"Restaurar este chamado para a operação?":
  "Excluir "+selected.protocolo+" da operação? Dados e anexos serão mantidos para auditoria."))return;
 try{
  await request("/"+selected.id+"/"+action,"POST",{protocolo:protocol,motivo:reason});
  hideDialog("tnDetailDialog");selected=null;
  await refresh();
  inform(restore?"Chamado restaurado.":"Chamado excluído da operação e preservado para restauração.");
 }catch(e){inform(e.message,true);}
}
const detailItem=(label,value)=>{
 const e=element("div");e.append(element("span",label),element("strong",value||"Não informado"));return e;
};
function updateSystemInput(){
 const form=$("tnStatusForm"),wrap=$("pedSystemNumberInputWrap"),final=form.elements.status.value==="FINALIZADO"&&kindOf(selected)==="PEDIDO";
 wrap.hidden=!final;form.elements.numeroPedidoSistema.required=final;
}
async function openDetail(id){
 const serial=++detailSerial;
 const preview=chamados.find(row=>row.id===id)||historyRows.find(row=>row.id===id);
 selected=preview||{id};
 $("tnDetailProtocol").textContent=preview?number(preview):"Carregando chamado...";
 $("tnDetailTitle").textContent=preview?kindTitle(preview)+" · "+(kindRef(preview)||number(preview)):
  "Consultando dados e histórico";
 if(preview){
  $("tnDetailStatus").textContent=({FILA:"Na fila",ANDAMENTO:"Em andamento",PENDENTE:"Pendente",FINALIZADO:"Finalizado"})[preview.status]||preview.status;
  $("tnDetailOwner").textContent=preview.executor?"Executor: "+preview.executor:"Aguardando executor";
 }
 $("tnDetailInfo").replaceChildren(element("p","Buscando informações...","cad-empty"));
 $("tnExecution").hidden=!execution;
 $("tnChatForm").hidden=true;
 $("tnPendingUpload").hidden=true;
 if($("tnPendingCorrection"))$("tnPendingCorrection").hidden=true;
 $("tnAssumir").hidden=!(execution&&executor&&preview?.status==="FILA");
 $("tnStatusForm").hidden=true;
 showDialog("tnDetailDialog");
 try{
  const data=await request("/"+id);
  if(serial!==detailSerial)return;
  const row=data.chamado;selected=row;
  const kind=kindOf(row),extras=row.dadosEspecificos||{};
  const payment=["PAGAMENTO","PAGAMENTO_GUIA"].includes(kind),proofSlot=kind==="PAGAMENTO"?"comprovante_pagamento":"comprovante_guia";
  const hasProof=(data.anexos||[]).some(doc=>doc.slot===proofSlot);
  $("tnDetailProtocol").textContent=kindTitle(row).toUpperCase()+" "+number(row);
  $("tnDetailTitle").textContent=kind==="PEDIDO"?
   "OC "+row.numeroPedidoOC+" · "+row.unidadeEmbarque:
   kindTitle(row)+" · "+kindRef(row);
  $("tnDetailMeta").textContent="Solicitante: "+(row.nomeSolicitante||row.solicitante)+" · "+time(row.criadoEm);
  $("tnDetailTipo").dataset.kind=kind;
  $("tnDetailTipo").textContent=kindTitle(row);
  $("tnDetailStatus").dataset.state=row.status;
  $("tnDetailStatus").textContent=({FILA:"Na fila",ANDAMENTO:"Em andamento",PENDENTE:"Pendente",FINALIZADO:"Finalizado",RASCUNHO:"Rascunho"})[row.status]||row.status;
  $("tnDetailOwner").textContent=row.executor?"Executor: "+row.executor:"Aguardando executor";
  $("pedSystemNumber").hidden=kind!=="PEDIDO"||row.status!=="FINALIZADO"||!row.numeroPedidoSistema;
  $("pedSystemNumberValue").textContent=row.numeroPedidoSistema||"";
  const info=$("tnDetailInfo");info.replaceChildren();
  if(kind==="PEDIDO"){
   for(let i=0;i<FIELDS.length;i++)info.append(detailItem(LABELS[i],row[FIELDS[i]]));
  }else{
   for(const name of EXTRA_FIELDS[kind]||[]){
    if(kind==="PAGAMENTO"&&name==="pixPagamento"&&extras.formaPagamento==="DEPOSITO")continue;
    const value=name==="formaPagamento"?
      ({PIX_IRIOM:"PIX IRIOM",PIX_IRION:"PIX IRIOM",DEPOSITO:"Depósito bancário"}[extras[name]]||extras[name]):
      name==="etapaPagamento"?
      ({ADIANTAMENTO:"Adiantamento",SALDO:"Saldo",ADIANTAMENTO_E_SALDO:"Adiantamento e Saldo"}[extras[name]]||extras[name]):
      extras[name];
    info.append(detailItem(EXTRA_LABELS[name],value));
   }
  }
  const currentDocs=data.anexos||[];
  $("tnDetailDocs").closest(".cad-detail-section").hidden=kind==="PAGAMENTO"&&currentDocs.length===0;
  renderDocs(id,currentDocs,kind);renderChat(data.mensagens||[]);renderHistory(data.historico||[]);
  $("pedProofFlag").hidden=!payment||row.status!=="FINALIZADO";
  $("pedProofFlag").textContent=hasProof?"Comprovante anexado":"Aguardando comprovante";
  const isMine=execution&&executor&&row.executor===user;
  const canMove=isMine&&["ANDAMENTO","PENDENTE"].includes(row.status);
  $("pedAdminActions").hidden=!superAdmin;
  if(superAdmin){
   $("pedAdminProtocol").value="";$("pedAdminReason").value="";
   $("pedAdminEditReason").value="";$("pedAdminEditWrap").open=false;
   $("pedAdminRemove").hidden=Boolean(row.excluidoEm);
   $("pedAdminRestore").hidden=!row.excluidoEm;
   setupAdminFields(row);
  }
  $("tnExecution").hidden=!execution;
  $("pedProofSection").hidden=!(execution&&isMine&&payment&&row.status==="FINALIZADO");
  $("pedProofFile").value="";
  $("tnAssumir").hidden=!(execution&&executor&&row.status==="FILA");
  $("tnStatusForm").hidden=!canMove;
  if(canMove){
   $("tnStatusForm").elements.status.value=row.status;
   $("tnStatusForm").elements.motivo.value="";
   $("tnStatusForm").elements.numeroPedidoSistema.value=row.numeroPedidoSistema||"";
   updateSystemInput();
  }
  $("tnChatForm").hidden=data.consultaPublica===true||["RASCUNHO","FINALIZADO"].includes(row.status)||(execution&&!isMine);
  $("tnPendingUpload").hidden=kind==="PAGAMENTO"||data.consultaPublica===true||execution||row.status!=="PENDENTE";
  const allowCorrection=data.consultaPublica!==true&&row.status==="PENDENTE";
  if($("tnPendingCorrection")){
   $("tnPendingCorrection").hidden=!allowCorrection;
   $("tnPendingReason").textContent=allowCorrection?
    (row.motivo||"A execução solicitou correções neste chamado. Revise os dados antes de reenviar."):"";
   $("tnPendingEdit").onclick=()=>{
    hideDialog("tnDetailDialog");
    if(execution){
     // A edição utiliza os mesmos controles e validações do formulário Solicitações.
     const next=new URL("solicitacao-pedidos.html",window.location.href);
     next.searchParams.set("corrigir",row.id);
     window.location.assign(next.href);
    }else void resume(row,data);
   };
  }
  showDialog("tnDetailDialog");
 }catch(e){inform(e.message,true);}
}
async function action(path,data,message){
 if(!selected||actionBusy)return;const id=selected.id;
 actionBusy=true;detailSerial++;
 $("tnAssumir").disabled=true;
 inform((path==="/assumir"?"Assumindo chamado ":"Salvando alterações do chamado ")+
  (selected.protocolo||number(selected)||"")+"...");
 try{
  const saved=await request("/"+id+path,"POST",data);
  if(selected?.id===id){
   if(saved.status)selected.status=saved.status;
   if(path==="/assumir")selected.executor=user;
   $("tnDetailStatus").textContent=({ANDAMENTO:"Em andamento",PENDENTE:"Pendente",FINALIZADO:"Finalizado"})[selected.status]||selected.status;
   $("tnDetailOwner").textContent=selected.executor?"Executor: "+selected.executor:"Aguardando executor";
   if(path==="/assumir"){$("tnAssumir").hidden=true;$("tnStatusForm").hidden=false;}
  }
  // A resposta da API já confirma o movimento. Atualizar localmente é imediato.
  const local=chamados.find(row=>row.id===id);
  if(local&&(path==="/assumir"||path==="/situacao")){
   if(saved.status)local.status=saved.status;
   if(path==="/assumir")local.executor=user;
   if(path==="/situacao"&&saved.numeroPedidoSistema)local.numeroPedidoSistema=saved.numeroPedidoSistema;
   local.atualizadoEm=new Date().toISOString();
   boardSerial++;mineSignature="";render();lastBoardRefresh=Date.now();
   if($("tnAutoStatus"))$("tnAutoStatus").textContent="Alteração confirmada · sincronização automática ativa";
  }
  if(path==="/assumir"){
   $("tnStatusForm").elements.status.value="ANDAMENTO";
   $("tnStatusForm").elements.motivo.value="";
   $("tnStatusForm").hidden=false;
   updateSystemInput();
  }
  inform(message||"Alteração salva.");
  if(path==="/situacao")hideDialog("tnDetailDialog");
  else if(path==="/mensagens")void openDetail(id);
 }catch(e){inform(e.message,true);}
 finally{actionBusy=false;$("tnAssumir").disabled=false;}
}
async function extraProof(){
 if(!selected||!["PAGAMENTO","PAGAMENTO_GUIA"].includes(kindOf(selected))||selected.status!=="FINALIZADO")return;
 const file=$("pedProofFile").files[0];if(!file)return inform("Selecione o comprovante.",true);
 const slot=kindOf(selected)==="PAGAMENTO"?"comprovante_pagamento":"comprovante_guia";
 try{await upload(selected.id,slot,file);await openDetail(selected.id);inform("Comprovante anexado com sucesso.");}
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
 ensureBoard();render();
 if($("tnAutoStatus"))$("tnAutoStatus").textContent="Sincronização automática disponível";
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
  executor=state.executor===true;superAdmin=state.superAdmin===true;
  autoEvery=state.armazenamentoChamados==="sheets"?30000:15000;
  canCorrectPending=state.solicitacoesHabilitadas===true;
  $("tnHistoryAdmin").hidden=!superAdmin;
  if(execution){
   const allowedKinds=new Set(state.tiposLiberados||[]);
   for(const option of [...$("tnHistoryType").options])
    if(option.value&&!allowedKinds.has(option.value))option.remove();
  }
  if(execution){const allowed=new Set(state.tiposLiberados||[]);
   for(const option of [...$("tnTypeFilter").options])if(option.value&&!allowed.has(option.value))option.remove();}
  user=String(session.usuario||session.user||"").trim();
  if(!user)throw Error("Usuário não identificado.");
  canCreate=state.armazenamentoConfigurado===true&&state.podeCriar!==false;
  if($("tnSwitch"))$("tnSwitch").hidden=!executor;
  if($("tnNew"))$("tnNew").disabled=!canCreate;
  if(!canCreate)inform("Criação indisponível. Confirme as permissões e o armazenamento no Super Admin.",true);
  if($("tnAutoStatus"))$("tnAutoStatus").textContent="Atualização automática a cada "+(autoEvery/1000)+" segundos";
  startAutoRefresh();
  await refresh();
  if(!execution){
   const deepLink=new URL(window.location.href);
   const pendingId=deepLink.searchParams.get("corrigir");
   if(pendingId){
    deepLink.searchParams.delete("corrigir");
    window.history.replaceState(null,"",deepLink.pathname+deepLink.search+deepLink.hash);
    if(/^[a-f0-9-]{36}$/.test(pendingId)){
     try{
      const details=await request("/"+pendingId);
      if(details?.chamado?.status==="PENDENTE"&&details.consultaPublica!==true)
       void resume(details.chamado,details);
      else inform("Este chamado não está mais pendente ou não pode ser corrigido.",true);
     }catch(e){inform("Não foi possível abrir a pendência: "+e.message,true);}
    }
   }
  }
 }catch(e){
  if($("tnNew"))$("tnNew").disabled=true;
  ensureBoard();
  if($("tnAutoStatus"))$("tnAutoStatus").textContent="Não foi possível carregar.";
  if(!boardLoaded)for(const lane of lanes.values())
   lane.items.replaceChildren(element("p",e.message,"cad-lane-empty"));
  inform(e.message,true);
 }
}
document.querySelectorAll("[data-close]").forEach(btn=>btn.onclick=()=>hideDialog(btn.dataset.close));
$("tnPreviewDialog").addEventListener("close",clearPreview);
$("tnRefresh").onclick=()=>refresh().catch(e=>inform(e.message,true));
$("tnFilter").onchange=render;$("tnTypeFilter").onchange=render;
$("tnSearch").oninput=()=>{
 cancelAnimationFrame(searchFrame);searchFrame=requestAnimationFrame(render);
};
if($("tnOpsOverview")){
 $("tnOpsOverview").addEventListener("click",event=>{
  const metric=event.target.closest("[data-metric-status]");
  if(!metric)return;
  const value=metric.dataset.metricStatus;
  $("tnFilter").value=$("tnFilter").value===value?"":value;
  render();
 });
}
$("tnDraftButton").onclick=()=>{draftsExpanded=!draftsExpanded;render();};
$("tnHistoryRefresh").onclick=()=>fetchHistoric(true);
$("tnHistoryMore").onclick=()=>fetchHistoric(false);
$("tnHistoryType").onchange=()=>{if($("pedidosHistoric").open)void fetchHistoric(true);};
$("tnHistorySearch").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();fetchHistoric(true);}};
$("tnHistoryAll").onchange=syncHistoryAdmin;
$("tnHistoryStatus").onchange=()=>{if($("pedidosHistoric").open)void fetchHistoric(true);};
$("tnHistoryRemoved").onchange=()=>{if($("pedidosHistoric").open)void fetchHistoric(true);};
$("pedAdminEditSave").onclick=adminCorrection;
$("pedAdminRemove").onclick=()=>adminRemove(false);
$("pedAdminRestore").onclick=()=>adminRemove(true);
if($("tnKindSelect")){
 $("tnKindSelect").onchange=()=>setKind($("tnKindSelect").value,{syncPicker:false});
 $("tnKindSelect").dataset.kind="PEDIDO";
}
if($("pedFormaPagamento"))$("pedFormaPagamento").onchange=syncPaymentMethod;
if($("pedEtapaPagamento"))$("pedEtapaPagamento").onchange=syncPaymentMethod;
if($("tnNew"))$("tnNew").onclick=newForm;
if($("tnForm"))$("tnForm").onsubmit=submitForm;
$("tnAssumir").onclick=()=>action("/assumir",{},"Solicitação assumida.");
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
$("pedProofSend").onclick=extraProof;
$("pedCopySystemNumber").onclick=()=>{
 const value=$("pedSystemNumberValue").textContent;
 if(value&&navigator.clipboard)navigator.clipboard.writeText(value).then(()=>inform("Número copiado.")).catch(()=>inform("Não foi possível copiar.",true));
};
window.addEventListener("beforeunload",event=>{
 if(!busy)return;
 event.preventDefault();event.returnValue="";
});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else void boot();
})();
