# Plano de implantação do banco multi-transportadoras

A migração `worker/migrations/super-admin/0001_tenants.sql` é **somente preparatória**. Não foi aplicada ao banco D1 de produção.

## Política de dados
- Nunca executar `DROP`, `DELETE` ou renomear tabelas legadas para iniciar a arquitetura multi-tenant.
- Nova Frota mantém Google Apps Script, planilhas, documentos e dados existentes.
- Não inserir usuários globais em `portal_tenant_users`: Super Admin tem identidade separada.
- Não ativar novos tenants até existir autenticação vinculada ao tenant, verificação de módulos no servidor e armazenamento isolado.
- A tabela de módulos começa com `enabled=0`, bloqueando novos cards por padrão.
- Criar backup testado do D1 antes da primeira aplicação.
- Evitar execução automática desta migração no deploy do Worker; usar processo de migração revisado.

## Próxima implementação
1. Provisionar D1 separado para catálogo de tenants, sem reutilizar `FLEET_DB`.
2. Acrescentar binding dedicado, por exemplo `TENANTS_DB`, somente após provisionamento.
3. Implementar APIs de leitura/escrita com validação de permissões e auditoria.
4. Fazer seed idempotente da Nova Frota **somente no catálogo**, sem tocar nos dados operacionais.
5. Implementar identidade global imutável e MFA antes de permitir ações destrutivas.
6. Testar isolamento, desligamento de transportadora, módulos desativados e rollback.

## Observação
A existência de uma linha no catálogo **não** autoriza acesso às planilhas ou ao banco de frota. O controle deve ocorrer no backend em cada requisição.
