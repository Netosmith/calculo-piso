-- Nova estrutura isolada. Não altera tabelas legadas de frota/monitoramento.
-- Aplicar somente após backup e revisão do ambiente de destino.
CREATE TABLE IF NOT EXISTS portal_tenants (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK(status IN ('active','inactive')),
  logo_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS portal_tenant_modules (
  tenant_id TEXT NOT NULL REFERENCES portal_tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id,module_key)
);
CREATE TABLE IF NOT EXISTS portal_tenant_users (
  tenant_id TEXT NOT NULL REFERENCES portal_tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMINISTRADOR','COMERCIAL','OPERACIONAL','PISO')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id,user_id)
);
CREATE TABLE IF NOT EXISTS portal_tenant_audit (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portal_tenant_users_user ON portal_tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_tenant_audit_tenant_date ON portal_tenant_audit(tenant_id,created_at);
