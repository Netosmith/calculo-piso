// Shared Nova Frota Home, using this transportadora's private Sheets gateway.
// Do not replace the real modules with simplified D1 widgets.
(function(){
 "use strict";
 let currentTenant="";
 let lastFreightSummary=null;
 const displayBase=source=>source==="FRETES"?"GERAL":
   source==="FRETES2"?"MT INTERNO":
   source.startsWith("FRETES-")?source.slice(7):source;
 function renderUnifiedFreightSummary(){
  if(!lastFreightSummary||lastFreightSummary.tenantId!==currentTenant)return;
  const seen=new Set(),rows=[];
  for(const row of lastFreightSummary.rows||[]){
   if(!row||typeof row!=="object")continue;
   // IDs belong to each independently managed spreadsheet, not globally.
   // The same numeric ID may occur in different bases without being a duplicate.
   const id=String(row.id||"").trim();
   const source=String(row.source||"").toUpperCase();
   const recordKey=source+"::"+id;
   if(id&&seen.has(recordKey))continue;
   if(id)seen.add(recordKey);
   rows.push(row);
  }
  const byBase=new Map();
  for(const row of rows){
   const label=displayBase(String(row.source||"").toUpperCase());
   const acc=byBase.get(label)||{fretes:0,porta:0,transito:0};
   acc.fretes++;
   acc.porta+=Number(row.porta)||0;
   acc.transito+=Number(row.transito)||0;
   byBase.set(label,acc);
  }
  set("homeFretesAtivos",rows.length);
  const detail=$("homeFretesDetalhe");
  if(detail)detail.textContent=[...byBase].map(([base,acc])=>base+": "+acc.fretes).join(" • ")||"Nenhum frete disponível";
  const totalPorta=[...byBase.values()].reduce((n,x)=>n+x.porta,0);
  const totalTransito=[...byBase.values()].reduce((n,x)=>n+x.transito,0);
  const vehicle=document.querySelector(".nf-veiculos-resumo");
  if(vehicle){
   vehicle.replaceChildren();
   const total=document.createElement("strong");
   total.textContent="TOTAL: "+(totalPorta+totalTransito)+" | Porta: "+totalPorta+" | Trânsito: "+totalTransito;
   total.style.cssText="display:block;font-size:12px;margin-bottom:7px;color:#f1f7ff";
   vehicle.append(total);
   const lines=document.createElement("div");
   lines.style.cssText="max-height:80px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;font-size:10px";
   for(const [base,acc] of byBase){
    const item=document.createElement("div");
    item.textContent=base+": "+(acc.porta+acc.transito)+" ("+acc.porta+"P / "+acc.transito+"T)";
    lines.append(item);
   }
   vehicle.append(lines);
  }
  set("homeFretesAtualizacao","Consolidado das bases habilitadas");
  set("homeVeiculosAtualizacao","Porta e trânsito por base operacional");
 }

 const $=id=>document.getElementById(id);
 const set=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
 const BASE_UFS=["GO","MT","SP","MS","BA","PR","SC","RO","TO","MA","AC","AL","AP","AM","CE","DF","ES","MG","PA","PB","PE","PI","RJ","RN","RS","RR","SE"];
 function baseKey(uf){return "fretes-"+uf.toLowerCase();}
 function renderBaseCards(){
  const grid=document.querySelector(".nf-tools");
  if(!grid || !window.__PORTAL_TENANT_SESSION?.tenantMode)return;
  const general=grid.querySelector('a[data-feature="fretes"] h2');
  const internal=grid.querySelector('a[data-feature="fretes2"] h2');
  if(general)general.textContent="Fretes Geral (multiestado)";
  if(internal)internal.textContent="Fretes MT (interno)";
  for(const uf of BASE_UFS){
   const key=baseKey(uf);
   const existing=grid.querySelector('a[data-feature="'+key+'"]');
   const card=existing || document.createElement("a");
   if(!existing){
    card.className="nf-tool green pf-base-card";
    card.dataset.feature=key;
    const icon=document.createElement("span");
    icon.className="nf-tool-icon";icon.textContent="🚛";
    const title=document.createElement("h2");
    title.textContent="Fretes "+uf;
    const detail=document.createElement("p");
    detail.textContent="Base operacional "+uf+" da transportadora.";
    const arrow=document.createElement("span");
    arrow.className="nf-tool-arrow";arrow.textContent="→";
    card.append(icon,title,detail,arrow);
    grid.append(card);
   }else{
    const title=card.querySelector("h2");
    if(title)title.textContent="Fretes "+uf;
   }
   card.href=window.portalTenantHref?.("fretes-"+uf+".html") || "./fretes-"+uf+".html";
   card.dataset.feature=key;
  }
 }
 function cards(){
  renderBaseCards();
  document.querySelectorAll(".nf-tools a.nf-tool[data-feature]").forEach(card=>{
   const allowed=typeof window.canAccessFeature==="function"&&
    window.canAccessFeature(card.dataset.feature);
   card.hidden=!allowed;
   card.style.display=allowed?"":"none";
   card.removeAttribute("aria-disabled");
   card.classList.remove("pf-pending");
   if(allowed)card.title="Abrir módulo desta transportadora";
  });
 }
 async function dashboard(session){
  const values=["homeFretesAtivos","homeFretesGO","homeFretesMT",
   "homeVeiculosGO","homeVeiculosMT","homeVeiculosGOPorta",
   "homeVeiculosGOTransito","homeVeiculosMTPorta","homeVeiculosMTTransito",
   "homeSolicStat","homeSolicOpen","homeFiliais"];
  values.forEach(id=>set(id,"—"));
  const updates=["homeFretesAtualizacao","homeVeiculosAtualizacao",
   "homeSolicAtualizacao","homeFiliaisAtualizacao"];
  updates.forEach(id=>set(id,"Consultando a planilha individual..."));
  try{
   const response=await window.PortalAPI.call("home","read",{});
   if(currentTenant!==session.transportadoraId)return;
   const data=response?.data||{};
   const fields={
    homeFretesAtivos:"fretesAtivos",homeFretesGO:"fretesGO",homeFretesMT:"fretesMT",
    homeVeiculosGO:"veiculosGO",homeVeiculosMT:"veiculosMT",
    homeVeiculosGOPorta:"goPorta",homeVeiculosGOTransito:"goTransito",
    homeVeiculosMTPorta:"mtPorta",homeVeiculosMTTransito:"mtTransito",
    homeSolicStat:"solicitacoes",homeSolicOpen:"solicitacoes",homeFiliais:"filiais"
   };
   Object.entries(fields).forEach(([id,key])=>{
    if(typeof data[key]==="number"&&Number.isFinite(data[key]))set(id,data[key]);
   });
   updates.forEach(id=>set(id,"Atualizado pela planilha da transportadora"));
   renderUnifiedFreightSummary();
   document.querySelector(".nf-footer-status")?.replaceChildren("Dados exclusivos");
  }catch(error){
   if(currentTenant!==session.transportadoraId)return;
   updates.forEach(id=>set(id,"Integração da planilha indisponível"));
   renderUnifiedFreightSummary();
   document.querySelector(".nf-footer-status")?.replaceChildren("Planilha não disponível");
  }
 }
 function render(session){
  if(session?.tenantMode!==true||!session.transportadoraId)return;
  if(window.__PORTAL_TENANT_EXPECTED &&
     session.transportadoraId!==window.__PORTAL_TENANT_EXPECTED)return;
  currentTenant=session.transportadoraId;
  lastFreightSummary=null;
  document.body?.classList.add("pf-tenant-mode");
  const root=$("tenantWorkspace");
  if(root){root.replaceChildren();root.hidden=true;}
  const name=String(session.usuario||"Usuário").split(".")[0];
  set("homeUserName",name.charAt(0)+name.slice(1).toLowerCase());
  set("homeSub","Visão geral da operação | "+session.transportadoraNome+
   " | Acesso: "+session.usuario+" • "+session.perfil);
  const footer=document.querySelector(".nf-footer span:last-child");
  if(footer)footer.textContent="Portal Frete | "+session.transportadoraNome;
  document.title="Home | "+(session.transportadoraNome||"Portal Frete");
  const solicit=$("homeSolicCard");if(solicit)solicit.disabled=true;
  document.querySelector(".nf-support-link")?.setAttribute("hidden","");
  cards();
  void dashboard(session);
 }
 window.addEventListener("portal:tenant-freights-summary",event=>{
  if(event.detail?.tenantId!==currentTenant)return;
  lastFreightSummary=event.detail;
  renderUnifiedFreightSummary();
 });
 window.addEventListener("portal:session",event=>render(event.detail));
 if(window.portalAuthReady)Promise.resolve(window.portalAuthReady).then(render).catch(()=>{});
})();