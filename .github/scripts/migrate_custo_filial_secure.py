from pathlib import Path
import re

path = Path("assets/js/custo-filial.js")
text = path.read_text(encoding="utf-8")
original = text

text = re.sub(
    r'\nconst API_URL\s*=\s*"https://script\.google\.com[^\n]+;\n',
    '\n',
    text,
    count=1,
)

api_block = re.compile(
    r'// ==========================================\n// API\n// ==========================================\n.*?// ==========================================\n// NORMALIZAÇÃO',
    re.S,
)

secure_api = '''// ==========================================\n// API SEGURA VIA CLOUDFLARE WORKER\n// ==========================================\n\nasync function apiGet(action) {\n  if (!window.PortalAPI) {\n    throw new Error("API segura do Portal indisponível.");\n  }\n\n  if (action === "fretes_list") {\n    return PortalAPI.call("fretes", "read", {});\n  }\n\n  if (action === "getAll") {\n    return PortalAPI.call("custo-filial", "read", { resource: "all" });\n  }\n\n  return PortalAPI.call("custo-filial", "read", {\n    resource: action\n  });\n}\n\nasync function apiPost(payload = {}) {\n  if (!window.PortalAPI) {\n    throw new Error("API segura do Portal indisponível.");\n  }\n\n  const action = String(payload.action || "").trim();\n  const data = { ...payload };\n  delete data.action;\n\n  const map = {\n    add_meta: ["create", "metas"],\n    update_meta: ["update", "metas"],\n    add_lancamento: ["create", "lancamentos"],\n    update_lancamento: ["update", "lancamentos"],\n    importar_metas_base: ["export", "metas-base"]\n  };\n\n  const config = map[action];\n  if (!config) {\n    throw new Error(`Ação não mapeada no gateway seguro: ${action}`);\n  }\n\n  const [operation, resource] = config;\n  return PortalAPI.call("custo-filial", operation, {\n    resource,\n    operation: action,\n    ...data\n  });\n}\n\n// ==========================================\n// NORMALIZAÇÃO'''

if not api_block.search(text):
    raise SystemExit("Bloco antigo de API não encontrado em custo-filial.js")
text = api_block.sub(secure_api, text, count=1)

text = re.sub(
    r'\n\s*if \(!API_URL \|\| API_URL\.includes\("COLE_AQUI"\)\) \{\n\s*throw new Error\("Preencha a API_URL no custo-filial\.js"\);\n\s*\}\n',
    '\n',
    text,
    count=1,
)

for forbidden in ["script.google.com", "const API_URL", "fetch(API_URL", "COLE_AQUI"]:
    if forbidden in text:
        raise SystemExit(f"Referência legada restante: {forbidden}")

for required in [
    'PortalAPI.call("custo-filial"',
    'PortalAPI.call("fretes", "read"',
    'resource: "metas"',
    'resource: "lancamentos"',
]:
    if required not in text:
        raise SystemExit(f"Integração obrigatória ausente: {required}")

if text == original:
    raise SystemExit("Nenhuma alteração aplicada em custo-filial.js")

path.write_text(text, encoding="utf-8")
