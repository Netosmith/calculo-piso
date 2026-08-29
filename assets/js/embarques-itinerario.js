/* embarques-itinerario.js | NOVA FROTA
   Itinerário separado dos anexos gerais:
   - 📎 enquanto não houver print
   - 🖼️ quando houver print
   - a coluna ANEXOS continua reservada somente para comprovante e liberação
*/
(function(){
"use strict";

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const safeUrl=v=>{const s=String(v??"").trim();return /^https?:\/\//i.test(s)?s:""};
let itineraryById=new Map();
let busy=false;

async function api(action,params={}){
  const session=window.portalAuthReady?await window.portalAuthReady:null;
  if(!session) throw new Error("Sessão inválida ou expirada.");
  if(!window.PortalAPI) throw new Error("API segura indisponível.");
  return window.PortalAPI.call("embarques",action,params);
}

function injectStyles(){
  if(document.getElementById("nfItineraryStyles")) return;
  const st=document.createElement("style");
  st.id="nfItineraryStyles";
  st.textContent=`
    .proof::before{content:"🖼️"!important;font-size:16px!important;line-height:1!important}
    .itinerary-view,.itinerary-upload{width:29px;height:29px;display:inline-flex;align-items:center;justify-content:center;border-radius:7px;text-decoration:none;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;font-size:16px;line-height:1}
    .itinerary-view{border:1px solid #9fd8b5;background:#eaf8ef;color:#176b39}
    .itinerary-upload{border:1px solid #a9c9f7;background:#eaf3ff;color:#1d4ed8}
    .itinerary-view:hover,.itinerary-upload:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(15,35,63,.10)}
    th.nf-itinerary-col,td.nf-itinerary-col{text-align:center;width:58px;min-width:58px}
  `;
  document.head.appendChild(st);
}

function ensureFileInput(){
  if(document.getElementById("quickItineraryInput")) return;
  const input=document.createElement("input");
  input.type="file";
  input.id="quickItineraryInput";
  input.accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
  input.hidden=true;
  input.addEventListener("change",async()=>{
    const file=input.files?.[0];
    const id=input.dataset.id||"";
    input.value="";
    if(!file||!id) return;
    await uploadItinerary(id,file);
  });
  document.body.appendChild(input);
}

async function filePayload(file){
  if(file.size>7*1024*1024) throw new Error("A imagem do itinerário excede 7 MB.");
  const base64=await new Promise((resolve,reject)=>{
    const rd=new FileReader();
    rd.onload=()=>resolve(String(rd.result||"").split(",").pop());
    rd.onerror=()=>reject(new Error("Falha ao ler a imagem do itinerário."));
    rd.readAsDataURL(file);
  });
  const original=String(file.name||"itinerario.png").replace(/^ITINERARIO_/i,"");
  return {fileName:"ITINERARIO_"+original,mimeType:file.type||"image/png",base64Data:base64};
}

function isItineraryRecord(r){
  const explicit=safeUrl(r.itinerarioUrl);
  if(explicit) return {url:explicit,nome:String(r.itinerarioNome||""),fileId:String(r.itinerarioId||""),legacy:false};

  /* Compatibilidade: a primeira versão podia cair no slot de comprovante.
     A partir desta correção, uploads de itinerário recebem prefixo ITINERARIO_. */
  const comprovanteNome=String(r.comprovanteNome||"");
  if(/^ITINERARIO_/i.test(comprovanteNome) && safeUrl(r.comprovanteUrl)){
    return {url:safeUrl(r.comprovanteUrl),nome:comprovanteNome,fileId:String(r.comprovanteId||""),legacy:true};
  }
  return {url:"",nome:"",fileId:"",legacy:false};
}

async function loadItineraries(){
  try{
    const res=await api("read",{resource:"registros"});
    const data=Array.isArray(res?.data)?res.data:[];
    itineraryById=new Map(data.map(r=>[String(r.id||""),isItineraryRecord(r)]));
    decorateTable();
  }catch(error){
    console.warn("[EMBARQUES] Não foi possível carregar os itinerários:",error);
  }
}

async function uploadItinerary(id,file){
  if(busy) return;
  busy=true;
  try{
    const fp=await filePayload(file);
    const res=await api("update",{resource:"itinerario",id,...fp});
    if(!res||res.ok===false) throw new Error(res?.error||"Falha ao salvar o itinerário.");
    await loadItineraries();
    alert("Itinerário anexado com sucesso.");
  }catch(error){
    console.error("[EMBARQUES] upload itinerário:",error);
    alert("Não foi possível anexar o itinerário.\n\n"+error.message);
  }finally{
    busy=false;
  }
}

function ensureHeader(){
  const table=document.getElementById("tbody")?.closest("table");
  const tr=table?.querySelector("thead tr");
  if(!tr||tr.querySelector(".nf-itinerary-col")) return;
  const headers=[...tr.children];
  const roteiro=headers.find(th=>th.textContent.trim().toUpperCase()==="ROTEIRO");
  if(!roteiro) return;
  const th=document.createElement("th");
  th.className="nf-itinerary-col";
  th.textContent="Itinerário";
  roteiro.insertAdjacentElement("afterend",th);
}

function itineraryCell(id){
  const info=itineraryById.get(String(id))||{};
  const url=safeUrl(info.url);
  const td=document.createElement("td");
  td.className="nf-itinerary-col";
  if(url){
    td.innerHTML=`<a class="itinerary-view" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Abrir print do itinerário">🖼️</a>`;
  }else{
    td.innerHTML=`<button type="button" class="itinerary-upload" data-id="${esc(id)}" title="Anexar print do itinerário">📎</button>`;
    td.querySelector("button").onclick=()=>{
      const input=document.getElementById("quickItineraryInput");
      input.dataset.id=String(id);
      input.click();
    };
  }
  return td;
}

function cleanAnnexCell(tr,id){
  const info=itineraryById.get(String(id))||{};
  if(!info.legacy) return;
  const cells=[...tr.children];
  /* Depois da inclusão dinâmica do ITINERÁRIO, ANEXOS fica na penúltima coluna. */
  const annexCell=cells[cells.length-2];
  if(!annexCell) return;
  const links=[...annexCell.querySelectorAll("a.proof")];
  links.forEach(a=>{
    if(safeUrl(a.href)===safeUrl(info.url)) a.remove();
  });
  const box=annexCell.querySelector(".annexes");
  if(box && !box.querySelector("a.proof")) box.textContent="-";
}

function decorateRows(){
  const body=document.getElementById("tbody");
  if(!body) return;
  [...body.querySelectorAll("tr[data-id]")].forEach(tr=>{
    const id=tr.dataset.id||"";
    if(!tr.querySelector("td.nf-itinerary-col")){
      const cells=[...tr.children];
      const roteiroCell=cells[8];
      if(roteiroCell) roteiroCell.insertAdjacentElement("afterend",itineraryCell(id));
    }else{
      const old=tr.querySelector("td.nf-itinerary-col");
      const fresh=itineraryCell(id);
      old.replaceWith(fresh);
    }
    cleanAnnexCell(tr,id);
  });
}

function decorateTable(){
  ensureHeader();
  decorateRows();
}

function observeTable(){
  const body=document.getElementById("tbody");
  if(!body) return;
  const observer=new MutationObserver(()=>decorateTable());
  observer.observe(body,{childList:true,subtree:false});
}

window.addEventListener("DOMContentLoaded",()=>{
  injectStyles();
  ensureFileInput();
  decorateTable();
  observeTable();
  setTimeout(loadItineraries,500);
  setInterval(()=>{if(!busy)loadItineraries()},30000);
});
})();
