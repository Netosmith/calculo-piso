from pathlib import Path

path = Path('assets/js/fretes.js')
text = path.read_text(encoding='utf-8')

old = '''      STATE.rows = Array.isArray(res.data)
        ? res.data.map((row) => ({ ...row, status: normalizeFreteStatus(row.status) }))
        : [];
'''

new = '''      const payload = res?.data;
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

      STATE.rows = rows.map((row) => ({
        ...row,
        status: normalizeFreteStatus(row.status)
      }));
'''

if old not in text:
    raise SystemExit('Trecho esperado não encontrado em assets/js/fretes.js')

path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('fretes.js corrigido para payload.data')
