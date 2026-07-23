/* calculo-piso.js | NOVA FROTA */
(function(){
"use strict";

const API_URL="https://script.google.com/macros/s/AKfycbzbRKO6O7RdN50TKkXGKWu8vyISGVBGVRnnx561Su2MnIzOINHeU1TqV86N7LS2C8o/exec";
const ADMIN_USER="LUZIANO";

/* PARÂMETROS FIXOS ANTT 6.084, DE 16/07/2026 */
const DATA=[
 {tipo:"9 Rodotrem",eixos:9,rkm:9.2231,custoCC:908.91,peso:49},
 {tipo:"9 Rodocaçamba",eixos:9,rkm:9.2231,custoCC:908.91,peso:47},
 {tipo:"8 eixos Graneleiro",eixos:8,rkm:8.0516,custoCC:820.34,peso:45},
 {tipo:"8 eixos Caçamba",eixos:8,rkm:8.0516,custoCC:820.34,peso:43},
 {tipo:"4 eixo Graneleiro",eixos:7,rkm:8.0516,custoCC:820.34,peso:39},
 {tipo:"4 eixo Caçamba",eixos:7,rkm:8.0516,custoCC:820.34,peso:37},
 {tipo:"7 Bitrem",eixos:7,rkm:8.0516,custoCC:820.34,peso:36},
 {tipo:"7 Biçamba",eixos:7,rkm:8.0516,custoCC:820.34,peso:35},
 {tipo:"6 LS Graneleiro",eixos:6,rkm:7.3841,custoCC:680.01,peso:31},
 {tipo:"6 LS Caçamba",eixos:6,rkm:7.3841,custoCC:680.01,peso:29},
 {tipo:"5 LS Graneleiro",eixos:5,rkm:6.6983,custoCC:664.83,peso:26},
 {tipo:"5 LS TOCO Caçamba",eixos:5,rkm:6.6983,custoCC:664.83,peso:25},
 {tipo:"3 Truck Graneleiro",eixos:3,rkm:5.1355,custoCC:552.24,peso:14}
];

const $=id=>document.getElementById(id);
let pesos={},selected=0,chart=null;

function txt(v){return String(v??"").trim()}
function up(v){return txt(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function num(v){
 if(typeof v==="number") return Number.isFinite(v)?v:0;
 let s=txt(v).replace(/\s+/g,"").replace(/[^\d,.-]/g,"");
 if(s.includes(",")) s=s.replace(/\./g,"").replace(",",".");
 const n=Number(s); return Number.isFinite(n)?n:0;
}
function money(v){return num(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function dec(v,d=2){return num(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d})}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function user(){
 try{if(typeof getUser==="function"&&getUser())return up(getUser())}catch(e){}
 return up(localStorage.getItem("nf_auth_user")||"LUZIANO");
}
function role(){return up(localStorage.getItem("nf_auth_profile")||"ADMINISTRADOR")}
function pesoKey(){return `piso_${user()||"DEFAULT"}_pesos_custom_v2`}
function loadPesos(){try{return JSON.parse(localStorage.getItem(pesoKey())||"{}")}catch(e){return {}}}
function savePesos(){localStorage.setItem(pesoKey(),JSON.stringify(pesos))}
function getPeso(r){const v=num(pesos[r.tipo]);return v>0?v:r.peso}
function inputs(){return {km:num($("km")?.value),ped:num($("pedagio")?.value),m:num($("margem")?.value)/100,i:num($("icms")?.value)/100}}
function calc(r){
 const x=inputs(),peso=getPeso(r);
 const motorista=Math.ceil(((r.rkm*x.km)+r.custoCC+(x.ped*r.eixos))/peso);
 const den=(1-x.m)*(1-x.i);
 return {motorista,empresa:den>0?motorista/den:NaN,peso};
}

function fillTipos(){
 $("tipo").innerHTML=DATA.map((r,i)=>`<option value="${i}">${esc(r.tipo)}</option>`).join("");
 $("tipo").value=String(selected);
}
function renderPesos(){
 const w=$("tblPesos"); w.innerHTML="";
 DATA.forEach((r,i)=>{
  const d=document.createElement("div"); d.className="weightRow";
  d.innerHTML=`<span>${esc(r.tipo)}</span><input class="pesoInput" data-i="${i}" type="number" min=".01" step=".01" value="${getPeso(r)}">`;
  d.querySelector("input").addEventListener("change",e=>{
   const v=num(e.target.value); if(v>0)pesos[r.tipo]=v;else delete pesos[r.tipo];
   savePesos(); renderAll();
  });
  w.appendChild(d);
 });
}
function renderTable(){
 const b=$("tblFretes"); b.innerHTML="";
 DATA.forEach((r,i)=>{
  const c=calc(r),tr=document.createElement("tr");
  if(i===selected)tr.classList.add("active");
  tr.innerHTML=`<td>${esc(r.tipo)}</td><td class="num motorValue">${money(c.motorista)}</td><td class="num companyValue">${Number.isFinite(c.empresa)?money(c.empresa):"Erro"}</td><td class="num">${r.eixos}</td><td class="num">${dec(c.peso)}</td>`;
  tr.onclick=()=>{selected=i;$("tipo").value=String(i);renderAll()};
  b.appendChild(tr);
 });
}
function renderSelected(){
 const r=DATA[selected],c=calc(r);
 $("eixos").value=r.eixos;
 $("pesoSelecionado").value=dec(c.peso);
 $("outMotorista").textContent=money(c.motorista);
 $("outEmpresa").textContent=Number.isFinite(c.empresa)?money(c.empresa):"Erro";
}
function renderMap(){
 const o=txt($("origemRota").value),d=txt($("destinoRota").value),km=num($("km").value);
 $("mapKm").textContent=`${dec(km,0)} km`;
 $("routeDistance").textContent=`📍 KM manual: ${dec(km,0)} km`;
 if(!o||!d){
  $("routeTitle").textContent="Informe origem e destino";
  $("mapStatus").textContent="Aguardando rota";
  $("mapIframe").removeAttribute("src"); return;
 }
 $("routeTitle").textContent=`${o} → ${d}`;
 $("mapStatus").textContent="Rota carregada";
 $("mapIframe").src=`https://www.google.com/maps?q=${encodeURIComponent(o+" para "+d)}&output=embed`;
}
function renderAll(){renderSelected();renderTable();renderMap()}

function jsonp(params,timeout=35000){
 return new Promise((resolve,reject)=>{
  const cb=`nf_${Date.now()}_${Math.random().toString(36).slice(2)}`,s=document.createElement("script"),u=new URL(API_URL);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  u.searchParams.set("callback",cb);u.searchParams.set("_",Date.now());
  const t=setTimeout(()=>{clean();reject(new Error("Timeout"))},timeout);
  function clean(){clearTimeout(t);try{delete window[cb]}catch(e){}s.remove()}
  window[cb]=r=>{clean();resolve(r)};
  s.onerror=()=>{clean();reject(new Error("Erro de comunicação"))};
  s.src=u.toString();document.head.appendChild(s);
 });
}
function normPlace(v){return up(v).replace(/\bBRASIL\b/g,"").replace(/\s+/g," ").trim()}
function routeMatch(r,o,d){
 const ro=normPlace(r.origem),rd=normPlace(r.destino);
 return ro&&rd&&((ro===o&&rd===d)||(ro.includes(o)&&rd.includes(d))||(o.includes(ro)&&d.includes(rd)));
}
function dateVal(r){
 const v=r.dataHora||r.ultimaAlteracao||r.dataReferencia||r.updatedAt||r.createdAt;
 if(typeof v==="number")return v;
 const m=txt(v).match(/(\d{2})\/(\d{2})\/(\d{4})/);
 if(m)return new Date(+m[3],+m[2]-1,+m[1]).getTime();
 return Date.parse(v)||0;
}
function avg(a){const v=a.filter(x=>x>0);return v.length?v.reduce((x,y)=>x+y,0)/v.length:0}
function renderHistory(rows){
 const emp=rows.map(r=>num(r.valorEmpresa)).filter(v=>v>0),mot=rows.map(r=>num(r.valorMotorista)).filter(v=>v>0),all=[...emp,...mot];
 $("histEmpresaAvg").textContent=money(avg(emp));$("histMotorAvg").textContent=money(avg(mot));
 $("histMax").textContent=money(all.length?Math.max(...all):0);$("histMin").textContent=money(all.length?Math.min(...all):0);
 $("historyTable").innerHTML=rows.length?rows.slice(0,60).map(r=>`<tr><td>${new Date(dateVal(r)).toLocaleDateString("pt-BR")}</td><td class="num companyValue">${money(r.valorEmpresa)}</td><td class="num motorValue">${money(r.valorMotorista)}</td><td>${esc(r.cliente||"-")}</td></tr>`).join(""):`<tr><td colspan="4" class="empty">Nenhum frete encontrado para esta rota.</td></tr>`;
 const cm=new Map();rows.forEach(r=>cm.set(up(r.cliente)||"SEM CLIENTE",(cm.get(up(r.cliente)||"SEM CLIENTE")||0)+1));
 $("topClients").innerHTML=cm.size?[...cm].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,n])=>`<div class="clientRow"><span>${esc(c)}</span><strong>${n} frete(s)</strong></div>`).join(""):`<div class="empty">Sem dados</div>`;
 $("histCount").textContent=rows.length;$("histClients").textContent=cm.size;
 $("histKmAvg").textContent=`${dec(avg(rows.map(r=>num(r.km)).filter(v=>v>0)),0)} km`;
 $("histTollPct").textContent=rows.length?`${dec(rows.filter(r=>num(r.pedagioEixo)>0).length/rows.length*100,0)}%`:"0%";
 renderChart(rows);
}
function renderChart(rows){
 const ordered=[...rows].sort((a,b)=>dateVal(a)-dateVal(b)).slice(-20),vals=ordered.map(r=>num(r.valorEmpresa));
 const first=vals.find(v=>v>0)||0,last=[...vals].reverse().find(v=>v>0)||0,tr=first?((last-first)/first)*100:0;
 $("trendValue").textContent=`${tr>=0?"+":""}${dec(tr,1)}%`;
 if(chart)chart.destroy();
 chart=new Chart($("trendChart"),{type:"line",data:{labels:ordered.map(r=>new Date(dateVal(r)).toLocaleDateString("pt-BR")),datasets:[{data:vals,label:"Frete Empresa",tension:.28,borderWidth:2,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{ticks:{display:false},grid:{display:false}},y:{ticks:{callback:v=>`R$ ${v}`}}}}});
}
async function loadHistory(){
 const o=normPlace($("origemRota").value),d=normPlace($("destinoRota").value);
 if(!o||!d){$("historyStatus").textContent="Aguardando rota";renderHistory([]);return}
 $("historyStatus").textContent="Consultando B.I...";
 try{
  const res=await jsonp({action:"historico_fretes_list"});
  if(!res||res.ok===false)throw new Error(res?.error||"Falha na API");
  let rows=Array.isArray(res.data)?res.data:[];
  rows=rows.filter(r=>routeMatch(r,o,d)).sort((a,b)=>dateVal(b)-dateVal(a));
  renderHistory(rows);$("historyStatus").textContent=rows.length?`${rows.length} registros encontrados`:"Nenhum histórico para esta rota";
 }catch(e){console.error(e);renderHistory([]);$("historyStatus").textContent="Falha ao consultar B.I."}
}

function quote(){
 const r=DATA[selected],c=calc(r),x=inputs();
 return `🚛 NOVA FROTA\nCOTAÇÃO DE FRETE\n\nROTA: ${txt($("origemRota").value)||"-"} → ${txt($("destinoRota").value)||"-"}\nVEÍCULO: ${r.tipo}\nEIXOS: ${r.eixos}\nKM: ${dec(x.km,1)}\nPEDÁGIO/EIXO: ${money(x.ped)}\nPESO: ${dec(c.peso)} t\n\nFRETE MOTORISTA: ${money(c.motorista)}\nFRETE EMPRESA: ${money(c.empresa)}`;
}
async function copyQuote(){try{await navigator.clipboard.writeText(quote())}catch(e){}alert("Cotação copiada.")}
function saveQuote(){const k=`nf_piso_cotacoes_${user()}`,a=JSON.parse(localStorage.getItem(k)||"[]");a.unshift({data:new Date().toISOString(),texto:quote()});localStorage.setItem(k,JSON.stringify(a.slice(0,100)));alert("Cotação salva.")}
function whatsapp(){window.open(`https://wa.me/?text=${encodeURIComponent(quote())}`,"_blank")}
function openMaps(){const o=txt($("origemRota").value),d=txt($("destinoRota").value);if(!o||!d)return alert("Informe origem e destino.");window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}`,"_blank")}
function exportCSV(){
 const h=["Tipo","Eixos","R$/KM","Custo CC","Peso","Motorista","Empresa"],rows=DATA.map(r=>{const c=calc(r);return [r.tipo,r.eixos,dec(r.rkm,4),dec(r.custoCC),dec(c.peso),dec(c.motorista),dec(c.empresa)]});
 const csv=[h,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\n");
 const u=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=u;a.download="calculo-piso.csv";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
async function exportJPG(){const c=await html2canvas($("app"),{scale:2,useCORS:true,backgroundColor:"#06101f"}),a=document.createElement("a");a.href=c.toDataURL("image/jpeg",.94);a.download="calculo-piso.jpg";a.click()}
function resetMine(){pesos={};localStorage.removeItem(pesoKey());renderPesos();renderAll()}
function resetAll(){if(user()!==ADMIN_USER&&!role().includes("ADMIN"))return alert("Apenas administrador.");for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.includes("pesos_custom"))localStorage.removeItem(k)}resetMine()}
function debounce(fn,ms=600){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}

function init(){
 try{if(typeof requirePisoAuth==="function")requirePisoAuth();else if(typeof requireHomeAuth==="function")requireHomeAuth()}catch(e){}
 $("userName").textContent=user();$("userRole").textContent=role();
 pesos=loadPesos();fillTipos();renderPesos();renderAll();renderHistory([]);
 $("tipo").onchange=()=>{selected=+$("tipo").value||0;renderAll()};
 ["km","pedagio","margem","icms"].forEach(id=>$(id).oninput=renderAll);
 const route=debounce(()=>{renderMap();loadHistory()});
 $("origemRota").oninput=route;$("destinoRota").oninput=route;
 $("btnCalc").onclick=()=>{renderAll();loadHistory()};
 $("btnOpenMaps").onclick=openMaps;$("btnCopy").onclick=copyQuote;$("btnSave").onclick=saveQuote;
 $("btnPublish").onclick=()=>location.href="./fretes.html";$("btnWhatsApp").onclick=whatsapp;
 $("btnExportCSV").onclick=exportCSV;$("btnExportJPG").onclick=exportJPG;
 $("btnHome").onclick=()=>location.href="./home.html";
 $("btnLogout").onclick=()=>{try{if(typeof logoutAll==="function")return logoutAll()}catch(e){}location.href="../pages/login.html"};
 $("btnAdmin").onclick=()=>$("adminModal").classList.add("show");
 $("btnAdminClose").onclick=()=>$("adminModal").classList.remove("show");
 $("btnResetPesos").onclick=resetMine;$("btnResetAllPesos").onclick=resetAll;
}
window.addEventListener("DOMContentLoaded",init);
})();
