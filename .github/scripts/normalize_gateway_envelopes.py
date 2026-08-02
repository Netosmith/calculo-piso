from pathlib import Path
import re

repo = Path('.')
api_path = repo / 'assets/js/api.js'
auth_path = repo / 'assets/js/auth.js'

api = api_path.read_text(encoding='utf-8')

marker = 'window.PortalAPI = {'
helper = '''function normalizeGatewayEnvelope(result) {
  const inner = result?.data;

  if (
    inner &&
    typeof inner === "object" &&
    !Array.isArray(inner) &&
    inner.ok === true &&
    Object.prototype.hasOwnProperty.call(inner, "data")
  ) {
    const { data, ...gatewayMeta } = inner;
    return {
      ...result,
      data,
      gatewayMeta
    };
  }

  return result;
}

'''

if 'function normalizeGatewayEnvelope(result)' not in api:
    if marker not in api:
        raise SystemExit('Marcador window.PortalAPI não encontrado em api.js')
    api = api.replace(marker, helper + marker, 1)

old_call = '''  call(module, action, params = {}) {
    return portalApiRequest("/v1/gateway", {
      method: "POST",
      body: { module, action, params }
    });
  }
'''
new_call = '''  async call(module, action, params = {}) {
    const result = await portalApiRequest("/v1/gateway", {
      method: "POST",
      body: { module, action, params }
    });

    return normalizeGatewayEnvelope(result);
  }
'''

if old_call in api:
    api = api.replace(old_call, new_call, 1)
elif new_call not in api:
    raise SystemExit('Trecho PortalAPI.call esperado não encontrado em api.js')

api_path.write_text(api, encoding='utf-8')

auth = auth_path.read_text(encoding='utf-8')
auth_new, count = re.subn(r'api\.js(?:\?v=\d+)?', 'api.js?v=3', auth)
if count == 0:
    raise SystemExit('Referência a api.js não encontrada em auth.js')
auth_path.write_text(auth_new, encoding='utf-8')

updated_pages = []
for html_path in (repo / 'pages').glob('*.html'):
    text = html_path.read_text(encoding='utf-8')
    new_text, replacements = re.subn(r'auth\.js(?:\?v=\d+)?', 'auth.js?v=5', text)
    if replacements and new_text != text:
        html_path.write_text(new_text, encoding='utf-8')
        updated_pages.append(str(html_path))

# Também cobre HTMLs ativos fora de pages, quando existirem.
for html_path in repo.glob('*.html'):
    text = html_path.read_text(encoding='utf-8')
    new_text, replacements = re.subn(r'auth\.js(?:\?v=\d+)?', 'auth.js?v=5', text)
    if replacements and new_text != text:
        html_path.write_text(new_text, encoding='utf-8')
        updated_pages.append(str(html_path))

# Relatório simples de módulos que usam o gateway.
modules = []
for js_path in (repo / 'assets/js').glob('*.js'):
    text = js_path.read_text(encoding='utf-8', errors='ignore')
    if 'PortalAPI.call' in text:
        modules.append(str(js_path))

report = repo / 'GATEWAY_ENVELOPE_AUDIT.md'
report.write_text(
    '# Auditoria de envelopes do gateway\n\n'
    'A normalização global foi aplicada em `assets/js/api.js`.\n\n'
    'Respostas no formato `data: { ok: true, data: ... }` agora são entregues aos módulos como `data: ...`.\n\n'
    '## Módulos que utilizam PortalAPI.call\n\n' +
    ''.join(f'- `{path}`\n' for path in sorted(modules)) +
    '\n## Páginas com cache de autenticação atualizado\n\n' +
    ''.join(f'- `{path}`\n' for path in sorted(set(updated_pages))),
    encoding='utf-8'
)

print(f'Normalização aplicada. {len(modules)} módulos auditados; {len(set(updated_pages))} páginas atualizadas.')
