# Portal independente de transportadoras: homologacao

## Estado da implementacao

O Super Admin ja administra transportadoras, modulos, vinculos e logos no D1/R2 de homologacao. A proxima etapa adiciona login com senha **separado da Nova Frota**, sessao HttpOnly propria e cadastros reais de fretes isolados.

O codigo do portal esta em `worker/src/tenant-portal.js`. O Worker separado sera `portalfrete-tenant-staging`, com configuracao `worker/wrangler.tenant-staging.jsonc`. **Nao** usar `worker/wrangler.jsonc`, `portalfrete-api`, `portal-frota` nem o Apps Script legado.

### 1. Aplicar somente o SQL adicional

No painel Cloudflare, entrar em **Storage & Databases > D1 > portal-super-admin-tenants-staging > Console**. Copiar todo o conteudo do arquivo:

`worker/migrations/super-admin/0002_tenant_portal.sql`

Executar nesse banco exclusivo. Nao repetir o arquivo `0001_tenants.sql`: as quatro tabelas do Super Admin ja foram criadas manualmente. Nao executar `wrangler d1 migrations apply --remote`, pois o Console nao registra o historico do Wrangler.

Confirmar com:

```sql
SELECT name FROM sqlite_master
WHERE type='table' AND name IN (
  'portal_tenant_credentials',
  'portal_tenant_sessions',
  'portal_tenant_login_attempts',
  'portal_tenant_freights'
) ORDER BY name;
```

Esperado: quatro tabelas. As existentes nao sao apagadas, e o arquivo nao insere usuarios ou senhas.

### 2. Publicar um Worker separado de login

Em **Compute > Workers & Pages > Create application > Worker > Start with Hello World**, criar o Worker **portalfrete-tenant-staging**. Ele deve ficar distinto do `portalfrete-super-admin-staging` (protegido pelo Cloudflare Access) e do `portalfrete-api` (producao Nova Frota).

Na aba **Bindings / Associacoes**, vincular:

- **D1**: nome da variavel `TENANTS_DB`, banco `portal-super-admin-tenants-staging`.
- **R2**: nome da variavel `TENANT_BRANDS`, bucket `portal-super-admin-brands-staging`.

**Nao habilitar Cloudflare Access global neste novo Worker**: os usuarios novos entram com usuario e senha proprios; proteger tudo com o Access exclusivo do proprietario impediria o login deles. O Worker nao publica nenhum endpoint admin e todas as APIs operacionais exigem sessao propria.

Em **Settings > Builds**, conectar GitHub `Netosmith/calculo-piso` com:

| Campo | Configuracao |
|---|---|
| Branch | `feature/super-admin-panel-foundation` |
| Root directory / Caminho | `/worker` |
| Build | `npm ci && npm test` |
| Deploy | `npx wrangler deploy --config wrangler.tenant-staging.jsonc` |
| Preview builds | Desativados |
| API token | Novo token de build, dedicado a este Worker |

Nao conectar a branch `main`, nao substituir `portalfrete-api` e nao publicar com `npx wrangler deploy` sem `--config`.

### 3. Validar primeiro a infraestrutura

Depois da primeira implantacao, abrir:

`https://portalfrete-tenant-staging.luziano-transportes.workers.dev/health`

Esperado:

```json
{"ok":true,"environment":"tenant-staging","database":"ready"}
```

Qualquer 503 indica associacao D1/R2 ou migracao faltando. Nao iniciar testes com usuarios ate o health confirmar.

### 4. Preparar primeiro usuario

No Super Admin ja protegido:

`https://portalfrete-super-admin-staging.luziano-transportes.workers.dev/super-admin`

Selecionar **Transportadora Teste** (ID `teste-01`). Verificar:

1. Vinculo `USUARIO.TESTE` ativo.
2. Empresa **ativa** (status ainda pode estar inativa apos criacao).
3. Modulos `Fretes` e `BI` salvos.
4. Na aba Usuarios, usar botao **Definir senha** para criar senha forte de 12 a 128 caracteres. Este botao so e habilitado depois que a tabela `portal_tenant_credentials` existe e a atualizacao do Worker admin foi publicada. A senha e transmitida por HTTPS, guardada apenas como hash com salt PBKDF2 e nunca retornada pela API. Nao colar senha em conversas ou arquivos.

Depois abrir:

`https://portalfrete-tenant-staging.luziano-transportes.workers.dev/?tenant=teste-01`

Entrar com o identificador da empresa, `USUARIO.TESTE` e a senha definida. Confirmar modulo Fretes, criar um frete ficticio, sair, entrar novamente e confirmar persistencia. Confirmar BI e logo. Em outra empresa, nao deve aparecer nenhum frete da primeira.

### Limites da fase atual

- O portal de novos tenants nao tem acesso aos fretes, usuarios ou Apps Script da Nova Frota.
- Registro de vinculo D1 por si so nao cria credencial: exige senha definida e empresa/usuario ativos.
- Modulos `Fretes` (cadastro e status) e `BI` sao funcionais nesta fase. Os demais cards aparecem como *Em preparacao*, mesmo quando habilitados no Super Admin. Nao vincular essas paginas diretamente as rotas legadas.
- Senhas sao guardadas com PBKDF2-SHA256 e salt aleatorio; sessões sao tokens aleatorios armazenados apenas pelo hash no D1, cookies HttpOnly/Secure/SameSite Strict, limitacao de tentativas por usuario e revogacao de sessoes ao redefinir senha. Reducao de acesso por status da empresa/usuario e aplicada a cada requisicao.
- O modulo de fretes de novos tenants ainda nao reproduz toda a operacao do `fretes.html` legado. E uma implementacao isolada, funcional e evolutiva para homologacao.
- Nenhuma migracao sera aplicada pelo GitHub, nenhuma conta de producao sera alterada e nenhum PR sera mesclado automaticamente.

## Reversao

Desativar ou retirar do ar apenas o Worker `portalfrete-tenant-staging`; os registros do D1 de homologacao permanecem. O Worker principal `portalfrete-api` e o Apps Script da Nova Frota nao sao afetados.
