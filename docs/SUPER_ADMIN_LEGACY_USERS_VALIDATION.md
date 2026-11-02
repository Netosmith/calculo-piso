# Homologacao da listagem legada de usuarios

## Estado atual
- O codigo esta apenas na branch feature/super-admin-panel-foundation.
- A consulta real exige SUPER_ADMIN_LEGACY_USERS_READ=enabled e uma sessao de proprietario valida.
- Nao configurar essa chave no Worker de producao ate validar em ambiente isolado.
- A pagina de demonstracao publica usa dados ficticios; nao conectar dados pessoais a ela.

## Validacoes antes de habilitar
1. Executar npm test na pasta worker e conferir o workflow Super Admin Security Tests.
2. Confirmar no Apps Script que portal_gateway/cadastros/read com resource=usuarios aceita a identidade administrativa e devolve uma lista no formato data, data.data ou data.rows.
3. Confirmar que a resposta contem os campos Usuario, Nome, Perfil, Estados, Ativo e que o backend descarta quaisquer campos extras, especialmente Senha.
4. Confirmar se ha perfis adicionais alem dos sete ja identificados; ajustar mapeamento e testes antes da ativacao.
5. Confirmar que a leitura do Apps Script exige autorizacao no servidor, sem confiar apenas em parametros auth enviados pelo cliente.
6. Testar ambiente isolado com conta de proprietario, sem copiar senhas ou exportar dados pessoais para logs.
7. Verificar se o total supera 500; nesse caso, implementar paginacao antes de habilitar.
8. Verificar isolamento por transportadora e confirmar que outras empresas nunca consultam o cadastro da Nova Frota.
9. Confirmar CORS e cookie de sessao no dominio real de homologacao, sem flexibilizar SameSite/HttpOnly/Secure.

## Teste de aceitacao
- GET /v1/super-admin/me devolve superAdmin=true apenas para o proprietario.
- GET /v1/super-admin/transportadoras/nova-frota/usuarios devolve somente campos permitidos quando habilitado.
- Sem configuracao de leitura, o endpoint nao acessa o Apps Script.
- Outros tenants nao sao consultados no Apps Script legado.
- Nenhum endpoint de escrita fica habilitado.

## Reversao
Remover a configuracao SUPER_ADMIN_LEGACY_USERS_READ do ambiente de homologacao e verificar que a consulta deixa de chamar o Apps Script. Nenhuma migracao D1 ou alteracao de cadastro legado e necessaria.
