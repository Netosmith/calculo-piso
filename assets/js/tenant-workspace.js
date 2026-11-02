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
 "body.pf-tenant-mode .nf-home-layout,body.pf-tenant-mode .nf-solic-wrap,body.pf-tenant-mode .nf-support-link{display:none!important}",
 "body.pf-tenant-mode #tenantWorkspace{display:block!important;min-height:65vh;position:relative;z-index:1}",
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
 '<section class="pf-title"><img class="pf-logo" id="pfLogo" alt="Logo da empresa" hidden>',
 '<div><h1 id="pfCompany">Transportadora</h1><p id="pfIdentity"></p></div></section>',
 '<div class="pf-status" id="pfStatus" role="status"></div>',
 '<section class="pf-box"><h2>Meus módulos</h2><div class="pf-grid" id="pfModules"></div></section>',
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
function displayModules(){
 const root=$("pfModules");root.replaceChildren();
 const modules=Array.isArray(session.modules)?session.modules:[];
 if(!modules.length){root.textContent="Nenhum módulo habilitado pelo Super Admin.";return;}
 for(const key of modules){
  const usable=enabled.has(key)&&session.perfil!=="PISO";
  const button=document.createElement("button");button.className="pf-module";button.type="button";button.disabled=!usable;
  const strong=document.createElement("b");strong.textContent=names[key]||key;
  const caption=document.createElement("small");
  caption.textContent=usable?"Abrir módulo":session.perfil==="PISO"&&enabled.has(key)?
   "Restrito a este perfil":"Em integração para novas transportadoras";
  button.append(strong,caption);
  if(usable)button.onclick=()=>openModule(key);
  root.append(button);
 }
}
async function getLogo(){
 if(logoUrl){URL.revokeObjectURL(logoUrl);logoUrl=null;}
 const logo=$("pfLogo");logo.hidden=true;logo.removeAttribute("src");
 try{
  const response=await fetch(window.PortalAPI.tenantLogoUrl(),{credentials:"include",cache:"no-store"});
  if(!response.ok)return;
  const blob=await response.blob();
  if(!["image/png","image/jpeg","image/webp"].includes(blob.type))return;
  logoUrl=URL.createObjectURL(blob);logo.src=logoUrl;logo.hidden=false;
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
 $("pfFreights").hidden=true;$("pfBi").hidden=true;msg("");
 if(key==="fretes"||key==="fretes2"){
  $("pfFreights").hidden=false;$("pfForm").hidden=!writeAllowed();await getFreights();
 }else if(key==="bi"){$("pfBi").hidden=false;await getBi();}
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
 if(nextSession?.tenantMode!==true || !nextSession.transportadoraId)return;
 session=nextSession;document.body.classList.add("pf-tenant-mode");
 const root=$("tenantWorkspace");if(!root)return;
 root.hidden=false;
 if(!initialized){root.innerHTML=markup();setup();initialized=true;}
 text("pfCompany",session.transportadoraNome||session.transportadoraId);
 text("pfIdentity","Usuário "+session.usuario+" · Perfil "+session.perfil+" · Portal Frete");
 const legacyLogo=document.querySelector(".nf-brand > img");if(legacyLogo)legacyLogo.hidden=true;
 if(!$("pfBrand")){
  const brand=document.createElement("strong");brand.id="pfBrand";brand.textContent="PORTAL FRETE";
  document.querySelector(".nf-brand")?.append(brand);
 }
 displayModules();getLogo();
}
window.addEventListener("portal:session",event=>render(event.detail));
if(window.portalAuthReady)Promise.resolve(window.portalAuthReady).then(render).catch(()=>{});
})();