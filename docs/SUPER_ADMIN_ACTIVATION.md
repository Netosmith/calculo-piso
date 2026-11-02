## Simplificacao em homologacao: Cloudflare Access sem segundo autenticador

O proprietario autorizou o funcionamento imediato do Super Admin no Worker de homologacao.
O entrypoint worker/src/staging.js aceita escrita SOMENTE depois de confirmar via
Cloudflare Access o email exato e AUD da aplicacao; exige Origin do proprio Worker,
rejeita Content-Types de formulario e registra auditoria no D1 isolado.
A UI de homologacao nao exige colar token OIDC, e as flags de escrita estao
restritas a worker/wrangler.super-admin-staging.jsonc.
O controller usado pela API de producao continua exigindo token OIDC e MFA para escrita.
Este comportamento simplificado NAO deve ser copiado para o Worker portalfrete-api.
Nova Frota permanece imutavel pelas rotas deste catalogo.
Vinculos D1 ainda nao representam contas com senha ou acesso operacional.

# Ativacao segura do Super Admin - checklist operacional

**Estado:** Backend de gestao de transportadoras e modulos implementado e testado na branch feature/super-admin-panel-foundation. Nao publicado em producao. O cadastro de usuarios legados permanece somente leitura. O painel agora suporta vinculos D1 de novas transportadoras (sem criar login ou senha) e upload de logo por empresa em R2 isolado, ambos desativados por padrao. A pagina de preview publica utiliza dados ficticios.

## 1. Ambiente de homologacao Cloudflare
Usar um Worker de homologacao com nome, dominio, segredos e D1 dedicados. Nao copiar tokens ou senhas pessoais para o repositorio. A conta proprietaria deve conseguir autenticar pelo login do Portal Frete em dominio de homologacao confiavel. O dominio do painel e da API precisa manter compatibilidade com cookies Secure, HttpOnly e SameSite=Strict.

O Worker exige APPS_SCRIPT_URL e PORTAL_KEY conforme a configuracao atual de validacao. Nao apontar homologacao para a base legada real sem autorizacao e regras de acesso.

## Banco D1 de homologacao criado em 2026-11-02

- Nome: `portal-super-admin-tenants-staging`.
- ID: `9103c28a-c224-4781-9d3f-fd735b546cd9`.
- Configuracao dedicada: `worker/wrangler.super-admin-staging.jsonc`; **nao** alterar o Worker principal `worker/wrangler.jsonc` para este D1.
- O provisionamento do banco e a execucao do SQL foram confirmados em captura do Console D1 em 2026-11-02. As quatro tabelas portal_tenants, portal_tenant_modules, portal_tenant_users e portal_tenant_audit foram listadas na consulta sqlite_master.
- **O banco ja existe e o esquema SQL ja foi aplicado manualmente no Console D1. NAO executar novamente o comando d1 create nem d1 migrations apply --remote nesta etapa.**
- O Console D1 nao registra a migracao na tabela de controle do Wrangler. Antes de habilitar um processo automatizado de migracoes, fazer reconciliacao de baseline e verificar schema e indices no banco especifico; nao reexecutar automaticamente a migracao existente.
- O procedimento de homologacao ainda exige segredos, sessao de usuario autorizada e verificacao do provedor OIDC; nenhum deles foi configurado por esse commit.

## 2. Criar D1 isolado
No diretorio worker, com Wrangler autenticado na conta correta:

    npx wrangler d1 create portal-super-admin-tenants-staging

O comando retorna o UUID do banco. **O banco desta homologacao ja existe: nao executar novamente.** Adicionar ao **Worker de homologacao**, preservando todas as demais bindings, a entrada abaixo no array d1_databases do respectivo wrangler.jsonc:

    {
      "binding": "TENANTS_DB",
      "database_name": "portal-super-admin-tenants-staging",
      "database_id": "9103c28a-c224-4781-9d3f-fd735b546cd9",
      "migrations_dir": "migrations/super-admin"
    }

**Nao reutilizar FLEET_DB.** A migracao fica isolada em worker/migrations/super-admin/0001_tenants.sql, e nao na pasta raiz de migracoes.

**Status: esta etapa ja foi concluida pelo Console D1, sem comando Wrangler remoto.** Para testes de migracao local, e permitido usar Wrangler --local contra um banco de desenvolvimento local isolado. Nunca aplicar a migracao em FLEET_DB ou em bancos de clientes existentes. Nao realizar deploy do Worker de producao nesta etapa.

## 2.1. Criar biblioteca R2 dedicada para logos das novas empresas
O bucket portal-super-admin-brands-staging ja foi criado no Cloudflare, confirmado por captura de tela em 2026-11-02. Classe Standard, acesso publico Disabled, 0 B inicialmente. NAO criar novamente.

A binding R2 TENANT_BRANDS ja foi preparada no arquivo worker/wrangler.super-admin-staging.jsonc para esse bucket, sem reutilizar CLIENT_LOGOS ou FLEET_FILES. O painel aceita apenas PNG, JPG ou WebP com ate 2 MB e armazena chave aleatoria privada por transportadora. A logo existente so e substituida apos auditoria e atualizacao bem-sucedidas no D1.

## 2.2. Publicacao isolada do Worker de homologacao

A configuracao `worker/wrangler.super-admin-staging.jsonc` usa apenas `src/staging.js`. Essa entrada expoe somente `GET /health` e `/v1/super-admin/*`. Ela NAO publica login, fretes, frota, jogos nem Apps Script. A verificacao `/health` consulta apenas a disponibilidade do D1 e da binding R2, sem retornar dados privados.

Foi preparado o workflow `.github/workflows/super-admin-staging-deploy.yml` para publicar SOMENTE `portalfrete-super-admin-staging`. Ele exige:

1. Criar token API Cloudflare com privilegios minimos de publicacao de Worker, da conta correta; gravar no GitHub Actions Secret `CLOUDFLARE_SUPER_ADMIN_STAGING_TOKEN`. Nunca colar token no chat ou codigo.
2. Manter `CLOUDFLARE_ACCOUNT_ID` nos GitHub Actions Secrets, apontando para a conta correta.
3. O workflow foi preparado na branch `feature/super-admin-panel-foundation`, mas o GitHub normalmente so disponibiliza `workflow_dispatch` depois que o arquivo existe na branch padrao. Nao tentar executa-lo antes de registrar apenas o workflow na branch padrao com revisao. Alternativamente, um operador autorizado pode implantar localmente via `npx wrangler deploy --config wrangler.super-admin-staging.jsonc` na pasta `worker`, apos `npm ci`, `npm test` e dry-run, garantindo conta correta. Nenhum push faz deploy automatico.
4. Conferir testes, compilacao e deploy verdes; acessar `/health` no dominio workers.dev do Worker isolado.

**Importante:** o cookie de login do dominio `api.portalfrete.net.br` usa `__Host-` e `SameSite=Strict` e nao sera enviado automaticamente ao Worker `workers.dev`. A integracao de identidade/dominio de homologacao ainda e necessaria. NAO copiar o `PORTAL_KEY` de producao para contornar isso. As rotas administrativas continuam fechadas ate haver sessao de proprietario e MFA validos.

## 2.3. Login independente com Cloudflare Access (homologacao)

CONFIRMADO: `GET /health` respondeu `{"ok":true,"environment":"staging","database":"ready","storage":"bound"}` no Worker separado. Esse teste valida D1/R2, nao login.

A entrada `worker/src/staging.js` agora serve `/super-admin` (painel real, mesma origem da API) somente depois que Cloudflare Access autentica o visitante. Usa `ctx.access` do runtime, nao confia em cabecalhos de email ou cookies da Nova Frota. O proprio Worker confere email exato e AUD da aplicacao Access.

**Configuracao no painel Cloudflare, exclusivamente no portalfrete-super-admin-staging:**

1. Abrir a aba Access do Worker, escolher proteger **este Worker** e selecionar **All traffic / Todo o trafego**, incluindo `workers.dev` principal, e nao apenas previews.
2. Em Authentication policy, permitir apenas a conta autorizada (ou regra de email unico no Zero Trust). Evitar a regra ampla Everyone, dominio inteiro ou bypass.
3. Em Zero Trust > Access > Applications, abrir a aplicacao do Worker e identificar o **Application Audience (AUD) Tag**, sem divulgar tokens JWT.
4. Em Settings > Variables and Secrets do Worker isolado, criar dois Secrets: `SUPER_ADMIN_ACCESS_EMAIL` (email exato da conta que faz login no Access) e `SUPER_ADMIN_ACCESS_AUD` (AUD tag da aplicacao Access). Nao inserir estes segredos no repo nem reutilizar variaveis da producao.
5. Abrir `https://portalfrete-super-admin-staging.luziano-transportes.workers.dev/super-admin`, concluir login Access. O painel deve abrir somente para o email e AUD autorizados. Visitantes nao autorizados recebem 403.

**Nao configurar `PORTAL_KEY`, `APPS_SCRIPT_URL` nem KV de sessao de producao neste Worker.** A identidade do proprietario no staging e um principal interno ACCESS_OWNER criado SOMENTE apos `ctx.access` validado. A Nova Frota nao e modificada. A leitura e autenticada com Access; operacoes de escrita ainda exigem, separadamente, OIDC RS256 com MFA valida e flags opt-in. Cloudflare Access sozinho nao concede permissoes de escrita.

Se a politica Access for removida, `ctx.access` sera ausente e a API/HTML retornara 403 mesmo que alguem envie manualmente cabecalhos de email. O health pode permanecer publico se o Access externo nao estiver habilitado, mas nao revela dados de tenant.

## 3. Configurar proprietario e provedor OIDC com MFA
Em homologacao, configurar segredos do Worker por ambiente:

- SUPER_ADMIN_USER: login exato do proprietario, na autenticacao do Portal.
- SUPER_ADMIN_SUBJECT: identificador imutavel sub da identidade global.
- SUPER_ADMIN_OIDC: JSON emitido pela configuracao do provedor confiavel, com issuer, audience, subject, jwksUrl e mfaPolicy.
- SUPER_ADMIN_TENANT_WRITES: enabled somente apos validar OIDC, D1 e auditoria.
- SUPER_ADMIN_MEMBERSHIP_WRITES: enabled somente em homologacao, depois de validar a escrita do D1.
- SUPER_ADMIN_BRAND_WRITES: enabled somente em homologacao, depois de provisionar a binding TENANT_BRANDS.
- SUPER_ADMIN_LEGACY_USERS_READ: permanecer disabled ate validar o Apps Script real.

Exemplo estrutural de SUPER_ADMIN_OIDC (valores ficticios, nao usar em producao):

    {
      "issuer":"https://id.example.invalid",
      "audience":"portal-super-admin",
      "subject":"stable-unique-subject",
      "jwksUrl":"https://id.example.invalid/jwks",
      "mfaPolicy":{"acceptedAmr":["mfa"]}
    }

A claim amr/acr correta depende do provedor. Verificar assinatura RS256, emissor, audiencia, sub e MFA documentada. O backend exige tokens com tempo de vida de ate 300 segundos. **A entrada manual de JWT na interface e exclusiva da fase de homologacao**: antes da producao, substituir por fluxo OIDC confiavel sem copiar/colar tokens, com renovacao segura, CSRF e logout da sessao elevada. Segredos podem ser criados com npx wrangler secret put <NOME> usando a configuracao do ambiente correto.

## 4. Operacoes disponiveis em homologacao
- GET /v1/super-admin/me: recursos do ambiente e sessao global.
- GET /v1/super-admin/transportadoras: catalogo D1 e Nova Frota legada.
- POST /v1/super-admin/authorize: verifica JWT assinado com MFA, sem alterar dados.
- POST /v1/super-admin/transportadoras: cria transportadora inativa.
- PATCH /v1/super-admin/transportadoras/{id}: altera nome e status.
- PUT /v1/super-admin/transportadoras/{id}/modules: grava modulo(s) autorizados.
- GET /v1/super-admin/transportadoras/{id}/auditoria: ultimos 50 eventos.
- GET /v1/super-admin/transportadoras/{id}/usuarios: cadastro legado opt-in ou vinculos D1.
- POST /v1/super-admin/transportadoras/{id}/usuarios: cadastra vinculo inativo apenas no catalogo (exige SUPER_ADMIN_MEMBERSHIP_WRITES=enabled).
- PATCH /v1/super-admin/transportadoras/{id}/usuarios/{userId}: altera perfil ou status de vinculo, sem modificar senha ou criar credencial.
- GET /v1/super-admin/transportadoras/{id}/logo: entrega logo privada ao proprietario autenticado.
- PUT /v1/super-admin/transportadoras/{id}/logo: upload binario autenticado com MFA, exige SUPER_ADMIN_BRAND_WRITES=enabled e TENANT_BRANDS.

Todas as gravacoes exigem cookie de proprietario valido + JWT verificado com MFA + SUPER_ADMIN_TENANT_WRITES=enabled + TENANTS_DB. A Nova Frota legada nao pode ser criada, renomeada, desativada ou ter usuarios/logos alterados por essas rotas. Um vinculo D1 **NAO** significa conta autenticavel: a integracao de identidade e permissao tenant-aware esta pendente.

## 5. Criterios antes de ativar em producao
- Workflow Super Admin Security Tests verde no commit de release.
- D1 de homologacao migrado e operacoes CRUD/auditoria verificadas na interface.
- MFA validada com o provedor real; testar expiracao, revogacao e conta nao proprietaria.
- Trocar o campo de JWT manual por fluxo de identidade OIDC dedicado, sem exposicao de token ao usuario.
- CORS e cookie funcionando no dominio real de hospedagem, sem enfraquecer a protecao.
- Revisao de perfis, quantidade e contrato de usuarios Apps Script feita separadamente.
- Modulos das novas empresas nao concedem ainda acesso ao sistema legado: exigir autorizacao tenant-aware em cada API antes de liberar uso real multiempresa.
- Avaliacao e autorizacao explicita para qualquer merge/deploy de producao.

## 6. Reversao
Desativar SUPER_ADMIN_TENANT_WRITES no Worker de homologacao imediatamente. Isso bloqueia gravacoes sem apagar D1. O catalogo e historico permanecem para auditoria; dados legados da Nova Frota nao sao modificados.
