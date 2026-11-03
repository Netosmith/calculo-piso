# Revisao tecnica do Super Admin - 2026-11-02

> **Registro historico da auditoria inicial.** O estado mais recente, incluindo testes concluídos e APIs CRUD protegidas, está em [SUPER_ADMIN_ACTIVATION.md](SUPER_ADMIN_ACTIVATION.md). As referencias abaixo a operacoes de escrita ainda nao implementadas ou testes nao confirmados descrevem o inicio da revisao, nao o estado atual.

## Confirmado no codigo da branch
- API de Super Admin roteada em worker/src/router.js e protegida por sessao e identificador SUPER_ADMIN_USER.
- Leitura de usuarios legados so ocorre para tenant nova-frota com SUPER_ADMIN_LEGACY_USERS_READ=enabled.
- Projecao explicita de campos exclui Senha e quaisquer propriedades adicionais.
- Listagem de usuarios D1 e apenas vinculos, nao o cadastro completo.
- Operacoes de escrita permanecem bloqueadas.
- Pagina pages/super-admin.html consulta a API real e mostra origem e busca; pagina de preview publica permanece demonstrativa.
- Workflow de testes definido em .github/workflows/super-admin-security.yml.

## Riscos e pendencias
1. CRITICO: Sem execucao confirmada dos testes apos os ultimos commits. Nao fazer merge.
2. CRITICO: Origem e contrato reais do Apps Script nao foram validados. Nao habilitar leitura em producao.
3. ALTO: SUPER_ADMIN_USER compara nome de usuario da sessao. OIDC/MFA e identidade global robusta ainda sao exigidos para ativar administracao com escrita.
4. ALTO: TENANTS_DB e migracoes ainda nao provisionados; isolamento multi-tenant de ponta a ponta nao esta demonstrado.
5. ALTO: Cookies SameSite=Strict podem impedir autenticacao em hospedagem cross-site (Pages/GitHub Pages versus dominio da API). Testar em dominio de homologacao com mesma origem/site; nao afrouxar cookies para contornar.
6. MEDIO: A leitura legada limita a 500 registros e rejeita perfis nao mapeados. Confirmar quantidade e perfis reais antes de ativar.
7. MEDIO: A consulta D1 devolve somente vinculos e nao deve ser apresentada como lista integral de usuarios.
8. MEDIO: Ausencia de testes ponta a ponta com Apps Script e interface real.
9. MEDIO: Revisar permissao do gateway no Apps Script, para nao confiar em auth enviado pelo cliente.
10. MEDIO: Verificar CORS, politicas de cache, rate limit e auditoria de consultas administrativas em homologacao.

## Correcao aplicada
O tratamento de erro da leitura legada nao registra mais a mensagem bruta recebida do Apps Script.

## Condicoes para avancar
- Workflow de testes verde, inclusive novos testes.
- Contrato do Apps Script revisado e resposta real validada com dados nao sensiveis.
- Dominio e cookies de homologacao validados.
- Identidade forte e auditoria antes de qualquer escrita.
- Aprovacao explicita para deploy ou merge.
