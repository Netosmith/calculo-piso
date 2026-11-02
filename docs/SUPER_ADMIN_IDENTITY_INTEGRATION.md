# Integração de identidade do Super Admin

## Estado atual
O acesso de leitura usa a sessão legada e o segredo `SUPER_ADMIN_USER`. A autorização de escrita exige `SUPER_ADMIN_SUBJECT`, `authSubject`, `authAssurance=mfa` e `authProviderVerified=true`, mas **nenhum provedor externo confiável está integrado**. Por isso, endpoints de escrita permanecem desabilitados.

## Arquitetura necessária
1. Escolher provedor OIDC com MFA obrigatório e identificador `sub` imutável. Exemplos: Cloudflare Access ou outro IdP compatível, sujeito à configuração da conta.
2. Validar no Worker a assinatura JWT usando JWKS obtido do emissor confiável. Validar também `iss`, `aud`, `exp`, `nbf` e algoritmo permitido. Não aceitar campos de identidade enviados pelo navegador.
3. Confirmar MFA com evidência documentada do provedor (`acr`/`amr` ou política de acesso verificada no servidor). Não inferir MFA a partir de nome de usuário.
4. Vincular `sub` à configuração secreta `SUPER_ADMIN_SUBJECT`; aplicar regra de tenant autorizado e sessão ativa.
5. Emitir uma sessão de privilégio elevado, curta, vinculada ao provedor e protegida contra CSRF. Revalidar identidade para ações críticas.
6. Somente após testes de integração e revisão de segurança, conectar os endpoints de escrita ao serviço de catálogo e auditoria.

## Checklist de homologação
- Token inválido, expirado, emissor errado e audiência errada são negados.
- Ausência de MFA e tentativa de falsificar `authProviderVerified` são negadas.
- Usuário com perfil ADMINISTRADOR da transportadora não recebe acesso global.
- Desativar transportadora bloqueia novos acessos sem apagar dados.
- Cada alteração de módulos e usuários gera auditoria transacional.
- Recuperação de conta, rotação de chaves e revogação de sessão são testadas.

**Não adicionar valores reais de segredos, chaves ou tokens ao repositório.**
