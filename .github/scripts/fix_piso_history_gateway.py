from pathlib import Path
import re

js_path = Path("assets/js/calculo-piso.js")
html_path = Path("pages/calculo-piso.html")

js = js_path.read_text(encoding="utf-8")
required_markers = (
    'async function loadHistory()',
    'function extractHistoryRows(',
    'PortalAPI.call("bi","read"',
    'const normalizeKey=(value)=>',
)

missing = [marker for marker in required_markers if marker not in js]
if missing:
    raise SystemExit(
        "A implementação atual do Histórico Comercial está incompleta: "
        + ", ".join(missing)
    )

html = html_path.read_text(encoding="utf-8")
updated, count = re.subn(
    r"calculo-piso\.js(?:\?v=\d+)?",
    "calculo-piso.js?v=21",
    html,
    count=1,
)
if count == 0:
    raise SystemExit(
        "Referência a calculo-piso.js não encontrada em calculo-piso.html"
    )

html_path.write_text(updated, encoding="utf-8")
print("Histórico Comercial validado e cache atualizado para v21.")
