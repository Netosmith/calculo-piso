/* Solicitações são colaborativas; o app Administrativo mantém permissão
 * separada. Somente uma sessão assinada do Worker libera a barra. */
(function(){
  "use strict";
  const wrap=document.querySelector(".nf-solic-wrap");
  const button=document.getElementById("homeSolicCard");
  const topbar=document.querySelector(".nf-topbar-inner");
  if(!wrap||!button||!topbar)return;

  function canSeeHomeSolicitations(session){
    if(!session || !String(session.usuario||"").trim() ||
       String(session.perfil||"").trim().toUpperCase()==="PISO")return false;
    // Nova Frota já usa Solicitações na Home para todos os perfis.
    if(session.tenantMode!==true)return true;
    // Para outras empresas, exclusivamente os módulos da sessão assinada.
    return Boolean(session.transportadoraId &&
      Array.isArray(session.modules) && session.modules.includes("administrativo"));
  }

  function apply(session){
    const allowed=canSeeHomeSolicitations(session);
    wrap.hidden=!allowed;
    topbar.classList.toggle("has-admin-solicitations",allowed);
    // O formulário envia solicitações pela integração privada de cada empresa.
    // A abertura do aplicativo Administrativo continua restrita a GOADM/ADMINISTRADOR.
    button.disabled=!allowed;
  }

  window.addEventListener("portal:session",event=>apply(event.detail));
  (async()=>{
    let session=null;
    try{session=window.portalAuthReady?await window.portalAuthReady:null;}catch{}
    apply(session);
  })();
})();
