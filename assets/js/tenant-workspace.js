// Shared Nova Frota Home, using this transportadora's private Sheets gateway.
// Do not replace the real modules with simplified D1 widgets.
(function(){
 "use strict";
 let currentTenant="";
 const $=id=>document.getElementById(id);
 const set=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
 function cards(){
  document.querySelectorAll(".nf-tools a.nf-tool[data-feature]").forEach(card=>{
   const allowed=typeof window.canAccessFeature==="function"&&
    window.canAccessFeature(card.dataset.feature);
   card.hidden=!allowed;
   card.style.display=allowed?"":"none";
   card.removeAttribute("aria-disabled");
   card.classList.remove("pf-pending");
   if(allowed)card.title="Abrir módulo desta transportadora";
  });
 }
 async function dashboard(session){
  const values=["homeFretesAtivos","homeFretesGO","homeFretesMT",
   "homeVeiculosGO","homeVeiculosMT","homeVeiculosGOPorta",
   "homeVeiculosGOTransito","homeVeiculosMTPorta","homeVeiculosMTTransito",
   "homeSolicStat","homeSolicOpen","homeFiliais"];
  values.forEach(id=>set(id,"—"));
  const updates=["homeFretesAtualizacao","homeVeiculosAtualizacao",
   "homeSolicAtualizacao","homeFiliaisAtualizacao"];
  updates.forEach(id=>set(id,"Consultando a planilha individual..."));
  try{
   const response=await window.PortalAPI.call("home","read",{});
   if(currentTenant!==session.transportadoraId)return;
   const data=response?.data||{};
   const fields={
    homeFretesAtivos:"fretesAtivos",homeFretesGO:"fretesGO",homeFretesMT:"fretesMT",
    homeVeiculosGO:"veiculosGO",homeVeiculosMT:"veiculosMT",
    homeVeiculosGOPorta:"goPorta",homeVeiculosGOTransito:"goTransito",
    homeVeiculosMTPorta:"mtPorta",homeVeiculosMTTransito:"mtTransito",
    homeSolicStat:"solicitacoes",homeSolicOpen:"solicitacoes",homeFiliais:"filiais"
   };
   Object.entries(fields).forEach(([id,key])=>{
    if(typeof data[key]==="number"&&Number.isFinite(data[key]))set(id,data[key]);
   });
   updates.forEach(id=>set(id,"Atualizado pela planilha da transportadora"));
   document.querySelector(".nf-footer-status")?.replaceChildren("Dados exclusivos");
  }catch(error){
   if(currentTenant!==session.transportadoraId)return;
   updates.forEach(id=>set(id,"Integração da planilha indisponível"));
   document.querySelector(".nf-footer-status")?.replaceChildren("Planilha não disponível");
  }
 }
 function render(session){
  if(session?.tenantMode!==true||!session.transportadoraId)return;
  if(window.__PORTAL_TENANT_EXPECTED &&
     session.transportadoraId!==window.__PORTAL_TENANT_EXPECTED)return;
  currentTenant=session.transportadoraId;
  document.body?.classList.add("pf-tenant-mode");
  const root=$("tenantWorkspace");
  if(root){root.replaceChildren();root.hidden=true;}
  const name=String(session.usuario||"Usuário").split(".")[0];
  set("homeUserName",name.charAt(0)+name.slice(1).toLowerCase());
  set("homeSub","Visão geral da operação | "+session.transportadoraNome+
   " | Acesso: "+session.usuario+" • "+session.perfil);
  const footer=document.querySelector(".nf-footer span:last-child");
  if(footer)footer.textContent="Portal Frete | "+session.transportadoraNome;
  document.title="Home | "+(session.transportadoraNome||"Portal Frete");
  const solicit=$("homeSolicCard");if(solicit)solicit.disabled=true;
  document.querySelector(".nf-support-link")?.setAttribute("hidden","");
  cards();
  void dashboard(session);
 }
 window.addEventListener("portal:session",event=>render(event.detail));
 if(window.portalAuthReady)Promise.resolve(window.portalAuthReady).then(render).catch(()=>{});
})();