/* Nova Frota • Comissões calculadas exclusivamente pelas toneladas.
 * Cada linha é um funcionário; modalidade e taxa vêm do cadastro.
 * Valores são conferidos novamente no Worker antes de gravar.
 */
(()=>{
"use strict";
const API="https://api.portalfrete.net.br/v1/funcionarios";
const $=id=>document.getElementById(id);
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl=c=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(c)||0)/100);
const num=n=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(n);
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const params=new URLSearchParams(location.search);
let month=/^20\d{2}-(0[1-9]|1[0-2])$/.test(params.get("month")||"")?params.get("month"):today().slice(0,7);
let employees=[],commissions=[],totals={},monthlyVolume=null,working=false;
const drafts=new Map();
function notice(message,error=false){
 const node=$("rhNotice");if(!node)return;
 node.className="rh-alert"+(error?" error":" success");
 node.textContent=message;node.hidden=false;
}
async function api(path="",method="GET",body){
 const options={method,credentials:"include",cache:"no-store",headers:{Accept:"application/json"}};
 if(body!==undefined){options.headers["Content-Type"]="application/json";options.body=JSON.stringify(body)}
 const res=await fetch(API+path,options);
 let data;try{data=await res.json()}catch{throw Error("A API de funcionários não respondeu corretamente.")}
 if(!res.ok||data.ok!==true)throw Error(data.error||"Não foi possível salvar a comissão.");
 return data;
}
function decimal(value,scale,max,places){
 let s=String(value??"").trim().replace(/\s/g,"");
 if(!s)return 0;
 if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
 else if(/^\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
 if(!new RegExp("^[0-9]+(?:[.][0-9]{1,"+places+"})?$").test(s))return null;
 const v=Math.round(Number(s)*scale);
 return Number.isSafeInteger(v)&&v>=0&&v<=max?v:null;
}
const tonnes=v=>decimal(v,1000,1000000000,3);
const cents=v=>decimal(v,100,100000000000,2);
const isManual=k=>k==="MANUAL"||k==="AGENCIA";
function modeLabel(kind,rate,oldBase=false){
 const rateNum=Number(rate||0);
 if(kind==="TON")return brl(rateNum)+"/tonelada";
 if(kind==="PERCENT")return (rateNum/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"%"+
   (oldBase?" (cálculo antigo)":" sobre toneladas");
 if(kind==="MANUAL")return "Manual";
 if(kind==="AGENCIA")return "Agência";
 return "Sem comissão";
}
function rowDraft(p){
 if(!drafts.has(p.id))drafts.set(p.id,{tonnes:monthlyVolume?num(monthlyVolume.tonnesMilli/1000):"",manual:"",reference:""});
 return drafts.get(p.id);
}
function calculate(p){
 const d=rowDraft(p),t=tonnes(d.tonnes),m=cents(d.manual);
 if(t===null||t<=0||m===null||!monthlyVolume)return null;
 const kind=p.commissionKind,rate=Number(p.commissionRate||0);
 let amount=0;
 if(kind==="TON")amount=Math.round(t*rate/1000);
 else if(kind==="PERCENT")amount=Math.round(t*rate/100000);
 else if(isManual(kind))amount=m;
 if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000000)return null;
 return {employeeId:p.id,tonnesMilli:t,manualAmountCents:isManual(kind)?m:0,amountCents:amount};
}
function previewRow(id){
 const p=employees.find(x=>x.id===id),el=$("rhPreview_"+id);
 if(!p||!el)return;
 const draft=calculate(p);
 el.textContent=isManual(p.commissionKind)?(draft?brl(draft.amountCents):"—"):(monthlyVolume?brl(p.commissionsCents||0):"Aplique volume");
 el.classList.toggle("positive",Boolean(draft));
}
function filterEmployee(p){
 const q=String($("rhCommissionSearch")?.value||"").trim().toLocaleLowerCase("pt-BR");
 return !q||(p.name+" "+p.role+" "+p.branch+" "+p.city).toLocaleLowerCase("pt-BR").includes(q);
}
function renderGrid(){
 const root=$("rhCommissionGrid");if(!root)return;
 const people=employees.filter(e=>e.active&&e.commissionKind&&e.commissionKind!=="NONE"&&filterEmployee(e));
 const count=$("rhEligibleCount");if(count)count.textContent=String(people.length);
 if(!people.length){
  root.innerHTML='<tr><td colspan="8" class="rh-empty">Nenhum funcionário com comissão habilitada. Configure a modalidade no Cadastro de Funcionários.</td></tr>';
  return;
 }
 root.innerHTML=people.map(p=>{
  const d=rowDraft(p),manual=isManual(p.commissionKind),value=manual?calculate(p):null;
  return '<tr data-rh-person="'+escape(p.id)+'">'+
   '<td class="strong">'+escape(p.name)+'<div class="rh-muted">'+escape(p.branch)+'</div></td>'+
   '<td>'+escape(modeLabel(p.commissionKind,p.commissionRate))+'</td>'+
   '<td><input class="rh-grid-input" type="text" inputmode="decimal" aria-label="Toneladas de '+escape(p.name)+
     '" data-rh-tons="'+escape(p.id)+'" value="'+escape(d.tonnes)+'" readonly placeholder="Volume do Painel"></td>'+
   '<td>'+(manual?
     '<input class="rh-grid-input" type="text" inputmode="decimal" aria-label="Valor manual de '+escape(p.name)+
     '" data-rh-manual="'+escape(p.id)+'" value="'+escape(d.manual)+'" placeholder="R$ 0,00">'
     :'<span class="rh-muted">Automático</span>')+'</td>'+
   '<td class="money strong" id="rhPreview_'+escape(p.id)+'">'+(manual?(value?brl(value.amountCents):"—"):(monthlyVolume?brl(p.commissionsCents||0):"Aplique volume"))+'</td>'+
   '<td class="money">'+brl(p.commissionsCents||0)+'</td>'+
   '<td><input class="rh-grid-input rh-grid-reference" type="text" maxlength="160" data-rh-reference="'+escape(p.id)+
     '" aria-label="Referência de '+escape(p.name)+'" value="'+escape(d.reference)+'" placeholder="Opcional"></td>'+
   '<td class="actions">'+(manual?'<button type="button" class="rh-btn primary rh-grid-save" data-rh-save="'+escape(p.id)+'"'+
     (!value||working?" disabled":"")+'>Salvar</button>':'<span class="rh-pill">Automático</span>')+'</td></tr>';
 }).join("");
}
function updateRow(id){
 previewRow(id);
 const p=employees.find(x=>x.id===id),row=document.querySelector('tr[data-rh-person="'+id+'"]');
 const save=row?.querySelector("[data-rh-save]");
 if(save)save.disabled=working||!p||!isManual(p.commissionKind)||!calculate(p);
}
function renderHistory(){
 const root=$("rhCommissionRows");if(!root)return;
 root.innerHTML=commissions.length?commissions.map(c=>
  '<tr><td>'+escape(String(c.date||"").split("-").reverse().join("/"))+'</td>'+
  '<td class="strong">'+escape(c.employeeName)+'</td>'+
  '<td>'+escape(modeLabel(c.kind,c.rateValue,c.kind==="PERCENT"&&c.freightCentsPerTon>0))+'</td>'+
  '<td class="money">'+num(c.tonnesMilli/1000)+'</td>'+
  '<td class="money strong">'+brl(c.amountCents)+'</td>'+
  '<td>'+escape(c.description||"")+'</td>'+
  '<td class="actions"><button type="button" class="rh-table-action danger" data-rh-void="'+
    escape(c.id)+'">Anular</button></td></tr>').join("")
  :'<tr><td colspan="7" class="rh-empty">Nenhuma comissão lançada no mês selecionado.</td></tr>';
}
async function refresh(){
 const data=await api("?month="+encodeURIComponent(month));
 employees=data.employees||[];commissions=data.commissions||[];totals=data.totals||{};monthlyVolume=data.monthlyVolume||null;
 if($("rhGlobalTonnes"))$("rhGlobalTonnes").value=monthlyVolume?num(monthlyVolume.tonnesMilli/1000):"";
 if($("rhCommissionTotal"))$("rhCommissionTotal").textContent=brl(totals.commissionsCents||0);
 if($("rhCommissionCount"))$("rhCommissionCount").textContent=String(commissions.length);
 if($("rhMonth"))$("rhMonth").value=month;
 renderGrid();renderHistory();
 if(data.complete===false)notice("Há mais registros do que o limite de consulta. Verifique o histórico.",true);
}
async function savePerson(id){
 if(working)return;
 const p=employees.find(e=>e.id===id);
 if(!p||!p.active||!isManual(p.commissionKind))return;
 const draft=calculate(p);
 const date=$("rhCommissionDate")?.value||"";
 if(!draft)return notice("Informe toneladas válidas e, se for manual ou agência, o valor da linha de "+p.name+".",true);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return notice("Escolha a data da comissão.",true);
 working=true;
 updateRow(id);
 try{
  const saved=await api("/commissions","POST",{
    employeeId:id,date,tonnesMilli:draft.tonnesMilli,
    freightCentsPerTon:0,manualAmountCents:draft.manualAmountCents,
    description:rowDraft(p).reference.trim()
  });
  drafts.delete(id);
  if(date.slice(0,7)!==month){
    month=date.slice(0,7);
    params.set("month",month);history.replaceState(null,"","?"+params);
  }
  await refresh();
  notice("Comissão de "+p.name+" salva: "+brl(saved.commission.amountCents)+".");
 }catch(e){notice(e.message,true)}
 finally{working=false;renderGrid()}
}
async function voidRecord(id){
 const c=commissions.find(x=>x.id===id);
 if(!c||!confirm("Anular a comissão de "+c.employeeName+" ("+brl(c.amountCents)+")? O lançamento ficará registrado como anulado."))return;
 try{await api("/commissions/"+encodeURIComponent(id),"DELETE");await refresh();notice("Comissão anulada.")}
 catch(e){notice(e.message,true)}
}
async function init(){
 const sess=window.portalAuthReady?await window.portalAuthReady:null;
 if(!sess||!requireFeatureAuth("funcionarios"))return;
 if(sess.tenantMode===true||sess.transportadoraId!=="nova-frota"||
    String(sess.perfil||"").toUpperCase()!=="ADMINISTRADOR"){
  location.replace("./home.html");return;
 }
 if($("rhUser"))$("rhUser").textContent=sess.nome||sess.usuario||"Administração";
 if($("rhMonth"))$("rhMonth").value=month;
 if($("rhCommissionDate"))$("rhCommissionDate").value=today();
 if($("rhCommissionSearch"))$("rhCommissionSearch").addEventListener("input",renderGrid);
 if($("rhReload"))$("rhReload").addEventListener("click",()=>refresh().catch(e=>notice(e.message,true)));
 if($("rhMonth"))$("rhMonth").addEventListener("change",()=>{
  const next=$("rhMonth").value;
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(next))return;
  month=next;drafts.clear();params.set("month",next);history.replaceState(null,"","?"+params);
  refresh().catch(e=>notice(e.message,true));
 });
 document.addEventListener("input",e=>{
  const t=e.target;
  const id=t?.dataset?.rhManual||t?.dataset?.rhReference;
  if(!id)return;
  const p=employees.find(x=>x.id===id);
  if(!p)return;
  const d=rowDraft(p);
  if(t.dataset.rhManual)d.manual=t.value;
  else d.reference=t.value;
  updateRow(id);
 });
 document.addEventListener("click",e=>{
  const save=e.target.closest("[data-rh-save]");if(save){savePerson(save.dataset.rhSave);return}
  const revoke=e.target.closest("[data-rh-void]");if(revoke)voidRecord(revoke.dataset.rhVoid);
 });
 await refresh();
}
init().catch(e=>notice(e.message,true));
})();
