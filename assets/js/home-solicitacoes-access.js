/* O botão de Solicitações acompanha o card Administrativo e o perfil
 * confirmado pelo Worker. O cache local nunca é usado para autorizar. */
(function(){
  "use strict";
  const wrap=document.querySelector(".nf-solic-wrap");
  const button=document.getElementById("homeSolicCard");
  const topbar=document.querySelector(".nf-topbar-inner");
  if(!wrap||!button||!topbar)return;

  function canSeeHomeSolicitations(session){
    const role=String(session?.perfil||"").trim().toUpperCase();
    if(!session || !["GOADM","ADMINISTRADOR"].includes(role))return false;
    if(session.tenantMode===true){
      if(!Array.isArray(session.modules) || !session.modules.includes("administrativo"))return false;
    }
    return typeof canAccessFeature==="function" &&
      canAccessFeature("administrativo")===true;
  }

  function apply(session){
    const allowed=canSeeHomeSolicitations(session);
    wrap.hidden=!allowed;
    topbar.classList.toggle("has-admin-solicitations",allowed);
    // As novas transportadoras ainda usam o fluxo administrativo próprio;
    // a Home não deve habilitar o formulário legado dessas empresas.
    button.disabled=!allowed||session?.tenantMode===true;
  }

  window.addEventListener("portal:session",event=>apply(event.detail));
  (async()=>{
    let session=null;
    try{session=window.portalAuthReady?await window.portalAuthReady:null;}catch{}
    apply(session);
  })();
})();
