-- Apply only to dedicated TENANTS_DB after backup, never to FLEET_DB.
CREATE TABLE IF NOT EXISTS portal_admin_token_uses (
  subject TEXT NOT NULL,
  jti TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (subject, jti)
);
CREATE INDEX IF NOT EXISTS idx_admin_token_expiry ON portal_admin_token_uses(expires_at);
