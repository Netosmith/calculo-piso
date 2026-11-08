/* Nova Frota RH • Comissões. O servidor recalcula e valida antes de salvar. */
(() => {
"use strict";
const API="https://api.portalfrete.net.br/v1/funcionarios";
const $=id=>document.getElementById(id);
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const currency=c=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(c)||0)/100);
const fmtInt=n=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(n);
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const params=new URLSearchParams(location.search);
let month=/^20\d{2}-(0[1-9]|1[0-2])$/.test(params.get("month")||"")?params.get("month"):today().slice(0,7);
let employees=[],commissions=[],totals={};
let working=false;
function notice(message,err=false){
  const target=$("rhNotice");if(!target)return;
  target.hidden=false;target.className="rh-alert"+(err?" error":" success");
  target.textContent=message;
}
const cleared=()=>{if($("rhNotice"))$("rhNotice").hidden=true};
async function api(route="",method="GET",body){
  const options={method,credentials:"include",cache:"no-store",headers:{Accept:"application/json"}};
  if(body!==undefined){options.headers["Content-Type"]="application/json";options.body=JSON.stringify(body)}
  const response=await fetch(API+route,options);
  let data;try{data=await response.json()}catch{throw Error("Falha ao receber resposta da API de funcionários.")}
  if(!response.ok||data.ok!==true)throw Error(data.error||"A operação não foi concluída.");
  return data;
}
function readDecimal(value,scale,max,decimals){
  let s=String(value??"").trim().replace(/\s/g,"");
  if(!s)return 0;
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  else if(/^(\d{1,3}\.)+\d{3}$/.test(s))s=s.replace(/\./g,"");
  if(!new RegExp("^\\\\d+(?:\\\\.\\\\d{1,"+decimals+"})?$").test(s))return null;
  const v=Math.round(Number(s)*scale);
  return Number.isSafeInteger(v)&&v>=0&&v<=max?v:null;
}
const tonnes=value=>readDecimal(value,1000,1000000000,3);
const centavos=value=>readDecimal(value,100,100000000000,2);
const kindLabel=(person)=>{
  if(!person)return "Selecione um funcionário";
  const rate=Number(person.commissionRate||0);
  if(person.commissionKind==="TON")return currency(rate)+"/t";
  if(person.commissionKind==="PERCENT")return (rate/100).toLocaleString("pt-BR",{minimumFractionDigits:2})+"% sobre o valor do frete";
  if(person.commissionKind==="MANUAL")return "Comissão manual · valor definido no lançamento";
  if(person.commissionKind==="AGENCIA")return "Agência · valor a definir";
  return "Nenhuma comissão cadastrada";
};
function currentPerson(){return employees.find(e=>e.id===$("rhCommissionEmployee")?.value)}
function preview(){
  const person=currentPerson(),kind=person?.commissionKind||"NONE";
  const tonne=tonnes($("rhCommissionTonnes")?.value||"");
  const freight=centavos($("rhCommissionFreight")?.value||"");
  const manual=centavos($("rhCommissionManual")?.value||"");
  if(!person||kind==="NONE"||tonne===null||freight===null||manual===null)return null;
  let amount=0,freightCentsPerTon=0,manualAmountCents=0;
  if(kind==="TON"){
    if(tonne<=0)return null;
    amount=Math.round(tonne*person.commissionRate/1000);
  }else if(kind==="PERCENT"){
    if(tonne<=0||freight<=0)return null;
    freightCentsPerTon=freight;
    const freightTotal=Math.round(tonne*freight/1000);
    if(freightTotal>100000000000)return null;
    amount=Math.round(freightTotal*person.commissionRate/10000);
  }else if(kind==="MANUAL"||kind==="AGENCIA"){
    if(manual<=0)return null;
    manualAmountCents=manual;
    amount=manual;
  }
  if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000000)return null;
  return {employeeId:person.id,tonnesMilli:tonne,freightCentsPerTon,manualAmountCents,amountCents:amount};
}
function syncForm(){
  const person=currentPerson(),kind=person?.commissionKind||"NONE";
  if($("rhCommissionContext"))$("rhCommissionContext").textContent=kindLabel(person);
  if($("rhCommissionFreightWrap"))$("rhCommissionFreightWrap").hidden=kind!=="PERCENT";
  if($("rhCommissionManualWrap"))$("rhCommissionManualWrap").hidden=!["MANUAL","AGENCIA"].includes(kind);
  if($("rhCommissionTonnes"))$("rhCommissionTonnes").required=["TON","PERCENT"].includes(kind);
  if($("rhCommissionFreight"))$("rhCommissionFreight").required=kind==="PERCENT";
  if($("rhCommissionManual"))$("rhCommissionManual").required=["MANUAL","AGENCIA"].includes(kind);
  if($("rhCommissionSubmit"))$("rhCommissionSubmit").disabled=!person||kind==="NONE"||working;
  const amount=preview();
  if($("rhCommissionPreview"))$("rhCommissionPreview").textContent=amount?currency(amount.amountCents):"R$ 0,00";
  if($("rhCommissionNote"))$("rhCommissionNote").textContent=
    kind==="PERCENT"?"Fórmula: toneladas × R$/t × percentual. É necessário informar o valor do frete.":kind==="TON"?
    "Fórmula: toneladas × comissão por tonelada.":kind==="MANUAL"||kind==="AGENCIA"?
    "Preencha o valor definido. As toneladas são opcionais e ficam registradas para consulta.":
    "Escolha um funcionário com comissão configurada no Cadastro.";
}
function showRows(){
  const target=$("rhCommissionRows");if(!target)return;
  const term=String($("rhCommissionSearch")?.value||"").toLocaleLowerCase("pt-BR").trim();
  const shown=commissions.filter(c=>!term||(c.employeeName+" "+(c.description||"")).toLocaleLowerCase("pt-BR").includes(term));
  target.innerHTML=shown.length?shown.map(c=>'<tr><td>'+escape(c.date?.split("-").reverse().join("/")||"")+
    '</td><td class="strong">'+escape(c.employeeName)+'</td><td>'+escape(kindLabel({commissionKind:c.kind,commissionRate:c.rateValue}))+
    '</td><td class="money">'+(c.tonnesMilli?fmtInt(c.tonnesMilli/1000):"—")+
    '</td><td class="money">'+(c.freightCentsPerTon?currency(c.freightCentsPerTon):"—")+
    '</td><td class="money strong">'+currency(c.amountCents)+'</td><td>'+escape(c.description||"")+
    '</td><td class="actions"><button class="rh-table-action danger" type="button" data-rh-void="'+escape(c.id)+'">Anular</button></td></tr>').join("")
    :'<tr><td colspan="8" class="rh-empty">Nenhuma comissão lançada nesta competência.</td></tr>';
}
async function refresh(){
  const data=await api("?month="+encodeURIComponent(month));
  employees=data.employees||[];commissions=data.commissions||[];totals=data.totals||{};
  if($("rhCommissionTotal"))$("rhCommissionTotal").textContent=currency(totals.commissionsCents||0);
  if($("rhCommissionCount"))$("rhCommissionCount").textContent=String(commissions.length);
  const select=$("rhCommissionEmployee");
  const previous=select?.value||params.get("employee")||"";
  if(select){
    const available=employees.filter(p=>p.active&&p.commissionKind&&p.commissionKind!=="NONE");
    select.innerHTML='<option value="">Selecione um funcionário</option>'+available.map(p=>
      '<option value="'+escape(p.id)+'">'+escape(p.name)+" · "+escape(p.branch)+'</option>').join("");
    if(available.some(x=>x.id===previous))select.value=previous;
  }
  showRows();syncForm();
  if(data.complete===false)notice("O limite de registros da competência foi atingido. Verifique o histórico.",true);
}
async function submit(event){
  event.preventDefault();if(working)return;
  const draft=preview(),date=$("rhCommissionDate")?.value||"";
  if(!draft)return notice("Preencha os dados necessários ao cálculo da comissão.",true);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return notice("Escolha uma data válida.",true);
  working=true;syncForm();
  try{
    const response=await api("/commissions","POST",{
      employeeId:draft.employeeId,date,
      description:$("rhCommissionDescription")?.value?.trim()||"",
      tonnesMilli:draft.tonnesMilli,
      freightCentsPerTon:draft.freightCentsPerTon,
      manualAmountCents:draft.manualAmountCents
    });
    month=date.slice(0,7);
    if($("rhMonth"))$("rhMonth").value=month;
    params.set("month",month);history.replaceState(null,"","?"+params);
    for(const id of ["rhCommissionTonnes","rhCommissionFreight","rhCommissionManual","rhCommissionDescription"])
      if($(id))$(id).value="";
    await refresh();
    notice("Comissão de "+currency(response.commission?.amountCents)+" registrada com sucesso.");
  }catch(e){notice(e.message,true)}
  finally{working=false;syncForm()}
}
async function voidRecord(id){
  const c=commissions.find(x=>x.id===id);
  if(!c||!confirm("Anular a comissão de "+c.employeeName+" ("+currency(c.amountCents)+")? A anulação ficará registrada."))return;
  try{await api("/commissions/"+encodeURIComponent(id),"DELETE");await refresh();notice("Comissão anulada.")}
  catch(e){notice(e.message,true)}
}
async function init(){
  const session=window.portalAuthReady?await window.portalAuthReady:null;
  if(!session||!requireFeatureAuth("funcionarios"))return;
  if(session.tenantMode===true||session.transportadoraId!=="nova-frota"||
     String(session.perfil||"").toUpperCase()!=="ADMINISTRADOR"){
    location.replace("./home.html");return;
  }
  if($("rhUser"))$("rhUser").textContent=session.nome||session.usuario||"Administração";
  if($("rhMonth"))$("rhMonth").value=month;
  if($("rhCommissionDate"))$("rhCommissionDate").value=today();
  if($("rhCommissionForm"))$("rhCommissionForm").addEventListener("submit",submit);
  if($("rhCommissionEmployee"))$("rhCommissionEmployee").addEventListener("change",syncForm);
  for(const id of ["rhCommissionTonnes","rhCommissionFreight","rhCommissionManual"])
    if($(id))$(id).addEventListener("input",syncForm);
  if($("rhCommissionSearch"))$("rhCommissionSearch").addEventListener("input",showRows);
  if($("rhReload"))$("rhReload").addEventListener("click",()=>refresh().catch(e=>notice(e.message,true)));
  if($("rhMonth"))$("rhMonth").addEventListener("change",()=>{
    const m=$("rhMonth").value;
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(m))return;
    month=m;params.set("month",m);history.replaceState(null,"","?"+params);
    refresh().catch(e=>notice(e.message,true));
  });
  document.addEventListener("click",e=>{
    const button=e.target.closest("[data-rh-void]");
    if(button)voidRecord(button.dataset.rhVoid);
  });
  await refresh();
}
init().catch(e=>notice(e.message,true));
})();
