-- Exclusao auditada de viagens Nova Frota pelo proprietario do Portal.
-- Sem chave estrangeira para preservar auditoria mesmo apos remover a viagem.
CREATE TABLE IF NOT EXISTS monitor_trip_deletion_audit (
  id TEXT PRIMARY KEY NOT NULL,
  trip_id TEXT NOT NULL,
  plate TEXT NOT NULL,
  driver TEXT NOT NULL,
  was_active INTEGER NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  backup_key TEXT NOT NULL,
  positions_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitor_trip_deletion_audit_date
  ON monitor_trip_deletion_audit(deleted_at DESC);
