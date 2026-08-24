/* chamados.js | NOVA FROTA */
(function(){
"use strict";

const $ = id => document.getElementById(id);
const up = v => String(v ?? "").trim().toUpperCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"");

let chamados = [];
let atual = null;
let admin = false;
let searchTimer = null;

function esc(v){
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function authContext(){
  return typeof getAuthContext === "function"
    ? getAuthContext()
    : {usuario:"",nome:"",perfil:"",estado:""};
}

function loading(show,text="Processando..."){
  $("loading")?.classList.toggle("show",!!show);
  if($("loadingText")) $("loadingText").textContent=text;
}

function slug(v){
  return up(v).toLowerCase().replace(/\s+/g,"-");
}

function fmtDate(v){
  if(!v) return "-";

  if(typeof v === "number"){
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "-"
      : d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
  }

  const d = new Date(v);
  if(!Number.isNaN(d.getTime())){
    return d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
  }

  return String(v);
}

async function portalCall(action,params={}){
  const session = window.portalAuthReady ? await window.portalAuthReady : null;
  if(!session) throw new Error("Sessão inválida ou expirada.");
  if(!window.PortalAPI) throw new Error("API segura do Portal indisponível.");
  return window.PortalAPI.call("chamados",action,params);
}

async function fileToPayload(file){
  if(!file) return null;
  if(file.size > 5 * 1024 * 1024){
    throw new Error("O anexo excede 5 MB.");
  }

  const base64 = await new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      resolve(raw.includes(",") ? raw.split(",").pop() : raw);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });

  return {
    fileName:file.name,
    mimeType:file.type || "application/octet-stream",
    base64Data:base64
  };
}

function renderUser(){
  const a = authContext();
  admin = up(a.perfil) === "ADMINISTRADOR";
  document.body.classList.toggle("is-admin",admin);

  if($("userName")) $("userName").textContent = up(a.nome || a.usuario || "USUÁRIO");
  if($("userRole")) $("userRole").textContent = up(a.perfil || "PERFIL");
  if($("listTitle")) $("listTitle").textContent = admin ? "Todos os chamados" : "Meus chamados";
}

async function loadResumo(){
  const res = await portalCall("read",{resource:"resumo"});
  const r = res?.data || {};

  $("kpiAbertos").textContent = Number(r.abertos || 0);
  $("kpiAtendimento").textContent = Number(r.emAtendimento || 0);
  $("kpiAguardando").textContent = Number(r.aguardandoUsuario || 0);
  $("kpiResolvidos").textContent = Number(r.resolvidos || 0);
  $("kpiUrgentes").textContent = Number(r.urgentes || 0);
}

async function loadChamados(){
  const params = {
    busca:$("fBusca")?.value || "",
    status:$("fStatus")?.value || "",
    prioridade:$("fPrioridade")?.value || ""
  };

  const res = await portalCall("read",params);
  chamados = Array.isArray(res?.data) ? res.data : [];
  renderLista();

  if(atual){
    const atualizado = chamados.find(x => String(x.id) === String(atual.id));
    if(atualizado){
      atual = atualizado;
      renderDetalheCabecalho();
    }
  }
}

async function refreshAll(){
  loading(true,"Atualizando chamados...");
  try{
    await Promise.all([loadResumo(),loadChamados()]);
  }catch(error){
    console.error("[CHAMADOS] carregar:",error);
    alert("Não foi possível carregar os chamados.\n\n"+error.message);
  }finally{
    loading(false);
  }
}

function renderLista(){
  const list = $("ticketList");
  if(!list) return;

  if(!chamados.length){
    list.innerHTML = '<div class="empty">Nenhum chamado encontrado.</div>';
    return;
  }

  list.innerHTML = chamados.map(item => `
    <button class="ticket ${atual && String(atual.id)===String(item.id) ? "active" : ""}" data-id="${esc(item.id)}" type="button">
      <div class="ticket-top">
        <span class="ticket-number">${esc(item.numeroChamado || "-")}</span>
        <span class="badge status-${slug(item.status)}">${esc(item.status || "-")}</span>
      </div>
      <div class="ticket-title">${esc(item.titulo || "Sem título")}</div>
      <div class="ticket-meta">
        <span>${esc(item.solicitanteNome || item.solicitanteUsuario || "-")}</span>
        <span>${esc(fmtDate(item.updatedAt || item.createdAt))}</span>
      </div>
    </button>
  `).join("");

  list.querySelectorAll(".ticket").forEach(btn=>{
    btn.onclick = () => abrirChamado(btn.dataset.id);
  });
}

function renderDetalheCabecalho(){
  if(!atual) return;

  $("detailEmpty").hidden = true;
  $("detailContent").hidden = false;

  $("dNumero").textContent = atual.numeroChamado || "-";
  $("dTitulo").textContent = atual.titulo || "-";
  $("dSolicitante").textContent = atual.solicitanteNome || atual.solicitanteUsuario || "-";
  $("dCategoria").textContent = atual.categoria || "-";
  $("dModulo").textContent = atual.modulo || "-";
  $("dResponsavel").textContent = atual.responsavel || "NÃO ATRIBUÍDO";

  const prio = $("dPrioridade");
  prio.className = `badge prio-${slug(atual.prioridade)}`;
  prio.textContent = atual.prioridade || "NORMAL";

  const status = $("dStatus");
  status.className = `badge status-${slug(atual.status)}`;
  status.textContent = atual.status || "ABERTO";

  if(admin){
    $("dEditStatus").value = atual.status || "ABERTO";
    $("dEditPrioridade").value = atual.prioridade || "NORMAL";
    $("dEditResponsavel").value = atual.responsavel || "";
  }

  renderLista();
}

async function abrirChamado(id){
  const item = chamados.find(x => String(x.id) === String(id));
  if(!item) return;

  atual = item;
  renderDetalheCabecalho();

  loading(true,"Carregando histórico...");
  try{
    const res = await portalCall("read",{resource:"mensagens",id:id});
    renderConversa(res?.data || {});
  }catch(error){
    console.error("[CHAMADOS] histórico:",error);
    alert("Não foi possível carregar o histórico.\n\n"+error.message);
  }finally{
    loading(false);
  }
}

function renderConversa(data){
  const mensagens = Array.isArray(data.mensagens) ? data.mensagens : [];
  const anexos = Array.isArray(data.anexos) ? data.anexos : [];
  const a = authContext();

  $("conversation").innerHTML = mensagens.length
    ? mensagens.map(m=>{
        const mine = up(m.autorUsuario) === up(a.usuario);
        const isAdm = up(m.perfil) === "ADMINISTRADOR";
        return `
          <div class="message ${mine ? "mine" : ""} ${isAdm ? "admin" : ""}">
            <div class="message-head">
              <span><strong>${esc(m.autorNome || m.autorUsuario || "USUÁRIO")}</strong> · ${esc(m.perfil || "")}</span>
              <span>${esc(m.dataHora || fmtDate(m.createdAt))}</span>
            </div>
            <div class="message-text">${esc(m.mensagem || "")}</div>
          </div>
        `;
      }).join("")
    : '<div class="empty">Nenhuma mensagem registrada.</div>';

  $("attachments").innerHTML = anexos.map(anexo=>`
    <a class="attachment" href="${esc(anexo.arquivoUrl)}" target="_blank" rel="noopener">
      📎 ${esc(anexo.nomeArquivo || "Anexo")}
    </a>
  `).join("");

  const conv = $("conversation");
  if(conv) conv.scrollTop = conv.scrollHeight;
}

function openNew(){
  $("modalNovo").classList.add("show");
  $("nTitulo").focus();
}

function closeNew(){
  $("modalNovo").classList.remove("show");
}

function clearNew(){
  $("nTitulo").value = "";
  $("nCategoria").value = "ERRO NO SISTEMA";
  $("nPrioridade").value = "NORMAL";
  $("nModulo").value = "";
  $("nFilial").value = "";
  $("nDescricao").value = "";
  $("nAnexo").value = "";
}

async function salvarNovo(){
  const titulo = $("nTitulo").value.trim();
  const descricao = $("nDescricao").value.trim();

  if(!titulo || !descricao){
    alert("Informe o título e a descrição do chamado.");
    return;
  }

  loading(true,"Abrindo chamado...");
  try{
    const file = $("nAnexo").files?.[0];
    const filePayload = file ? await fileToPayload(file) : null;

    const payload = {
      titulo,
      categoria:$("nCategoria").value,
      prioridade:$("nPrioridade").value,
      modulo:$("nModulo").value || "PORTAL",
      filial:$("nFilial").value || "",
      descricao,
      pagina:window.location.href,
      ...(filePayload || {})
    };

    const res = await portalCall("create",payload);
    const criado = res?.data;

    closeNew();
    clearNew();
    await refreshAll();

    if(criado?.id){
      await abrirChamado(criado.id);
    }

    alert(`Chamado ${criado?.numeroChamado || ""} aberto com sucesso.`);
  }catch(error){
    console.error("[CHAMADOS] abrir:",error);
    alert("Não foi possível abrir o chamado.\n\n"+error.message);
  }finally{
    loading(false);
  }
}

async function enviarResposta(){
  if(!atual){
    alert("Selecione um chamado.");
    return;
  }

  const texto = $("replyText").value.trim();
  const file = $("replyFile").files?.[0];

  if(!texto && !file){
    alert("Digite uma mensagem ou selecione um anexo.");
    return;
  }

  loading(true,"Enviando resposta...");
  try{
    if(texto){
      await portalCall("create",{
        resource:"mensagens",
        id:atual.id,
        mensagem:texto,
        tipo:"MENSAGEM"
      });
    }

    if(file){
      const fp = await fileToPayload(file);
      await portalCall("update",{
        resource:"anexo",
        id:atual.id,
        ...fp
      });
    }

    $("replyText").value = "";
    $("replyFile").value = "";
    $("replyFileName").textContent = "Nenhum arquivo";

    await loadChamados();
    await abrirChamado(atual.id);
    await loadResumo();
  }catch(error){
    console.error("[CHAMADOS] resposta:",error);
    alert("Não foi possível enviar a resposta.\n\n"+error.message);
  }finally{
    loading(false);
  }
}

async function salvarGestao(){
  if(!admin || !atual) return;

  loading(true,"Atualizando chamado...");
  try{
    await portalCall("update",{
      id:atual.id,
      status:$("dEditStatus").value,
      prioridade:$("dEditPrioridade").value,
      responsavel:$("dEditResponsavel").value.trim()
    });

    await refreshAll();
    await abrirChamado(atual.id);
  }catch(error){
    console.error("[CHAMADOS] gestão:",error);
    alert("Não foi possível atualizar o chamado.\n\n"+error.message);
  }finally{
    loading(false);
  }
}

function bind(){
  renderUser();

  $("btnNovoChamado").onclick = openNew;
  $("btnFecharNovo").onclick = closeNew;
  $("btnCancelarNovo").onclick = closeNew;
  $("btnSalvarNovo").onclick = salvarNovo;
  $("btnAtualizar").onclick = refreshAll;
  $("btnEnviarResposta").onclick = enviarResposta;
  $("btnSalvarGestao").onclick = salvarGestao;

  $("btnReplyFile").onclick = () => $("replyFile").click();
  $("replyFile").onchange = () => {
    $("replyFileName").textContent = $("replyFile").files?.[0]?.name || "Nenhum arquivo";
  };

  $("modalNovo").onclick = e => {
    if(e.target === $("modalNovo")) closeNew();
  };

  document.addEventListener("keydown",e=>{
    if(e.key === "Escape") closeNew();
  });

  $("fStatus").onchange = loadChamados;
  $("fPrioridade").onchange = loadChamados;
  $("fBusca").oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadChamados,280);
  };
}

window.addEventListener("DOMContentLoaded",async()=>{
  bind();
  await refreshAll();
});

})();
