# MODELO-01 | Páginas reutilizáveis

Estes 49 arquivos são modelos **sem empresa associada**. Contêm o identificador `__TENANT_ID__`, que intencionalmente impede login e acesso aos dados.

Para uma nova transportadora, não edite esta pasta. Use:

```bash
node scripts/criar-transportadora-modelo.mjs empresa-exemplo empresa-02 --dry-run
node scripts/criar-transportadora-modelo.mjs empresa-exemplo empresa-02
```

Consulte o passo a passo completo em [docs/GUIA_NOVAS_TRANSPORTADORAS.md](../../docs/GUIA_NOVAS_TRANSPORTADORAS.md).

A planilha limpa associada ao modelo está no Google Sheets, mas **não** está vinculada automaticamente às páginas ou ao Apps Script. Crie integração própria para cada empresa no Super Admin.
