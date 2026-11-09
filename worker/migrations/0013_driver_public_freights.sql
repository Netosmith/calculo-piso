-- Ofertas explicitamente autorizadas para o app de motoristas Nova Frota.
-- Publicação nunca é automática. Nenhuma referência a cliente/valor empresa.
CREATE TABLE IF NOT EXISTS driver_public_freights (
  source TEXT NOT NULL CHECK(source IN ('fretes','fretes2')),
  source_id TEXT NOT NULL,
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  produto TEXT NOT NULL,
  volume TEXT NOT NULL DEFAULT '',
  valor_motorista TEXT NOT NULL DEFAULT '',
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY(source,source_id)
);
CREATE INDEX IF NOT EXISTS idx_driver_public_freights_expiry
  ON driver_public_freights(expires_at DESC);
