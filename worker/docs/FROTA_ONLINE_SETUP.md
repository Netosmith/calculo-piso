# Gestão de Frota: ativação online

Código backend preparado, mas NÃO implantado nem vinculado à produção automaticamente.

## 1. Cloudflare D1
Na conta Cloudflare > Workers & Pages > D1 > Create database.
Nome sugerido: `portal-frota`.
Copie o `database_id` real gerado e adicione em `worker/wrangler.jsonc`:

```json
"d1_databases": [{"binding":"FLEET_DB","database_name":"portal-frota","database_id":"ID_REAL_DO_SEU_D1"}]
```

Execute a migração **remota** após backup e conferência:
```bash
cd worker
npx wrangler d1 execute portal-frota --remote --file=migrations/0001_fleet.sql
```

## 2. Cloudflare R2
Crie bucket privado `portal-frota-documentos`. **Não atribua domínio público.**
Adicione ao array `r2_buckets` existente, sem remover CLIENT_LOGOS:

```json
{"binding":"FLEET_FILES","bucket_name":"portal-frota-documentos"}
```

## 3. Implantação
Valide as permissões ADMINISTRADOR / COMERCIAL com conta de teste. Depois:
```bash
cd worker
npx wrangler deploy
```
O controlador retornará 503 se D1 ou R2 ainda não estiver configurado, sem gravar dados localmente por engano.

## 4. Próxima tarefa para entrada definitiva em produção
Conectar o frontend à API /v1/fleet/records, /v1/fleet/sets e /v1/fleet/documents (sem fallback silencioso local), migrar cadastros locais com confirmação e testar upload/download/alteração/exclusão.
IMPORTANTE: o frontend ainda salva no navegador e não está online. Não envie CNH/fotos pessoais antes da integração e da verificação das políticas de acesso.

## 5. Segurança antes de dados reais
Sessão HttpOnly assinada e autorização no servidor; restringir por perfil conforme política; adicionar proteção CSRF nas operações de escrita, limitação de requisições, trilha de auditoria, política de retenção e procedimentos de backup/recuperação e LGPD. A autenticação atual usa cookie SameSite=Strict: validar origem final e política de CORS com a interface.
