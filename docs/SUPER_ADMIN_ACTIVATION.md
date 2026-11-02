# Ativacao segura do Super Admin - checklist operacional

**Estado:** Backend de gestao de transportadoras e modulos implementado e testado na branch feature/super-admin-panel-foundation. Nao publicado em producao. O cadastro de usuarios legados permanece somente leitura. O painel agora suporta vinculos D1 de novas transportadoras (sem criar login ou senha) e upload de logo por empresa em R2 isolado, ambos desativados por padrao. A pagina de preview publica utiliza dados ficticios.

## 1. Ambiente de homologacao Cloudflare
Usar um Worker de homologacao com nome, dominio, segredos e D1 dedicados. Nao copiar tokens ou senhas pessoais para o repositorio. A conta proprietaria deve conseguir autenticar pelo login do Portal Frete em dominio de homologacao confiavel. O dominio do painel e da API precisa manter compatibilidade com cookies Secure, HttpOnly e SameSite=Strict.

O Worker exige APPS_SCRIPT_URL e PORTAL_KEY conforme a configuracao atual de validacao. Nao apontar homologacao para a base legada real sem autorizacao e regras de acesso.

## Banco D1 de homologacao criado em 2026-11-02

- Nome: `portal-super-admin-tenants-staging`.
- ID: `9103c28a-c224-4781-9d3f-fd735b546cd9`.
- Configuracao dedicada: `worker/wrangler.super-admin-staging.jsonc`; **nao** alterar o Worker principal `worker/wrangler.jsonc` para este D1.
- O provisionamento do banco foi confirmado por captura de tela; a aplicacao do SQL ainda precisa ser confirmada.
- Para evitar repeticao da criacao, **pular o comando `d1 create`** abaixo e ir diretamente para aplicar a migracao ao banco dedicado.
- Se usar o Console D1 do painel, executar as instrucoes idempotentes em `worker/migrations/super-admin/0001_tenants.sql` no banco com este nome e conferir as quatro tabelas. O Console nao registra a migracao automaticamente na tabela de controle do Wrangler; antes de usar o fluxo `d1 migrations apply`, conferir o estado de migracoes com o Wrangler.
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

Executar primeiro em D1 local:

    npx wrangler d1 migrations apply TENANTS_DB --local

Depois de conferir banco e conta de homologacao, aplicar apenas ao D1 dedicado:

    npx wrangler d1 migrations apply TENANTS_DB --remote

Nao aplicar a migracao em FLEET_DB ou em bancos de clientes existentes. Nao realizar deploy do Worker de producao nesta etapa.

## 2.1. Criar biblioteca R2 dedicada para logos das novas empresas
No mesmo ambiente de homologacao:

    npx wrangler r2 bucket create portal-super-admin-brands-staging

No wrangler do Worker de homologacao, adicionar uma binding R2 **TENANT_BRANDS** para esse bucket, sem reutilizar CLIENT_LOGOS ou FLEET_FILES. O painel aceita apenas PNG, JPG ou WebP com ate 2 MB e armazena chave aleatoria privada por transportadora. A logo existente so e substituida apos auditoria e atualizacao bem-sucedidas no D1.

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
