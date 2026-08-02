# Auditoria de envelopes do gateway

A normalização global foi aplicada em `assets/js/api.js`.

Respostas no formato `data: { ok: true, data: ... }` agora são entregues aos módulos como `data: ...`.

## Módulos que utilizam PortalAPI.call

- `assets/js/api.js`
- `assets/js/cadastros.js`
- `assets/js/fretes.js`
- `assets/js/fretes2.js`
- `assets/js/patrimonio-br.js`
- `assets/js/share-clientes.js`

## Páginas com cache de autenticação atualizado

- `pages/administrativo.html`
- `pages/bi.html`
- `pages/cadastros.html`
- `pages/calculo-antt.html`
- `pages/calculo-antt2.html`
- `pages/calculo-piso.html`
- `pages/controle.html`
- `pages/custo-filial.html`
- `pages/divulgacao.html`
- `pages/fretes-mercado.html`
- `pages/fretes.html`
- `pages/fretes2.html`
- `pages/home.html`
- `pages/login.html`
- `pages/patrimonio-br.html`
- `pages/share-clientes.html`
