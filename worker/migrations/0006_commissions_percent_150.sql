-- Amplia taxas de comissão para 1,5% sem perder configurações existentes.
-- Idempotente: pode ser reaplicada nas publicações do Worker.
-- A tabela de lançamentos históricos não é alterada.
CREATE TABLE IF NOT EXISTS rh_commission_settings_upgrade (
 employee_id TEXT PRIMARY KEY REFERENCES rh_employees(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL DEFAULT 'NONE'
  CHECK(kind IN ('NONE','TON','PERCENT','MANUAL','AGENCIA')),
 rate_value INTEGER NOT NULL DEFAULT 0 CHECK(rate_value BETWEEN 0 AND 1000),
 updated_by TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR REPLACE INTO rh_commission_settings_upgrade
 (employee_id,kind,rate_value,updated_by,updated_at)
 SELECT employee_id,kind,rate_value,updated_by,updated_at
 FROM rh_commission_settings;
DROP TABLE rh_commission_settings;
ALTER TABLE rh_commission_settings_upgrade RENAME TO rh_commission_settings;
