-- Apenas os nomes/locais de coleta e descarga explicitamente publicados.
-- Registros anteriores seguem com locais vazios ate nova publicacao.
ALTER TABLE driver_public_freights ADD COLUMN coleta TEXT NOT NULL DEFAULT '';
ALTER TABLE driver_public_freights ADD COLUMN descarga TEXT NOT NULL DEFAULT '';
