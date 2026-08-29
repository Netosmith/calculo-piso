from pathlib import Path

p = Path('pages/embarques.html')
s = p.read_text(encoding='utf-8')
s = s.replace('assets/js/embarques-itinerario.js?v=1', 'assets/js/embarques-itinerario.js?v=2')
p.write_text(s, encoding='utf-8')
