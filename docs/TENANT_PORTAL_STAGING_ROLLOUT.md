# Portal Frete unificado: Nova Frota e demais transportadoras

## Arquitetura simplificada escolhida pelo proprietario (2026-11-02)

**Somente um Portal Frete operacional** e um Super Admin protegido. Nao criar o Worker adicional `portalfrete-tenant-staging`; o prototipo independente foi abandonado em favor da integracao com o Worker `portalfrete-api` e as paginas `pages/login.html` e `pages/home.html` que ja existem.

### Arquitetura efetiva

- `portalfrete.net.br/pages/login.html`: mesma tela, com seletor de transportadora. Nova Frota e a opcao padrao.
- `portalfrete.net.br/pages/home.html`: Nova Frota preserva a Home atual; outras empresas recebem seus proprios cards e area de Fretes / BI, na propria Home.
- `api.portalfrete.net.br` (`portalfrete-api`): login legado utiliza Apps Script e cookie antigo. Novas transportadoras usam credenciais D1 e cookie isolado HttpOnly; os dois fluxos se excluem.
- Nova Frota continua com Apps Script e seus modulos legados, sem migracao de dados.
- Para novas empresas, modulos `fretes`, `fretes2` (compartilham um cadastro de fretes nesta primeira fase) e `bi` estao disponiveis. Outros cards autorizados aparecem como **Em integracao**, sem acesso a recursos legados.
- `portalfrete-super-admin-staging`: segue separado exclusivamente como **Super Admin protegido pelo Cloudflare Access do proprietario**. A Home Nova Frota inclui o card para abri-lo no endereco autenticado.

### Banco e armazenamento

O proprietario ja aplicou `0001_tenants.sql` e `0002_tenant_portal.sql` manualmente no D1 `portal-super-admin-tenants-staging`. O Worker principal recebe vinculacoes **aditivas**:

- `TENANTS_DB` → `portal-super-admin-tenants-staging`
- `TENANT_BRANDS` → `portal-super-admin-brands-staging`
- `TENANT_PORTAL_ENABLED` → `enabled`

Esses bancos sao de homologacao; a operacao legada da Nova Frota continua em `FLEET_DB`, `SESSIONS`, `CLIENT_LOGOS` e Apps Script. Nao copiar dados legados para o D1 sem plano de migracao e isolamento.

### Primeiro login

No Super Admin atual, selecione `teste-01`. Verifique empresa **ativa**, usuario `USUARIO.TESTE` ativo, modulos `Fretes` e `BI` selecionados. Defina uma senha de pelo menos 12 caracteres pelo botao **Definir senha**, que grava somente hash PBKDF2 em `portal_tenant_credentials`. Nunca compartilhe senhas no chat.

Acesse a **mesma tela de login** `https://portalfrete.net.br/pages/login.html`; selecione `TRANSPORTADORA TESTE`, informe usuario e senha. O Worker retorna contexto `tenantMode`, `transportadoraId`, `transportadoraNome`, perfil e modulos habilitados. A mesma Home renderiza os cards da empresa e chama apenas `/v1/tenant/*`.

Para Nova Frota, basta deixar a opcao padrao no login; o fluxo existente, selecao de estado, Apps Script e sessoes legadas permanecem os mesmos.

### Auditoria e garantias

- O gateway, frota, monitoramento, logos de clientes e Super Admin legado rejeitam cookies de tenant.
- Ao criar sessao de tenant, o cookie antigo de Nova Frota e removido; no sentido contrario, o cookie de tenant e removido.
- O backend verifica transportadora e usuario ativos, senha de hash+salt, expiracao e revogacao de sessao, modulo e perfil a cada requisicao.
- Leitura e mutacoes de fretes filtram o tenant no banco; alteracoes incluem auditoria por tenant.
- Operacoes de escrita exigem origem confiavel; frontend apenas chama URLs de mesma API.
- A conta `PISO` nao pode ler fretes ou BI.
- Token e senha nao sao colocados em localStorage, URL ou logs.

### Validacao e entrega

Rodar `npm test` e `npx wrangler deploy --dry-run` no diretorio `worker`, conferir workflow `Super Admin Security Tests` antes de publicar. Atualizacao da configuracao `worker/wrangler.jsonc` e **aditiva** aos bindings originais de producao.

**Deploy seguro:** validar primeiro API publica de transportadoras, login Nova Frota, Pingo Chic, logos, monitoramento e gateway antes de considerar implantacao concluida. Se os recursos de tenant falharem, desabilitar `TENANT_PORTAL_ENABLED` sem afetar o login Nova Frota.

Nao executar o SQL 0001/0002 novamente; tabelas ja existentes estao operacionais.

### Limites da primeira versao unificada

NÃO afirmar que todos os modulos das novas transportadoras ja usam D1: inicialmente Fretes e BI funcionam. Os modulos restantes exigem adaptacao dos contratos e do armazenamento antes de habilitar. Nao direcionar usuarios das novas empresas a paginas legadas enquanto essas rotas nao estiverem isoladas.
