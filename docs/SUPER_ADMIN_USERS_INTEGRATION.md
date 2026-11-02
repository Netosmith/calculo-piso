# Integração segura de usuários do Super Admin

## Situação verificada
- A sessão do Portal Frete é assinada no Worker e autentica a conta existente por meio do fluxo legado.
- A tabela planejada `portal_tenant_users` contém apenas `tenant_id`, `user_id`, `role`, `active` e `created_at`. Não contém nome, login, último acesso ou senha.
- A nova rota GET `/v1/super-admin/transportadoras/:tenantId/usuarios` é somente leitura, exige autorização global e retorna **apenas vínculos D1**. Ela falha com 503 se TENANTS_DB não estiver configurado. Lista vazia não equivale a ausência de usuários legados.
- Não há banco TENANTS_DB provisionado nem migração aplicada nesta etapa. Nenhuma alteração foi implantada em produção.

## Etapas antes da listagem completa
1. Localizar o cadastro de usuários e autenticação no Apps Script da Nova Frota e identificar campos realmente disponíveis.
2. Criar integração autenticada de leitura com escopo por tenant e proibir retorno de senhas, hashes e tokens.
3. Estabelecer identificador estável e vínculo entre login legado e tenant. Resolver duplicidades e desativados sem alterar contas.
4. Testar isolamento, paginação, limites, auditoria de consulta e tratamento de indisponibilidade.
5. Exibir nome/login/perfil/situação no painel real somente depois de confirmar a origem. A prévia continua fictícia.
6. Implementar alterações de perfil, suspensão e redefinição de senha apenas após integração OIDC/MFA, autorização reforçada, revogação de sessões e auditoria.

## Segurança de dados
Não sincronizar credenciais nem permitir reset de senha por edição direta de planilhas. Não expor listagem global em endpoint público ou no HTML estático. O painel demonstrativo hospedado no Pages não acessa a API real.
