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
  // Keep the exact totals consolidated from this company's enabled bases.
  // Only the presentation differs from Nova Frota's legacy GO/MT Home.
  set("homeFretesAtivos",rows.length);
  const summaries=[...byBase].map(([base,acc])=>({
   base,fretes:acc.fretes,porta:acc.porta,transito:acc.transito,
   total:acc.porta+acc.transito
  }));
  const allFreightLabels=summaries.map(x=>x.base+": "+x.fretes);
  const visibleFreightLabels=allFreightLabels.slice(0,2);
  if(allFreightLabels.length>2)
    visibleFreightLabels.push("+"+(allFreightLabels.length-2)+" bases");
  const failedLabels=[...failedBases].filter(source=>selectedBases.has(source))
    .map(displayBase);
  const detail=$("homeFretesDetalhe");
  if(detail){
   // Previous tenant version used bordered chips with inline CSS.
   // Clear those old styles and use the same compact line as Nova Frota.
   detail.removeAttribute("style");
   detail.classList.add("pf-tenant-freight-detail");
   detail.replaceChildren();
   detail.textContent=visibleFreightLabels.join(" • ") ||
     (failedLabels.length?"Bases indisponíveis":"Nenhuma base vinculada");
   detail.title=[...allFreightLabels,...failedLabels.map(x=>x+": indisponível")]
     .join(" • ");
  }
  const totalPorta=summaries.reduce((n,x)=>n+x.porta,0);
  const totalTransito=summaries.reduce((n,x)=>n+x.transito,0);
  const vehicle=document.querySelector(".nf-veiculos-resumo");
  if(vehicle){
   vehicle.replaceChildren();
   vehicle.removeAttribute("style");
   vehicle.classList.add("pf-tenant-vehicle");
   vehicle.setAttribute("aria-label","Veículos da transportadora por base");
   const total=document.createElement("strong");
   total.className="nf-stat-value pf-tenant-vehicle-total";
   total.textContent=String(totalPorta+totalTransito);
   vehicle.append(total);

   const meta=document.createElement("div");
   meta.className="pf-tenant-vehicle-meta";
   const allVehicleLabels=summaries.map(x=>x.base+": "+x.total);
   meta.textContent=allVehicleLabels.slice(0,2).join(" • ")+
     (allVehicleLabels.length>2?" • +"+(allVehicleLabels.length-2)+" bases":"");
   if(!summaries.length)meta.textContent="Nenhuma base vinculada";
   meta.title=allVehicleLabels.join(" • ");
   vehicle.append(meta);

   const lines=document.createElement("div");
   lines.className="pf-tenant-vehicle-lines";
   lines.setAttribute("aria-label","Detalhamento de Porta e Trânsito por base");
   for(const {base,porta,transito,total:baseTotal} of summaries){
    const item=document.createElement("div");
    item.className="nf-veiculos-linha";
    item.title=base+": "+baseTotal+" veículos • Porta "+porta+" • Trânsito "+transito;

    const label=document.createElement("strong");
    label.className="nf-veiculos-uf";
    label.textContent=base;
    label.title=base;
    item.append(label);
    for(const [type,name,value] of [["porta","Porta",porta],["transito","Trânsito",transito]]){
     const status=document.createElement("span");
     status.className="nf-veiculos-status "+type;
     const dot=document.createElement("i");
     dot.setAttribute("aria-hidden","true");
     const caption=document.createElement("span");
     caption.textContent=name;
     const count=document.createElement("b");
     count.textContent=String(value);
     status.append(dot,caption,count);
     item.append(status);
    }
    lines.append(item);
   }
   vehicle.append(lines);
  }
  // This is the local time when the private-sheet summary was consulted,
  // not a claim about when the spreadsheet itself was last modified.
  const consultedAt=new Intl.DateTimeFormat("pt-BR",{
   hour:"2-digit",minute:"2-digit"
  }).format(new Date());
  const status=failedLabels.length?
   failedLabels.length+" base(s) indisponíveis • "+consultedAt:
   summaries.length?"Consultado às "+consultedAt:"Nenhuma base vinculada";
  set("homeFretesAtualizacao",status);
  set("homeVeiculosAtualizacao",status);
  for(const id of ["homeFretesAtualizacao","homeVeiculosAtualizacao"]){
   const el=$(id);
   if(el)el.title=failedLabels.length?
     "Sem conexão: "+failedLabels.join(", ")+". Dados das demais bases atualizados às "+consultedAt:
     status;
  }
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
  // A PISO session must never fetch or render tenant's dashboard, freights,
  // regional assignments or operational data.
  if(String(session.perfil||"").trim().toUpperCase()==="PISO"){
    set("homeSub","Acesso exclusivo ao Cálculo de Piso 2 (ANTT)");
    return;
  }
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
  // Solicitações são controladas pela liberação do módulo no Super Admin.
  // Não desabilitar o botão por se tratar de uma transportadora independente.
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