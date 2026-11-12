(function(){
 "use strict";
 const MODULES=["cadastro-solicitacoes","execucao-cadastros"];
 window.__PORTAL_CADASTRO_MODULES_CONFIRMED={"cadastro-solicitacoes":false,"execucao-cadastros":false};
 window.__PORTAL_CADASTRO_EXECUTOR=false;
 function show(feature,yes){
  document.querySelectorAll('.nf-tools [data-feature="'+feature+'"]').forEach(card=>{
   card.hidden=!yes;
   if(yes)card.style.removeProperty("display");
   else card.style.display="none";
  });
 }
 function denyAll(){MODULES.forEach(key=>show(key,false));}
 async function boot(){
  denyAll();
  try{
   const session=window.portalAuthReady?await window.portalAuthReady:null;
   const ctx=window.__PORTAL_TENANT_SESSION?.tenantMode===true
     ? window.__PORTAL_TENANT_SESSION : session?.tenantMode===true ? session : null;
   const expected=String(window.__PORTAL_TENANT_EXPECTED||"");
   if(expected){
    if(ctx?.transportadoraId!==expected)return;
   }else if(!session||session.tenantMode===true||session.transportadoraId!=="nova-frota")return;
   const headers={Accept:"application/json"};
   if(ctx?.ownerSupport===true&&expected)headers["X-Portal-Support-Tenant"]=expected;
   const response=await fetch("https://api.portalfrete.net.br/v1/cadastro-solicitacoes/config",{
    credentials:"include",cache:"no-store",headers
   });
   if(!response.ok)return;
   const result=await response.json();
   if(result?.ok!==true||result.empresa!==(expected||"nova-frota"))return;
   const allowed=feature=>(typeof canAccessFeature==="function"&&canAccessFeature(feature))&&
     (!ctx||(Array.isArray(ctx.modules)&&ctx.modules.includes(feature)));
   const requestEnabled=result.solicitacoesHabilitadas===true&&allowed("cadastro-solicitacoes");
   const executionEnabled=result.execucaoHabilitada===true&&result.executor===true&&allowed("execucao-cadastros");
   window.__PORTAL_CADASTRO_MODULES_CONFIRMED={
    "cadastro-solicitacoes":requestEnabled,"execucao-cadastros":executionEnabled
   };
   window.__PORTAL_CADASTRO_EXECUTOR=executionEnabled;
   MODULES.forEach(key=>show(key,window.__PORTAL_CADASTRO_MODULES_CONFIRMED[key]===true));
  }catch(_){denyAll();}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
 else void boot();
})();
