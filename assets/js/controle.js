/* controle.js | NOVA FROTA | GATEWAY SEGURO | TEMA CLARO + EDIÇÃO DE VEÍCULOS */
(function(){
"use strict";

const S={
  rows:[],
  filial:"",
  id:"",
  loading:false,
  veiculoEditId:""
};

const $=s=>document.querySelector(s);
const safe=v=>String(v??"").trim();
const upper=v=>safe(v).toUpperCase();
const num=v=>{
  const n=Number(String(v??"").replace(/\./g,"").replace(",","."));
  return Number.isFinite(n)?n:0;
};
const ton=v=>num(v).toLocaleString("pt-BR",{maximumFractionDigits:2})+" t";

const STATUS_EMBARQUE=["AGENDADO","EM ANDAMENTO","EM ATRASO","CONCLUÍDO","CANCELADO"];
const STATUS_VEICULO=["PORTA","CARREGANDO","CARREGADO","TRÂNSITO","FINALIZADO","CANCELADO"];

function escapeHtml(value){
  return safe(value)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function optionList(values,selected){
  const atual=upper(selected);
  return values.map(value=>
    `<option value="${escapeHtml(value)}"${upper(value)===atual?" selected":""}>${escapeHtml(value)}</option>`
  ).join("");
}

function fmtDataHora(v){
  if(!v)return"-";
  const d=new Date(v);
  return Number.isNaN(d.getTime())
    ? safe(v)
    : d.toLocaleString("pt-BR",{
        day:"2-digit",month:"2-digit",year:"numeric",
        hour:"2-digit",minute:"2-digit"
      });
}

function fmtData(v){
  if(!v)return"-";
  const raw=String(v);
  if(/^\d{4}-\d{2}-\d{2}/.test(raw)){
    const d=raw.slice(0,10).split("-");
    return`${d[2]}/${d[1]}/${d[0]}`;
  }
  return raw;
}

function sync(text){
  const el=$("#sync");
  if(el)el.textContent=text;
}

function setButtonSaving(button,saving,text="SALVANDO..."){
  if(!button)return;
  if(saving){
    button.dataset.originalText=button.dataset.originalText||button.textContent;
    button.disabled=true;
    button.textContent=text;
  }else{
    button.disabled=false;
    button.textContent=button.dataset.originalText||"Salvar";
  }
}

function setLoading(on,text){
  S.loading=!!on;
  sync(on?(text||"⏳ Carregando..."):"✅ Pronto");
  ["#btnNovoTop","#btnNovoFilial","#btnNovoVeiculo","#btnAtualizar"].forEach(sel=>{
    const el=$(sel);
    if(el)el.disabled=!!on;
  });
}

async function portalApi(){
  if(window.PortalAPI)return window.PortalAPI;
  if(typeof window.ensurePortalApi==="function")return window.ensurePortalApi();
  throw new Error("API segura do Portal indisponível.");
}

async function api(action,resource,params={}){
  const client=await portalApi();
  const response=await client.call("controle",action,{...params,resource});
  if(!response||response.ok===false)throw new Error(response?.error||"Erro na API segura.");
  return response;
}

function extractRows(res){
  const raw=res?.data;
  const rows=raw?.rows??raw?.data??raw?.items??raw?.embarques??raw?.veiculos??raw??[];
  return Array.isArray(rows)?rows:[];
}

function normalizeVeiculo(v){
  return{
    id:safe(v.id??v.ID??v.Id),
    idEmbarque:safe(v.idEmbarque??v.IDEmbarque??v.embarqueId),
    dataHora:safe(v.dataHora??v.DataHora??v.data_hora),
    placa:upper(v.placa??v.Placa),
    motorista:upper(v.motorista??v.Motorista),
    tipo:upper(v.tipo??v.Tipo??v.tipoVeiculo??v.TipoVeiculo),
    peso:num(v.peso??v.Peso),
    situacao:upper(v.situacao??v.Situacao??v.status)
  };
}

function normalizeEmbarque(e){
  const veiculos=Array.isArray(e.veiculos)?e.veiculos.map(normalizeVeiculo):[];
  return{
    id:safe(e.id??e.ID??e.Id),
    data:safe(e.data??e.Data??e.dataCriacao??e.DataCriacao),
    filial:upper(e.filial??e.Filial),
    cliente:upper(e.cliente??e.Cliente),
    origem:upper(e.origem??e.Origem),
    local:upper(e.local??e.Local??e.localEmbarque??e.LocalEmbarque),
    destino:upper(e.destino??e.Destino),
    produto:upper(e.produto??e.Produto),
    volume:num(e.volume??e.Volume??e.volumeContratado??e.VolumeContratado),
    status:upper(e.status??e.Status),
    veiculos
  };
}

async function carregarDados(){
  setLoading(true,"⏳ Carregando embarques...");
  try{
    const[resEmb,resVei]=await Promise.all([
      api("read","embarques"),
      api("read","veiculos")
    ]);

    const embarques=extractRows(resEmb).map(normalizeEmbarque);
    const veiculos=extractRows(resVei).map(normalizeVeiculo);
    const mapa={};

    veiculos.forEach(v=>{
      if(!mapa[v.idEmbarque])mapa[v.idEmbarque]=[];
      mapa[v.idEmbarque].push(v);
    });

    embarques.forEach(e=>{
      e.veiculos=mapa[e.id]||e.veiculos||[];
    });

    S.rows=embarques;
    renderDashboard();

    if(S.filial)renderFilial();
    if(S.id&&S.rows.some(e=>e.id===S.id))openDetalhe(S.id,false);

    sync("✅ Dados atualizados");
  }catch(err){
    console.error("[CONTROLE] carregar:",err);
    sync("⚠️ Erro ao carregar");
    alert("Não foi possível carregar o controle de embarque.\n\n"+err.message);
  }finally{
    setLoading(false);
  }
}

function show(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $("#view-"+name)?.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}

function embarcado(e){
  return(e.veiculos||[]).reduce((a,v)=>a+num(v.peso),0);
}

function saldo(e){
  return Math.max(0,num(e.volume)-embarcado(e));
}

function cls(status){
  status=upper(status);
  if(["CONCLUÍDO","FINALIZADO"].includes(status))return"text-green-700 border-green-300 bg-green-50";
  if(["EM ATRASO","CANCELADO"].includes(status))return"text-red-700 border-red-300 bg-red-50";
  if(["EM ANDAMENTO","CARREGANDO"].includes(status))return"text-amber-700 border-amber-300 bg-amber-50";
  if(["TRÂNSITO","CARREGADO"].includes(status))return"text-blue-700 border-blue-300 bg-blue-50";
  return"text-slate-700 border-slate-300 bg-slate-50";
}

function statusSlug(value){
  return upper(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^A-Z0-9]+/g,"")
    .toLowerCase();
}

function filenamePart(value){
  return upper(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^A-Z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"");
}

function getEmbarqueAtual(){
  return S.rows.find(x=>x.id===S.id)||null;
}

function resumo(){
  const map={};

  S.rows.forEach(e=>{
    const filial=upper(e.filial||"SEM FILIAL");
    if(!map[filial]){
      map[filial]={filial,total:0,ativos:0,finalizados:0,veiculos:0};
    }

    map[filial].total++;
    map[filial].veiculos+=(e.veiculos||[]).length;

    if(upper(e.status)==="CONCLUÍDO")map[filial].finalizados++;
    else map[filial].ativos++;
  });

  return Object.values(map).sort((a,b)=>a.filial.localeCompare(b.filial));
}

function fillFiliais(){
  const el=$("#fFilial");
  if(!el)return;

  const old=el.value;
  const filiais=resumo().map(x=>x.filial);

  el.innerHTML=
    '<option value="">Todas as filiais</option>'+
    filiais.map(f=>`<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");

  if(filiais.includes(old))el.value=old;
}

function renderDashboard(){
  let data=resumo();
  const filtro=upper($("#fFilial")?.value);
  const busca=upper($("#fBusca")?.value);

  if(filtro)data=data.filter(x=>x.filial===filtro);

  if(busca){
    data=data.filter(x=>
      upper(JSON.stringify({
        resumo:x,
        embarques:S.rows.filter(e=>upper(e.filial)===x.filial)
      })).includes(busca)
    );
  }

  const grid=$("#gridFiliais");
  if(!grid)return;

  grid.innerHTML="";

  if(!data.length){
    grid.innerHTML='<div class="col-span-full bg-white border border-line rounded-xl p-8 text-center text-muted">Nenhuma filial encontrada.</div>';
  }

  data.forEach(x=>{
    const aberto=x.ativos>0;
    const button=document.createElement("button");
    button.type="button";
    button.className="text-left bg-white border border-line p-5 rounded-2xl hover:border-blue-300 hover:shadow-lg transition-all";

    button.innerHTML=`
      <div class="flex justify-between mb-4">
        <span class="material-symbols-outlined ${aberto?"text-amber-500 pulse":"text-green-600"}">local_shipping</span>
        <span class="text-xs font-bold ${aberto?"text-amber-700":"text-green-700"}">
          ${aberto?"EM ABERTO":"FINALIZADOS"}
        </span>
      </div>
      <h3 class="text-lg font-bold text-text">${escapeHtml(x.filial)}</h3>
      <div class="mt-4 pt-4 border-t border-line grid grid-cols-3 gap-2">
        <div><small class="text-muted">Ativos</small><b class="block text-xl text-text">${x.ativos}</b></div>
        <div><small class="text-muted">Veículos</small><b class="block text-xl text-text">${x.veiculos}</b></div>
        <div><small class="text-muted">Total</small><b class="block text-xl text-text">${x.total}</b></div>
      </div>
    `;

    button.onclick=()=>openFilial(x.filial);
    grid.appendChild(button);
  });

  const finalizados=S.rows.filter(e=>upper(e.status)==="CONCLUÍDO").length;
  $("#sFiliais").textContent=resumo().length;
  $("#sAtivos").textContent=S.rows.length-finalizados;
  $("#sVeiculos").textContent=S.rows.reduce((a,e)=>a+(e.veiculos||[]).length,0);
  $("#sFinalizados").textContent=finalizados;

  fillFiliais();
}

function openFilial(filial){
  S.filial=filial;
  $("#tituloFilial").textContent="Filial: "+filial;
  renderFilial();
  show("filial");
}

function renderFilial(){
  let rows=S.rows.filter(e=>upper(e.filial)===upper(S.filial));
  const busca=upper($("#buscaFilial")?.value);

  if(busca)rows=rows.filter(e=>upper(JSON.stringify(e)).includes(busca));

  const tbody=$("#tbodyEmbarques");
  tbody.innerHTML="";

  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="9" class="p-8 text-center text-muted">Nenhum embarque encontrado para esta filial.</td></tr>';
  }

  rows.forEach(e=>{
    const tr=document.createElement("tr");
    tr.className="hover:bg-slate-50 transition-colors";

    tr.innerHTML=`
      <td class="p-4">${fmtData(e.data)}</td>
      <td class="p-4 font-semibold">${escapeHtml(e.cliente)}</td>
      <td class="p-4">${escapeHtml(e.origem)}</td>
      <td class="p-4">${escapeHtml(e.local)}</td>
      <td class="p-4">${escapeHtml(e.destino)}</td>
      <td class="p-4">${ton(e.volume)}</td>
      <td class="p-4">${ton(saldo(e))}</td>
      <td class="p-4">
        <select data-status-embarque="${escapeHtml(e.id)}"
          class="status-select border rounded-lg px-3 py-2 text-xs font-bold uppercase ${cls(e.status)}">
          ${optionList(STATUS_EMBARQUE,e.status)}
        </select>
      </td>
      <td class="p-4 text-right whitespace-nowrap">
        <button data-open="${escapeHtml(e.id)}"
          class="material-symbols-outlined text-blue-600 hover:text-blue-800"
          title="Abrir embarque">visibility</button>
        <button data-del="${escapeHtml(e.id)}"
          class="material-symbols-outlined text-red-500 hover:text-red-700 ml-2"
          title="Excluir embarque">delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-open]").forEach(btn=>{
    btn.onclick=()=>openDetalhe(btn.dataset.open);
  });

  tbody.querySelectorAll("[data-status-embarque]").forEach(select=>{
    select.onchange=()=>atualizarStatusEmbarque(
      select.dataset.statusEmbarque,
      select.value,
      select
    );
  });

  tbody.querySelectorAll("[data-del]").forEach(btn=>{
    btn.onclick=()=>deleteEmbarque(btn.dataset.del);
  });

  const todos=S.rows.filter(e=>upper(e.filial)===upper(S.filial));
  const finalizados=todos.filter(e=>upper(e.status)==="CONCLUÍDO").length;
  const volume=todos.reduce((a,e)=>a+num(e.volume),0);
  const saldoTotal=todos.reduce((a,e)=>a+saldo(e),0);
  const saidas=todos.reduce(
    (a,e)=>a+(e.veiculos||[]).filter(v=>upper(v.situacao)==="FINALIZADO").length,
    0
  );

  $("#fAtivos").textContent=todos.length-finalizados;
  $("#fTotal").textContent=todos.length;
  $("#fFinalizados").textContent=finalizados;
  $("#mEficiencia").textContent=(todos.length?finalizados/todos.length*100:0)
    .toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
  $("#mSaidas").textContent=saidas;
  $("#mVolume").textContent=ton(volume);
  $("#mSaldo").textContent=ton(saldoTotal);
}

function openDetalhe(id,changeView=true){
  const e=S.rows.find(x=>x.id===id);
  if(!e)return;

  S.id=id;

  $("#dCliente").textContent=e.cliente;
  $("#dRota").textContent=e.origem+" → "+e.destino;
  $("#dProduto").textContent=e.produto;

  const st=$("#dStatus");
  st.innerHTML=optionList(STATUS_EMBARQUE,e.status);
  st.value=e.status;
  st.className="w-full border rounded-lg text-xs font-bold uppercase "+cls(e.status);
  st.dataset.id=e.id;

  $("#dVolume").textContent=ton(e.volume);
  $("#dEmbarcado").textContent=ton(embarcado(e));
  $("#dSaldo").textContent=ton(saldo(e));

  renderVeiculos(e);

  if(changeView)show("detalhe");
}

function renderVeiculos(e){
  const tbody=$("#tbodyVeiculos");
  tbody.innerHTML="";

  if(!(e.veiculos||[]).length){
    tbody.innerHTML='<tr><td colspan="7" class="p-8 text-center text-muted">Nenhum veículo registrado neste embarque.</td></tr>';
  }

  (e.veiculos||[]).forEach(v=>{
    const tr=document.createElement("tr");
    tr.className="hover:bg-slate-50 transition-colors";

    tr.innerHTML=`
      <td class="p-4">${fmtDataHora(v.dataHora)}</td>
      <td class="p-4 font-bold">${escapeHtml(v.placa)}</td>
      <td class="p-4">${escapeHtml(v.motorista||"-")}</td>
      <td class="p-4">${escapeHtml(v.tipo||"-")}</td>
      <td class="p-4">${ton(v.peso)}</td>
      <td class="p-4">
        <select data-status-veiculo="${escapeHtml(v.id)}"
          class="status-select border rounded-lg px-3 py-2 text-xs font-bold uppercase ${cls(v.situacao)}">
          ${optionList(STATUS_VEICULO,v.situacao)}
        </select>
      </td>
      <td class="p-4 text-right whitespace-nowrap">
        <button
          data-vedit="${escapeHtml(v.id)}"
          class="material-symbols-outlined text-blue-600 hover:text-blue-800"
          title="Editar veículo">edit</button>
        <button
          data-vdel="${escapeHtml(v.id)}"
          class="material-symbols-outlined text-red-500 hover:text-red-700 ml-2"
          title="Excluir veículo">delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-status-veiculo]").forEach(select=>{
    select.onchange=()=>atualizarSituacaoVeiculo(
      select.dataset.statusVeiculo,
      select.value,
      select
    );
  });

  tbody.querySelectorAll("[data-vedit]").forEach(btn=>{
    btn.onclick=()=>openVeiculoModal(btn.dataset.vedit);
  });

  tbody.querySelectorAll("[data-vdel]").forEach(btn=>{
    btn.onclick=()=>deleteVeiculo(btn.dataset.vdel);
  });
}

async function atualizarStatusEmbarque(id,novoStatus,select){
  const embarque=S.rows.find(x=>x.id===id);
  if(!embarque)return;

  const anterior=embarque.status;
  select.disabled=true;
  sync("⏳ Atualizando status...");

  try{
    await api("update","embarques",{id,status:upper(novoStatus)});
    embarque.status=upper(novoStatus);
    await carregarDados();

    if(S.filial)renderFilial();
    if(S.id===id)openDetalhe(id,false);

    sync("✅ Status atualizado");
  }catch(err){
    console.error(err);
    select.value=anterior;
    alert("Erro ao atualizar o status do embarque.\n\n"+err.message);
    sync("⚠️ Erro ao atualizar");
  }finally{
    select.disabled=false;
  }
}

async function atualizarSituacaoVeiculo(id,novaSituacao,select){
  const embarque=S.rows.find(x=>x.id===S.id);
  const veiculo=embarque?.veiculos?.find(v=>v.id===id);
  if(!veiculo)return;

  const anterior=veiculo.situacao;
  select.disabled=true;
  sync("⏳ Atualizando veículo...");

  try{
    await api("update","veiculos",{id,situacao:upper(novaSituacao)});
    veiculo.situacao=upper(novaSituacao);
    await carregarDados();

    if(S.id)openDetalhe(S.id,false);

    sync("✅ Situação atualizada");
  }catch(err){
    console.error(err);
    select.value=anterior;
    alert("Erro ao atualizar a situação do veículo.\n\n"+err.message);
    sync("⚠️ Erro ao atualizar");
  }finally{
    select.disabled=false;
  }
}

function renderPosicao(e){
  if(!e)return;

  $("#pCliente").textContent=e.cliente||"-";
  $("#pRota").textContent=(e.origem||"-")+" → "+(e.destino||"-");
  $("#pProduto").textContent=e.produto||"-";
  $("#pStatus").textContent=e.status||"-";
  $("#pContratado").textContent=ton(e.volume);
  $("#pEmbarcado").textContent=ton(embarcado(e));
  $("#pSaldo").textContent=ton(saldo(e));
  $("#pQtdVeiculos").textContent=(e.veiculos||[]).length.toLocaleString("pt-BR");
  $("#pTotalEmbarcado").textContent=ton(embarcado(e));
  $("#pAtualizado").textContent="Atualizado em "+new Date().toLocaleString("pt-BR",{
    day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"
  });

  const tbody=$("#pVeiculos");
  tbody.innerHTML="";

  const rows=(e.veiculos||[]).slice().sort((a,b)=>{
    const da=new Date(a.dataHora||0).getTime()||0;
    const db=new Date(b.dataHora||0).getTime()||0;
    return da-db;
  });

  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="6" class="position-empty">Nenhum veículo registrado neste embarque.</td></tr>';
    return;
  }

  rows.forEach(v=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${escapeHtml(fmtDataHora(v.dataHora))}</td>
      <td><strong>${escapeHtml(v.placa||"-")}</strong></td>
      <td>${escapeHtml(v.motorista||"-")}</td>
      <td>${escapeHtml(v.tipo||"-")}</td>
      <td>${escapeHtml(ton(v.peso))}</td>
      <td><span class="position-badge ${statusSlug(v.situacao)}">${escapeHtml(v.situacao||"-")}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirPosicao(){
  const e=getEmbarqueAtual();
  if(!e){
    alert("Nenhum embarque selecionado.");
    return;
  }

  renderPosicao(e);
  $("#modalPosicao")?.classList.add("show");
}

function fecharPosicao(){
  $("#modalPosicao")?.classList.remove("show");
}

async function capturarPosicao(){
  const target=$("#positionCapture");
  if(!target)throw new Error("Área da posição não encontrada.");
  if(typeof window.html2canvas!=="function")throw new Error("Gerador de imagem indisponível.");

  return window.html2canvas(target,{
    backgroundColor:"#ffffff",
    scale:2,
    useCORS:true,
    logging:false,
    windowWidth:target.scrollWidth,
    windowHeight:target.scrollHeight
  });
}

async function baixarPosicao(){
  const e=getEmbarqueAtual();
  if(!e)return;

  const btn=$("#btnBaixarPosicao");
  const original=btn?.textContent;

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent="GERANDO...";
    }

    const canvas=await capturarPosicao();
    const a=document.createElement("a");
    a.download=`POSICAO_${filenamePart(e.cliente)}_${filenamePart(e.origem)}_${filenamePart(e.destino)}.jpg`;
    a.href=canvas.toDataURL("image/jpeg",.94);
    a.click();

    sync("✅ Posição gerada");
  }catch(err){
    console.error("[CONTROLE] posição JPG:",err);
    alert("Não foi possível gerar a imagem da posição.\n\n"+err.message);
  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent=original||"⬇ Baixar JPG";
    }
  }
}

async function copiarPosicao(){
  const btn=$("#btnCopiarPosicao");
  const original=btn?.textContent;

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent="COPIANDO...";
    }

    const canvas=await capturarPosicao();

    if(!navigator.clipboard||!window.ClipboardItem){
      throw new Error("Seu navegador não permite copiar imagens diretamente.");
    }

    const blob=await new Promise((resolve,reject)=>
      canvas.toBlob(
        b=>b?resolve(b):reject(new Error("Falha ao criar a imagem.")),
        "image/png"
      )
    );

    await navigator.clipboard.write([
      new ClipboardItem({"image/png":blob})
    ]);

    sync("✅ Imagem copiada");

    if(btn)btn.textContent="COPIADO ✓";

    setTimeout(()=>{
      if(btn)btn.textContent=original||"▣ Copiar imagem";
    },1400);
  }catch(err){
    console.error("[CONTROLE] copiar posição:",err);
    alert("Não foi possível copiar a imagem.\n\n"+err.message);
    if(btn)btn.textContent=original||"▣ Copiar imagem";
  }finally{
    if(btn)btn.disabled=false;
  }
}

function modal(id,on){
  if(S.loading&&!on)return;
  $("#"+id)?.classList.toggle("show",on);
}

function openEmbarqueModal(){
  ["eCliente","eOrigem","eLocal","eDestino","eProduto","eVolume"].forEach(id=>{
    $("#"+id).value="";
  });

  $("#eFilial").value=S.filial||"";
  $("#eStatus").value="AGENDADO";
  modal("modalEmbarque",true);
}

async function salvarEmbarque(){
  const payload={
    filial:upper($("#eFilial").value),
    cliente:upper($("#eCliente").value),
    origem:upper($("#eOrigem").value),
    localEmbarque:upper($("#eLocal").value),
    destino:upper($("#eDestino").value),
    produto:upper($("#eProduto").value),
    volumeContratado:num($("#eVolume").value),
    status:upper($("#eStatus").value)
  };

  const faltando=[];
  if(!payload.filial)faltando.push("FILIAL");
  if(!payload.cliente)faltando.push("CLIENTE");
  if(!payload.origem)faltando.push("ORIGEM");
  if(!payload.destino)faltando.push("DESTINO");
  if(!payload.volumeContratado)faltando.push("VOLUME");

  if(faltando.length){
    alert("Preencha: "+faltando.join(", "));
    return;
  }

  const btn=$("#salvarEmbarque");
  setButtonSaving(btn,true);
  setLoading(true,"⏳ Salvando embarque...");

  try{
    await api("create","embarques",payload);
    modal("modalEmbarque",false);
    S.filial=payload.filial;
    await carregarDados();
    openFilial(payload.filial);
    sync("✅ Embarque salvo");
  }catch(err){
    console.error(err);
    alert("Erro ao salvar embarque.\n\n"+err.message);
  }finally{
    setButtonSaving(btn,false);
    setLoading(false);
  }
}

async function deleteEmbarque(id){
  const e=S.rows.find(x=>x.id===id);
  if(!e||!confirm("Excluir este embarque e seus veículos?"))return;

  setLoading(true,"⏳ Excluindo embarque...");

  try{
    await api("delete","embarques",{id});
    await carregarDados();

    if(S.filial){
      renderFilial();
      show("filial");
    }

    sync("✅ Embarque excluído");
  }catch(err){
    console.error(err);
    alert("Erro ao excluir embarque.\n\n"+err.message);
  }finally{
    setLoading(false);
  }
}

/* =========================================================
   VEÍCULOS
   - Modal atende inclusão e edição
   - Botão lápis na tabela abre o veículo para alteração
   ========================================================= */

function fecharVeiculoModal(){
  S.veiculoEditId="";
  modal("modalVeiculo",false);
}

function openVeiculoModal(id=""){
  const embarque=S.rows.find(x=>x.id===S.id);
  if(!embarque)return;

  S.veiculoEditId=safe(id);

  const titulo=$("#tituloModalVeiculo");
  const btnSalvar=$("#salvarVeiculo");

  if(S.veiculoEditId){
    const veiculo=(embarque.veiculos||[]).find(v=>v.id===S.veiculoEditId);

    if(!veiculo){
      alert("Veículo não encontrado.");
      S.veiculoEditId="";
      return;
    }

    $("#vPlaca").value=veiculo.placa||"";
    $("#vMotorista").value=veiculo.motorista||"";
    $("#vTipo").value=veiculo.tipo||"";
    $("#vPeso").value=num(veiculo.peso)||"";
    $("#vSituacao").value=veiculo.situacao||"PORTA";

    if(titulo)titulo.textContent="Editar veículo";
    if(btnSalvar){
      btnSalvar.textContent="Atualizar";
      btnSalvar.dataset.originalText="Atualizar";
    }
  }else{
    ["vPlaca","vMotorista","vTipo","vPeso"].forEach(campo=>{
      $("#"+campo).value="";
    });

    $("#vSituacao").value="PORTA";

    if(titulo)titulo.textContent="Adicionar veículo";
    if(btnSalvar){
      btnSalvar.textContent="Salvar";
      btnSalvar.dataset.originalText="Salvar";
    }
  }

  modal("modalVeiculo",true);
}

async function salvarVeiculo(){
  const embarque=S.rows.find(x=>x.id===S.id);
  if(!embarque)return;

  const payload={
    idEmbarque:embarque.id,
    placa:upper($("#vPlaca").value),
    motorista:upper($("#vMotorista").value),
    tipoVeiculo:upper($("#vTipo").value),
    peso:num($("#vPeso").value),
    situacao:upper($("#vSituacao").value)
  };

  if(!payload.placa){
    alert("Informe a placa.");
    return;
  }

  const editando=!!S.veiculoEditId;
  const btn=$("#salvarVeiculo");

  setButtonSaving(
    btn,
    true,
    editando?"ATUALIZANDO...":"SALVANDO..."
  );

  setLoading(
    true,
    editando?"⏳ Atualizando veículo...":"⏳ Salvando veículo..."
  );

  try{
    if(editando){
      await api("update","veiculos",{
        id:S.veiculoEditId,
        ...payload
      });
    }else{
      await api("create","veiculos",payload);
    }

    const embarqueId=embarque.id;
    S.veiculoEditId="";
    modal("modalVeiculo",false);

    await carregarDados();
    openDetalhe(embarqueId);

    sync(editando?"✅ Veículo atualizado":"✅ Veículo salvo");
  }catch(err){
    console.error(err);
    alert(
      (editando?"Erro ao atualizar veículo.":"Erro ao salvar veículo.")+
      "\n\n"+
      err.message
    );
  }finally{
    if(btn){
      btn.dataset.originalText=editando?"Atualizar":"Salvar";
    }
    setButtonSaving(btn,false);
    setLoading(false);
  }
}

async function deleteVeiculo(id){
  const embarque=S.rows.find(x=>x.id===S.id);
  if(!embarque||!confirm("Excluir este veículo?"))return;

  setLoading(true,"⏳ Excluindo veículo...");

  try{
    await api("delete","veiculos",{id});
    await carregarDados();
    openDetalhe(embarque.id);
    sync("✅ Veículo excluído");
  }catch(err){
    console.error(err);
    alert("Erro ao excluir veículo.\n\n"+err.message);
  }finally{
    setLoading(false);
  }
}

function bind(){
  $("#btnNovoTop").onclick=openEmbarqueModal;
  $("#btnNovoFilial").onclick=openEmbarqueModal;
  $("#btnNovoVeiculo").onclick=()=>openVeiculoModal();

  $("#btnGerarPosicao").onclick=abrirPosicao;
  $("#btnFecharPosicao").onclick=fecharPosicao;
  $("#btnBaixarPosicao").onclick=baixarPosicao;
  $("#btnCopiarPosicao").onclick=copiarPosicao;

  $("#btnVoltarPainel").onclick=()=>{
    renderDashboard();
    show("dashboard");
  };

  $("#btnVoltarFilial").onclick=()=>{
    renderFilial();
    show("filial");
  };

  $("#fBusca").oninput=renderDashboard;
  $("#fFilial").onchange=renderDashboard;
  $("#buscaFilial").oninput=renderFilial;
  $("#btnAtualizar").onclick=carregarDados;

  $("#dStatus").onchange=e=>{
    const id=e.target.dataset.id||S.id;
    if(id)atualizarStatusEmbarque(id,e.target.value,e.target);
  };

  $("#fecharEmbarque").onclick=
  $("#cancelarEmbarque").onclick=
    ()=>modal("modalEmbarque",false);

  $("#salvarEmbarque").onclick=salvarEmbarque;

  $("#fecharVeiculo").onclick=
  $("#cancelarVeiculo").onclick=
    fecharVeiculoModal;

  $("#salvarVeiculo").onclick=salvarVeiculo;

  ["modalEmbarque","modalVeiculo"].forEach(id=>{
    $("#"+id).onclick=e=>{
      if(e.target.id===id){
        if(id==="modalVeiculo")fecharVeiculoModal();
        else modal(id,false);
      }
    };
  });

  $("#modalPosicao").onclick=e=>{
    if(e.target.id==="modalPosicao")fecharPosicao();
  };

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){
      modal("modalEmbarque",false);
      fecharVeiculoModal();
      fecharPosicao();
    }
  });
}

async function init(){
  bind();
  show("dashboard");
  await carregarDados();
}

window.addEventListener("DOMContentLoaded",init);
})();
