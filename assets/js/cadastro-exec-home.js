(function(){
 "use strict";
 async function boot(){
  try{
   if(window.portalAuthReady)await window.portalAuthReady;
   const card=document.querySelector('[data-feature="execucao-cadastros"]');
   if(!card)return;
   const headers={Accept:"application/json"};
   if(window.__PORTAL_TENANT_SESSION?.ownerSupport===true && window.__PORTAL_TENANT_EXPECTED)
     headers["X-Portal-Support-Tenant"]=window.__PORTAL_TENANT_EXPECTED;
   const response=await fetch("https://api.portalfrete.net.br/v1/cadastro-solicitacoes/config",
    {credentials:"include",cache:"no-store",headers});
   if(!response.ok)return;
   const data=await response.json();
   if(data.ok===true && data.execucaoHabilitada===true && data.executor===true){
    window.__PORTAL_CADASTRO_EXECUTOR=true;
    card.hidden=false;card.style.removeProperty("display");
   }else{
    card.hidden=true;card.style.display="none";
   }
  }catch(_error){/* Acesso não confirmado: manter o card oculto. */}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
 else void boot();
})();