/* Subperfil Pedido Execução, configura categorias por usuário e empresa. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 const labels={
  PEDIDO:"Abertura de pedido",CORRECAO_PEDIDO:"Correção de pedido",
  CTE_COMPLEMENTAR:"CT-e complementar",CARTA_CORRECAO:"Carta de correção",
  PAGAMENTO:"Solicitação de pagamento",PAGAMENTO_GUIA:"Pagamento de GUIA"
 };
 const keys=Object.keys(labels);
 let loaded="",usuarios={},configured=false,dirty=false,saving=false,seq=0;
 const tenant=()=>selected?.id||"";
 const edit=()=>typeof canEditModules==="function"&&canEditModules();
 const status=message=>{$("pedExecStatus").textContent=message;};
 const list=$("pedExecList");
 const clear=()=>{for(const el of document.querySelectorAll("[data-ped-exec-kind]"))el.checked=false;};
 function redraw(){
  list.replaceChildren();
  const entries=Object.entries(usuarios).sort(([a],[b])=>a.localeCompare(b));
  if(!entries.length)list.append(document.createTextNode("Nenhum executor classificado."));
  for(const [user,kinds] of entries){
   const line=document.createElement("div");line.className="ped-exec-user";
   const text=document.createElement("span");text.textContent=user+" · "+kinds.map(k=>labels[k]).join(", ");
   const choose=document.createElement("button");choose.type="button";choose.textContent="Editar";choose.className="ghost";
   choose.onclick=()=>{ $("pedExecUsuario").value=user;for(const e of document.querySelectorAll("[data-ped-exec-kind]"))e.checked=kinds.includes(e.dataset.pedExecKind);};
   const remove=document.createElement("button");remove.type="button";remove.textContent="Remover";remove.className="ghost";remove.disabled=!edit();
   remove.onclick=()=>{delete usuarios[user];dirty=true;redraw();status("Alterações pendentes. Salve para aplicar.");};
   line.append(text,choose,remove);list.append(line);
  }
  $("pedExecSave").disabled=!edit()||!dirty||saving||!loaded;
  $("pedExecAssign").disabled=!edit()||!loaded||saving;
 }
 async function load(){
  const id=tenant(),serial=++seq;loaded="";usuarios={};dirty=false;configured=false;clear();
  redraw();if(!id)return;
  status("Consultando perfis de execução de "+id+"...");
  try{
   const data=await request("/v1/super-admin/transportadoras/"+encodeURIComponent(id)+"/pedidos-exec-access");
   if(serial!==seq||id!==tenant())return;
   usuarios=structuredClone(data.usuarios||{});loaded=id;configured=!!data.configured;
   redraw();
   status(configured?"Acessos por tipo ativos. Usuários não listados não podem executar chamados.":"Configuração inicial: executores existentes ainda veem os 4 tipos antigos. Salve a nova lista para ativar a restrição por usuário.");
  }catch(error){if(serial===seq)status(error.message||"Erro ao carregar.");}
 }
 $("pedExecAssign").onclick=()=>{
  if(!loaded||loaded!==tenant()||!edit())return;
  const user=$("pedExecUsuario").value.trim().toUpperCase();
  const kinds=[...document.querySelectorAll("[data-ped-exec-kind]:checked")].map(x=>x.dataset.pedExecKind);
  if(!/^[A-Z0-9._-]{2,80}$/.test(user)||!kinds.length)
   return status("Informe o usuário do login e selecione pelo menos um tipo.");
  usuarios[user]=keys.filter(k=>kinds.includes(k));$("pedExecUsuario").value=user;
  dirty=true;redraw();status("Permissões de "+user+" preparadas. Clique em Salvar perfis de execução.");
 };
 $("pedExecSave").onclick=async()=>{
  if(!dirty||saving||!edit()||loaded!==tenant())return;
  const id=tenant();saving=true;redraw();
  try{
   const data=await writeRequest("/v1/super-admin/transportadoras/"+encodeURIComponent(id)+"/pedidos-exec-access","PUT",{usuarios});
   if(id!==tenant())return;
   usuarios=structuredClone(data.usuarios);dirty=false;configured=true;redraw();
   status("Acessos gravados. A fila de cada executor mostrará somente seus tipos autorizados.");
  }catch(error){status(error.message||"Falha ao salvar.");}
  finally{saving=false;redraw();}
 };
 document.querySelector('[data-tab="profiles"]')?.addEventListener("click",()=>{
  if(loaded!==tenant())void load();
 });
 window.addEventListener("superadmin:company-changed",()=>void load());
})();
