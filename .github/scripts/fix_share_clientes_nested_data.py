from pathlib import Path

js_path = Path('assets/js/share-clientes.js')
html_path = Path('pages/share-clientes.html')

js = js_path.read_text(encoding='utf-8')

old = '''    let rows = response?.data ?? response;

    if (!Array.isArray(rows)) {
      rows = rows?.rows || rows?.fretes || rows?.items || [];
    }

    return Array.isArray(rows) ? rows : [];
'''

new = '''    const payload = response?.data ?? response;

    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload?.fretes)
            ? payload.fretes
            : Array.isArray(payload?.items)
              ? payload.items
              : [];

    return rows;
'''

if old not in js:
    raise SystemExit('Trecho esperado não encontrado em assets/js/share-clientes.js')

js_path.write_text(js.replace(old, new, 1), encoding='utf-8')

html = html_path.read_text(encoding='utf-8')
import re
pattern = r'share-clientes\.js(?:\?v=\d+)?'
match = re.search(pattern, html)
if not match:
    raise SystemExit('Referência share-clientes.js não encontrada no HTML')

current = match.group(0)
version_match = re.search(r'\?v=(\d+)', current)
next_version = int(version_match.group(1)) + 1 if version_match else 2
updated = f'share-clientes.js?v={next_version}'
html_path.write_text(html[:match.start()] + updated + html[match.end():], encoding='utf-8')

print('Share Clientes corrigido para payload.data e cache atualizado')
