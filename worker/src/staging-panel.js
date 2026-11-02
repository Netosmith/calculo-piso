import {stagingPage} from "./staging-page.js";

// Dedicated Cloudflare Access UI for this isolated staging Worker.
// It never asks the owner to paste an OIDC token into the browser.
function required(html,from,to){
  if(!html.includes(from))throw new Error("Staging UI out of sync: "+from.slice(0,70));
  return html.replace(from,to);
}
export function stagingPanelHtml(){
  let html=stagingPage;
  html=required(html,"const API_BASE = 'https://api.portalfrete.net.br';","const API_BASE = '';");
  html=required(html,"location.assign('home.html')","location.assign('https://portalfrete.net.br/pages/home.html')");
  html=required(html,'const canEdit=()=>Boolean(writeReady&&mfaActive&&selected&&selected.id!=="nova-frota");','const canEdit=()=>Boolean(writeReady&&selected&&selected.id!=="nova-frota");');
  html=required(html,"const canEditMembership=()=>Boolean(canEdit()&&membershipReady&&mfaMembershipActive);","const canEditMembership=()=>Boolean(canEdit()&&membershipReady);");
  html=required(html,"const canEditBrand=()=>Boolean(canEdit()&&brandReady&&mfaBrandActive);","const canEditBrand=()=>Boolean(canEdit()&&brandReady);");
  html=required(html,"$('newCompany').disabled=!(writeReady&&mfaActive);","$('newCompany').disabled=!writeReady;");
  html=required(html,"$('adminAuth').hidden=!writeReady;","$('adminAuth').hidden=true;");
  html=required(html,"writeReady?'requer validação MFA':'não configurada'","writeReady?'liberada pelo Cloudflare Access':'não configurada'");
  const start=html.indexOf("async function writeRequest(");
  const end=html.indexOf("async function refreshCompanies(",start);
  if(start<0||end<=start)throw new Error("Staging write form markers missing");
  html=html.slice(0,start)+
    "async function writeRequest(path,method,data,contentType='application/json'){\n"+
    " return request(path,{method,headers:{'Content-Type':contentType},body:contentType==='application/json'?JSON.stringify(data):data});\n"+
    "}\n"+html.slice(end);
  return html;
}
