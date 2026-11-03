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
  if(file==="login.html")return ownLogin;
  return modules.has(String(file))?prefix+file:null;
 };
 const companyName=String(window.__PORTAL_TENANT_SESSION?.transportadoraNome||"Portal Frete");
 const brandedImages=new Set();
 let tenantLogoUrl=null;
 function brandImage(img){
  if(!img||brandedImages.has(img))return;
  const src=String(img.getAttribute("src")||"").toLowerCase();
  if(!src.includes("logo-novafrota"))return;
  brandedImages.add(img);
  img.alt=companyName;
  let label=document.createElement("strong");
  label.textContent=companyName;
  label.className="pf-company-name";
  label.style.cssText="display:inline-block;font-weight:900;font-size:14px;max-width:270px;color:inherit";
  img.insertAdjacentElement("afterend",label);
  img.hidden=true;img.style.display="none";
  if(tenantLogoUrl){
   img.src=tenantLogoUrl;img.hidden=false;img.style.removeProperty("display");
   label.hidden=true;
  }
 }
 function brandSubtree(root){
  if(root?.matches?.("img"))brandImage(root);
  root?.querySelectorAll?.("img")?.forEach(brandImage);
 }
 async function loadBrand(){
  try{
   const r=await fetch("https://api.portalfrete.net.br/v1/tenant/logo",{
    credentials:"include",cache:"no-store"
   });
   if(!r.ok)return;
   const file=await r.blob();
   if(!["image/png","image/jpeg","image/webp"].includes(file.type))return;
   tenantLogoUrl=URL.createObjectURL(file);
   for(const img of brandedImages){
    if(!img.isConnected)continue;
    img.src=tenantLogoUrl;img.hidden=false;
    img.style.removeProperty("display");
    if(img.nextElementSibling?.classList.contains("pf-company-name"))
     img.nextElementSibling.hidden=true;
   }
  }catch(_){}
 }
 function fixLink(link){
  if(!link||!link.getAttribute)return;
  const value=link.getAttribute("href");
  const mapped=route(value);
  if(mapped&&link.getAttribute("href")!==mapped)link.setAttribute("href",mapped);
 }
 function fixSubtree(root){
  if(root?.matches?.("a[href]"))fixLink(root);
  root?.querySelectorAll?.("a[href]")?.forEach(fixLink);
  brandSubtree(root);
 }
 // Capture before app-specific click handlers; preserve modifier keys, targets
 // and event listeners, changing the URL only if it is one of our shared pages.
 document.addEventListener("click",event=>{
  const link=event.target?.closest?.("a[href]");
  if(link)fixLink(link);
 },true);
 function ready(){
  fixSubtree(document);
  void loadBrand();
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