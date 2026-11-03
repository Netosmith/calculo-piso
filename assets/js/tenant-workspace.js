// Transportadoras usam a mesma Home do Portal Frete, mas dados exclusivos no D1.
(function(){
"use strict";
let session=null,initialized=false,logoUrl=null;
const writers=new Set(["ADMINISTRADOR","COMERCIAL","OPERACIONAL","GOADM"]);
const names={piso:"Piso ANTT",fretes:"Fretes",fretes2:"Fretes MT",bi:"BI",divulgacao:"Divulgação",
 controle:"Controle de Embarque",share:"Share Clientes",ordem:"Ordem de Carregamento",
 cadastros:"Cadastros",estadias:"Estadias","custo-frota":"Custo de Frota",
 administrativo:"Administrativo",monitoramento:"Monitoramento"};
const enabled=new Set(["fretes","fretes2","bi"]);
const style=document.createElement("style");
style.textContent=[
 "body.pf-tenant-mode .nf-solic-wrap,body.pf-tenant-mode .nf-support-link{display:none!important}",
 "body.pf-tenant-mode #tenantWorkspace:not([hidden]){display:block;margin:22px 0 30px;position:relative;z-index:1}",
 "body.pf-tenant-mode #tenantWorkspace[hidden]{display:none!important}",
 "body.pf-tenant-mode .nf-tools .nf-tool.pf-pending{opacity:.52;cursor:not-allowed}",
 "body.pf-tenant-mode .nf-tools .nf-tool.pf-pending .nf-tool-arrow{display:none}",
 "body.pf-tenant-mode .nf-brand-name{color:inherit;font-size:16px;font-weight:850;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
 "html[data-nf-home='1'][data-nf-theme='claro'] body.pf-tenant-mode .pf-box{background:#fff;color:#17345a;border:1px solid #d5e3f2;box-shadow:0 8px 22px rgba(22,62,107,.09)}",
 "html[data-nf-home='1'][data-nf-theme='claro'] body.pf-tenant-mode .pf-stat{background:#eef4fb;border-color:#d2e1ef;color:#17345a}",
 "html[data-nf-home='1'][data-nf-theme='claro'] body.pf-tenant-mode .pf-stat strong{color:#17345a}",
 "html[data-nf-home='1'][data-nf-theme='claro'] body.pf-tenant-mode .pf-box label,html[data-nf-home='1'][data-nf-theme='claro'] body.pf-tenant-mode .pf-note{color:#45627e}",
 "html[data-nf-home='1'][data-nf-theme='claro'] body.pf-tenant-mode .pf-box input{background:#fff;color:#17345a;border-color:#b8cfe2}",
 "html[data-nf-home='1'][data-nf-theme='claro'] body.pf-tenant-mode .pf-table th{color:#45627e}",
 "html[data-nf-home='1'][data-nf-theme='claro'] body.pf-tenant-mode .pf-table th,html[data-nf-home='1'][data-nf-theme='claro'] body.pf-tenant-mode .pf-table td{border-bottom-color:#e2ebf4}",
 ".pf-title{display:flex;align-items:center;gap:17px;flex-wrap:wrap;margin-bottom:24px}",
 ".pf-title h1{font-size:30px;color:#eef7ff;margin:0}.pf-title p{color:#acc5df;margin:6px 0 0}",
 ".pf-logo{width:88px;height:65px;border-radius:12px;object-fit:contain;background:#fff;padding:6px}",
 ".pf-box{border:1px solid #355879;background:rgba(12,33,55,.96);border-radius:16px;padding:22px;margin-bottom:18px;color:#e9f6ff}",
 ".pf-box h2{font-size:21px;margin:0 0 16px}",
 ".pf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}",
 ".pf-module{min-height:96px;text-align:left;border:1px solid #45749a;background:#163c5c;padding:16px;border-radius:10px;color:#fff;cursor:pointer}",
 ".pf-module b{display:block;font-size:16px}.pf-module small{display:block;color:#b9d3e7;margin-top:7px}",
 ".pf-module:disabled{opacity:.55;cursor:not-allowed}.pf-module:hover:not(:disabled){background:#1d5077}",
 ".pf-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}",
 ".pf-box label{display:block;color:#d0e3f3;margin-bottom:10px;font-size:13px}",
 ".pf-box input{display:block;width:100%;border:1px solid #4b7291;border-radius:9px;color:white;background:#091f33;padding:12px;margin-top:6px;font:inherit}",
 ".pf-btn{background:#196ead;border:1px solid #4e9dce;color:white;border-radius:9px;padding:10px 14px;cursor:pointer;font:inherit}",
 ".pf-btn:disabled{opacity:.5;cursor:not-allowed}",
 ".pf-table{width:100%;border-collapse:collapse;min-width:650px}",
 ".pf-table th,.pf-table td{padding:11px 7px;border-bottom:1px solid #355777;text-align:left;font-size:13px}",
 ".pf-table th{color:#b3cee5}",
 ".pf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}",
 ".pf-stat{padding:18px;border:1px solid #3b6787;border-radius:13px;background:#19415f}",
 ".pf-stat strong{display:block;font-size:30px;color:#fff;margin-top:6px}",
 ".pf-note{color:#afc7da;font-size:13px;line-height:1.5}",
 ".pf-status{min-height:27px;color:#bfe8ff;padding:0 0 13px}",
 "@media(max-width:680px){.pf-form,.pf-stats{grid-template-columns:1fr}.pf-title h1{font-size:24px}}"
].join("");
document.head.appendChild(style);
const $=id=>document.getElementById(id);
const msg=t=>{$("pfStatus").textContent=String(t||"");};
const text=(id,t)=>{$(id).textContent=String(t??"");};
const writeAllowed=()=>writers.has(session?.perfil);
const price=t=>Number(t).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const cell=t=>{const td=document.createElement("td");td.textContent=String(t??"");return td;};
const call=(path,options={})=>window.PortalAPI.tenantRequest(path,options);

function markup(){
 return [
 '<div class="pf-status" id="pfStatus" role="status"></div>',
 '<section class="pf-box" id="pfFreights" hidden>',
 '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h2>Fretes da transportadora</h2>',
 '<button type="button" class="pf-btn" id="pfReload">Atualizar</button></div>',
 '<p class="pf-note">Registros próprios desta empresa, sem compartilhamento com a Nova Frota.</p>',
 '<form id="pfForm" class="pf-form"><div>',
 '<label>Origem<input id="pfOrigem" maxlength="100" required placeholder="Ex.: Rio Verde - GO"></label>',
 '<label>Destino<input id="pfDestino" maxlength="100" required placeholder="Ex.: Santos - SP"></label>',
 '</div><div><label>Produto<input id="pfProduto" maxlength="60" required placeholder="Ex.: Soja"></label>',
 '<label>Valor por tonelada (R$)<input id="pfValor" type="number" min=".01" max="100000" step=".01" required></label>',
 '</div><div><button type="submit" class="pf-btn" id="pfSave">Cadastrar frete</button></div></form>',
 '<div style="overflow:auto"><table class="pf-table"><thead><tr>',
 '<th>Origem</th><th>Destino</th><th>Produto</th><th>R$/ton</th><th>Status</th><th>Ação</th>',
 '</tr></thead><tbody id="pfRows"></tbody></table></div>',
 '<p class="pf-note" id="pfEmpty"></p></section>',
 '<section class="pf-box" id="pfBi" hidden><h2>BI da transportadora</h2>',
 '<div class="pf-stats" id="pfStats"></div></section>'
 ].join("");
}
const supported=new Set(["fretes","fretes2","bi"]);
function canOpen(key){
 const modules=Array.isArray(session?.modules)?session.modules:[];
 return supported.has(key) && session?.perfil!=="PISO" && modules.includes(key);
}
function configureHomeCards(){
 const modules=Array.isArray(session?.modules)?session.modules:[];
 document.querySelectorAll(".nf-tools a.nf-tool[data-feature]").forEach(card=>{
  const key=card.dataset.feature;
  if(!modules.includes(key) && !(key==="piso2"&&modules.includes("piso")))return;
  const active=canOpen(key);
  card.classList.toggle("pf-pending",!active);
  card.setAttribute("aria-disabled",String(!active));
  card.title=active?"Abrir módulo com dados desta transportadora":
   "Integração de dados desta transportadora ainda não disponível";
 });
}
async function getLogo(){
 if(logoUrl){URL.revokeObjectURL(logoUrl);logoUrl=null;}
 const logo=document.querySelector(".nf-brand > img");
 if(!logo)return;
 const company=session?.transportadoraNome||"Portal Frete";
 let label=document.getElementById("pfBrandName");
 if(!label){
  label=document.createElement("strong");
  label.id="pfBrandName";
  label.className="nf-brand-name";
  document.querySelector(".nf-brand")?.append(label);
 }
 logo.style.display="none";
 label.hidden=false;
 label.textContent=company;
 document.title="Home | "+company;
 try{
  const response=await fetch(window.PortalAPI.tenantLogoUrl(),{credentials:"include",cache:"no-store"});
  if(!response.ok)return;
  const blob=await response.blob();
  if(!["image/png","image/jpeg","image/webp"].includes(blob.type))return;
  logoUrl=URL.createObjectURL(blob);
  logo.src=logoUrl;
  logo.alt=company;
  logo.style.removeProperty("display");
  label.hidden=true;
 }catch{}
}
async function getFreights(){
 try{
  const result=await call("/fretes"),items=Array.isArray(result.fretes)?result.fretes:[];
  const rows=$("pfRows");rows.replaceChildren();
  text("pfEmpty",items.length?"":"Ainda não existem fretes cadastrados para esta empresa.");
  for(const freight of items){
   const tr=document.createElement("tr");
   for(const value of [freight.origem,freight.destino,freight.produto,price(freight.valorTon),freight.status])tr.append(cell(value));
   const action=document.createElement("td");
   if(writeAllowed()){
    const next=freight.status==="aberto"?"finalizado":"aberto";
    const button=document.createElement("button");button.className="pf-btn";button.type="button";
    button.textContent=next==="finalizado"?"Finalizar":"Reabrir";
    button.onclick=async()=>{
     button.disabled=true;
     try{
      await call("/fretes/"+encodeURIComponent(freight.id),{method:"PATCH",body:{status:next}});
      await getFreights();msg("Situação do frete atualizada.");
     }catch(error){msg(error.message);}finally{button.disabled=false;}
    };
    action.append(button);
   }else action.textContent="Somente leitura";
   tr.append(action);rows.append(tr);
  }
 }catch(error){msg(error.message);}
}
async function getBi(){
 try{
  const data=await call("/bi");const root=$("pfStats");root.replaceChildren();
  for(const entry of [["Fretes cadastrados",data.total],["Abertos",data.abertos],["Finalizados",data.finalizados]]){
   const block=document.createElement("div");block.className="pf-stat";
   const label=document.createElement("span");label.textContent=entry[0];
   const value=document.createElement("strong");value.textContent=String(entry[1]??0);
   block.append(label,value);root.append(block);
  }
 }catch(error){msg(error.message);}
}
async function openModule(key){
 if(!canOpen(key))return;
 const root=$("tenantWorkspace");
 root.hidden=false;
 $("pfFreights").hidden=true;$("pfBi").hidden=true;msg("");
 if(key==="fretes"||key==="fretes2"){
  $("pfFreights").hidden=false;$("pfForm").hidden=!writeAllowed();await getFreights();
 }else if(key==="bi"){$("pfBi").hidden=false;await getBi();}
 root.scrollIntoView({behavior:"smooth",block:"start"});
}
function bindHomeCards(){
 document.querySelector(".nf-tools")?.addEventListener("click",event=>{
  if(!session)return;
  const card=event.target.closest("a.nf-tool[data-feature]");
  if(!card)return;
  event.preventDefault();event.stopPropagation();
  const key=card.dataset.feature;
  if(canOpen(key)){void openModule(key);return;}
  // A card can be enabled by Super Admin but still lack a tenant-safe backend.
  const root=$("tenantWorkspace");root.hidden=false;
  $("pfFreights").hidden=true;$("pfBi").hidden=true;
  msg("Este módulo ainda está sendo integrado para "+(session.transportadoraNome||"esta transportadora")+". Os dados de outras empresas não serão exibidos.");
  root.scrollIntoView({behavior:"smooth",block:"start"});
 },true);
}
function setHomeValue(id,value){
 const element=$(id);if(element)element.textContent=String(value);
}
function sourceUf(origin){
 const match=String(origin||"").toUpperCase().match(/(?:^|[-,\\/\\s])([A-Z]{2})(?=$|[-,\\/\\s])/g);
 const last=match?.[match.length-1]||"";
 const code=last.replace(/[^A-Z]/g,"");
 return new Set(["GO","MT","MS","MG","SP","PR","SC","TO","BA","PA","MA"]).has(code)?code:"";
}
async function updateTenantHome(){
 // Only tenant-scoped endpoints may populate the shared Nova Frota layout.
 for(const id of ["homeVeiculosGO","homeVeiculosMT","homeVeiculosGOPorta",
  "homeVeiculosGOTransito","homeVeiculosMTPorta","homeVeiculosMTTransito",
  "homeSolicStat","homeSolicOpen","homeFiliais"])setHomeValue(id,"—");
 for(const id of ["homeVeiculosAtualizacao","homeSolicAtualizacao","homeFiliaisAtualizacao"])
  setHomeValue(id,"Dados ainda não integrados");
 setHomeValue("homeFretesAtualizacao","Carregando dados da transportadora...");
 try{
  if(!canOpen("fretes")&&!canOpen("fretes2")){
   setHomeValue("homeFretesAtivos","—");
   setHomeValue("homeFretesGO","—");setHomeValue("homeFretesMT","—");
   setHomeValue("homeFretesAtualizacao","Sem acesso ao módulo de fretes");
   return;
  }
  const data=await call("/fretes");
  const fretes=Array.isArray(data.fretes)?data.fretes:[];
  const active=fretes.filter(row=>row.status==="aberto");
  setHomeValue("homeFretesAtivos",active.length);
  setHomeValue("homeFretesGO",active.filter(row=>sourceUf(row.origem)==="GO").length);
  setHomeValue("homeFretesMT",active.filter(row=>sourceUf(row.origem)==="MT").length);
  setHomeValue("homeFretesAtualizacao","Atualizado agora · dados exclusivos");
  document.querySelector(".nf-footer-status")?.replaceChildren("Dados atualizados agora");
 }catch(error){
  for(const id of ["homeFretesAtivos","homeFretesGO","homeFretesMT"])setHomeValue(id,"—");
  setHomeValue("homeFretesAtualizacao","Falha ao consultar fretes próprios");
  document.querySelector(".nf-footer-status")?.replaceChildren("Não foi possível carregar os dados");
 }
}
function setup(){
 $("pfReload").onclick=getFreights;
 $("pfForm").onsubmit=async event=>{
  event.preventDefault();const button=$("pfSave");button.disabled=true;msg("");
  try{
   await call("/fretes",{method:"POST",body:{
    origem:$("pfOrigem").value,destino:$("pfDestino").value,
    produto:$("pfProduto").value,valorTon:Number($("pfValor").value)
   }});
   $("pfForm").reset();await getFreights();msg("Frete cadastrado nesta transportadora.");
  }catch(error){msg(error.message);}finally{button.disabled=false;}
 };
}
function render(nextSession){
 if(nextSession?.tenantMode!==true||!nextSession.transportadoraId)return;
 session=nextSession;
 document.body.classList.add("pf-tenant-mode");
 const root=$("tenantWorkspace");if(!root)return;
 if(!initialized){root.innerHTML=markup();setup();bindHomeCards();initialized=true;}
 const short=String(session.usuario||"Usuário").split(".")[0];
 setHomeValue("homeUserName",short.slice(0,1)+short.slice(1).toLowerCase());
 setHomeValue("homeSub","Visão geral da operação | "+session.transportadoraNome+
  " | Acesso: "+session.usuario+" • "+session.perfil);
 const footer=document.querySelector(".nf-footer span:last-child");
 if(footer)footer.textContent="Portal Frete | "+session.transportadoraNome;
 // Never reveal legacy Nova Frota KPI values or operational requests.
 const solicit=document.getElementById("homeSolicCard");if(solicit)solicit.disabled=true;
 const support=document.querySelector(".nf-support-link");if(support)support.hidden=true;
 configureHomeCards();
 void updateTenantHome();
 void getLogo();
}
window.addEventListener("portal:session",event=>render(event.detail));
if(window.portalAuthReady)Promise.resolve(window.portalAuthReady).then(render).catch(()=>{});
})();