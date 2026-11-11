(function(){
 "use strict";
 const KEYS=["solicitacao-pedidos","execucao-pedidos"];
 window.__PORTAL_PEDIDOS_MODULES_CONFIRMED={"solicitacao-pedidos":false,"execucao-pedidos":false};
 window.__PORTAL_PEDIDOS_EXECUTOR=false;
 function show(key,enabled){
  document.querySelectorAll('.nf-tools [data-feature="'+key+'"]').forEach(card=>{
   card.hidden=!enabled;
   card.style.display=enabled?"":"none";
  });
 }
 async function load(){
  KEYS.forEach(x=>show(x,false));
  try{
   const session=window.portalAuthReady?await window.portalAuthReady:null;
   const tenant=window.__PORTAL_TENANT_SESSION?.tenantMode===true?window.__PORTAL_TENANT_SESSION:
    session?.tenantMode===true?session:null;
   const expected=window.__PORTAL_TENANT_EXPECTED||"nova-frota";
   if(tenant&&tenant.transportadoraId!==expected)return;
   if(!tenant&&(!session||session.transportadoraId!=="nova-frota"))return;
   const headers={Accept:"application/json"};
   if(tenant?.ownerSupport===true)headers["X-Portal-Support-Tenant"]=expected;
   const response=await fetch("https://api.portalfrete.net.br/v1/abertura-pedidos/config",{
    credentials:"include",cache:"no-store",headers
   });
   if(!response.ok)return;
   const data=await response.json();
   if(data?.ok!==true||data.empresa!==expected)return;
   const enabled=key=>!tenant||(Array.isArray(tenant.modules)&&tenant.modules.includes(key));
   const requester=data.solicitacoesHabilitadas===true&&enabled("solicitacao-pedidos");
   const executor=data.execucaoHabilitada===true&&data.executor===true&&enabled("execucao-pedidos");
   window.__PORTAL_PEDIDOS_MODULES_CONFIRMED={"solicitacao-pedidos":requester,"execucao-pedidos":executor};
   window.__PORTAL_PEDIDOS_EXECUTOR=executor;
   KEYS.forEach(x=>show(x,window.__PORTAL_PEDIDOS_MODULES_CONFIRMED[x]===true));
  }catch(_){KEYS.forEach(x=>show(x,false));}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});else void load();
})();
