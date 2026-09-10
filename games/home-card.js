(() => {
 const card=document.getElementById('novaFrotaGamesCard');if(!card)return;
 function apply(session){const allowed=session?.perfil==='ADMINISTRADOR';card.hidden=!allowed;card.style.display=allowed?'':'none';}
 apply(null);
 Promise.resolve(window.portalAuthReady).then(apply).catch(()=>apply(null));
 window.addEventListener('portal:session',e=>apply(e.detail));
 window.addEventListener('storage',()=>apply(null));
})();
