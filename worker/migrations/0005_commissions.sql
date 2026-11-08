-- Comissão por funcionário, separada da folha base e dos vales.
-- Idempotente para execução em todos os deploys do Cloudflare Worker.
CREATE TABLE IF NOT EXISTS rh_commission_settings (
 employee_id TEXT PRIMARY KEY REFERENCES rh_employees(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL DEFAULT 'NONE' CHECK(kind IN ('NONE','TON','PERCENT','MANUAL','AGENCIA')),
 rate_value INTEGER NOT NULL DEFAULT 0 CHECK(rate_value BETWEEN 0 AND 100),
 updated_by TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rh_commissions (
 id TEXT PRIMARY KEY,
 employee_id TEXT NOT NULL REFERENCES rh_employees(id) ON DELETE RESTRICT,
 date TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('TON','PERCENT','MANUAL','AGENCIA')),
 rate_value INTEGER NOT NULL DEFAULT 0,
 tonnes_milli INTEGER NOT NULL DEFAULT 0 CHECK(tonnes_milli BETWEEN 0 AND 1000000000),
 freight_cents_per_ton INTEGER NOT NULL DEFAULT 0 CHECK(freight_cents_per_ton BETWEEN 0 AND 100000000),
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000000),
 description TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 voided_at TEXT,
 voided_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_rh_commissions_month ON rh_commissions(date);
CREATE INDEX IF NOT EXISTS idx_rh_commissions_employee_date ON rh_commissions(employee_id,date);
CREATE INDEX IF NOT EXISTS idx_rh_commissions_active ON rh_commissions(voided_at);
