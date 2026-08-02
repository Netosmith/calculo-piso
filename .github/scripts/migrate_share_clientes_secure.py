from pathlib import Path
import re

path = Path("assets/js/share-clientes.js")
text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
    "/* share-clientes.js | NOVA -FROTA */",
    "/* share-clientes.js | NOVA FROTA | Gateway seguro Cloudflare */",
    1,
)

text = re.sub(
    r'\n\s*const SHEETS_API_URL\s*=\s*\n\s*"https://script\.google\.com/macros/s/[^\"]+/exec";\n',
    "\n",
    text,
    count=1,
)

start = text.find("  function jsonp(url, timeoutMs = 30000) {")
end = text.find("\n\n  function getCmhLocal(row) {", start)
if start < 0 or end < 0:
    raise SystemExit("Bloco legado JSONP/loadFretesRows não encontrado.")

replacement = '''  async function loadFretesRows() {
    if (!window.PortalAPI) {
      throw new Error("API segura do Portal indisponível.");
    }

    const response = await window.PortalAPI.call("share", "read", {
      base: BASE_ATUAL,
      resource: BASE_ATUAL
    });

    if (response && response.ok === false) {
      throw new Error(response.error || "Erro retornado pelo gateway seguro.");
    }

    let rows = response?.data ?? response;

    if (!Array.isArray(rows)) {
      rows = rows?.rows || rows?.fretes || rows?.items || [];
    }

    return Array.isArray(rows) ? rows : [];
  }
'''

text = text[:start] + replacement + text[end:]

forbidden = [
    "script.google.com/macros/",
    "SHEETS_API_URL",
    "function jsonp(",
    "callback=",
]
leftovers = [item for item in forbidden if item in text]
if leftovers:
    raise SystemExit("Referências legadas restantes: " + ", ".join(leftovers))

if "PortalAPI.call(\"share\", \"read\"" not in text:
    raise SystemExit("Chamada direta ao gateway Share não foi criada.")

if text == original:
    raise SystemExit("Nenhuma alteração aplicada.")

path.write_text(text, encoding="utf-8")
