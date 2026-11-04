// Shared Nova Frota Home, using this transportadora's private Sheets gateway.
// Do not replace the real modules with simplified D1 widgets.
(function(){
 "use strict";
 let currentTenant="";
 let lastFreightSummary=null;
 let activeFreightModules=new Set();
 const displayBase=source=>source==="FRETES"?"GERAL":
   source==="FRETES2"?"MT INTERNO":
   source.startsWith("FRETES-")?source.slice(7):source;
 function renderUnifiedFreightSummary(){
  if(!lastFreightSummary||lastFreightSummary.tenantId!==currentTenant)return;
  const selectedBases=new Set((lastFreightSummary.bases||[]).map(value=>String(value).toUpperCase()));
  const failedBases=new Set((lastFreightSummary.failedBases||[]).map(value=>String(value).toUpperCase()));
  const seen=new Set(),rows=[];
  for(const row of lastFreightSummary.rows||[]){
   if(!row||typeof row!=="object")continue;
   // IDs belong to each independently managed spreadsheet, not globally.
   // The same numeric ID may occur in different bases without being a duplicate.
   const id=String(row.id||"").trim();
   const source=String(row.source||"").toUpperCase();
   if(!selectedBases.has(source))continue;
   const recordKey=source+"::"+id;
   if(id&&seen.has(recordKey))continue;
   if(id)seen.add(recordKey);
   rows.push(row);
  }
  const byBase=new Map([...selectedBases].filter(source=>!failedBases.has(source)).map(source=>[
    displayBase(source),{fretes:0,porta:0,transito:0}
  ]));
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
  if(detail){
    detail.replaceChildren();
    detail.style.cssText="display:flex;flex-wrap:wrap;gap:6px;max-height:156px;overflow:auto;white-space:normal;padding:4px 0";
    for(const [base,acc] of byBase){
      const chip=document.createElement("span");
      chip.textContent=base+": "+acc.fretes;
      chip.style.cssText="display:inline-block;border-radius:7px;border:1px solid #8fb2cd65;padding:3px 7px;font-size:11px;white-space:nowrap";
      detail.append(chip);
    }
    for(const source of failedBases){
      if(!selectedBases.has(source))continue;
      const chip=document.createElement("span");
      chip.textContent=displayBase(source)+": indisponível";
      chip.style.cssText="display:inline-block;border:1px solid #e5ab4f;border-radius:7px;padding:3px 7px;font-size:11px;color:#ffda9b";
      detail.append(chip);
    }
    if(!byBase.size&&!failedBases.size)detail.textContent="Nenhuma base habilitada e vinculada a uma regional";
  }
  const totalPorta=[...byBase.values()].reduce((n,x)=>n+x.porta,0);
  const totalTransito=[...byBase.values()].reduce((n,x)=>n+x.transito,0);
  const vehicle=document.querySelector(".nf-veiculos-resumo");
  if(vehicle){
   vehicle.replaceChildren();
   const total=document.createElement("strong");
   total.textContent=(failedBases.size?"TOTAL PARCIAL: ":"TOTAL: ")+(totalPorta+totalTransito)+" | Porta: "+totalPorta+" | Trânsito: "+totalTransito;
   total.style.cssText="display:block;font-size:12px;margin-bottom:7px;color:#f1f7ff";
   vehicle.append(total);
   const lines=document.createElement("div");
   lines.style.cssText="max-height:156px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:6px;font-size:11px";
   for(const [base,acc] of byBase){
    const item=document.createElement("div");
    item.textContent=base+": "+(acc.porta+acc.transito)+" ("+acc.porta+"P / "+acc.transito+"T)";
    lines.append(item);
   }
   vehicle.append(lines);
  }
  const updateMessage=failedBases.size?failedBases.size+" base(s) sem conexão; indicadores parciais":
    byBase.size?"Consolidado das bases vinculadas a regionais":"Selecione a base no cadastro de uma regional";
  set("homeFretesAtualizacao",updateMessage);
  set("homeVeiculosAtualizacao",failedBases.size?"Verifique a integração das bases indisponíveis":
    byBase.size?"Porta e trânsito por base operacional vinculada":"Nenhuma base regional vinculada");
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
  if(general)general.textContent="Fretes Operacional";
  if(internal)internal.closest("a")?.remove();
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
   const feature=card.dataset.feature;
   // Shortcut availability follows Super Admin grants. Regional assignments
   // control KPIs, not whether the operator may open and prepare that base.
   const allowed=typeof window.canAccessFeature==="function"&&
    window.canAccessFeature(feature);
   if(allowed&&(feature==="fretes"||/^fretes-[a-z]{2}$/.test(feature))){
    const description=card.querySelector("p");
    if(description)description.textContent=activeFreightModules.has(feature)
      ?"Base habilitada e vinculada às regionais."
      :"Vincule uma regional para contabilizar esta base na Home.";
   }
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
   // Freight and fleet indicators come ONLY from enabled regional bases.
   // General Home metrics can never overwrite their consolidated counts.
   const fields={homeSolicStat:"solicitacoes",homeSolicOpen:"solicitacoes",homeFiliais:"filiais"};
   Object.entries(fields).forEach(([id,key])=>{
    if(typeof data[key]==="number"&&Number.isFinite(data[key]))set(id,data[key]);
   });
   ["homeSolicAtualizacao","homeFiliaisAtualizacao"].forEach(id=>set(id,"Atualizado pela planilha da transportadora"));
   renderUnifiedFreightSummary();
   document.querySelector(".nf-footer-status")?.replaceChildren("Dados exclusivos");
  }catch(error){
   if(currentTenant!==session.transportadoraId)return;
   ["homeSolicAtualizacao","homeFiliaisAtualizacao"].forEach(id=>set(id,"Integração da planilha indisponível"));
   renderUnifiedFreightSummary();
   document.querySelector(".nf-footer-status")?.replaceChildren("Planilha não disponível");
  }
 }
 function render(session){
  if(session?.tenantMode!==true||!session.transportadoraId)return;
  if(window.__PORTAL_TENANT_EXPECTED &&
     session.transportadoraId!==window.__PORTAL_TENANT_EXPECTED)return;
  // Auth may notify twice; do not discard regional assignments loaded meanwhile.
  if(currentTenant===session.transportadoraId && document.body?.classList.contains("pf-tenant-mode"))return;
  currentTenant=session.transportadoraId;
  lastFreightSummary=null;
  activeFreightModules=new Set();
  document.body?.classList.add("pf-tenant-mode");
  set("homeFretesAtivos","—");
  set("homeFretesDetalhe","Consultando bases vinculadas às regionais...");
  const pendingFleet=document.querySelector(".nf-veiculos-resumo");
  if(pendingFleet)pendingFleet.textContent="Consultando veículos das bases vinculadas...";
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
  activeFreightModules=new Set((event.detail?.bases||[]).map(source=>
    source==="FRETES"?"fretes":String(source).toLowerCase()));
  cards();
  renderUnifiedFreightSummary();
 });
 window.addEventListener("portal:session",event=>render(event.detail));
 if(window.portalAuthReady)Promise.resolve(window.portalAuthReady).then(render).catch(()=>{});
})();