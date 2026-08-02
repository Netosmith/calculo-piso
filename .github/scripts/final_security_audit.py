from pathlib import Path
from datetime import datetime, timezone

ROOTS = [Path("assets/js"), Path("pages")]
EXTENSIONS = {".js", ".html"}
IGNORE_FILES = {
    Path("assets/js/api.js"),
}
PATTERNS = {
    "URL direta do Apps Script": "script.google.com",
    "Constante API_URL legada": "API_URL",
    "Função JSONP legada": "jsonp(",
    "Callback JSONP": "callback=",
}

findings = []
checked = 0

for root in ROOTS:
    if not root.exists():
        continue
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in EXTENSIONS:
            continue
        if path in IGNORE_FILES:
            continue
        checked += 1
        text = path.read_text(encoding="utf-8", errors="ignore")
        for label, pattern in PATTERNS.items():
            for line_no, line in enumerate(text.splitlines(), start=1):
                if pattern in line:
                    findings.append((str(path), line_no, label, line.strip()[:220]))

report = [
    "# Varredura Final de Segurança do Frontend",
    "",
    f"Gerado em: {datetime.now(timezone.utc).isoformat()}",
    f"Arquivos verificados: {checked}",
    "",
]

if findings:
    report += [
        "## Resultado: PENDÊNCIAS ENCONTRADAS",
        "",
        "Foram localizadas referências legadas que devem ser revisadas antes da remoção definitiva da ponte de compatibilidade.",
        "",
        "| Arquivo | Linha | Tipo | Trecho |",
        "|---|---:|---|---|",
    ]
    for path, line_no, label, snippet in findings:
        snippet = snippet.replace("|", "\\|")
        report.append(f"| `{path}` | {line_no} | {label} | `{snippet}` |")
else:
    report += [
        "## Resultado: APROVADO",
        "",
        "Nenhuma URL direta do Apps Script, constante `API_URL`, função JSONP ou callback legado foi encontrada no frontend ativo.",
    ]

report += [
    "",
    "## Observações",
    "",
    "- O arquivo `assets/js/api.js` foi excluído desta busca porque é a camada oficial de comunicação com o Worker.",
    "- Documentos Markdown, scripts de migração e workflows não fazem parte do frontend publicado e não entram no resultado.",
    "- Referências a CDNs, imagens e bibliotecas externas não são tratadas como falha nesta auditoria.",
]

Path("SECURITY_AUDIT_FINAL.md").write_text("\n".join(report) + "\n", encoding="utf-8")

print(f"Arquivos verificados: {checked}")
print(f"Pendências encontradas: {len(findings)}")
for item in findings:
    print(f"{item[0]}:{item[1]} - {item[2]}")
