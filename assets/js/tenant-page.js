/*
 * One shared source of truth: /pages/<module>.html.
 * Private transportadora URLs render that source in place. Browser URL is only
 * presentation; Worker session and R2 configuration select the data source.
 *
 * Do NOT use document.open/write/close after asynchronous fetches. They can
 * destroy the live parser / script context in mobile browsers.
 */
(function(){
 "use strict";
 const script=document.currentScript;
 const tenant=String(script?.dataset.tenantId||"");
 const page=String(script?.dataset.sharedPage||"");
 const match=location.pathname.match(/^\/pages\/([a-z][a-z0-9-]{2,63})\/([a-z][a-z0-9-]*\.html)$/);
 const slug=match?.[1]||"";
 const file=match?.[2]||"";
 const login="/pages/"+slug+"/login.html";
 const allowed=new Set([
  "home.html","fretes.html","fretes2.html","bi.html","divulgacao.html",
  "share-clientes.html","controle.html","administrativo.html","cadastros.html",
  "estadias.html","fretes-mercado.html","embarques.html","chamados.html",
  "patrimonio-br.html","relatorio.html","custo-filial.html",
  "custo-frota-pesada.html","monitoramento.html","calculo-piso.html",
  "calculo-antt.html","calculo-antt2.html","ordem.html"
 ]);
 let stage="inicio";
 function refuse(){location.replace(login);}
 function showFailure(){
  document.documentElement.removeAttribute("data-pf-tenant-boot");
  const body=document.body||document.documentElement;
  body.replaceChildren();
  const main=document.createElement("main");
  main.style.cssText="max-width:600px;margin:12vh auto;padding:24px;font-family:system-ui,Arial,sans-serif;color:#1b3754;text-align:center";
  const h=document.createElement("h1");
  h.textContent="Não foi possível abrir o aplicativo";
  h.style.cssText="font-size:23px;line-height:1.3";
  const p=document.createElement("p");
  p.textContent="Falha no carregamento da página compartilhada ("+stage+").";
  const btn=document.createElement("button");
  btn.textContent="Tentar novamente";
  btn.style.cssText="border:0;border-radius:8px;padding:12px 18px;background:#1c65a7;color:white;font:inherit;cursor:pointer";
  btn.addEventListener("click",()=>location.reload());
  const link=document.createElement("a");
  link.href=login;link.textContent="Voltar ao login";
  link.style.cssText="display:block;margin:20px auto";
  main.append(h,p,btn,link);
  body.appendChild(main);
 }
 async function get(url,options){
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
   try{
    const response=await fetch(url,{...options,cache:"no-store"});
    if(response.status>=500 && attempt===0)continue;
    return response;
   }catch(error){
    lastError=error;
   }
  }
  throw lastError||new Error("Recurso temporariamente indisponível.");
 }
 async function renderShared(html){
  const parsed=new DOMParser().parseFromString(html,"text/html");
  if(!parsed.head||!parsed.body||!parsed.querySelector("title"))
   throw new Error("Documento compartilhado inválido.");
  const base=parsed.createElement("base");
  base.href="/pages/";
  parsed.head.prepend(base);
  // Hide legacy Home defaults until signed session + tenant customization
  // finish. This also prevents flashes of Nova Frota logos, names and cards.
  const bootStyle=parsed.createElement("style");
  bootStyle.id="pfTenantBootStyle";
  bootStyle.textContent='html[data-pf-tenant-boot="1"] body{visibility:hidden!important}';
  parsed.head.insertBefore(bootStyle,base.nextSibling);
  const route=parsed.createElement("script");
  route.src="/assets/js/tenant-route.js?v=3";
  parsed.head.insertBefore(route,base.nextSibling);
  // Controle uses Tailwind utilities. The Play CDN may fail when injected
  // after DOMContentLoaded on tenant pages; use precompiled same-origin CSS.
  // The legacy Nova Frota HTML still uses its original loading mechanism.
  if(page==="controle.html"){
   parsed.querySelectorAll('script[src*="cdn.tailwindcss.com"]').forEach(node=>node.remove());
   parsed.querySelectorAll("script:not([src])").forEach(node=>{
    if(/\btailwind\.config\s*=/.test(node.textContent||""))node.remove();
   });
   const css=parsed.createElement("link");
   css.id="pfTenantControleCss";
   css.rel="stylesheet";
   css.href="/assets/css/controle-tailwind.generated.css?v=1";
   parsed.head.append(css);
  }
  // The HTML & assets remain shared; the cache key is only for this tenant
  // shell so updates do not mix with a previous app session.
  parsed.querySelectorAll('script[src],link[rel="stylesheet"][href]').forEach(node=>{
   const attr=node.hasAttribute("src")?"src":"href";
   const raw=node.getAttribute(attr)||"";
   if(/^(\.\.\/assets\/(?:js|css)\/[^"'?]+\?v=)\d+$/.test(raw)){
    node.setAttribute(attr,raw.replace(/\?v=\d+$/,"?v=tenant-20261103-brand-v3"));
   }
  });
  // Unlike document.write in a completed document, this does not tear down
  // the browsing context. HTML-inserted scripts are inert, so explicitly
  // re-create them in document order.
  document.documentElement.setAttribute("data-pf-tenant-boot","1");
  document.documentElement.innerHTML=parsed.documentElement.innerHTML;
  document.documentElement.lang=parsed.documentElement.lang||"pt-BR";
  const controlStylesheet=document.querySelector("#pfTenantControleCss");
  const cssReady=!controlStylesheet ? Promise.resolve() : new Promise((resolve,reject)=>{
   if(controlStylesheet.sheet){resolve();return;}
   controlStylesheet.addEventListener("load",resolve,{once:true});
   controlStylesheet.addEventListener("error",()=>reject(new Error("CSS local do Controle indisponível.")),{once:true});
  });
  const scripts=Array.from(document.querySelectorAll("script"));
  for(const original of scripts){
   const cloned=document.createElement("script");
   for(const attr of original.attributes){
    if(!["async","defer","src"].includes(attr.name))
     cloned.setAttribute(attr.name,attr.value);
   }
   const source=original.getAttribute("src");
   if(!source){
    cloned.textContent=original.textContent||"";
    original.replaceWith(cloned);
    continue;
   }
   cloned.async=false; // Ensure auth.js runs before dependent page modules.
   const loaded=new Promise((resolve,reject)=>{
    cloned.onload=resolve;
    cloned.onerror=()=>reject(new Error("Não foi possível carregar "+new URL(source,document.baseURI).pathname));
   });
   cloned.setAttribute("src",source);
   original.replaceWith(cloned);
   try{await loaded;}catch(error){
    // Missing optional remote libraries should not erase an otherwise
    // valid module. Essential local scripts must still load successfully.
    if(new URL(source,document.baseURI).origin===location.origin)throw error;
    console.warn("[TENANT PAGE] optional library unavailable",error?.name);
   }
  }
  await cssReady;
  // The shell's real DOMContentLoaded already fired before the async fetch.
  // Replay it once for the existing shared module's setup listeners.
  document.dispatchEvent(new Event("DOMContentLoaded",{bubbles:true}));
  window.dispatchEvent(new Event("load"));
  // Render tenant branding and permissions before showing the Home.
  if(window.portalAuthReady){
   try{await window.portalAuthReady;}catch(error){
    throw new Error("Não foi possível validar a sessão do aplicativo.");
   }
  }
  await Promise.resolve();
  document.documentElement.removeAttribute("data-pf-tenant-boot");
 }
 async function load(){
  if(!tenant||!slug||page!==file||!allowed.has(page)){refuse();return;}
  try{
   stage="sessão";
   const sessionResponse=await get("https://api.portalfrete.net.br/v1/session",{
    credentials:"include",headers:{"Accept":"application/json"}
   });
   if(sessionResponse.status===401||sessionResponse.status===403){refuse();return;}
   if(!sessionResponse.ok)throw new Error("Sessão indisponível.");
   const sessionData=await sessionResponse.json();
   const session=sessionData?.session;
   if(sessionData?.ok!==true||session?.tenantMode!==true||
      session.transportadoraId!==tenant){refuse();return;}
   stage="HTML compartilhado";
   const htmlResponse=await get("/pages/"+page,{credentials:"same-origin"});
   if(!htmlResponse.ok)throw new Error("Página compartilhada retornou HTTP "+htmlResponse.status);
   const html=await htmlResponse.text();
   // Several original modules start with an HTML comment before <!doctype>.
   // Do not reject valid shared pages because their doctype is not byte zero.
   if(!/<html(?:\s|>)/i.test(html)||!/<head(?:\s|>)/i.test(html))
    throw new Error("Conteúdo da página compartilhada inválido.");
   window.__PORTAL_TENANT_EXPECTED=tenant;
   window.__PORTAL_TENANT_ROUTE_PREFIX="/pages/"+slug+"/";
   window.__PORTAL_TENANT_SESSION=session;
   try{sessionStorage.setItem("pf:tenant-login-path",login);}catch(_){}
   stage="scripts do aplicativo";
   await renderShared(html);
  }catch(error){
   console.error("[TENANT PAGE] error stage="+stage,{
    name:error?.name||"Error",message:String(error?.message||"").slice(0,180)
   });
   showFailure();
  }
 }
 void load();
})();