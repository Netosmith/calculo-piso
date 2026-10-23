-- Monitoramento Nova Frota: dados de viagens e última posição GPS.
-- Token de compartilhamento armazenado apenas como SHA-256.
CREATE TABLE IF NOT EXISTS monitor_trips (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL,
  driver TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT '',
  destination TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  token_hash TEXT NOT NULL UNIQUE,
  token_expires_at TEXT NOT NULL,
  lat REAL,
  lng REAL,
  accuracy REAL,
  last_position_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_monitor_trips_created ON monitor_trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_trips_active ON monitor_trips(active);
