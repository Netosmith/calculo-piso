# Ativacao segura do Super Admin - checklist operacional

**Estado:** Backend de gestao de transportadoras e modulos implementado e testado na branch feature/super-admin-panel-foundation. Nao publicado em producao. O cadastro de usuarios legados e operacoes de usuario permanecem somente leitura. A pagina de preview publica utiliza dados ficticios.

## 1. Ambiente de homologacao Cloudflare
Usar um Worker de homologacao com nome, dominio, segredos e D1 dedicados. Nao copiar tokens ou senhas pessoais para o repositorio. A conta proprietaria deve conseguir autenticar pelo login do Portal Frete em dominio de homologacao confiavel. O dominio do painel e da API precisa manter compatibilidade com cookies Secure, HttpOnly e SameSite=Strict.

O Worker exige APPS_SCRIPT_URL e PORTAL_KEY conforme a configuracao atual de validacao. Nao apontar homologacao para a base legada real sem autorizacao e regras de acesso.

## 2. Criar D1 isolado
No diretorio worker, com Wrangler autenticado na conta correta:

    npx wrangler d1 create portal-super-admin-tenants

O comando retorna o UUID do banco. Adicionar ao **Worker de homologacao**, preservando todas as demais bindings, a entrada abaixo no array d1_databases do respectivo wrangler.jsonc:

    {
      "binding": "TENANTS_DB",
      "database_name": "portal-super-admin-tenants",
      "database_id": "UUID_RETORNADO_PELO_CLOUDFLARE",
      "migrations_dir": "migrations/super-admin"
    }

**Nao reutilizar FLEET_DB.** A migracao fica isolada em worker/migrations/super-admin/0001_tenants.sql, e nao na pasta raiz de migracoes.

Executar primeiro em D1 local:

    npx wrangler d1 migrations apply TENANTS_DB --local

Depois de conferir banco e conta de homologacao, aplicar apenas ao D1 dedicado:

    npx wrangler d1 migrations apply TENANTS_DB --remote

Nao aplicar a migracao em FLEET_DB ou em bancos de clientes existentes. Nao realizar deploy do Worker de producao nesta etapa.

## 3. Configurar proprietario e provedor OIDC com MFA
Em homologacao, configurar segredos do Worker por ambiente:

- SUPER_ADMIN_USER: login exato do proprietario, na autenticacao do Portal.
- SUPER_ADMIN_SUBJECT: identificador imutavel sub da identidade global.
- SUPER_ADMIN_OIDC: JSON emitido pela configuracao do provedor confiavel, com issuer, audience, subject, jwksUrl e mfaPolicy.
- SUPER_ADMIN_TENANT_WRITES: enabled somente apos validar OIDC, D1 e auditoria.
- SUPER_ADMIN_LEGACY_USERS_READ: permanecer disabled ate validar o Apps Script real.

Exemplo estrutural de SUPER_ADMIN_OIDC (valores ficticios, nao usar em producao):

    {
      "issuer":"https://id.example.invalid",
      "audience":"portal-super-admin",
      "subject":"stable-unique-subject",
      "jwksUrl":"https://id.example.invalid/jwks",
      "mfaPolicy":{"acceptedAmr":["mfa"]}
    }

A claim amr/acr correta depende do provedor. Verificar assinatura RS256, emissor, audiencia, sub e MFA documentada. O backend exige tokens com tempo de vida de ate 300 segundos. Segredos podem ser criados com npx wrangler secret put <NOME> usando a configuracao do ambiente correto.

## 4. Operacoes disponiveis em homologacao
- GET /v1/super-admin/me: recursos do ambiente e sessao global.
- GET /v1/super-admin/transportadoras: catalogo D1 e Nova Frota legada.
- POST /v1/super-admin/authorize: verifica JWT assinado com MFA, sem alterar dados.
- POST /v1/super-admin/transportadoras: cria transportadora inativa.
- PATCH /v1/super-admin/transportadoras/{id}: altera nome e status.
- PUT /v1/super-admin/transportadoras/{id}/modules: grava modulo(s) autorizados.
- GET /v1/super-admin/transportadoras/{id}/auditoria: ultimos 50 eventos.
- GET /v1/super-admin/transportadoras/{id}/usuarios: cadastro legado opt-in ou vinculos D1.

Todas as gravacoes exigem cookie de proprietario valido + JWT verificado com MFA + SUPER_ADMIN_TENANT_WRITES=enabled + TENANTS_DB. A Nova Frota legada nao pode ser criada, renomeada ou desativada por essas rotas.

## 5. Criterios antes de ativar em producao
- Workflow Super Admin Security Tests verde no commit de release.
- D1 de homologacao migrado e operacoes CRUD/auditoria verificadas na interface.
- MFA validada com o provedor real; testar expiracao, revogacao e conta nao proprietaria.
- CORS e cookie funcionando no dominio real de hospedagem, sem enfraquecer a protecao.
- Revisao de perfis, quantidade e contrato de usuarios Apps Script feita separadamente.
- Modulos das novas empresas nao concedem ainda acesso ao sistema legado: exigir autorizacao tenant-aware em cada API antes de liberar uso real multiempresa.
- Avaliacao e autorizacao explicita para qualquer merge/deploy de producao.

## 6. Reversao
Desativar SUPER_ADMIN_TENANT_WRITES no Worker de homologacao imediatamente. Isso bloqueia gravacoes sem apagar D1. O catalogo e historico permanecem para auditoria; dados legados da Nova Frota nao sao modificados.
