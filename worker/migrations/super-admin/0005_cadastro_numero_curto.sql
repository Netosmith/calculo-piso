-- Identificação curta e única por transportadora.
-- Migração aplicada uma única vez por ambiente. Não altera o protocolo interno.
ALTER TABLE portal_cadastro_tickets ADD COLUMN numero_curto INTEGER;

WITH numerados AS (
 SELECT id,ROW_NUMBER() OVER(PARTITION BY tenant_id ORDER BY criado_em, id) AS numero
 FROM portal_cadastro_tickets
)
UPDATE portal_cadastro_tickets
 SET numero_curto=(SELECT numero FROM numerados WHERE numerados.id=portal_cadastro_tickets.id)
 WHERE numero_curto IS NULL;

CREATE TABLE IF NOT EXISTS portal_cadastro_numeracao (
 tenant_id TEXT PRIMARY KEY,
 ultimo_numero INTEGER NOT NULL DEFAULT 0 CHECK (ultimo_numero>=0)
);
INSERT INTO portal_cadastro_numeracao(tenant_id,ultimo_numero)
SELECT tenant_id,MAX(numero_curto)
FROM portal_cadastro_tickets WHERE numero_curto IS NOT NULL GROUP BY tenant_id
ON CONFLICT(tenant_id)
DO UPDATE SET ultimo_numero=MAX(portal_cadastro_numeracao.ultimo_numero,excluded.ultimo_numero);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cadastro_numero_por_empresa
ON portal_cadastro_tickets(tenant_id,numero_curto) WHERE numero_curto IS NOT NULL;

-- O trigger usa uma operação atômica, sem MAX()+1 concorrente na API.
CREATE TRIGGER IF NOT EXISTS trg_cadastro_numero_por_empresa
AFTER INSERT ON portal_cadastro_tickets
WHEN NEW.numero_curto IS NULL
BEGIN
 INSERT INTO portal_cadastro_numeracao(tenant_id,ultimo_numero) VALUES(NEW.tenant_id,1)
 ON CONFLICT(tenant_id) DO UPDATE SET ultimo_numero=portal_cadastro_numeracao.ultimo_numero+1;
 UPDATE portal_cadastro_tickets
 SET numero_curto=(SELECT ultimo_numero FROM portal_cadastro_numeracao WHERE tenant_id=NEW.tenant_id)
 WHERE id=NEW.id AND tenant_id=NEW.tenant_id;
END;
