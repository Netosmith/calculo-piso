/* estadias.js | NOVA FROTA */
(function(){
"use strict";

const API_URL="https://script.google.com/macros/s/AKfycbwlz0Rr0PmdPLZva-6TtSzpfDqx-G1IAkrX8n8cFp5t4mDkH5NQjsztvaWYbtUu8nFG/exec";

const ACTIONS={
  list:"estadias_list",
  save:"estadias_save",
  update:"estadias_update",
  remove:"estadias_delete",
  status:"estadias_status"
};

const $=id=>document.getElementById(id);

let dados=[];
let filtrados=[];
let paginaAtual=1;
let selecionado=null;

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
function hoursBetween(start,end){
  const a=new Date(start),b=new Date(end);
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return 0;
  return Math.max(0,(b-a)/3600000);
}
function statusClass(status){
  const s=up(status);
  if(s.includes("LIBER"))return "ok";
  if(s.includes("NEGAD"))return "no";
  if(s.includes("CORRE"))return "correct";
  if(s.includes("ANAL"))return "analysis";
  return "wait";
}
function normalizeRow(r,index){
  const chegada=r.dataHoraChegada??r["DATA/HORA CHEGADA"]??r.chegada??"";
  const saida=r.dataHoraSaida??r["DATA/HORA SAÃDA"]??r.saida??"";
  const espera=num(r.tempoEspera??r["TEMPO ESPERA (HORAS)"])||hoursBetween(chegada,saida);
  const retro=num(r.tempoRetroativo??r["TEMPO RETROATIVO (HS)"]);
  const pagar=num(r.horasPagar??r["HORA A PAGAR"])||Math.max(0,espera-retro);
  const valorHora=num(r.valorHora??r["VALOR ESTADIA (H)"]);
  const valorTotal=num(r.valorTotal??r["VALOR ESTADIA (R$)"])||(pagar*valorHora);

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
    pesoDestino:num(r.pesoDestino??r["PESO DESTINO (kg)"]),
    dataHoraChegada:chegada,
    dataHoraSaida:saida,
    tempoEspera:espera,
    tempoRetroativo:retro,
    horasPagar:pagar,
    valorHora,
    valorTotal,
    motivo:txt(r.motivo??r["MOTIVO DA ESTADIA"]),
    status:txt(r.status??r["STATUS DA ESTADIA"]??"AGUARDANDO"),
    situacao:txt(r.situacao??r.SITUACAO),
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
      reject(new Error("Falha de comunicaÃ§Ã£o com a API."));
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

function currentUser(){
  const keys=["nf_auth_nome","nf_auth_user","usuario"];
  for(const key of keys){
    const value=localStorage.getItem(key);
    if(value)return value;
  }
  return "USUÃRIO";
}
function currentRole(){
  return localStorage.getItem("nf_auth_profile")||localStorage.getItem("perfil")||"PERFIL";
}
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
    const res=await jsonp({action:ACTIONS.list});

    if(!res||res.ok===false){
      throw new Error(res?.error||"A API de estadias ainda nÃ£o foi configurada.");
    }

    const rows=Array.isArray(res.data)?res.data:Array.isArray(res)?res:[];
    dados=rows.map(normalizeRow);

    popularFiltros();
    aplicarFiltros();

    if($("syncStatus")){
      $("syncStatus").textContent=`Atualizado Ã s ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
    }
  }catch(error){
    console.error("[ESTADIAS] Erro ao carregar:",error);
    dados=[];
    filtrados=[];
    renderTudo();
    if($("syncStatus"))$("syncStatus").textContent="Apps Script ainda sem as rotas de estadias";
    $("tabelaEstadias").innerHTML=
      `<tr><td colspan="14" class="empty">O layout estÃ¡ pronto. Agora precisamos adicionar ao Apps Script a aÃ§Ã£o <b>${ACTIONS.list}</b>.</td></tr>`;
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

function renderTable(){
  const tbody=$("tabelaEstadias");
  const rows=getPageRows();

  $("tableMeta").textContent=`${filtrados.length} registro(s)`;

  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="14" class="empty">Nenhuma estadia encontrada para os filtros selecionados.</td></tr>';
    return;
  }

  tbody.innerHTML=rows.map(r=>`
    <tr data-id="${esc(r.id)}" class="${selecionado?.id===r.id?"selected":""}">
      <td><span class="badge ${statusClass(r.status)}">${esc(r.status||"AGUARDANDO")}</span></td>
      <td>${esc(r.cliente||"-")}</td>
      <td>${esc(r.cte||"-")}</td>
      <td>${esc(r.nf||"-")}</td>
      <td><b>${esc(r.placa||"-")}</b></td>
      <td>${esc(r.origem||"-")}</td>
      <td>${esc(r.destino||"-")}</td>
      <td>${esc(dateTimeBR(r.dataHoraChegada))}</td>
      <td>${esc(dateTimeBR(r.dataHoraSaida))}</td>
      <td>${r.tempoEspera?`${r.tempoEspera.toFixed(2)} h`:"-"}</td>
      <td class="moneyCell">${r.valorTotal?money(r.valorTotal):"-"}</td>
      <td><span class="badge ${statusClass(r.situacao||r.status)}">${esc(r.situacao||r.status||"-")}</span></td>
      <td>${esc(r.responsavel||"-")}</td>
      <td>
        <button class="btn ghost btnEdit" data-id="${esc(r.id)}" style="min-height:27px;padding:0 8px">Editar</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr[data-id]").forEach(tr=>{
    tr.addEventListener("click",e=>{
      if(e.target.closest(".btnEdit"))return;
      selecionado=dados.find(r=>r.id===tr.dataset.id)||null;
      renderTable();
      renderDetails();
    });
  });

  tbody.querySelectorAll(".btnEdit").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      const item=dados.find(r=>r.id===btn.dataset.id);
      if(item)openModal(item);
    });
  });
}

function renderPagination(){
  const wrap=$("paginacao");
  const size=num($("porPagina")?.value)||10;
  const pages=Math.max(1,Math.ceil(filtrados.length/size));
  if(paginaAtual>pages)paginaAtual=pages;

  const items=[];
  items.push(`<button class="pageBtn" data-page="${paginaAtual-1}" ${paginaAtual===1?"disabled":""}>â¹</button>`);

  const start=Math.max(1,paginaAtual-2);
  const end=Math.min(pages,start+4);
  for(let p=start;p<=end;p++){
    items.push(`<button class="pageBtn ${p===paginaAtual?"active":""}" data-page="${p}">${p}</button>`);
  }

  items.push(`<button class="pageBtn" data-page="${paginaAtual+1}" ${paginaAtual===pages?"disabled":""}>âº</button>`);
  wrap.innerHTML=items.join("");

  wrap.querySelectorAll("button:not(:disabled)").forEach(btn=>{
    btn.onclick=()=>{
      paginaAtual=Number(btn.dataset.page);
      renderTable();
      renderPagination();
    };
  });
}

function renderDetails(){
  const body=$("detalhesBody");
  const r=selecionado;

  if(!r){
    body.innerHTML='<div class="empty">Selecione uma solicitaÃ§Ã£o na tabela.</div>';
    return;
  }

  body.innerHTML=`
    <div class="detailStatusRow">
      <span class="badge ${statusClass(r.status)}">${esc(r.status)}</span>
      <span class="detailId">ID: #EST-${esc(String(r.id).padStart(5,"0"))}</span>
    </div>

    <dl class="detailGrid">
      <dt>Cliente:</dt><dd>${esc(r.cliente||"-")}</dd>
      <dt>CTe:</dt><dd>${esc(r.cte||"-")}</dd>
      <dt>NF:</dt><dd>${esc(r.nf||"-")}</dd>
      <dt>Data NF:</dt><dd>${esc(dateOnlyBR(r.dataNf))}</dd>
      <dt>Placa:</dt><dd>${esc(r.placa||"-")}</dd>
      <dt>Motorista:</dt><dd>${esc(r.motorista||"-")}</dd>
      <dt>Origem:</dt><dd>${esc(r.origem||"-")}</dd>
      <dt>Destino:</dt><dd>${esc(r.destino||"-")}</dd>
      <dt>Produto:</dt><dd>${esc(r.produto||"-")}</dd>
      <dt>Peso (kg):</dt><dd>${r.pesoDestino?r.pesoDestino.toLocaleString("pt-BR"):"-"}</dd>
    </dl>

    <hr class="detailDivider">

    <dl class="detailGrid">
      <dt>Chegada:</dt><dd>${esc(dateTimeBR(r.dataHoraChegada))}</dd>
      <dt>SaÃ­da:</dt><dd>${esc(dateTimeBR(r.dataHoraSaida))}</dd>
      <dt>Tempo de espera:</dt><dd>${r.tempoEspera?`${r.tempoEspera.toFixed(2)} h`:"-"}</dd>
      <dt>Tempo retroativo:</dt><dd>${r.tempoRetroativo?`${r.tempoRetroativo.toFixed(2)} h`:"-"}</dd>
      <dt>Horas a pagar:</dt><dd>${r.horasPagar?`${r.horasPagar.toFixed(2)} h`:"-"}</dd>
      <dt>Valor/hora:</dt><dd>${r.valorHora?money(r.valorHora):"-"}</dd>
      <dt>Valor da estadia:</dt><dd>${r.valorTotal?money(r.valorTotal):"-"}</dd>
      <dt>ResponsÃ¡vel:</dt><dd>${esc(r.responsavel||"-")}</dd>
      <dt>Motivo:</dt><dd>${esc(r.motivo||"-")}</dd>
      <dt>ObservaÃ§Ãµes:</dt><dd>${esc(r.observacoes||"-")}</dd>
    </dl>

    ${r.anexoUrl?`
      <div class="attachment">
        <strong>ð Anexo (1)</strong>
        <a href="${esc(r.anexoUrl)}" target="_blank" rel="noopener">Abrir documento <span>â©</span></a>
      </div>`:""}

    <div class="detailsActions">
      <button class="btn green detailAction" data-status="LIBERADA">Aprovar</button>
      <button class="btn red detailAction" data-status="NEGADA CLIENTE">Negar</button>
      <button class="btn ghost detailAction" data-status="SOLICITAR CORREÃÃO">Solicitar correÃ§Ã£o</button>
    </div>
  `;

  body.querySelectorAll(".detailAction").forEach(btn=>{
    btn.onclick=()=>updateStatus(r.id,btn.dataset.status);
  });
}

function renderTudo(){
  renderKpis();
  renderTable();
  renderPagination();
  renderDetails();
}

function clearForm(){
  $("formEstadia").reset();
  $("registroId").value="";
  $("status").value="AGUARDANDO";
  $("tempoRetroativo").value="0";
  $("valorHora").value="0";
  $("responsavel").value=currentUser();
}

function openModal(item=null){
  clearForm();
  $("modalTitulo").textContent=item?"Editar solicitaÃ§Ã£o":"Nova solicitaÃ§Ã£o de estadia";

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

  $("modalEstadia").classList.add("show");
}
function closeModal(){$("modalEstadia").classList.remove("show")}

function formPayload(){
  const chegada=$("dataHoraChegada").value;
  const saida=$("dataHoraSaida").value;
  const espera=hoursBetween(chegada,saida);
  const retro=num($("tempoRetroativo").value);
  const pagar=Math.max(0,espera-retro);
  const valorHora=num($("valorHora").value);

  return {
    id:$("registroId").value,
    cliente:up($("cliente").value),
    cte:txt($("cte").value),
    nf:txt($("nf").value),
    dataNf:$("dataNf").value,
    placa:up($("placa").value),
    motorista:up($("motorista").value),
    origem:up($("origem").value),
    destino:up($("destino").value),
    produto:up($("produto").value),
    pesoDestino:num($("pesoDestino").value),
    dataHoraChegada:chegada,
    dataHoraSaida:saida,
    tempoEspera:espera,
    tempoRetroativo:retro,
    horasPagar:pagar,
    valorHora,
    valorTotal:pagar*valorHora,
    motivo:up($("motivo").value),
    status:up($("status").value),
    situacao:up($("status").value),
    responsavel:up($("responsavel").value||currentUser()),
    observacoes:up($("observacoes").value),
    anexoUrl:txt($("anexoUrl").value)
  };
}

async function saveItem(){
  if(!$("formEstadia").reportValidity())return;

  const payload=formPayload();
  const isEdit=!!payload.id;

  loading(true,isEdit?"Atualizando solicitaÃ§Ã£o...":"Salvando solicitaÃ§Ã£o...");

  try{
    const res=await postApi({
      action:isEdit?ACTIONS.update:ACTIONS.save,
      data:payload
    });

    if(!res||res.ok===false)throw new Error(res?.error||"NÃ£o foi possÃ­vel salvar.");

    closeModal();
    await loadData();
  }catch(error){
    console.error("[ESTADIAS] Erro ao salvar:",error);
    alert(`O Apps Script ainda precisa receber a rota ${isEdit?ACTIONS.update:ACTIONS.save}.\n\n${error.message}`);
  }finally{
    loading(false);
  }
}

async function updateStatus(id,status){
  if(!confirm(`Alterar esta estadia para "${status}"?`))return;

  loading(true,"Atualizando status...");
  try{
    const res=await postApi({
      action:ACTIONS.status,
      id,
      status,
      responsavel:currentUser()
    });

    if(!res||res.ok===false)throw new Error(res?.error||"Falha ao atualizar status.");
    await loadData();
    selecionado=dados.find(r=>r.id===id)||null;
    renderTudo();
  }catch(error){
    console.error(error);
    alert(`O Apps Script ainda precisa receber a rota ${ACTIONS.status}.\n\n${error.message}`);
  }finally{
    loading(false);
  }
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
  if(!filtrados.length)return alert("NÃ£o hÃ¡ dados para exportar.");

  const header=[
    "CLIENTE","CTE","NF","DATA NF","PLACA","MOTORISTA","ORIGEM","DESTINO",
    "PRODUTO","PESO DESTINO (KG)","DATA/HORA CHEGADA","DATA/HORA SAÃDA",
    "TEMPO ESPERA (HORAS)","TEMPO RETROATIVO (HS)","HORA A PAGAR",
    "VALOR ESTADIA (H)","VALOR ESTADIA (R$)","MOTIVO DA ESTADIA",
    "STATUS DA ESTADIA","RESPONSÃVEL","OBSERVAÃÃES","ANEXO"
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

  $("btnNovaEstadia").onclick=()=>openModal();
  $("btnAtualizar").onclick=loadData;
  $("btnExportar").onclick=exportCsv;
  $("btnFiltrar").onclick=aplicarFiltros;
  $("btnLimparFiltros").onclick=clearFilters;
  $("btnFecharDetalhes").onclick=()=>{selecionado=null;renderTudo()};

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
    paginaAtual=1;
    renderTable();
    renderPagination();
  });
}

window.addEventListener("DOMContentLoaded",()=>{
  bind();
  loadData();
});

})();