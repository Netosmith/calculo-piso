/* estadias.js | NOVA FROTA */
(function(){
"use strict";

const API_URL="https://script.google.com/macros/s/AKfycbzaNepXksIaxkc-tgSscNoevqySYO_m-Sjqi9m3_Fvz0ApKdSw8Znel9wuzqkw02i6Z/exec";

const ACTIONS={
  list:"estadias_list",
  save:"estadias_save",
  update:"estadias_update",
  remove:"estadias_delete",
  status:"estadias_status"
};

const STATUS_OPTIONS=[
  "AGUARDANDO",
  "EM ANÁLISE",
  "LIBERADA",
  "NEGADA PELO CLIENTE",
  "SOLICITAR CORREÇÃO",
  "PAGA"
];

const statusEmAtualizacao=new Set();

const $=id=>document.getElementById(id);

let dados=[];
let filtrados=[];
let paginaAtual=1;

function txt(v){return String(v??"").trim()}
function up(v){return txt(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function num(v){
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  let s=txt(v).replace(/[^\d,.-]/g,"");
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  const n=Number(s);
  return Number.isFinite(n)?n:0;
}
function esc(v){
  return String(v??"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function money(v){
  return num(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
function dateTimeBR(v){
  if(!v)return "-";
  if(typeof v==="number"){
    const excelEpoch=new Date(Date.UTC(1899,11,30));
    const d=new Date(excelEpoch.getTime()+v*86400000);
    return d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
  }

  const raw=txt(v);
  const parsed=Date.parse(raw);
  if(!Number.isNaN(parsed)){
    return new Date(parsed).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
  }

  return raw;
}
function dateOnlyBR(v){
  if(!v)return "-";
  const d=new Date(v);
  return Number.isNaN(d.getTime())?txt(v):d.toLocaleDateString("pt-BR");
}
function toDateInput(v){
  if(!v)return "";
  const d=new Date(v);
  if(Number.isNaN(d.getTime()))return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function toDateTimeInput(v){
  if(!v)return "";
  const d=new Date(v);
  if(Number.isNaN(d.getTime()))return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function parseDateValue(v){
  if(!v)return null;
  if(v instanceof Date)return Number.isNaN(v.getTime())?null:v;
  if(typeof v==="number"){
    const epoch=new Date(Date.UTC(1899,11,30));
    const d=new Date(epoch.getTime()+v*86400000);
    return Number.isNaN(d.getTime())?null:d;
  }
  const raw=txt(v);
  const br=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if(br){
    const d=new Date(+br[3],+br[2]-1,+br[1],+(br[4]||0),+(br[5]||0),+(br[6]||0));
    return Number.isNaN(d.getTime())?null:d;
  }
  const d=new Date(raw);
  return Number.isNaN(d.getTime())?null:d;
}
function hoursBetween(start,end){
  const a=parseDateValue(start),b=parseDateValue(end);
  if(!a||!b)return 0;
  return Math.max(0,(b-a)/3600000);
}
function roundMoney(v){return Math.round((num(v)+Number.EPSILON)*100)/100}
function hoursText(v){
  const totalMinutes=Math.round(num(v)*60);
  const hours=Math.floor(totalMinutes/60);
  const minutes=totalMinutes%60;
  return `${hours}:${String(minutes).padStart(2,"0")} h`;
}
function normalizeStatus(status){
  const normalized=up(status);
  return STATUS_OPTIONS.find(item=>up(item)===normalized)||"AGUARDANDO";
}
function statusClass(status){
  const s=up(status);
  if(s.includes("PAGA"))return "paid";
  if(s.includes("LIBER"))return "ok";
  if(s.includes("NEGAD"))return "no";
  if(s.includes("CORRE"))return "correct";
  if(s.includes("ANAL"))return "analysis";
  return "wait";
}
function authContext(){
  if(typeof getAuthContext==="function")return getAuthContext();
  return {usuario:localStorage.getItem("nf_auth_user")||"USUARIO",nome:localStorage.getItem("nf_auth_name")||localStorage.getItem("nf_auth_user")||"USUARIO",perfil:localStorage.getItem("nf_auth_profile")||"PERFIL",estado:localStorage.getItem("nf_auth_state")||""};
}
function canWrite(){return typeof canWriteEstadias==="function"?canWriteEstadias():up(currentRole())==="ADMINISTRADOR"}
function canDelete(){return typeof canDeleteEstadias==="function"?canDeleteEstadias():up(currentRole())==="ADMINISTRADOR"}
function ensureWrite(){if(canWrite())return true;alert("Seu perfil possui acesso somente para consulta.");return false}
function auditPayload(){const a=authContext();return {usuario:up(a.usuario),nomeUsuario:up(a.nome),perfil:up(a.perfil),estado:up(a.estado),atualizadoPor:up(a.nome||a.usuario),atualizadoEm:new Date().toISOString()}}
function normalizeRow(r,index){
  const chegada=r.dataHoraChegada??r["DATA/HORA CHEGADA"]??r.chegada??"";
  const saida=r.dataHoraSaida??r["DATA/HORA SAÍDA"]??r.saida??"";
  const espera=(chegada&&saida)?hoursBetween(chegada,saida):num(r.tempoEspera??r["TEMPO ESPERA (HORAS)"]);
  const retro=Math.max(0,num(r.tempoRetroativo??r["TEMPO RETROATIVO (HS)"]));
  const pagar=Math.max(0,espera-retro);
  const valorHora=Math.max(0,num(r.valorHora??r["VALOR ESTADIA (H)"]));
  const pesoDestino=num(r.pesoDestino??r["PESO DESTINO (kg)"]??r["PESO DESTINO (KG)"]);
  const pesoToneladas=Math.max(0,pesoDestino/1000);
  const valorTotal=roundMoney(pagar*valorHora*pesoToneladas);

  return {
    id:txt(r.id??r.ID??r.rowId??index+2),
    cliente:txt(r.cliente??r.CLIENTE),
    cte:txt(r.cte??r.CTE),
    nf:txt(r.nf??r.NF),
    dataNf:r.dataNf??r["DATA NF"]??"",
    placa:txt(r.placa??r.PLACA),
    motorista:txt(r.motorista??r.MOTORISTA),
    origem:txt(r.origem??r.ORIGEM),
    destino:txt(r.destino??r.DESTINO),
    produto:txt(r.produto??r.PRODUTO),
    pesoDestino,
    dataHoraChegada:chegada,
    dataHoraSaida:saida,
    tempoEspera:espera,
    tempoRetroativo:retro,
    horasPagar:pagar,
    valorHora,
    valorTotal,
    motivo:txt(r.motivo??r["MOTIVO DA ESTADIA"]),
    status:normalizeStatus(r.status??r["STATUS DA ESTADIA"]??"AGUARDANDO"),
    responsavel:txt(r.responsavel??r.RESPONSAVEL),
    observacoes:txt(r.observacoes??r.OBSERVACOES),
    anexoUrl:txt(r.anexoUrl??r.ANEXO_URL??r.anexo)
  };
}

function jsonp(params,timeout=35000){
  return new Promise((resolve,reject)=>{
    const cb=`nf_est_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script=document.createElement("script");
    const url=new URL(API_URL);

    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v??""));
    url.searchParams.set("callback",cb);
    url.searchParams.set("_",Date.now());

    const timer=setTimeout(()=>{
      cleanup();
      reject(new Error("Tempo de resposta excedido."));
    },timeout);

    function cleanup(){
      clearTimeout(timer);
      try{delete window[cb]}catch(e){}
      script.remove();
    }

    window[cb]=response=>{
      cleanup();
      resolve(response);
    };

    script.onerror=()=>{
      cleanup();
      reject(new Error("Falha de comunicação com a API."));
    };

    script.src=url.toString();
    document.head.appendChild(script);
  });
}

async function postApi(payload){
  const response=await fetch(API_URL,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify(payload)
  });

  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function loading(show,text="Processando..."){
  $("loading")?.classList.toggle("show",!!show);
  if($("loadingText"))$("loadingText").textContent=text;
}

function currentUser(){const a=authContext();return txt(a.nome||a.usuario||"USUÁRIO")}
function currentRole(){return txt(authContext().perfil||"PERFIL")}
function renderUser(){
  const name=currentUser();
  const role=currentRole();
  if($("userName"))$("userName").textContent=up(name);
  if($("userRole"))$("userRole").textContent=up(role);
  const initials=txt(name).split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join("").toUpperCase()||"NF";
  if($("userInitials"))$("userInitials").textContent=initials;
}

async function loadData(){
  loading(true,"Consultando estadias...");
  if($("syncStatus"))$("syncStatus").textContent="Atualizando...";

  try{
    const a=auditPayload();
    const res=await jsonp({action:ACTIONS.list,usuario:a.usuario,perfil:a.perfil,estado:a.estado});

    if(!res||res.ok===false){
      throw new Error(res?.error||"A API de estadias ainda não foi configurada.");
    }

    const rows=Array.isArray(res.data)?res.data:Array.isArray(res)?res:[];
    dados=rows.map(normalizeRow);

    popularFiltros();
    aplicarFiltros();

    if($("syncStatus")){
      $("syncStatus").textContent=`Atualizado às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
    }
  }catch(error){
    console.error("[ESTADIAS] Erro ao carregar:",error);
    dados=[];
    filtrados=[];
    renderTudo();
    if($("syncStatus"))$("syncStatus").textContent="Apps Script ainda sem as rotas de estadias";
    $("tabelaEstadias").innerHTML=
      `<tr><td colspan="13" class="empty">O layout está pronto. Agora precisamos adicionar ao Apps Script a ação <b>${ACTIONS.list}</b>.</td></tr>`;
  }finally{
    loading(false);
  }
}

function populateSelect(id,values){
  const el=$(id);
  if(!el)return;
  const old=el.value;
  const first=el.querySelector("option")?.outerHTML||'<option value="">Todos</option>';
  el.innerHTML=first+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
  el.value=values.includes(old)?old:"";
}
function popularFiltros(){
  const unique=field=>[...new Set(dados.map(r=>txt(r[field])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  populateSelect("filtroCliente",unique("cliente"));
  populateSelect("filtroProduto",unique("produto"));
  populateSelect("filtroResponsavel",unique("responsavel"));
}

function applyDateFilter(row){
  const ini=$("dataInicio")?.value;
  const fim=$("dataFim")?.value;
  if(!ini&&!fim)return true;

  const d=new Date(row.dataHoraChegada||row.dataNf);
  if(Number.isNaN(d.getTime()))return false;

  if(ini){
    const start=new Date(`${ini}T00:00:00`);
    if(d<start)return false;
  }
  if(fim){
    const end=new Date(`${fim}T23:59:59`);
    if(d>end)return false;
  }
  return true;
}

function aplicarFiltros(){
  const query=up($("busca")?.value);
  const cliente=up($("filtroCliente")?.value);
  const status=up($("filtroStatus")?.value);
  const produto=up($("filtroProduto")?.value);
  const responsavel=up($("filtroResponsavel")?.value);

  filtrados=dados.filter(r=>{
    const haystack=up([
      r.cliente,r.cte,r.nf,r.placa,r.motorista,r.origem,r.destino,
      r.produto,r.status,r.responsavel
    ].join(" "));

    return (!query||haystack.includes(query))
      &&(!cliente||up(r.cliente)===cliente)
      &&(!status||up(r.status)===status)
      &&(!produto||up(r.produto)===produto)
      &&(!responsavel||up(r.responsavel)===responsavel)
      &&applyDateFilter(r);
  });

  paginaAtual=1;
  renderTudo();
}

function renderKpis(){
  const total=filtrados.length;
  const aguardando=filtrados.filter(r=>up(r.status).includes("AGUARD")).length;
  const liberadas=filtrados.filter(r=>up(r.status).includes("LIBER")).length;
  const negadas=filtrados.filter(r=>up(r.status).includes("NEGAD")).length;
  const valor=filtrados.reduce((sum,r)=>sum+num(r.valorTotal),0);

  $("kpiTotal").textContent=total.toLocaleString("pt-BR");
  $("kpiAguardando").textContent=aguardando.toLocaleString("pt-BR");
  $("kpiLiberadas").textContent=liberadas.toLocaleString("pt-BR");
  $("kpiNegadas").textContent=negadas.toLocaleString("pt-BR");
  $("kpiValor").textContent=money(valor);
}

function getPageRows(){
  const size=num($("porPagina")?.value)||10;
  const start=(paginaAtual-1)*size;
  return filtrados.slice(start,start+size);
}

function statusOptionsHtml(current){
  return STATUS_OPTIONS.map(status=>`<option value="${esc(status)}" ${up(status)===up(current)?"selected":""}>${esc(status)}</option>`).join("");
}
function renderStatusCell(r){
  if(!canWrite()){
    return `<span class="badge ${statusClass(r.status)}" title="Status atual da solicitação">${esc(r.status)}</span>`;
  }
  return `<select class="statusSelect ${statusClass(r.status)}" data-id="${esc(r.id)}" data-old-status="${esc(r.status)}" ${statusEmAtualizacao.has(r.id)?"disabled":""}>${statusOptionsHtml(r.status)}</select>`;
}
function renderActionsCell(r){
  const actions=[];
  if(canWrite())actions.push(`<button class="btn ghost btnEdit" data-id="${esc(r.id)}" data-estadias-write style="min-height:28px;padding:0 9px">✏ Editar</button>`);
  if(r.anexoUrl)actions.push(`<a class="btn ghost" href="${esc(r.anexoUrl)}" target="_blank" rel="noopener" style="min-height:28px;padding:0 9px">📎</a>`);
  if(canDelete())actions.push(`<button class="btn red btnDelete" data-id="${esc(r.id)}" data-estadias-delete style="min-height:28px;padding:0 9px">🗑</button>`);
  return actions.length?`<div style="display:flex;gap:5px;align-items:center">${actions.join("")}</div>`:'<span style="color:#8795aa">Consulta</span>';
}
function renderTable(){
  const tbody=$("tabelaEstadias");
  const rows=getPageRows();
  if($("tableMeta"))$("tableMeta").textContent=`${filtrados.length} registro(s)`;
  if(!rows.length){tbody.innerHTML='<tr><td colspan="13" class="empty">Nenhuma estadia encontrada para os filtros selecionados.</td></tr>';return;}
  tbody.innerHTML=rows.map(r=>`
    <tr data-id="${esc(r.id)}">
      <td>${renderStatusCell(r)}</td>
      <td>${esc(r.cliente||"-")}</td><td>${esc(r.cte||"-")}</td><td>${esc(r.nf||"-")}</td>
      <td><b>${esc(r.placa||"-")}</b></td><td>${esc(r.origem||"-")}</td><td>${esc(r.destino||"-")}</td>
      <td>${esc(dateTimeBR(r.dataHoraChegada))}</td><td>${esc(dateTimeBR(r.dataHoraSaida))}</td>
      <td>${r.horasPagar>0?hoursText(r.horasPagar):"-"}</td>
      <td class="moneyCell">${r.valorTotal>0?money(r.valorTotal):"-"}</td>
      <td>${esc(r.responsavel||"-")}</td><td>${renderActionsCell(r)}</td>
    </tr>`).join("");
  tbody.querySelectorAll(".statusSelect").forEach(select=>{
    select.addEventListener("click",e=>e.stopPropagation());
    select.addEventListener("change",async e=>{
      e.stopPropagation();const oldStatus=select.dataset.oldStatus||"AGUARDANDO";const newStatus=normalizeStatus(select.value);
      select.className=`statusSelect ${statusClass(newStatus)}`;
      const ok=await updateStatus(select.dataset.id,newStatus,oldStatus);
      if(!ok){select.value=oldStatus;select.className=`statusSelect ${statusClass(oldStatus)}`;}
    });
  });
  tbody.querySelectorAll(".btnEdit").forEach(btn=>btn.onclick=e=>{e.stopPropagation();const item=dados.find(r=>r.id===btn.dataset.id);if(item)openModal(item)});
  tbody.querySelectorAll(".btnDelete").forEach(btn=>btn.onclick=e=>{e.stopPropagation();deleteItem(btn.dataset.id)});
}

function renderPagination(){
  const wrap=$("paginacao");
  const size=num($("porPagina")?.value)||10;
  const pages=Math.max(1,Math.ceil(filtrados.length/size));
  if(paginaAtual>pages)paginaAtual=pages;

  const items=[];
  items.push(`<button class="pageBtn" data-page="${paginaAtual-1}" ${paginaAtual===1?"disabled":""}>‹</button>`);

  const start=Math.max(1,paginaAtual-2);
  const end=Math.min(pages,start+4);
  for(let p=start;p<=end;p++){
    items.push(`<button class="pageBtn ${p===paginaAtual?"active":""}" data-page="${p}">${p}</button>`);
  }

  items.push(`<button class="pageBtn" data-page="${paginaAtual+1}" ${paginaAtual===pages?"disabled":""}>›</button>`);
  wrap.innerHTML=items.join("");

  wrap.querySelectorAll("button:not(:disabled)").forEach(btn=>{
    btn.onclick=()=>{
      paginaAtual=Number(btn.dataset.page);
      renderTable();
      renderPagination();
    };
  });
}

function renderTudo(){
  renderKpis();
  renderTable();
  renderPagination();
  if(typeof applyEstadiasAccessUI==="function")applyEstadiasAccessUI();
}

function clearForm(){
  $("formEstadia").reset();
  $("registroId").value="";
  $("status").value="AGUARDANDO";
  $("tempoRetroativo").value="0";
  $("valorHora").value="0";
  $("responsavel").value=currentUser();
  updateCalculationPreview();
}

function openModal(item=null){
  if(!ensureWrite())return;
  clearForm();
  $("modalTitulo").textContent=item?"Editar solicitação":"Nova solicitação de estadia";

  if(item){
    $("registroId").value=item.id;
    $("cliente").value=item.cliente;
    $("cte").value=item.cte;
    $("nf").value=item.nf;
    $("dataNf").value=toDateInput(item.dataNf);
    $("placa").value=item.placa;
    $("motorista").value=item.motorista;
    $("origem").value=item.origem;
    $("destino").value=item.destino;
    $("produto").value=item.produto;
    $("pesoDestino").value=item.pesoDestino||"";
    $("dataHoraChegada").value=toDateTimeInput(item.dataHoraChegada);
    $("dataHoraSaida").value=toDateTimeInput(item.dataHoraSaida);
    $("tempoRetroativo").value=item.tempoRetroativo||0;
    $("valorHora").value=item.valorHora||0;
    $("status").value=item.status||"AGUARDANDO";
    $("responsavel").value=item.responsavel||currentUser();
    $("motivo").value=item.motivo;
    $("observacoes").value=item.observacoes;
    $("anexoUrl").value=item.anexoUrl;
  }

  updateCalculationPreview();
  $("modalEstadia").classList.add("show");
}
function closeModal(){$("modalEstadia").classList.remove("show")}

// Fórmula oficial:
// total = horas a pagar × valor por tonelada/hora × peso em toneladas.
// O campo pesoDestino é informado em kg, por isso é dividido por 1.000.
function calculateFormValues(){
  const espera=hoursBetween($("dataHoraChegada")?.value,$("dataHoraSaida")?.value);
  const retro=Math.max(0,num($("tempoRetroativo")?.value));
  const pagar=Math.max(0,espera-retro);
  const valorHora=Math.max(0,num($("valorHora")?.value));
  const pesoDestino=Math.max(0,num($("pesoDestino")?.value));
  const pesoToneladas=pesoDestino/1000;
  const valorTotal=roundMoney(pagar*valorHora*pesoToneladas);

  return {
    espera,
    retro,
    pagar,
    valorHora,
    pesoDestino,
    pesoToneladas,
    valorTotal
  };
}
function updateCalculationPreview(){
  const c=calculateFormValues();
  if($("calcTempoEspera"))$("calcTempoEspera").textContent=hoursText(c.espera);
  if($("calcHorasPagar"))$("calcHorasPagar").textContent=hoursText(c.pagar);
  if($("calcValorTotal"))$("calcValorTotal").textContent=money(c.valorTotal);
  return c;
}
function formPayload(){
  const c=calculateFormValues();
  return {
    id:$("registroId").value,cliente:up($("cliente").value),cte:txt($("cte").value),nf:txt($("nf").value),dataNf:$("dataNf").value,
    placa:up($("placa").value),motorista:up($("motorista").value),origem:up($("origem").value),destino:up($("destino").value),produto:up($("produto").value),
    pesoDestino:c.pesoDestino,dataHoraChegada:$("dataHoraChegada").value,dataHoraSaida:$("dataHoraSaida").value,
    tempoEspera:c.espera,tempoRetroativo:c.retro,horasPagar:c.pagar,valorHora:c.valorHora,valorTotal:c.valorTotal,
    motivo:up($("motivo").value),status:normalizeStatus($("status").value),responsavel:up($("responsavel").value||currentUser()),
    observacoes:up($("observacoes").value),anexoUrl:txt($("anexoUrl").value),...auditPayload()
  };
}

async function saveItem(){
  if(!ensureWrite())return;
  if(!$("formEstadia").reportValidity())return;

  const payload=formPayload();
  const isEdit=!!payload.id;

  loading(true,isEdit?"Atualizando solicitação...":"Salvando solicitação...");

  try{
    const res=await postApi({
      action:isEdit?ACTIONS.update:ACTIONS.save,
      data:payload,
      auth:auditPayload()
    });

    if(!res||res.ok===false)throw new Error(res?.error||"Não foi possível salvar.");

    closeModal();
    await loadData();
  }catch(error){
    console.error("[ESTADIAS] Erro ao salvar:",error);
    alert(`O Apps Script ainda precisa receber a rota ${isEdit?ACTIONS.update:ACTIONS.save}.\n\n${error.message}`);
  }finally{
    loading(false);
  }
}

async function updateStatus(id,status,oldStatus){
  if(!ensureWrite())return false;
  const item=dados.find(r=>r.id===id);
  if(!item){alert("Registro não encontrado.");return false;}
  const newStatus=normalizeStatus(status);
  if(up(newStatus)===up(item.status))return true;
  if(!confirm(`Alterar o status de "${item.status}" para "${newStatus}"?`))return false;
  statusEmAtualizacao.add(id);renderTable();
  try{
    const res=await postApi({action:ACTIONS.status,id,status:newStatus,statusAnterior:oldStatus||item.status,responsavel:item.responsavel||currentUser(),auth:auditPayload(),...auditPayload()});
    if(!res||res.ok===false)throw new Error(res?.error||"Falha ao atualizar status.");
    item.status=newStatus;item.atualizadoPor=currentUser();item.atualizadoEm=new Date().toISOString();aplicarFiltros();return true;
  }catch(error){console.error(error);alert(`Não foi possível atualizar o status.

${error.message}`);return false;}
  finally{statusEmAtualizacao.delete(id);renderTudo();}
}
async function deleteItem(id){
  if(!canDelete()){alert("Somente administradores podem excluir estadias.");return;}
  const item=dados.find(r=>r.id===id);if(!item)return;
  if(!confirm(`Excluir definitivamente a estadia da placa ${item.placa||"-"}?`))return;
  loading(true,"Excluindo solicitação...");
  try{const res=await postApi({action:ACTIONS.remove,id,auth:auditPayload(),...auditPayload()});if(!res||res.ok===false)throw new Error(res?.error||"Falha ao excluir.");await loadData();}
  catch(error){alert(`Não foi possível excluir a estadia.

${error.message}`);}
  finally{loading(false);}
}

function clearFilters(){
  $("busca").value="";
  $("filtroCliente").value="";
  $("filtroStatus").value="";
  $("dataInicio").value="";
  $("dataFim").value="";
  $("filtroProduto").value="";
  $("filtroResponsavel").value="";
  aplicarFiltros();
}

function exportCsv(){
  if(!filtrados.length)return alert("Não há dados para exportar.");

  const header=[
    "CLIENTE","CTE","NF","DATA NF","PLACA","MOTORISTA","ORIGEM","DESTINO",
    "PRODUTO","PESO DESTINO (KG)","DATA/HORA CHEGADA","DATA/HORA SAÍDA",
    "TEMPO ESPERA (HORAS)","TEMPO RETROATIVO (HS)","HORA A PAGAR",
    "VALOR ESTADIA (H)","VALOR ESTADIA (R$)","MOTIVO DA ESTADIA",
    "STATUS DA ESTADIA","RESPONSÁVEL","OBSERVAÇÕES","ANEXO"
  ];

  const rows=filtrados.map(r=>[
    r.cliente,r.cte,r.nf,dateOnlyBR(r.dataNf),r.placa,r.motorista,r.origem,r.destino,
    r.produto,r.pesoDestino,dateTimeBR(r.dataHoraChegada),dateTimeBR(r.dataHoraSaida),
    r.tempoEspera,r.tempoRetroativo,r.horasPagar,r.valorHora,r.valorTotal,r.motivo,
    r.status,r.responsavel,r.observacoes,r.anexoUrl
  ]);

  const csv=[header,...rows]
    .map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(";"))
    .join("\n");

  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`estadias_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function bind(){
  renderUser();

  if($("btnNovaEstadia"))$("btnNovaEstadia").onclick=()=>{if(ensureWrite())openModal()};
  $("btnAtualizar").onclick=loadData;
  $("btnExportar").onclick=exportCsv;
  $("btnFiltrar").onclick=aplicarFiltros;
  $("btnLimparFiltros").onclick=clearFilters;

  $("btnFecharModal").onclick=closeModal;
  $("btnCancelarModal").onclick=closeModal;
  $("btnSalvarEstadia").onclick=saveItem;

  $("modalEstadia").addEventListener("click",e=>{
    if(e.target===$("modalEstadia"))closeModal();
  });

  $("busca").addEventListener("input",()=>{
    clearTimeout(window.__nfEstadiaSearch);
    window.__nfEstadiaSearch=setTimeout(aplicarFiltros,250);
  });

  ["filtroCliente","filtroStatus","dataInicio","dataFim","filtroProduto","filtroResponsavel"].forEach(id=>{
    $(id).addEventListener("change",aplicarFiltros);
  });

  $("porPagina").addEventListener("change",()=>{
    paginaAtual=1;renderTable();renderPagination();
  });

  ["dataHoraChegada","dataHoraSaida","tempoRetroativo","valorHora","pesoDestino"].forEach(id=>{
    $(id)?.addEventListener("input",updateCalculationPreview);
    $(id)?.addEventListener("change",updateCalculationPreview);
  });
}

window.addEventListener("DOMContentLoaded",()=>{
  if(typeof requireEstadiasAuth==="function"&&requireEstadiasAuth()!==true)return;
  bind();
  loadData();
});

})();
