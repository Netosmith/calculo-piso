from pathlib import Path

html_path = Path('pages/embarques.html')
js_path = Path('assets/js/embarques.js')
html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

# 1) HTML/CSS: ícone do clipe do itinerário nativo.
css_anchor = '.iconbtn.attach::before,.iconbtn.release::before{content:"📎";font-size:16px}'
if '.iconbtn.native-itinerary-upload::before' not in html and css_anchor in html:
    html = html.replace(css_anchor, css_anchor + '.iconbtn.native-itinerary-upload::before{content:"📎";font-size:16px}')

# 2) Campo de upload do itinerário no modal, antes de Comprovante.
comp_block = '<div class="form-field full"><label>Comprovante de descarga</label><div class="filebox"><input type="file" id="mComprovante"'
if 'id="mItinerario"' not in html and comp_block in html:
    itinerary_block = '<div class="form-field full"><label>Itinerário / Print do roteiro</label><div class="filebox"><input type="file" id="mItinerario" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"><div style="margin-top:7px;color:#71859a;font-size:8px">PNG, JPG ou WEBP. Ao salvar, o arquivo ficará na coluna ITINERÁRIO.</div></div></div>'
    html = html.replace('<div class="form-field full"><label>Comprovante de descarga</label>', itinerary_block + '<div class="form-field full"><label>Comprovante de descarga</label>', 1)

# 3) Área de anexos atuais no modal para abrir/remover individualmente.
if 'id="currentAttachments"' not in html:
    marker = '<div class="form-field full"><label>Itinerário / Print do roteiro</label>'
    if marker in html:
        manager = '<div class="form-field full" id="currentAttachments" style="display:none"><label>Anexos atuais</label><div class="filebox"><div id="currentAttachmentsList" style="display:grid;gap:8px"></div></div></div>'
        html = html.replace(marker, manager + marker, 1)

# 4) Input rápido independente para itinerário.
quick_marker = '<input type="file" id="quickProofInput"'
if 'id="quickItineraryInput"' not in html and quick_marker in html:
    html = html.replace(quick_marker, '<input type="file" id="quickItineraryInput" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" hidden>' + quick_marker, 1)

# 5) Remover completamente o complemento antigo. Toda lógica passa a ser nativa no embarques.js.
import re
html = re.sub(r'<script src="\.\./assets/js/embarques-itinerario\.js\?v=\d+"></script>', '', html)
html = re.sub(r'embarques\.js\?v=\d+', 'embarques.js?v=10', html)

# JS: estado independente do itinerário rápido.
js = js.replace('quickProofId="",quickReleaseId="";', 'quickProofId="",quickReleaseId="",quickItineraryId="";')

# Reset do novo input no modal.
reset_old = '$("mComprovante").value="";$("mLiberacao").value=""}'
reset_new = '$("mComprovante").value="";$("mLiberacao").value="";if($("mItinerario"))$("mItinerario").value="";if($("currentAttachments"))$("currentAttachments").style.display="none"}'
if reset_old in js:
    js = js.replace(reset_old, reset_new, 1)

# Bind do botão nativo do itinerário na tabela.
release_bind = 'body.querySelectorAll(".iconbtn.release").forEach(b=>b.onclick=()=>{quickReleaseId=b.dataset.id;$("quickReleaseInput").value="";$("quickReleaseInput").click()});'
it_bind = 'body.querySelectorAll(".native-itinerary-upload").forEach(b=>b.onclick=()=>{quickItineraryId=b.dataset.id;$("quickItineraryInput").value="";$("quickItineraryInput").click()});'
if it_bind not in js and release_bind in js:
    js = js.replace(release_bind, release_bind + '\n' + it_bind, 1)

# Renderizador do gerenciador de anexos atuais e remoção individual.
insert_before = 'function closeModal(){$("modal").classList.remove("show")}'
manager_code = r'''
function attachmentDescriptor(item,type){
  if(type==="itinerario")return{label:"Itinerário",nome:item.itinerarioNome,url:item.itinerarioUrl};
  if(type==="comprovante")return{label:"Comprovante",nome:item.comprovanteNome,url:item.comprovanteUrl};
  return{label:"Liberação",nome:item.liberacaoNome,url:item.liberacaoUrl};
}
function renderCurrentAttachments(item){
  const box=$("currentAttachments"),list=$("currentAttachmentsList");if(!box||!list||!item){if(box)box.style.display="none";return}
  const types=["itinerario","comprovante","liberacao"];
  const existing=types.map(t=>[t,attachmentDescriptor(item,t)]).filter(([,f])=>safeUrl(f.url));
  if(!existing.length){box.style.display="none";list.innerHTML="";return}
  box.style.display="block";
  list.innerHTML=existing.map(([type,f])=>`<div style="display:grid;grid-template-columns:120px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:7px 8px;border:1px solid #e0e8f1;border-radius:8px;background:#fff"><strong style="font-size:8px;text-transform:uppercase">${esc(f.label)}</strong><span style="font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.nome||"Arquivo anexado")}</span><a class="btn ghost" style="height:29px;display:inline-flex;align-items:center;text-decoration:none" href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener">Abrir</a><button type="button" class="btn ghost remove-single-attachment" style="height:29px;color:#b4232f;border-color:#efb5ba" data-type="${type}" data-id="${esc(item.id)}">Remover</button></div>`).join("");
  list.querySelectorAll(".remove-single-attachment").forEach(btn=>btn.onclick=()=>removeSingleAttachment(btn.dataset.id,btn.dataset.type));
}
async function removeSingleAttachment(id,type){
  const labels={itinerario:"itinerário",comprovante:"comprovante",liberacao:"liberação"};
  if(!confirm(`Remover o ${labels[type]} desta carga?`))return;
  loading(true,"Removendo anexo...");
  try{
    const res=await api("delete",{resource:type,id});
    if(!res||res.ok===false)throw new Error(res?.error||"Falha ao remover anexo.");
    await load();
    const updated=rows.find(r=>r.id===id);if(updated){openModal(updated)}
  }catch(error){alert("Não foi possível remover o anexo.\n\n"+error.message)}finally{loading(false)}
}
'''
if 'function removeSingleAttachment(' not in js and insert_before in js:
    js = js.replace(insert_before, manager_code + '\n' + insert_before, 1)

# Fazer openModal renderizar os anexos atuais.
open_end = '$("mObservacao").value=item.observacao}$("modal").classList.add("show")}'
if open_end in js:
    js = js.replace(open_end, '$("mObservacao").value=item.observacao;renderCurrentAttachments(item)}else{renderCurrentAttachments(null)}$("modal").classList.add("show")}', 1)

# Upload de itinerário no save, independente dos outros dois.
save_decl = 'saved=res?.data||p,id=saved.id||p.id,comprovante=$("mComprovante").files?.[0],liberacao=$("mLiberacao").files?.[0];'
if save_decl in js:
    js = js.replace(save_decl, 'saved=res?.data||p,id=saved.id||p.id,itinerario=$("mItinerario")?.files?.[0],comprovante=$("mComprovante").files?.[0],liberacao=$("mLiberacao").files?.[0];', 1)
    proof_upload = 'if(comprovante&&id){const fp=await filePayload(comprovante);await api("update",{resource:"comprovante",id,...fp})}'
    if proof_upload in js and 'if(itinerario&&id)' not in js:
        js = js.replace(proof_upload, 'if(itinerario&&id){const fp=await filePayload(itinerario);await api("update",{resource:"itinerario",id,...fp})}\n' + proof_upload, 1)

# Função de upload rápido do itinerário.
proof_func = 'async function uploadQuickProof(id,file)'
quick_it_func = r'''async function uploadQuickItinerary(id,file){if(!id||!file)return;loading(true,"Enviando itinerário...");try{const fp=await filePayload(file);await api("update",{resource:"itinerario",id,...fp});await load()}catch(error){alert("Não foi possível anexar o itinerário.\n\n"+error.message)}finally{loading(false);quickItineraryId="";if($("quickItineraryInput"))$("quickItineraryInput").value=""}}
'''
if 'async function uploadQuickItinerary(' not in js and proof_func in js:
    js = js.replace(proof_func, quick_it_func + proof_func, 1)

# Listener do input rápido. Inserir antes do fechamento do DOMContentLoaded, usando listener já existente como âncora.
release_listener = '$("quickReleaseInput").addEventListener("change",e=>uploadQuickRelease(quickReleaseId,e.target.files?.[0]));'
it_listener = '$("quickItineraryInput").addEventListener("change",e=>uploadQuickItinerary(quickItineraryId,e.target.files?.[0]));'
if it_listener not in js and release_listener in js:
    js = js.replace(release_listener, it_listener + '\n' + release_listener, 1)

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
print('Correção final aplicada em pages/embarques.html e assets/js/embarques.js')
