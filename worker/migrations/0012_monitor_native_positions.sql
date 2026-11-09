-- Posições nativas, com instante original da coleta e chave idempotente.
-- Separate table avoids altering legacy browser history and is safe to rerun.
CREATE TABLE IF NOT EXISTS monitor_native_positions (
  id TEXT PRIMARY KEY NOT NULL,
  trip_id TEXT NOT NULL REFERENCES monitor_trips(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy REAL NOT NULL,
  captured_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios'))
);
CREATE INDEX IF NOT EXISTS idx_monitor_native_positions_history
  ON monitor_native_positions(trip_id,captured_at DESC);
