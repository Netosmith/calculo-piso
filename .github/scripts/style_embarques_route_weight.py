from pathlib import Path

p = Path('assets/js/embarques.js')
s = p.read_text(encoding='utf-8')
old = '''<td>${esc(r.origem||"-")}</td><td>${esc(r.localOrigem||"-")}</td><td>${esc(r.destino||"-")}</td><td>${esc(r.localDestino||"-")}</td>'''
new = '''<td class="route-origin">${esc(r.origem||"-")}</td><td>${esc(r.localOrigem||"-")}</td><td class="route-destination">${esc(r.destino||"-")}</td><td>${esc(r.localDestino||"-")}</td>'''
if old not in s:
    raise SystemExit('Trecho origem/destino nao encontrado')
s = s.replace(old, new, 1)
old_weight = '''<td>${esc(kg(r.pesoKg))}</td><td class="money">'''
new_weight = '''<td class="cargo-weight">${esc(kg(r.pesoKg))}</td><td class="money">'''
if old_weight not in s:
    raise SystemExit('Trecho peso nao encontrado')
s = s.replace(old_weight, new_weight, 1)
p.write_text(s, encoding='utf-8')

h = Path('pages/embarques.html')
t = h.read_text(encoding='utf-8')
needle = '.strong{font-weight:900;color:#0e2138}'
replacement = needle + '.route-origin{font-weight:900!important;color:#123b6d!important}.route-destination{font-weight:900!important;color:#8f1d24!important}.cargo-weight{font-weight:900!important;color:#10233d!important}'
if needle not in t:
    raise SystemExit('Ponto CSS nao encontrado')
t = t.replace(needle, replacement, 1)
h.write_text(t, encoding='utf-8')
