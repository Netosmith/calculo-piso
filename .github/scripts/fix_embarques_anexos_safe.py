from pathlib import Path
import re

js_path = Path('assets/js/embarques.js')
html_path = Path('pages/embarques.html')
js = js_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')

# Estado visual por tipo de upload
if 'const uploadingByType=' not in js:
    js = js.replace(
        'let rows=[],filtered=[],page=1,shareView="cliente",freteMotoristaOculto=false,quickProofId="",quickReleaseId="",quickItineraryId="";',
        'let rows=[],filtered=[],page=1,shareView="cliente",freteMotoristaOculto=false,quickProofId="",quickReleaseId="",quickItineraryId="";\nconst uploadingByType={itinerario:new Set(),comprovante:new Set(),liberacao:new Set()};'
    )

helper = r'''
function uploadChip(){return `<span class="nf-upload-chip"><i class="nf-upload-spin"></i>Enviando</span>`}
function isUploading(type,id){return !!uploadingByType[type]?.has(String(id))}
'''.strip()
if 'function uploadChip()' not in js:
    marker = 'function statusOptionsHtml(current)'
    js = js.replace(marker, helper + '\n' + marker)

# Substitui renderTable por versão única e determinística
start = js.find('function renderTable(){')
end = js.find('function renderPagination()', start)
if start == -1 or end == -1:
    raise SystemExit('renderTable não encontrado')

render = r'''function renderTable(){
const body=$("tbody"),pr=pageRows();
if(!pr.length){body.innerHTML='<tr><td colspan="20" style="padding:32px;text-align:center;color:#71869b">Nenhum embarque encontrado.</td></tr>';return}
body.innerHTML=pr.map(r=>{
const anexos=[];
if(isUploading("comprovante",r.id)) anexos.push(uploadChip());
else if(safeUrl(r.comprovanteUrl)) anexos.push(`<a class="proof" href="${esc(safeUrl(r.comprovanteUrl))}" target="_blank" rel="noopener" title="${esc(r.comprovanteNome||"Comprovante de descarga")}">🖼️</a>`);
if(isUploading("liberacao",r.id)) anexos.push(uploadChip());
else if(safeUrl(r.liberacaoUrl)) anexos.push(`<a class="proof release" href="${esc(safeUrl(r.liberacaoUrl))}" target="_blank" rel="noopener" title="${esc(r.liberacaoNome||"Liberação do frete/embarque")}">🖼️</a>`);
const itineraryHtml=isUploading("itinerario",r.id)?uploadChip():(safeUrl(r.itinerarioUrl)?`<a class="proof" href="${esc(safeUrl(r.itinerarioUrl))}" target="_blank" rel="noopener" title="${esc(r.itinerarioNome||"Itinerário")}">🖼️</a>`:`<button class="nf-clip-btn native-itinerary-upload" data-id="${esc(r.id)}" title="Anexar itinerário">📎</button>`);
const proofAction=isUploading("comprovante",r.id)?`<button class="nf-send-btn" disabled>${uploadChip()}</button>`:`<button class="iconbtn attach" data-id="${esc(r.id)}" title="Anexar comprovante de descarga">📎</button>`;
const releaseAction=isUploading("liberacao",r.id)?`<button class="nf-send-btn" disabled>${uploadChip()}</button>`:`<button class="iconbtn release" data-id="${esc(r.id)}" title="Anexar liberação do frete/embarque">📎</button>`;
return `<tr data-id="${esc(r.id)}"><td class="strong">${esc(r.numeroCarga||"-")}</td><td>${esc(fmtDate(r.dataCarga))}</td><td>${esc(fmtDate(r.previsaoChegada))}</td><td>${esc(r.cliente||"-")}</td><td class="route-origin">${esc(r.origem||"-")}</td><td>${esc(r.localOrigem||"-")}</td><td class="route-destination">${esc(r.destino||"-")}</td><td>${esc(r.localDestino||"-")}</td><td>${safeUrl(r.roteiro)?`<a class="route-link" href="${esc(safeUrl(r.roteiro))}" target="_blank" rel="noopener noreferrer" title="Abrir roteiro no Google Maps">🗺️</a>`:"-"}</td><td class="native-itinerary">${itineraryHtml}</td><td class="strong">${esc(r.placa||"-")}</td><td>${esc(r.tipoVeiculo||"-")}</td><td><span class="tag ${r.tipoCarga.toLowerCase()}">${esc(r.tipoCarga)}</span></td><td class="cargo-weight">${esc(kg(r.pesoKg))}</td><td class="money">${esc(money(r.freteEmpresa))}</td><td class="money frete-motorista-cell ${freteMotoristaOculto?"hidden-frete":""}">${esc(money(r.freteMotorista))}</td><td><select class="inlineStatus st-${statusSlug(r.situacao)}" data-id="${esc(r.id)}" data-old="${esc(r.situacao)}" style="min-width:150px;height:30px;padding:0 26px 0 9px;border-radius:7px;border:1px solid #cbd8e5;font-size:8px;font-weight:900;text-transform:uppercase;outline:none;cursor:pointer">${statusOptionsHtml(r.situacao)}</select></td><td><input class="inlineObs" data-id="${esc(r.id)}" data-old="${esc(r.observacao||"")}" value="${esc(r.observacao||"")}" placeholder="Adicionar observação..." title="Clique para editar" style="width:220px;height:30px;padding:0 9px;border:1px solid #cbd8e5;border-radius:7px;background:#fff;color:#243a52;font-size:8px;outline:none"></td><td><div class="annexes">${anexos.length?anexos.join(""):"-"}</div></td><td><div class="actions">${proofAction}${releaseAction}<button class="iconbtn edit" data-id="${esc(r.id)}" title="Editar">✎</button><button class="iconbtn del" data-id="${esc(r.id)}" title="Excluir embarque">⋮</button></div></td></tr>`}).join("");
body.querySelectorAll(".inlineStatus").forEach(select=>{select.onclick=e=>e.stopPropagation();select.onchange=async()=>{const old=select.dataset.old||"PENDENTE",next=up(select.value),ok=await updateInlineField(select.dataset.id,"situacao",next,select);if(ok)select.dataset.old=next;else select.value=old}});
body.querySelectorAll(".inlineObs").forEach(input=>{input.onclick=e=>e.stopPropagation();input.onfocus=()=>{input.style.borderColor="#4c8df7";input.style.boxShadow="0 0 0 3px rgba(37,99,235,.10)"};input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();input.blur()}if(e.key==="Escape"){input.value=input.dataset.old||"";input.blur()}};input.onblur=async()=>{input.style.borderColor="#cbd8e5";input.style.boxShadow="none";const old=input.dataset.old||"",next=input.value.trim();if(next===old)return;const ok=await updateInlineField(input.dataset.id,"observacao",next,input);if(ok)input.dataset.old=next;else input.value=old}});
body.querySelectorAll(".native-itinerary-upload").forEach(b=>b.onclick=()=>{quickItineraryId=b.dataset.id;$("quickItineraryInput").value="";$("quickItineraryInput").click()});
body.querySelectorAll(".attach").forEach(b=>b.onclick=()=>{quickProofId=b.dataset.id;$("quickProofInput").value="";$("quickProofInput").click()});
body.querySelectorAll(".iconbtn.release").forEach(b=>b.onclick=()=>{quickReleaseId=b.dataset.id;$("quickReleaseInput").value="";$("quickReleaseInput").click()});
body.querySelectorAll(".edit").forEach(b=>b.onclick=()=>{const item=rows.find(r=>r.id===b.dataset.id);if(item)openModal(item)});
body.querySelectorAll(".del").forEach(b=>b.onclick=()=>removeRow(b.dataset.id));
applyFreteMotoristaVisibility()
}
'''
js = js[:start] + render + js[end:]

# Uploads rápidos com indicador persistente até reload concluído
def replace_func(name, body, next_name):
    global js
    s = js.find(f'async function {name}(')
    if s == -1:
        raise SystemExit(f'{name} não encontrado')
    e = js.find(next_name, s)
    if e == -1:
        raise SystemExit(f'fim de {name} não encontrado')
    js = js[:s] + body + '\n' + js[e:]

replace_func('uploadQuickProof', r'''async function uploadQuickProof(id,file){if(!id||!file)return;id=String(id);uploadingByType.comprovante.add(id);renderTable();try{const fp=await filePayload(file);await api("update",{resource:"comprovante",id,...fp});await load()}catch(error){alert("Não foi possível anexar o comprovante.\n\n"+error.message)}finally{uploadingByType.comprovante.delete(id);quickProofId="";if($("quickProofInput"))$("quickProofInput").value="";renderTable()}}''', 'async function uploadQuickRelease')
replace_func('uploadQuickRelease', r'''async function uploadQuickRelease(id,file){if(!id||!file)return;id=String(id);uploadingByType.liberacao.add(id);renderTable();try{const fp=await filePayload(file);await api("update",{resource:"liberacao",id,...fp});await load()}catch(error){alert("Não foi possível anexar a liberação.\n\n"+error.message)}finally{uploadingByType.liberacao.delete(id);quickReleaseId="";if($("quickReleaseInput"))$("quickReleaseInput").value="";renderTable()}}''', 'async function uploadQuickItinerary')

s = js.find('async function uploadQuickItinerary(')
if s != -1:
    # usa a próxima função conhecida
    candidates=[js.find('function setFreteMotoristaHidden',s),js.find('async function removeAttachment',s),js.find('function exportExcel',s)]
    e=min([x for x in candidates if x!=-1], default=-1)
    if e==-1: raise SystemExit('fim uploadQuickItinerary não encontrado')
    js=js[:s]+r'''async function uploadQuickItinerary(id,file){if(!id||!file)return;id=String(id);uploadingByType.itinerario.add(id);renderTable();try{const fp=await filePayload(file);await api("update",{resource:"itinerario",id,...fp});await load()}catch(error){alert("Não foi possível anexar o itinerário.\n\n"+error.message)}finally{uploadingByType.itinerario.delete(id);quickItineraryId="";if($("quickItineraryInput"))$("quickItineraryInput").value="";renderTable()}}
''' + js[e:]

# Remoção SEGURA: jamais usa DELETE para anexos.
s = js.find('async function removeAttachment(type,id)')
if s != -1:
    candidates=[js.find('function ',s+10), js.find('async function ',s+10)]
    candidates=[x for x in candidates if x!=-1]
    e=min(candidates) if candidates else -1
    if e==-1: raise SystemExit('fim removeAttachment não encontrado')
    safe_remove=r'''async function removeAttachment(type,id){
const item=rows.find(r=>String(r.id)===String(id));if(!item)return alert("Embarque não encontrado.");
const labels={itinerario:"itinerário",comprovante:"comprovante",liberacao:"liberação"};if(!confirm(`Remover ${labels[type]||"anexo"} deste embarque?`))return;
const fields={itinerario:["itinerarioNome","itinerarioUrl","itinerarioId"],comprovante:["comprovanteNome","comprovanteUrl","comprovanteId"],liberacao:["liberacaoNome","liberacaoUrl","liberacaoId"]}[type];if(!fields)return;
loading(true,"Removendo anexo...");try{const payload={...item,resource:"registros"};fields.forEach(f=>payload[f]="");const res=await api("update",payload);if(!res||res.ok===false)throw new Error(res?.error||"Falha ao remover anexo.");await load();if($("modal")?.classList.contains("show")){const atualizado=rows.find(r=>String(r.id)===String(id));if(atualizado)openModal(atualizado)}}catch(error){alert("Não foi possível remover o anexo.\n\n"+error.message)}finally{loading(false)}}
'''
    js=js[:s]+safe_remove+js[e:]

# Evita qualquer DELETE acidental para recursos de anexo ainda remanescente
js = re.sub(r'api\("delete",\{resource:(?:type|"itinerario"|"comprovante"|"liberacao"),id\}\)', 'Promise.reject(new Error("DELETE de anexo bloqueado por segurança"))', js)

# Campo de itinerário no modal
if 'id="mItinerario"' not in html:
    target='<div class="form-field full"><label>Comprovante de descarga</label>'
    insert='<div class="form-field full"><label>Itinerário / Print do roteiro</label><div class="filebox"><input type="file" id="mItinerario" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"><div style="margin-top:7px;color:#71859a;font-size:8px">Anexe o print do itinerário. PNG, JPG ou WEBP.</div></div></div>'
    html=html.replace(target,insert+target)

# Inputs rápidos
if 'id="quickItineraryInput"' not in html:
    html=html.replace('<input type="file" id="quickProofInput"', '<input type="file" id="quickItineraryInput" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" hidden><input type="file" id="quickProofInput"')

# CSS para clipe e ENVIANDO
css='''.nf-clip-btn{min-width:31px;height:31px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #a9c9f7;border-radius:7px;background:#eaf3ff;color:#1d4ed8;cursor:pointer;font-size:16px}.nf-upload-chip{min-width:76px;height:29px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #93c5fd;border-radius:7px;background:#eff6ff;color:#1d4ed8;font-size:8px;font-weight:900;text-transform:uppercase}.nf-upload-spin{width:11px;height:11px;border:2px solid #bfdbfe;border-top-color:#2563eb;border-radius:50%;animation:nfSpin .7s linear infinite}@keyframes nfSpin{to{transform:rotate(360deg)}}.nf-send-btn{border:0;background:transparent;padding:0}.annexes{min-width:68px}'''
if '.nf-upload-chip' not in html:
    html=html.replace('</style>',css+'</style>')

# Cache bust e remove script legado
html=re.sub(r'<script src="\.\./assets/js/embarques-itinerario\.js\?v=\d+"></script>','',html)
html=re.sub(r'embarques\.js\?v=\d+','embarques.js?v=11',html)

# Garante handlers para input rápido no init, se não existirem
if 'quickItineraryInput").onchange' not in js:
    marker='$("quickProofInput").onchange'
    idx=js.find(marker)
    if idx!=-1:
        js=js[:idx]+'$("quickItineraryInput").onchange=e=>uploadQuickItinerary(quickItineraryId,e.target.files?.[0]);\n'+js[idx:]

# mItinerario reset/save
js=js.replace('$("mComprovante").value="";$("mLiberacao").value=""', 'if($("mItinerario"))$("mItinerario").value="";$("mComprovante").value="";$("mLiberacao").value=""')
if 'itinerario=$("mItinerario")' not in js:
    js=js.replace('comprovante=$("mComprovante").files?.[0],liberacao=$("mLiberacao").files?.[0];', 'itinerario=$("mItinerario")?.files?.[0],comprovante=$("mComprovante").files?.[0],liberacao=$("mLiberacao").files?.[0];')
    js=js.replace('if(comprovante&&id){', 'if(itinerario&&id){const fp=await filePayload(itinerario);await api("update",{resource:"itinerario",id,...fp})}\nif(comprovante&&id){')

js_path.write_text(js,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('Patch aplicado com sucesso')
