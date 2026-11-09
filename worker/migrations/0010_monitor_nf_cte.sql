-- Dados fiscais opcionais para viagens da Nova Frota.
-- Separado do cadastro inicial para permitir adicionar NF / CT-e apos inicio.
CREATE TABLE IF NOT EXISTS monitor_trip_documents (
  trip_id TEXT PRIMARY KEY NOT NULL REFERENCES monitor_trips(id) ON DELETE CASCADE,
  nf TEXT NOT NULL DEFAULT '',
  cte TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS monitor_trip_documents_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES monitor_trips(id) ON DELETE CASCADE,
  nf_before TEXT NOT NULL DEFAULT '',
  nf_after TEXT NOT NULL DEFAULT '',
  cte_before TEXT NOT NULL DEFAULT '',
  cte_after TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitor_trip_documents_audit_trip
  ON monitor_trip_documents_audit(trip_id, changed_at DESC);
