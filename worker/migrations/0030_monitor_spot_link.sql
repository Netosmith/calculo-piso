-- Ponto de descarga de uso único, separado do acompanhamento de viagens.
-- Coordenadas somente após autorização explícita no navegador.
-- O token em texto puro nunca é gravado no banco.
CREATE TABLE IF NOT EXISTS monitor_spot_requests (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  referencia TEXT NOT NULL,
  placa TEXT NOT NULL DEFAULT '',
  motorista TEXT NOT NULL DEFAULT '',
  cliente TEXT NOT NULL DEFAULT '',
  descarga TEXT NOT NULL DEFAULT '',
  nf TEXT NOT NULL DEFAULT '',
  cte TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  lat REAL,
  lng REAL,
  accuracy REAL,
  captured_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_monitor_spot_created
  ON monitor_spot_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_spot_captured
  ON monitor_spot_requests(captured_at DESC);
