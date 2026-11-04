/* Global artwork image shared with Divulgação and Fretes.
 * Preview URLs are canonical and never depend on the transportadora alias,
 * location.pathname, document.baseURI or the Super Admin theme.
 */
(function(){
  "use strict";
  const HERO="/assets/img/divulgacao/hero-global.jpg?v=2";
  const SELECTORS=".m3HeroImg,.nfM3HeroImg,.nfM4HeroImg,.multiArtHeroImg";
  let override="";
  function setSource(url){
    override=typeof url==="string"&&url.startsWith("blob:")?url:"";
    sync();
  }

  function sync(root=document){
    const found=[];
    if(root?.matches?.(SELECTORS))found.push(root);
    root?.querySelectorAll?.(SELECTORS)?.forEach(img=>found.push(img));
    for(const img of found){
      // Assign the absolute URL before loading; no false retry loop.
      const source=override||HERO;
      if(img.getAttribute("src")!==source)img.setAttribute("src",source);
    }
    return found;
  }
  function wait(img){
    if(img.complete)return Promise.resolve(img.naturalWidth>0);
    return new Promise(resolve=>{
      let finished=false;
      let timeout;
      const done=()=>{
        if(finished)return;
        finished=true;clearTimeout(timeout);
        img.removeEventListener("load",done);
        img.removeEventListener("error",done);
        resolve(img.naturalWidth>0);
      };
      img.addEventListener("load",done);
      img.addEventListener("error",done);
      timeout=setTimeout(done,8000);
      if(img.complete)done();
    });
  }
  async function ready(root=document){
    // Wait for tenant-specific art background before exporting JPG.
    if(window.portalTenantVisualReady)
      try{await window.portalTenantVisualReady;}catch{}
    const images=sync(root);
    if(!images.length)return true;
    const status=await Promise.all(images.map(wait));
    return status.every(Boolean);
  }
  window.PortalArtHero=Object.freeze({src:HERO,sync,ready,setSource});
  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",()=>sync(),{once:true});
  else sync();
})();
