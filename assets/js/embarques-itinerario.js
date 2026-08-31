/* embarques-itinerario.js | NOVA FROTA */
(function(){
"use strict";

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const safeUrl=v=>{const s=String(v??"").trim();return /^https?:\/\//i.test(s)?s:""};
let records=new Map();
let uploading=new Set();
let removing=new Set();

async function api(action,params={}){
  const session=window.portalAuthReady?await window.portalAuthReady:null;
  if(!session) throw new Error("Sessão inválida ou expirada.");
  if(!window.PortalAPI) throw new Error("API segura indisponível.");
  return window.PortalAPI.call("embarques",action,params);
}

function injectStyles(){
  if($("nfItineraryStyles")) return;
  const st=document.createElement("style");
  st.id="nfItineraryStyles";
  st.textContent=`
  .proof::before{content:"🖼️"!important;font-size:16px!important;line-height:1!important}
  .nf-itinerary-col{text-align:center!important;width:64px;min-width:64px}
  .nf-it-btn{width:31px;height:31px;display:inline-flex;align-items:center;justify-content:center;border-radius:7px;border:1px solid #a9c9f7;background:#eaf3ff;color:#1d4ed8;cursor:pointer;text-decoration:none;font-size:16px;position:relative}
  .nf-it-btn.has-file{border-color:#9fd8b5;background:#eaf8ef;color:#176b39}
  .nf-it-btn.busy{width:auto;min-width:84px;padding:0 8px;gap:6px;font-size:8px;font-weight:900;text-transform:uppercase;color:#1d4ed8}
  .nf-spin{width:13px;height:13px;border:2px solid #bfdbfe;border-top-color:#2563eb;border-radius:50%;animation:nfItSpin .7s linear infinite}
  @keyframes nfItSpin{to{transform:rotate(360deg)}}
  .nf-attach-manager{grid-column:1/-1;margin-top:4px;padding:12px;border:1px solid #d7e1ec;border-radius:10px;background:#f8fafc}
  .nf-attach-manager h4{margin:0 0 9px;font-size:9px;text-transform:uppercase;color:#52667d}
  .nf-attach-row{display:grid;grid-template-columns:150px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #e5ebf2;font-size:9px}
  .nf-attach-row:first-of-type{border-top:0}.nf-attach-label{font-weight:900;color:#17324f}.nf-attach-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#60758b}
  .nf-mini{height:28px;padding:0 9px;border:1px solid #cbd7e3;border-radius:7px;background:#fff;color:#17324f;font-size:8px;font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
  .nf-mini.danger{border-color:#f2b8bd;background:#fff2f3;color:#b4232f}.nf-mini:disabled{opacity:.55;cursor:not-allowed}
  .annexes{display:flex!important;align-items:center!important;gap:5px!important;min-width:68px}
  `;
  document.head.appendChild(st);
}

function itineraryInfo(r){
  return {
    nome:String(r?.itinerarioNome||""),
    url:String(r?.itinerarioUrl||""),
    id:String(r?.itinerarioId||"")
  };
}

function attachmentInfo(r,type){
  if(type==="itinerario") return itineraryInfo(r);
  if(type==="comprovante") return {
    nome:String(r?.comprovanteNome||""),
    url:String(r?.comprovanteUrl||""),
    id:String(r?.comprovanteId||"")
  };
  return {
    nome:String(r?.liberacaoNome||""),
    url:String(r?.liberacaoUrl||""),
    id:String(r?.liberacaoId||"")
  };
}

async function refreshData(){
  try{
    const res=await api("read",{resource:"registros"});
    const data=Array.isArray(res?.data)?res.data:[];
    records=new Map(data.map(r=>[String(r.id||""),r]));
    decorateTable();
    refreshAttachmentManager();
  }catch(e){console.warn("[EMBARQUES] Falha ao atualizar anexos",e)}
}

function ensureInput(){
  if($("quickItineraryInput")) return;
  const input=document.createElement("input");
  input.type="file";input.hidden=true;input.id="quickItineraryInput";
  input.accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
  input.onchange=async()=>{const file=input.files?.[0],id=input.dataset.id||"";input.value="";if(file&&id)await uploadItinerary(id,file)};
  document.body.appendChild(input);
}

async function filePayload(file){
  if(file.size>7*1024*1024) throw new Error("A imagem do itinerário excede 7 MB.");
  const base64=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result||"").split(",").pop());rd.onerror=()=>reject(new Error("Falha ao ler a imagem."));rd.readAsDataURL(file)});
  return {fileName:file.name||"itinerario.png",mimeType:file.type||"image/png",base64Data:base64};
}

function ensureHeader_DISABLED(){
  const tr=$("tbody")?.closest("table")?.querySelector("thead tr");if(!tr)return;
  if(tr.querySelector("th.nf-itinerary-col"))return;
  const roteiro=[...tr.children].find(x=>x.textContent.trim().toUpperCase()==="ROTEIRO");if(!roteiro)return;
  const th=document.createElement("th");th.className="nf-itinerary-col";th.textContent="Itinerário";roteiro.insertAdjacentElement("afterend",th);
}

function renderItCell(td,id){
  const r=records.get(String(id))||{},info=itineraryInfo(r),url=safeUrl(info.url);
  td.innerHTML="";
  if(uploading.has(String(id))){td.innerHTML='<span class="nf-it-btn busy"><i class="nf-spin"></i>Enviando</span>';return}
  if(removing.has(String(id)+":itinerario")){td.innerHTML='<span class="nf-it-btn busy"><i class="nf-spin"></i>Removendo</span>';return}
  if(url){td.innerHTML=`<a class="nf-it-btn has-file" href="${esc(url)}" target="_blank" rel="noopener" title="Abrir print do itinerário">🖼️</a>`;return}
  const b=document.createElement("button");b.type="button";b.className="nf-it-btn";b.title="Anexar print do itinerário";b.textContent="📎";b.onclick=()=>{const inp=$("quickItineraryInput");inp.dataset.id=String(id);inp.click()};td.appendChild(b);
}

function renderAnnexesCell(tr,id){
  const table=tr.closest("table"),r=records.get(String(id));
  if(!table||!r)return;
  const headers=[...table.querySelectorAll("thead th")];
  const idx=headers.findIndex(th=>th.textContent.trim().toUpperCase()==="ANEXOS");
  if(idx<0)return;
  const cell=tr.children[idx];if(!cell)return;
  const comp=attachmentInfo(r,"comprovante"),lib=attachmentInfo(r,"liberacao");
  const items=[];
  if(safeUrl(comp.url))items.push(`<a class="proof" href="${esc(comp.url)}" target="_blank" rel="noopener" title="${esc(comp.nome||"Comprovante de descarga")}">🖼️</a>`);
  if(safeUrl(lib.url))items.push(`<a class="proof release" href="${esc(lib.url)}" target="_blank" rel="noopener" title="${esc(lib.nome||"Liberação do frete/embarque")}">🖼️</a>`);
  cell.innerHTML=`<div class="annexes">${items.length?items.join(""):"-"}</div>`;
}

function decorateRows_DISABLED(){
  const body=$("tbody");if(!body)return;
  [...body.querySelectorAll("tr[data-id]")].forEach(tr=>{
    const id=tr.dataset.id||"";
    let td=tr.querySelector("td.nf-itinerary-col");
    if(!td){const cells=[...tr.children],roteiro=cells[8];if(!roteiro)return;td=document.createElement("td");td.className="nf-itinerary-col";roteiro.insertAdjacentElement("afterend",td)}
    renderItCell(td,id);
    renderAnnexesCell(tr,id);
  });
}
function decorateTable(){ refreshNativeItinerary() }


function refreshNativeItinerary(){
  const body=$("tbody"); if(!body) return;
  [...body.querySelectorAll("tr[data-id]")].forEach(tr=>{
    const id=tr.dataset.id||"", r=records.get(String(id))||{}, info=itineraryInfo(r);
    const cell=tr.querySelector("td.native-itinerary"); if(!cell) return;
    if(uploading.has(String(id))){ cell.innerHTML='<span class="nf-it-btn busy"><i class="nf-spin"></i>Enviando</span>'; return; }
    const url=safeUrl(info.url);
    if(url){ cell.innerHTML=`<a class="nf-it-btn has-file" href="${esc(url)}" target="_blank" rel="noopener" title="Abrir print do itinerário">🖼️</a>`; return; }
    cell.innerHTML=`<button type="button" class="nf-it-btn native-itinerary-upload" data-id="${esc(id)}" title="Anexar print do itinerário">📎</button>`;
    const b=cell.querySelector("button"); if(b)b.onclick=()=>{const inp=$("quickItineraryInput"); inp.dataset.id=String(id); inp.value=""; inp.click()};
  });
}

async function uploadItinerary(id,file){
  id=String(id);if(uploading.has(id))return;uploading.add(id);decorateTable();
  try{
    const fp=await filePayload(file);
    const res=await api("update",{resource:"itinerario",id,...fp});
    if(!res||res.ok===false)throw new Error(res?.error||"Falha ao salvar itinerário.");
    await refreshData();
  }catch(e){alert("Não foi possível anexar o itinerário.\n\n"+e.message)}
  finally{uploading.delete(id);await refreshData();decorateTable()}
}

async function removeAttachment(type,id){
  const labels={comprovante:"comprovante de descarga",liberacao:"liberação",itinerario:"itinerário"};
  if(!confirm(`Remover ${labels[type]}?`))return;
  const key=String(id)+":"+type;removing.add(key);decorateTable();refreshAttachmentManager();
  try{
    const res=await api("delete",{resource:type,id});
    if(!res||res.ok===false)throw new Error(res?.error||"Falha ao remover anexo.");
    await refreshData();
  }catch(e){alert("Não foi possível remover o anexo.\n\n"+e.message)}
  finally{removing.delete(key);await refreshData();decorateTable();refreshAttachmentManager()}
}

function ensureAttachmentManager(){
  const grid=$("modal")?.querySelector(".form-grid");if(!grid||$("nfAttachmentManager"))return;
  const box=document.createElement("div");box.id="nfAttachmentManager";box.className="nf-attach-manager";box.innerHTML='<h4>Anexos atuais</h4><div id="nfAttachmentRows"></div>';grid.appendChild(box);
}

function refreshAttachmentManager(){
  ensureAttachmentManager();const box=$("nfAttachmentManager"),rows=$("nfAttachmentRows"),id=$("mId")?.value||"";
  if(!box||!rows)return;if(!id){box.style.display="none";return}box.style.display="block";
  const r=records.get(String(id))||{};
  const defs=[["itinerario","Itinerário"],["comprovante","Comprovante"],["liberacao","Liberação"]];
  rows.innerHTML=defs.map(([type,label])=>{const f=attachmentInfo(r,type),url=safeUrl(f.url),busy=removing.has(String(id)+":"+type);return `<div class="nf-attach-row"><span class="nf-attach-label">${label}</span><span class="nf-attach-name">${esc(f.nome||(url?"Arquivo anexado":"Nenhum arquivo"))}</span>${url?`<a class="nf-mini" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a>`:'<span></span>'}${url?`<button type="button" class="nf-mini danger" data-remove-attach="${type}" ${busy?"disabled":""}>Remover</button>`:'<span></span>'}</div>`}).join("");
  rows.querySelectorAll("[data-remove-attach]").forEach(b=>b.onclick=()=>removeAttachment(b.dataset.removeAttach,id));
}

function bindModalManager(){
  document.addEventListener("click",e=>{if(e.target.closest(".iconbtn.edit"))setTimeout(refreshAttachmentManager,60)},true);
  const modal=$("modal");if(modal)new MutationObserver(()=>{if(modal.classList.contains("show"))setTimeout(refreshAttachmentManager,20)}).observe(modal,{attributes:true,attributeFilter:["class"]});
}

function observeTable(){const body=$("tbody");if(!body)return;new MutationObserver(()=>decorateTable()).observe(body,{childList:true})}

window.addEventListener("DOMContentLoaded",()=>{
  injectStyles();ensureInput();ensureAttachmentManager();bindModalManager();decorateTable();observeTable();
  setTimeout(refreshData,450);
});
})();
