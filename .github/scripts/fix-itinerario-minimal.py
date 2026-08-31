from pathlib import Path

js_path=Path('assets/js/embarques-itinerario.js')
html_path=Path('pages/embarques.html')
js=js_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

old='const id=tr.dataset.id||"", r=records.get(String(id))||{}, info=rowInfo(r).itinerario;'
new='const id=tr.dataset.id||"", r=records.get(String(id))||{}, info=itineraryInfo(r);'
if old not in js:
    raise SystemExit('Trecho rowInfo nao encontrado')
js=js.replace(old,new,1)
html=html.replace('embarques-itinerario.js?v=4','embarques-itinerario.js?v=5')

js_path.write_text(js,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('OK: itinerario corrigido sem alterar o restante')
