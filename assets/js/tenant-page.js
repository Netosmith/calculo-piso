/*
 * Tenant-scoped HTML loader for a static GitHub Pages deployment.
 * The browser URL stays /pages/<private-slug>/<module>.html, while the
 * markup, scripts and styles come from the ONE shared /pages/<module>.html.
 *
 * URL names are presentation only. Authorization and sheet routing are
 * determined by the signed Worker session and its private R2 settings.
 */
(function(){
 "use strict";
 const script=document.currentScript;
 const tenant=script?.dataset.tenantId||"";
 const page=script?.dataset.sharedPage||"";
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
 function refuse(){location.replace(login||"/pages/login.html");}
 async function load(){
  if(!tenant||!slug||page!==file||!allowed.has(page)){refuse();return;}
  try{
   const sessionResponse=await fetch("https://api.portalfrete.net.br/v1/session",{
    credentials:"include",cache:"no-store",headers:{"Accept":"application/json"}
   });
   const data=await sessionResponse.json();
   const session=data?.session;
   if(!sessionResponse.ok||data?.ok!==true||session?.tenantMode!==true||
     session.transportadoraId!==tenant){refuse();return;}
   const htmlResponse=await fetch("/pages/"+page,{cache:"no-store",credentials:"same-origin"});
   if(!htmlResponse.ok)throw new Error("Modulo compartilhado indisponivel.");
   const html=await htmlResponse.text();
   if(!/^\s*<!doctype html>/i.test(html)||!/<head(?:\s|>)/i.test(html))
     throw new Error("HTML compartilhado invalido.");
   // Set only after the API verified the signed session. Never derive tenant
   // identity, sheet IDs or credentials from a query parameter.
   window.__PORTAL_TENANT_EXPECTED=tenant;
   window.__PORTAL_TENANT_ROUTE_PREFIX="/pages/"+slug+"/";
   window.__PORTAL_TENANT_SESSION=session;
   try{sessionStorage.setItem("pf:tenant-login-path",login);}catch(_){}
   const header='<head><base href="/pages/">'+
    '<script src="/assets/js/tenant-route.js?v=1"></script>';
   // Version the shared tenant assets independently from Nova Frota's
   // normal cache while keeping identical source HTML and CSS/JS files.
   const refreshed=html.replace(/(\.\.\/assets\/(?:js|css)\/[^"'?]+\?v=)\d+/g,
    "$1tenant-20261103");
   const shared=refreshed.replace(/<head(?:\s[^>]*)?>/i,header);
   document.open();
   document.write(shared);
   document.close();
  }catch(error){
   document.body.textContent="Nao foi possivel carregar esta pagina da transportadora.";
   const anchor=document.createElement("a");
   anchor.href=login;anchor.textContent="Voltar ao login";
   document.body.appendChild(document.createElement("p")).appendChild(anchor);
  }
 }
 void load();
})();