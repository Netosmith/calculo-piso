/*
 * Presentation-only tenant routing. NEVER selects data or authorizes a user.
 * The Worker derives all database access from its signed tenant session.
 */
(function(){
 "use strict";
 const prefix=String(window.__PORTAL_TENANT_ROUTE_PREFIX||"");
 const tenant=String(window.__PORTAL_TENANT_EXPECTED||"");
 if(!/^\/pages\/[a-z][a-z0-9-]{2,63}\/$/.test(prefix)||!tenant)return;
 const modules=new Set([
  "home.html","fretes.html","fretes2.html","bi.html","divulgacao.html",
  "share-clientes.html","controle.html","administrativo.html","cadastros.html",
  "estadias.html","fretes-mercado.html","embarques.html","chamados.html",
  "patrimonio-br.html","relatorio.html","custo-filial.html",
  "custo-frota-pesada.html","monitoramento.html","calculo-piso.html",
  "calculo-antt.html","calculo-antt2.html","ordem.html"
 ]);
 const ownLogin=prefix+"login.html";
 function route(urlText){
  if(typeof urlText!=="string"||!urlText)return null;
  if(/^(?:javascript:|data:|mailto:|tel:|#)/i.test(urlText.trim()))return null;
  let url;
  try{url=new URL(urlText,document.baseURI);}catch(_){return null;}
  if(url.origin!==location.origin)return null;
  const tenantPath=prefix.slice(0,-1);
  if(url.pathname.startsWith(tenantPath+"/"))return null;
  const match=url.pathname.match(/^\/pages\/([a-z][a-z0-9-]*\.html)$/);
  if(!match)return null;
  if(match[1]==="login.html")return ownLogin;
  if(!modules.has(match[1]))return null;
  return prefix+match[1]+url.search+url.hash;
 }
 window.portalTenantHref=function(file){
  return modules.has(String(file))?prefix+file:null;
 };
 function fixLink(link){
  if(!link||!link.getAttribute)return;
  const value=link.getAttribute("href");
  const mapped=route(value);
  if(mapped&&link.getAttribute("href")!==mapped)link.setAttribute("href",mapped);
 }
 function fixSubtree(root){
  if(root?.matches?.("a[href]"))fixLink(root);
  root?.querySelectorAll?.("a[href]")?.forEach(fixLink);
 }
 // Capture before app-specific click handlers; preserve modifier keys, targets
 // and event listeners, changing the URL only if it is one of our shared pages.
 document.addEventListener("click",event=>{
  const link=event.target?.closest?.("a[href]");
  if(link)fixLink(link);
 },true);
 function ready(){
  fixSubtree(document);
  if(typeof MutationObserver==="function"){
   const observer=new MutationObserver(mutations=>{
    for(const change of mutations){
     if(change.type==="attributes"){fixLink(change.target);continue;}
     for(const node of change.addedNodes||[]){
      if(node.nodeType===1)fixSubtree(node);
     }
    }
   });
   observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["href"]});
  }
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready,{once:true});
 else ready();
})();