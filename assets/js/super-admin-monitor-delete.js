/* Gestão exclusiva de exclusões do Monitoramento Nova Frota.
   Todas as permissões são verificadas novamente pelo servidor. */
(()=>{
"use strict";
const API="https://api.portalfrete.net.br";
const ROOT="/v1/super-admin/monitor/viagens";
const el=id=>document.getElementById(id);
const checked=new Map();
let rows=[],offset=0,hasMore=false,loading=false,processing=false;
let searchVersion=0;
const make=(tag,text,cls)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=String(text);
  if(cls)node.className=cls;
  return node;
};
const isVisible=()=>!el("monitorDeleteTab")?.hidden&&!el("monitorDelete")?.hidden;
const allowed=()=>window.superAdminCanDeleteMonitor===true;
function status(text,bad=false){
  const node=el("monitorDeleteStatus");
  node.textContent=text;
  node.style.color=bad?"#ffc2bd":"#bbd8ed";
}
async function request(path,options={}){
  const response=await fetch(API+path,{
    credentials:"include",cache:"no-store",...options,
    headers:{"Accept":"application/json",...(options.headers||{})}
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ok===false)
    throw Error(payload?.error||"Falha na operação administrativa ("+response.status+").");
  return payload;
}
function updateControls(){
  el("monitorDeleteCount").textContent=checked.size+" selecionada(s)";
  const valid=checked.size>0&&checked.size<=10&&
    el("monitorDeleteReason").value.trim().length>=12&&
    el("monitorDeletePhrase").value.trim()==="EXCLUIR"&&
    el("monitorDeleteBackup").checked&&allowed()&&!processing;
  el("monitorDeleteAction").disabled=!valid;
  el("monitorDeleteAction").textContent=checked.size>1?
    "EXCLUIR "+checked.size+" VIAGENS SELECIONADAS":"EXCLUIR VIAGEM SELECIONADA";
}
function drawRows(){
  const root=el("monitorDeleteList");root.replaceChildren();
  if(!rows.length){root.append(make("p","Nenhuma viagem encontrada para os filtros.", "muted"));}
  for(const trip of rows){
    const label=make("label",null,"monitor-delete-row");
    const checkbox=document.createElement("input");
    checkbox.type="checkbox";checkbox.checked=checked.has(trip.id);
    checkbox.disabled=!allowed()||(!checkbox.checked&&checked.size>=10);
    checkbox.setAttribute("aria-label","Selecionar viagem "+trip.plate);
    checkbox.addEventListener("change",()=>{
      if(checkbox.checked){
        if(checked.size>=10){checkbox.checked=false;status("Selecione no máximo 10 viagens por exclusão.",true);return;}
        checked.set(trip.id,trip);
      }else checked.delete(trip.id);
      updateControls();drawRows();
    });
    const detail=make("span");
    detail.append(make("strong",trip.plate+" · "+trip.driver));
    detail.append(make("small",(trip.branch||"Sem filial")+" · "+(trip.origin||"Origem não informada")+
      " → "+(trip.destination||"Destino não informado")));
    detail.append(make("small",(trip.active?"● ATIVA":"● ENCERRADA")+
      " · Criada: "+new Date(trip.createdAt).toLocaleString("pt-BR")+
      (trip.nf?" · NF: "+trip.nf:"")+(trip.cte?" · CT-e: "+trip.cte:"")));
    label.append(checkbox,detail);root.append(label);
  }
  el("monitorDeleteMore").hidden=!hasMore;
  updateControls();
}
function selectedCompanyIsNova(){
  const tab=el("monitorDeleteTab");
  return Boolean(tab&&!tab.hidden);
}
async function loadTrips(next=false){
  if(loading||!selectedCompanyIsNova())return;
  loading=true;
  const button=el("monitorDeleteReload");button.disabled=true;
  const current=++searchVersion;
  if(!next){rows=[];offset=0;hasMore=false;el("monitorDeleteList").textContent="Consultando viagens...";}
  const q=el("monitorDeleteSearch").value.trim();
  const params=new URLSearchParams({q,status:el("monitorDeleteFilter").value,offset:String(offset)});
  try{
    const data=await request(ROOT+"?"+params);
    if(current!==searchVersion||!selectedCompanyIsNova())return;
    const additions=Array.isArray(data.trips)?data.trips:[];
    rows=next?[...rows,...additions]:additions;
    offset=data.nextOffset===null?offset:data.nextOffset;
    hasMore=Number.isInteger(data.nextOffset);
    drawRows();
    status(rows.length+" viagem(ns) exibidas. Selecione até 10 para excluir. Nenhuma exclusão foi executada.");
  }catch(e){
    el("monitorDeleteList").textContent=e.message;
    status("Não foi possível carregar as viagens: "+e.message,true);
  }finally{loading=false;button.disabled=false;}
}
async function loadAudit(){
  const root=el("monitorDeleteAudit");root.replaceChildren();
  if(!selectedCompanyIsNova())return;
  root.textContent="Consultando auditoria...";
  try{
    const data=await request(ROOT+"/auditoria");
    root.replaceChildren();
    if(!data.audits?.length){root.append(make("p","Nenhuma viagem foi excluída até o momento.","muted"));return;}
    for(const entry of data.audits){
      const card=make("article");
      card.append(make("strong",entry.plate+" · "+entry.driver));
      card.append(make("small","Excluída em "+new Date(entry.deletedAt).toLocaleString("pt-BR")+
        " · Por: "+entry.actor+" · "+(entry.activeAtDeletion?"Estava ativa":"Estava encerrada")));
      card.append(make("small","Motivo: "+entry.reason));
      card.append(make("small","Posições arquivadas: "+entry.positionsCount));
      const btn=make("button","Baixar backup JSON","ghost");
      btn.type="button";btn.style.marginTop="10px";
      btn.onclick=()=>downloadBackup(entry.id,entry.plate,btn);
      card.append(btn);root.append(card);
    }
  }catch(e){root.textContent="Falha na auditoria: "+e.message;}
}
async function downloadBackup(auditId,plate,button){
  button.disabled=true;
  try{
    const response=await fetch(API+ROOT+"/auditoria/"+encodeURIComponent(auditId)+"/backup",{
      credentials:"include",cache:"no-store"
    });
    if(!response.ok)throw Error("Backup indisponível ("+response.status+").");
    const blob=await response.blob(),url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="viagem-"+plate+"-backup.json";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
    status("Backup privado da viagem "+plate+" baixado para conferência.");
  }catch(e){status(e.message,true);}
  finally{button.disabled=false;}
}
async function deleteSelected(){
  if(!allowed()||processing)return;
  updateControls();
  if(el("monitorDeleteAction").disabled)return;
  const list=[...checked.values()];
  const active=list.filter(x=>x.active);
  const labels=list.map(x=>x.plate+" ("+x.driver+")").join("\n");
  const extra=active.length?
    "\nATENÇÃO: "+active.length+" viagem(ns) ainda estão ATIVAS; seus links serão invalidados.":"";
  if(!confirm("Você está prestes a EXCLUIR "+list.length+
    " viagem(ns) da operação Nova Frota.\n\n"+labels+extra+
    "\n\nBackups privados e auditoria serão preservados.\nConfirma esta ação?"))return;
  processing=true;updateControls();
  try{
    const data=await request(ROOT+"/excluir",{
      method:"POST",
      headers:{"Content-Type":"application/json","X-Portal-Super-Admin-Action":"owner-panel"},
      body:JSON.stringify({
        tripIds:list.map(x=>x.id),confirmation:"EXCLUIR",
        backupAcknowledged:true,reason:el("monitorDeleteReason").value.trim()
      })
    });
    const successes=Array.isArray(data.deleted)?data.deleted:[];
    for(const item of successes)checked.delete(item.id);
    el("monitorDeletePhrase").value="";
    el("monitorDeleteBackup").checked=false;
    if(successes.length)el("monitorDeleteReason").value="";
    const warning=successes.filter(x=>x.warning).length;
    await loadTrips(false);await loadAudit();
    status(successes.length+" viagem(ns) removidas e arquivadas. "+
      (warning?"Aviso: verifique a limpeza dos arquivos originais. ":"")+
      (data.partial?"Operação parcial: "+(data.failed?.message||"verifique a auditoria."):""),
      Boolean(data.partial||warning));
  }catch(e){status("Nenhuma exclusão confirmada nesta tela: "+e.message,true);}
  finally{processing=false;updateControls();}
}
let timer=null;
function init(){
  if(!el("monitorDeleteTab"))return;
  el("monitorDeleteReload").onclick=()=>loadTrips(false);
  el("monitorDeleteSearchButton").onclick=()=>loadTrips(false);
  el("monitorDeleteSearch").oninput=()=>{
    clearTimeout(timer);timer=setTimeout(()=>loadTrips(false),450);
  };
  el("monitorDeleteFilter").onchange=()=>loadTrips(false);
  el("monitorDeleteMore").onclick=()=>loadTrips(true);
  el("monitorDeleteClear").onclick=()=>{checked.clear();drawRows();};
  el("monitorDeleteSelectPage").onclick=()=>{
    for(const item of rows){if(checked.size>=10)break;checked.set(item.id,item);}
    drawRows();
  };
  for(const id of ["monitorDeleteReason","monitorDeletePhrase","monitorDeleteBackup"])
    el(id).addEventListener(id==="monitorDeleteBackup"?"change":"input",updateControls);
  el("monitorDeleteAction").onclick=deleteSelected;
  el("monitorDeleteAuditRefresh").onclick=loadAudit;
  window.addEventListener("superadmin-monitor-open",()=>{
    checked.clear();updateControls();
    if(allowed()){loadTrips(false);loadAudit();}
    else status("Exclusão indisponível. É necessário habilitar a autorização segura do Super Admin.",true);
  });
  window.addEventListener("superadmin-monitor-company",e=>{
    if(e.detail?.tenantId!=="nova-frota"){
      checked.clear();rows=[];offset=0;hasMore=false;
      el("monitorDeleteList").textContent="Selecione a Nova Frota para gerenciar suas viagens.";
      updateControls();
    }
  });
  updateControls();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
else init();
})();
