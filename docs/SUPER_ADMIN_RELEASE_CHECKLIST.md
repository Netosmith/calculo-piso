# Checklist de liberação do Super Admin

## Estado atual
As alterações estão na branch de desenvolvimento. Não implantar antes de validar o isolamento e os backups.

## Configuração obrigatória no Cloudflare Worker
Configurar `SUPER_ADMIN_USER` como segredo do Worker, com o login exato do proprietário autenticado pelo cadastro atual. Exemplo operacional: `cd worker && npx wrangler secret put SUPER_ADMIN_USER`. Não colocar a credencial em `wrangler.jsonc`, no frontend ou no GitHub.

**Importante:** a configuração do usuário é um controle inicial, não substitui uma identidade imutável nem MFA. Antes de permitir operações globais de escrita, implementar identidade administrativa imutável, auditoria e confirmação de ações críticas.

## Regressão obrigatória
1. Login Nova Frota e seleção de estado; confirmar `transportadoraId=nova-frota`.
2. Sessão legada sem identificador continua funcionando; sessão com identificador vazio é negada nas rotas protegidas.
3. GET/HEAD de logos legadas sem cookie continuam funcionando; PUT/DELETE exigem administrador Nova Frota.
4. Usuário não autorizado recebe 403 no Super Admin; ausência de `SUPER_ADMIN_USER` mantém o painel fechado.
5. Fretes, BI, controle, frota e monitoramento da Nova Frota mantêm leituras e gravações esperadas.
6. Sessão de outra transportadora não acessa Apps Script, frota, monitoramento nem grava logos legadas.
7. Links de monitoramento por token continuam funcionando; tokens são credenciais de acesso e exigem controles de expiração e revogação.

## Backup e reversão
Antes do merge, realizar e verificar exportação do Google Sheets/Apps Script, D1 e objetos R2; registrar data, local e teste de restauração. Registrar commit estável do Worker para rollback. Não reindexar nem renomear chaves legadas nesta etapa.

## Bloqueadores de publicação
- Testes automatizados de autorização ainda não executados.
- Backups externos ainda não verificados.
- Novas transportadoras ainda não possuem provisionamento isolado.
- Super Admin permanece somente leitura; ativação de cards, usuários e upload de artes requer persistência e auditoria.
