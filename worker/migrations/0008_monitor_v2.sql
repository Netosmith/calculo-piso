-- Monitoramento Nova Frota 2.0. Reexecutavel, sem alterar tabelas existentes.
-- As tabelas sao exclusivas da operacao legada Nova Frota.
CREATE TABLE IF NOT EXISTS monitor_trip_extras (
  trip_id TEXT PRIMARY KEY NOT NULL REFERENCES monitor_trips(id) ON DELETE CASCADE,
  branch TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS monitor_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES monitor_trips(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy REAL NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitor_positions_trip_time ON monitor_positions(trip_id,recorded_at DESC);
