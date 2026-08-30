from pathlib import Path

p = Path('pages/embarques.html')
s = p.read_text(encoding='utf-8')

replacements = [
    ('<th>ROTEIRO</th><th>PLACA</th>', '<th>ROTEIRO</th><th>ITINERÁRIO</th><th>PLACA</th>'),
    ('<th>Roteiro</th><th>Placa</th>', '<th>Roteiro</th><th>Itinerário</th><th>Placa</th>'),
    ('<th>ROTEIRO</th>\n<th>PLACA</th>', '<th>ROTEIRO</th>\n<th>ITINERÁRIO</th>\n<th>PLACA</th>'),
]

changed = False
for old, new in replacements:
    if old in s:
        s = s.replace(old, new, 1)
        changed = True
        break

if not changed and 'ITINERÁRIO' not in s:
    raise SystemExit('Não encontrei o cabeçalho ROTEIRO/PLACA para corrigir')

# A tabela agora possui 21 colunas, incluindo ITINERÁRIO.
s = s.replace('colspan="20"', 'colspan="21"')

# Força cache novo apenas do embarques.js sem alterar lógica.
import re
s = re.sub(r'embarques\.js\?v=\d+', 'embarques.js?v=13', s)

p.write_text(s, encoding='utf-8')
print('Cabeçalho ITINERÁRIO alinhado e cache atualizado.')
