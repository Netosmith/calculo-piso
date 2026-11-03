# Super Admin: provisionamento seguro

## Conta inicial
- Login informado pelo titular: `LUZIANO`.
- O login é um identificador de busca para provisionamento, **não** é uma prova de identidade nem uma autorização por si só.
- Somente o titular dessa conta deverá receber o papel global `SUPER_ADMIN`.
- Não atribuir automaticamente esse papel a qualquer sessão cujo texto de `usuario` seja `LUZIANO`, sem conferir a identidade autenticada no cadastro confiável.

## Requisitos antes de habilitar
1. Criar registro global de identidade imutável (ID interno) e vincular a conta existente `LUZIANO` após confirmação no cadastro de usuários ativo.
2. Provisionar a concessão global por migração administrativa controlada, com registro de auditoria, sem endpoint público de autoatribuição.
3. Validar `SUPER_ADMIN` no Worker em todas as rotas `/v1/super-admin/*`, com consulta à fonte de verdade e status ativo da conta.
4. Garantir que administradores de transportadoras não possam criar, editar ou atribuir o papel global.
5. Separar as permissões globais das permissões por transportadora; cada ação deve conferir empresa e módulo no backend.
6. Suspender e revogar sessões com efeito imediato quando necessário; os tokens atuais assinados são stateless.
7. Ativar MFA para a conta global, rate limiting no login e auditoria de ações sensíveis antes da entrada em produção.
8. Nunca publicar credenciais, chaves, IDs secretos ou tokens no GitHub.

## Estado desta branch
`pages/super-admin.html` é apenas a estrutura visual. O endpoint `/v1/super-admin/me` ainda não existe; por isso a página falha de modo fechado. As ações de escrita continuam desabilitadas.

**Não efetuar merge em produção até implementar e testar o backend de autenticação, a persistência e o isolamento de transportadoras.**
