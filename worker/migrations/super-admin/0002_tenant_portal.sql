-- Isolated staging tenant portal tables. Apply ONLY to portal-super-admin-tenants-staging.
-- 0001 was applied in Cloudflare D1 console; DO NOT run it again.
-- A catalog membership alone never grants login: it needs an active tenant,
-- active member and a separately provisioned password credential.
CREATE TABLE IF NOT EXISTS portal_tenant_credentials (
 tenant_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 password_salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 iterations INTEGER NOT NULL CHECK(iterations >= 100000),
 version TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,user_id),
 FOREIGN KEY (tenant_id,user_id) REFERENCES portal_tenant_users(tenant_id,user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS portal_tenant_sessions (
 token_hash TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 credential_version TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (tenant_id,user_id) REFERENCES portal_tenant_users(tenant_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_portal_tenant_sessions_user
 ON portal_tenant_sessions(tenant_id,user_id);
CREATE INDEX IF NOT EXISTS idx_portal_tenant_sessions_exp
 ON portal_tenant_sessions(expires_at);

CREATE TABLE IF NOT EXISTS portal_tenant_login_attempts (
 attempt_key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL CHECK(attempts >= 0),
 window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_tenant_freights (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES portal_tenants(id) ON DELETE CASCADE,
 origem TEXT NOT NULL,
 destino TEXT NOT NULL,
 produto TEXT NOT NULL,
 valor_ton REAL NOT NULL CHECK(valor_ton > 0 AND valor_ton <= 100000),
 status TEXT NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto','finalizado')),
 criado_por TEXT NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portal_tenant_freights_tenant
 ON portal_tenant_freights(tenant_id,criado_em DESC,id DESC);
