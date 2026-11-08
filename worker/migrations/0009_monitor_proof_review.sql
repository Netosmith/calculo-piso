-- Monitoramento Nova Frota: coleta privada de selfie e comprovante, com revisão humana.
-- A obrigatoriedade começa apenas nas viagens novas (proof_required=1).
CREATE TABLE IF NOT EXISTS monitor_trip_proofs (
  trip_id TEXT PRIMARY KEY NOT NULL REFERENCES monitor_trips(id) ON DELETE CASCADE,
  proof_required INTEGER NOT NULL DEFAULT 0,
  selfie_key TEXT,
  selfie_sha256 TEXT,
  selfie_mime TEXT,
  selfie_at TEXT,
  selfie_status TEXT NOT NULL DEFAULT 'missing' CHECK (selfie_status IN ('missing','pending','approved','rejected')),
  selfie_reviewed_by TEXT,
  selfie_reviewed_at TEXT,
  selfie_review_note TEXT,
  receipt_key TEXT,
  receipt_sha256 TEXT,
  receipt_mime TEXT,
  receipt_at TEXT,
  receipt_status TEXT NOT NULL DEFAULT 'missing' CHECK (receipt_status IN ('missing','pending','approved','rejected')),
  receipt_reviewed_by TEXT,
  receipt_reviewed_at TEXT,
  receipt_review_note TEXT
);
CREATE TABLE IF NOT EXISTS monitor_proof_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES monitor_trips(id) ON DELETE CASCADE,
  proof_kind TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitor_proof_audit_trip_time
  ON monitor_proof_audit(trip_id, created_at DESC);
