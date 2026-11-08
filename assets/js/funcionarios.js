/* Nova Frota • Funcionários v1. Dados online no D1, sem localStorage de salários. */
(() => {
"use strict";
const API="https://api.portalfrete.net.br/v1/funcionarios";
const $=id=>document.getElementById(id);
const html=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl=c=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(c)||0)/100);
const fmtDate=s=>{const a=String(s||"").split("-");return a.length===3?a[2]+"/"+a[1]+"/"+a[0]:"—";};
const localMonth=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
const localDate=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const qp=new URLSearchParams(location.search);
const validMonth=v=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(v||""));
let month=validMonth(qp.get("month"))?qp.get("month"):localMonth();
let state={employees:[],entries:[],commissions:[],totals:{},monthlyVolume:null},busy=false;
const page=document.body.dataset.rhPage||"dashboard";
function status(msg,error=false){
  const box=$("rhNotice");if(!box)return;
  box.hidden=false;box.className="rh-alert"+(error?" error":" success");box.textContent=msg;
}
function clearStatus(){const box=$("rhNotice");if(box)box.hidden=true;}
function moneyToCents(input){
  let s=String(input??"").replace(/R\$/gi,"").replace(/\s/g,"").trim();
  if(!s)return null;
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  else if(/^\d{1,3}\.\d{3}$/.test(s))s=s.replace(".","");
  if(!/^\d+(\.\d{1,2})?$/.test(s))return null;
  const value=Math.round(Number(s)*100);
  return Number.isSafeInteger(value)&&value>=0&&value<=100000000000?value:null;
}
async function call(path="",method="GET",body){
  const opt={method,credentials:"include",cache:"no-store",headers:{"Accept":"application/json"}};
  if(body!==undefined){opt.headers["Content-Type"]="application/json";opt.body=JSON.stringify(body);}
  const response=await fetch(API+path,opt);
  let data;
  try{data=await response.json()}catch{throw Error("Servidor indisponível. Não foi possível validar a resposta.")}
  if(!response.ok||data.ok!==true)throw Error(data.error||"Falha ao consultar o sistema.");
  return data;
}
async function refresh(){
  if(busy)return;
  busy=true;
  const btn=$("rhReload");if(btn)btn.disabled=true;
  clearStatus();
  try{
    const data=await call("?month="+encodeURIComponent(month));
    state={employees:data.employees||[],entries:data.entries||[],commissions:data.commissions||[],totals:data.totals||{},monthlyVolume:data.monthlyVolume||null};
    if(!data.complete)status("O limite de registros foi atingido. Refine a consulta para obter todas as linhas.",true);
    if(page==="dashboard")renderDashboard();
    if(page==="table")renderTable();
    if(page==="employee")renderEmployeeForm();
    if(page==="entry")renderEntryForm();
    const tag=$("rhUser");if(tag&&window.__RH_SESSION)tag.textContent=window.__RH_SESSION.nome||window.__RH_SESSION.usuario||"Administração";
  }catch(err){status(err.message,true)}
  finally{busy=false;if(btn)btn.disabled=false}
}
const personOptions=()=>state.employees.filter(x=>x.active).map(x=>'<option value="'+html(x.id)+'">'+html(x.name)+" • "+html(x.branch)+"</option>").join("");
function entryRows(items,withActions=true){
  if(!items.length)return '<tr><td colspan="6" class="rh-empty">Nenhum vale registrado nesta competência.</td></tr>';
  return items.map(x=>'<tr><td>'+html(fmtDate(x.date))+'</td><td class="strong">'+html(x.employeeName)+'</td><td><span class="rh-pill '+(x.kind==="CUSTO"?"cost":"")+'">'+html(x.kind)+'</span></td><td>'+html(x.description)+'</td><td class="money strong">'+brl(x.amountCents)+'</td><td class="actions">'+(withActions?'<a class="rh-table-action" href="./funcionarios-lancamentos.html?id='+encodeURIComponent(x.id)+'&month='+month+'">Editar</a><button type="button" class="rh-table-action danger" data-delete-entry="'+html(x.id)+'">Excluir</button>':"")+'</td></tr>').join("");
}
function populateSelect(id,items,placeholder){
  const select=$(id);if(!select)return;
  const saved=select.value;
  select.innerHTML='<option value="">'+html(placeholder)+'</option>'+items.map(v=>'<option value="'+html(v)+'">'+html(v)+'</option>').join("");
  select.value=items.includes(saved)?saved:"";
}
function selectedEmployees(){
  const q=String($("rhSearch")?.value||"").trim().toLocaleLowerCase("pt-BR");
  const branch=$("rhBranch")?.value||"";
  const role=$("rhRole")?.value||"";
  const active=$("rhStatus")?.value||"";
  return state.employees.filter(e=>
    (!q||(e.name+" "+e.role+" "+e.branch).toLocaleLowerCase("pt-BR").includes(q))&&
    (!branch||e.branch===branch)&&(!role||e.role===role)&&
    (!active||(active==="active"?e.active:!e.active))
  );
}
function renderDashboard(){
 const t=state.totals;
 for(const [id,value] of [["rhKPeople",String(t.active||0)],["rhKSalary",brl(t.salaryCents)],
  ["rhKVales",brl(t.valesCents)],["rhKCommissions",brl(t.commissionsCents)],
  ["rhKPayable",brl((t.salaryCents||0)+(t.commissionsCents||0)-(t.valesCents||0))]]){
  if($(id))$(id).textContent=value;
 }
 if($("rhPeriodText"))$("rhPeriodText").textContent=month.slice(5)+"/"+month.slice(0,4);
 const fmt=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3});
 if($("rhMonthVolume"))$("rhMonthVolume").value=state.monthlyVolume
   ?fmt.format(state.monthlyVolume.tonnesMilli/1000):"";
 if($("rhVolumeStatus"))$("rhVolumeStatus").textContent=state.monthlyVolume
   ?"Aplicado: "+fmt.format(state.monthlyVolume.tonnesMilli/1000)+" toneladas • "+month.slice(5)+"/"+month.slice(0,4)
   :"Ainda não há volume mensal aplicado. Os lançamentos anteriores permanecem preservados.";
 if($("rhRecentBody"))$("rhRecentBody").innerHTML=entryRows(state.entries.filter(x=>x.kind==="VALE").slice(0,12));
 const select=$("rhDashboardBranch");
 if(select){
  const prev=select.value,branches=[...new Set(state.employees.map(x=>x.branch))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  select.innerHTML='<option value="">Todas as filiais</option>'+branches.map(b=>'<option value="'+html(b)+'">'+html(b)+'</option>').join("");
  select.value=branches.includes(prev)?prev:"";
 }
}
function totalCents(e,{vales=true,commission=true}={}){
 return Number(e.salaryCents||0)+(commission?Number(e.commissionsCents||0):0)-(vales?Number(e.valesCents||0):0);
}
const DOWNLOAD_VARIANTS={
 geral:{label:"Geral",vales:true,commission:true},
 sem_vales:{label:"Sem vales",vales:false,commission:true},
 sem_comissao:{label:"Sem comissão",vales:true,commission:false},
 sem_vales_comissao:{label:"Sem vale e comissão",vales:false,commission:false}
};
function updateDownloadTotals(){
 const people=selectedEmployees();
 for(const [mode,variant] of Object.entries(DOWNLOAD_VARIANTS)){
  const btn=document.querySelector('[data-rh-download="'+mode+'"]');
  if(btn)btn.textContent="↓ "+variant.label+" · "+brl(people.reduce((a,e)=>a+totalCents(e,variant),0));
 }
 if($("rhTableTotal"))$("rhTableTotal").textContent=brl(people.reduce((a,e)=>a+totalCents(e),0));
 if($("rhTableVolume"))$("rhTableVolume").textContent=state.monthlyVolume
  ?"Volume da competência: "+new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(state.monthlyVolume.tonnesMilli/1000)+" t"
  :"Volume mensal não informado: utilize o Painel para aplicar.";
}
function renderTable(){
 populateSelect("rhBranch",[...new Set(state.employees.map(x=>x.branch))].sort((a,b)=>a.localeCompare(b,"pt-BR")),"Todas as filiais");
 populateSelect("rhRole",[...new Set(state.employees.map(x=>x.role))].sort((a,b)=>a.localeCompare(b,"pt-BR")),"Todas as funções");
 const shown=selectedEmployees();
 if($("rhCountShown"))$("rhCountShown").textContent=shown.length+" funcionário(s) exibido(s)";
 const tbody=$("rhListBody");if(!tbody)return;
 tbody.innerHTML=shown.length?shown.map(e=>
   '<tr><td class="strong">'+html(e.name)+'</td><td>'+html(e.role)+'</td><td>'+html(e.branch)+'</td>'+
   '<td class="money">'+brl(e.salaryCents)+'</td><td class="money">'+brl(e.valesCents)+'</td>'+
   '<td class="money strong">'+brl(e.commissionsCents||0)+'</td>'+
   '<td class="money positive">'+brl(totalCents(e))+'</td>'+
   '<td><span class="rh-pill '+(e.active?"":"off")+'">'+(e.active?"ATIVO":"INATIVO")+'</span></td>'+
   '<td class="actions"><a class="rh-table-action" href="./funcionarios-cadastro.html?id='+encodeURIComponent(e.id)+'">Editar</a>'+
   '<a class="rh-table-action" href="./funcionarios-lancamentos.html?employee='+encodeURIComponent(e.id)+'&month='+month+'">Vale</a>'+
   '<a class="rh-table-action" href="./funcionarios-comissoes.html?employee='+encodeURIComponent(e.id)+'&month='+month+'">Comissão</a></td></tr>').join("")
  :'<tr><td colspan="9" class="rh-empty">Nenhum funcionário encontrado.</td></tr>';
 updateDownloadTotals();
}
const RH_COMMISSION_RATES={
  TON:[[5,"R$ 0,05/t"],[6,"R$ 0,06/t"],[7,"R$ 0,07/t"],[8,"R$ 0,08/t"],[9,"R$ 0,09/t"],[10,"R$ 0,10/t"],[15,"R$ 0,15/t"],[20,"R$ 0,20/t"]],
  PERCENT:[[10,"0,10%"],[15,"0,15%"],[20,"0,20%"],[25,"0,25%"],[100,"1,00%"],[150,"1,50%"]]
};
function updateCommissionSettings(){
  const kind=$("rhCommissionKind")?.value||"NONE",select=$("rhCommissionRate");
  if(!select)return;
  const previous=select.value;
  const options=RH_COMMISSION_RATES[kind]||[];
  select.replaceChildren(...options.map(([value,label])=>new Option(label,String(value))));
  if(options.some(([value])=>String(value)===previous))select.value=previous;
  if($("rhCommissionRateWrap"))$("rhCommissionRateWrap").hidden=!options.length;
  const hints={
    NONE:"Sem comissão. Você pode habilitar depois.",
    TON:"Calculada automaticamente a partir das toneladas lançadas.",
    PERCENT:"Calculada diretamente sobre as toneladas. Exemplo: 80.000 t × 1,5% = R$ 1.200,00.",
    MANUAL:"O valor será digitado na linha do funcionário na planilha de comissões.",
    AGENCIA:"Valor da agência definido na linha do funcionário na planilha de comissões."
  };
  if($("rhCommissionHint"))$("rhCommissionHint").textContent=hints[kind]||"";
}
function renderEmployeeForm(){
  const id=qp.get("id"),e=state.employees.find(x=>x.id===id);
  if(!id)return;
  if(!e){status("Funcionário não encontrado no cadastro.",true);return}
  if($("rhFormTitle"))$("rhFormTitle").textContent="Editar funcionário";
  $("rhName").value=e.name;$("rhRoleInput").value=e.role;
  $("rhBranchInput").value=e.branch;$("rhSalary").value=(e.salaryCents/100).toFixed(2).replace(".",",");
  $("rhNotes").value=e.notes||"";$("rhActive").checked=e.active;
  if($("rhCommissionKind")){
    $("rhCommissionKind").value=e.commissionKind||"NONE";
    updateCommissionSettings();
    $("rhCommissionRate").value=String(e.commissionRate||0);
  }
}
function renderEntryForm(){
  const select=$("rhEmployee");
  if(!select)return;
  const current=qp.get("employee")||select.value;
  select.innerHTML='<option value="">Selecione um funcionário</option>'+personOptions();
  if([...select.options].some(o=>o.value===current))select.value=current;
  const id=qp.get("id");
  if(!id)return;
  const e=state.entries.find(x=>x.id===id);
  if(!e){status("Lançamento não encontrado nesta competência. Confira o mês da consulta.",true);return}
  if($("rhFormTitle"))$("rhFormTitle").textContent="Editar vale / custo";
  if(![...select.options].some(o=>o.value===e.employeeId)){
    select.add(new Option(e.employeeName+" (inativo)",e.employeeId));
  }
  select.value=e.employeeId;select.disabled=true;
  $("rhType").value=e.kind;$("rhDescription").value=e.description;
  $("rhAmount").value=(e.amountCents/100).toFixed(2).replace(".",",");
  $("rhEntryDate").value=e.date;
}
async function saveEmployee(event){
  event.preventDefault();if(busy)return;
  const id=qp.get("id"),salary=moneyToCents($("rhSalary").value);
  if(salary===null)return status("Confira o salário. Exemplo: 4800,00.",true);
  const old=state.employees.find(e=>e.id===id);
  const body={name:$("rhName").value.trim(),role:$("rhRoleInput").value.trim(),city:old?.city||"",
    branch:$("rhBranchInput").value.trim(),salaryCents:salary,notes:$("rhNotes").value.trim(),
    active:$("rhActive").checked,
    commissionKind:$("rhCommissionKind")?.value||"NONE",
    commissionRate:Number($("rhCommissionRate")?.value||0)};
  if(!body.name||!body.role||!body.branch)return status("Preencha todos os campos obrigatórios.",true);
  const submit=$("rhSubmit");submit.disabled=true;
  try{
    await call(id?"/people/"+encodeURIComponent(id):"/people",id?"PUT":"POST",body);
    location.href="./funcionarios-tabela.html?month="+month;
  }catch(e){status(e.message,true);submit.disabled=false}
}
async function saveEntry(event){
  event.preventDefault();if(busy)return;
  const id=qp.get("id"),amount=moneyToCents($("rhAmount").value);
  if(amount===null||amount<=0)return status("Informe um valor maior que zero.",true);
  const body={employeeId:$("rhEmployee").value,kind:$("rhType").value,
    description:$("rhDescription").value.trim(),amountCents:amount,date:$("rhEntryDate").value};
  if(!body.employeeId||!body.description||!body.date)return status("Preencha os dados do lançamento.",true);
  const submit=$("rhSubmit");submit.disabled=true;
  try{
    await call(id?"/entries/"+encodeURIComponent(id):"/entries",id?"PUT":"POST",body);
    location.href="./funcionarios.html?month="+body.date.slice(0,7);
  }catch(e){status(e.message,true);submit.disabled=false}
}
async function deleteEntry(id){
  const item=state.entries.find(x=>x.id===id);if(!item)return;
  if(!confirm("Excluir o lançamento de "+item.employeeName+" ("+brl(item.amountCents)+")? A exclusão será registrada no histórico do banco."))return;
  try{await call("/entries/"+encodeURIComponent(id),"DELETE");await refresh();status("Lançamento excluído da listagem.",false)}
  catch(e){status(e.message,true)}
}
function downloadCSV(){
  const safe=v=>{
    let s=String(v??"");
    if(/^[=+\-@\t\r]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  const rows=[["Nome","Função","Cidade","Filial","Salário (R$)","Vales (R$)","Custos (R$)","Comissões (R$)","Saldo gerencial (R$)","Status"]];
  for(const e of selectedEmployees())rows.push([e.name,e.role,e.city,e.branch,(e.salaryCents/100).toFixed(2),(e.valesCents/100).toFixed(2),(e.costsCents/100).toFixed(2),((e.commissionsCents||0)/100).toFixed(2),((e.salaryCents+(e.commissionsCents||0)-e.valesCents)/100).toFixed(2),e.active?"Ativo":"Inativo"]);
  const csv="\uFEFF"+rows.map(r=>r.map(safe).join(";")).join("\r\n");
  const u=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=u;a.download="nova-frota-funcionarios-"+month+".csv";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function applyDashboardBranch(){
  const branch=$("rhDashboardBranch")?.value||"";
  const items=state.entries.filter(x=>!branch||state.employees.some(e=>e.id===x.employeeId&&e.branch===branch));
  const t=$("rhRecentBody");if(t)t.innerHTML=entryRows(items.slice(0,12));
}
async function init(){
  const sess=window.portalAuthReady?await window.portalAuthReady:null;
  if(!sess||!requireFeatureAuth("funcionarios"))return;
  if(sess.transportadoraId!=="nova-frota"||String(sess.perfil).toUpperCase()!=="ADMINISTRADOR"){
    location.replace("./home.html");return;
  }
  window.__RH_SESSION=sess;
  const tag=$("rhUser");if(tag)tag.textContent=sess.nome||sess.usuario;
  const monthInput=$("rhMonth");if(monthInput){monthInput.value=month;monthInput.addEventListener("change",()=>{if(!validMonth(monthInput.value))return;month=monthInput.value;qp.set("month",month);history.replaceState(null,"","?"+qp);refresh()})}
  const r=$("rhReload");if(r)r.addEventListener("click",refresh);
  const f=$("rhEmployeeForm");if(f)f.addEventListener("submit",saveEmployee);
  const ef=$("rhEntryForm");if(ef)ef.addEventListener("submit",saveEntry);
  if($("rhApplyMonthVolume"))$("rhApplyMonthVolume").addEventListener("click",applyMonthlyVolume);
  const kindInput=$("rhCommissionKind");if(kindInput){
    kindInput.addEventListener("change",updateCommissionSettings);
    updateCommissionSettings();
  }
  const date=$("rhEntryDate");if(date)date.value=localDate();
  for(const id of ["rhSearch","rhStatus"])if($(id))$(id).addEventListener(id==="rhSearch"?"input":"change",renderTable);
  for(const id of ["rhRole","rhBranch"])if($(id))$(id).addEventListener("change",renderTable);
  if($("rhDashboardBranch"))$("rhDashboardBranch").addEventListener("change",applyDashboardBranch);
  document.querySelectorAll("[data-rh-download]").forEach(b=>b.addEventListener("click",()=>downloadCSV(b.dataset.rhDownload)));
  document.addEventListener("click",ev=>{const button=ev.target.closest("[data-delete-entry]");if(button)deleteEntry(button.dataset.deleteEntry)});
  await refresh();
}
init().catch(e=>status(e.message,true));
})();
