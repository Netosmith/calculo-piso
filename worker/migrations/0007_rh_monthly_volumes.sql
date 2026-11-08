-- Volume total embarcado por competência, para comissão de funcionários.
-- Preserva todas as tabelas e lançamentos anteriores.
CREATE TABLE IF NOT EXISTS rh_monthly_volumes (
  month TEXT PRIMARY KEY CHECK(length(month)=7),
  tonnes_milli INTEGER NOT NULL CHECK(tonnes_milli BETWEEN 0 AND 1000000000),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
