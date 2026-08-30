from pathlib import Path

html_path = Path('pages/embarques.html')
js_path = Path('assets/js/embarques.js')
addon_path = Path('assets/js/embarques-itinerario.js')

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

# 1) Novo Embarque: campo de upload do itinerário
needle = '<div class="form-field full"><label>Comprovante de descarga</label><div class="filebox"><input type="file" id="mComprovante"'
insert = '<div class="form-field full"><label>Itinerário / Print do roteiro</label><div class="filebox"><input type="file" id="mItinerario" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"><div style="margin-top:7px;color:#71859a;font-size:8px">Anexe o print do itinerário. PNG, JPG ou WEBP.</div></div></div>'
if 'id="mItinerario"' not in html:
    html = html.replace(needle, insert + needle)

# bump cache and remove addon decoration dependency later
html = html.replace('embarques.js?v=8', 'embarques.js?v=9')
html = html.replace('embarques-itinerario.js?v=3', 'embarques-itinerario.js?v=4')
html_path.write_text(html, encoding='utf-8')

# 2) JS principal passa a conhecer os 3 anexos
old_norm = 'liberacaoId:String(r.liberacaoId||""),previsaoChegada:r.previsaoChegada||""'
new_norm = 'liberacaoId:String(r.liberacaoId||""),itinerarioNome:String(r.itinerarioNome||""),itinerarioUrl:String(r.itinerarioUrl||""),itinerarioId:String(r.itinerarioId||""),previsaoChegada:r.previsaoChegada||""'
js = js.replace(old_norm, new_norm)

# colspan tabela vazia
js = js.replace('colspan="19"', 'colspan="20"')

# tabela: render nativo da coluna ITINERÁRIO e dois anexos independentes
old = '<td>${safeUrl(r.roteiro)?`<a class="route-link" href="${esc(safeUrl(r.roteiro))}" target="_blank" rel="noopener noreferrer" title="Abrir roteiro no Google Maps">🗺️</a>`:"-"}</td><td class="strong">${esc(r.placa||"-")}</td>'
new = '<td>${safeUrl(r.roteiro)?`<a class="route-link" href="${esc(safeUrl(r.roteiro))}" target="_blank" rel="noopener noreferrer" title="Abrir roteiro no Google Maps">🗺️</a>`:"-"}</td><td class="native-itinerary">${safeUrl(r.itinerarioUrl)?`<a class="proof" href="${esc(safeUrl(r.itinerarioUrl))}" target="_blank" rel="noopener noreferrer" title="${esc(r.itinerarioNome||"Itinerário")}">🖼️</a>`:`<button class="iconbtn native-itinerary-upload" data-id="${esc(r.id)}" title="Anexar itinerário">📎</button>`}</td><td class="strong">${esc(r.placa||"-")}</td>'
js = js.replace(old, new)

# bind upload itinerary button to existing hidden input created by addon
marker = 'body.querySelectorAll(".attach").forEach(b=>b.onclick=()=>{quickProofId=b.dataset.id;$("quickProofInput").value="";$("quickProofInput").click()});'
addition = marker + '\nbody.querySelectorAll(".native-itinerary-upload").forEach(b=>b.onclick=()=>{let inp=$("quickItineraryInput");if(inp){inp.dataset.id=b.dataset.id;inp.value="";inp.click()}});'
js = js.replace(marker, addition)

# reset modal inclui itinerário
js = js.replace('$("mComprovante").value="";$("mLiberacao").value=""', '$("mComprovante").value="";$("mLiberacao").value="";if($("mItinerario"))$("mItinerario").value=""')

# salvar: inclui upload de itinerário, preservando cada resource separado
old_save_decl = 'comprovante=$("mComprovante").files?.[0],liberacao=$("mLiberacao").files?.[0];'
new_save_decl = 'comprovante=$("mComprovante").files?.[0],liberacao=$("mLiberacao").files?.[0],itinerario=$("mItinerario")?.files?.[0];'
js = js.replace(old_save_decl, new_save_decl)
js = js.replace('if(liberacao&&id){const fp=await filePayload(liberacao);await api("update",{resource:"liberacao",id,...fp})}\ncloseModal();await load()', 'if(liberacao&&id){const fp=await filePayload(liberacao);await api("update",{resource:"liberacao",id,...fp})}\nif(itinerario&&id){const fp=await filePayload(itinerario);await api("update",{resource:"itinerario",id,...fp})}\ncloseModal();await load()')

# export inclui itinerário
js = js.replace('"ROTEIRO":r.roteiro,"PLACA":r.placa', '"ROTEIRO":r.roteiro,"ITINERÁRIO":r.itinerarioUrl,"PLACA":r.placa')

js_path.write_text(js, encoding='utf-8')

# 3) addon fica responsável apenas por upload rápido/remover e não cria coluna duplicada
addon = addon_path.read_text(encoding='utf-8')
addon = addon.replace('function ensureHeader(){', 'function ensureHeader_DISABLED(){')
addon = addon.replace('function decorateRows(){', 'function decorateRows_DISABLED(){')
addon = addon.replace('function decorateTable(){ensureHeader();decorateRows()}', 'function decorateTable(){ refreshNativeItinerary() }')

helper = '''\nfunction refreshNativeItinerary(){\n  const body=$("tbody"); if(!body) return;\n  [...body.querySelectorAll("tr[data-id]")].forEach(tr=>{\n    const id=tr.dataset.id||"", r=records.get(String(id))||{}, info=rowInfo(r).itinerario;\n    const cell=tr.querySelector("td.native-itinerary"); if(!cell) return;\n    if(uploading.has(String(id))){ cell.innerHTML='<span class="nf-it-btn busy"><i class="nf-spin"></i>Enviando</span>'; return; }\n    const url=safeUrl(info.url);\n    if(url){ cell.innerHTML=`<a class="nf-it-btn has-file" href="${esc(url)}" target="_blank" rel="noopener" title="Abrir print do itinerário">🖼️</a>`; return; }\n    cell.innerHTML=`<button type="button" class="nf-it-btn native-itinerary-upload" data-id="${esc(id)}" title="Anexar print do itinerário">📎</button>`;\n    const b=cell.querySelector("button"); if(b)b.onclick=()=>{const inp=$("quickItineraryInput"); inp.dataset.id=String(id); inp.value=""; inp.click()};\n  });\n}\n'''
if 'function refreshNativeItinerary()' not in addon:
    addon = addon.replace('async function uploadItinerary', helper + '\nasync function uploadItinerary')
addon_path.write_text(addon, encoding='utf-8')

print('OK: embarques ajustado para 3 anexos independentes e upload de itinerario no modal')
