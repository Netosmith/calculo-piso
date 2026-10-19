-- Índices recomendados para cargas históricas extensas da Gestão de Frota.
-- Idempotente: pode ser executado mais de uma vez.
CREATE INDEX IF NOT EXISTS idx_fleet_records_date ON fleet_records(date);
CREATE INDEX IF NOT EXISTS idx_fleet_records_plate ON fleet_records(plate);
CREATE INDEX IF NOT EXISTS idx_fleet_records_driver ON fleet_records(driver);
CREATE INDEX IF NOT EXISTS idx_fleet_records_kind_date ON fleet_records(kind,date);
CREATE INDEX IF NOT EXISTS idx_fleet_sets_tractor ON fleet_sets(tractor);
CREATE INDEX IF NOT EXISTS idx_fleet_documents_set ON fleet_documents(set_id);
