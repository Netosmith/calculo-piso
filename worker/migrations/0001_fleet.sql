CREATE TABLE IF NOT EXISTS fleet_records (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('freight','expense','fuel','maintenance','commission')),
 plate TEXT NOT NULL,
 driver TEXT NOT NULL DEFAULT '',
 date TEXT NOT NULL,
 data_json TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fleet_records_date ON fleet_records(date);
CREATE INDEX IF NOT EXISTS idx_fleet_records_plate ON fleet_records(plate);
CREATE TABLE IF NOT EXISTS fleet_sets (
 id TEXT PRIMARY KEY,
 driver TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 tractor TEXT NOT NULL,
 trailer TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fleet_sets_tractor ON fleet_sets(tractor);
CREATE TABLE IF NOT EXISTS fleet_documents (
 id TEXT PRIMARY KEY,
 set_id TEXT NOT NULL REFERENCES fleet_sets(id) ON DELETE CASCADE,
 doc_type TEXT NOT NULL CHECK(doc_type IN ('cnh','cavalo','carreta','antt','endereco','fotoCaminhao','fotoMotorista','fotoMotoristaCNH','fotoMotoristaIndividual')),
 object_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL,
 filename TEXT NOT NULL,
 size INTEGER NOT NULL,
 uploaded_by TEXT NOT NULL,
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(set_id,doc_type)
);