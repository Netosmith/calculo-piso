-- RH / Funcionários da Nova Frota. Dados privados no banco D1 existente.
-- Não alterar nem misturar com a aba FUNCIONARIOS (cadastros gerais) do Sheets.
CREATE TABLE IF NOT EXISTS rh_employees (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 role TEXT NOT NULL,
 city TEXT NOT NULL DEFAULT '',
 branch TEXT NOT NULL DEFAULT '',
 salary_cents INTEGER NOT NULL DEFAULT 0 CHECK(salary_cents BETWEEN 0 AND 100000000000),
 notes TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_by TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rh_employees_name ON rh_employees(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_rh_employees_active ON rh_employees(active);
CREATE INDEX IF NOT EXISTS idx_rh_employees_branch ON rh_employees(branch);
CREATE TABLE IF NOT EXISTS rh_entries (
 id TEXT PRIMARY KEY,
 employee_id TEXT NOT NULL REFERENCES rh_employees(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('VALE','CUSTO')),
 description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000000),
 date TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rh_entries_month ON rh_entries(date);
CREATE INDEX IF NOT EXISTS idx_rh_entries_employee_month ON rh_entries(employee_id,date);
