-- Troca de Notas em D1 TENANTS_DB, isolada por tenant, sem misturar cadastros.
CREATE TABLE IF NOT EXISTS portal_troca_tickets(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,protocolo TEXT NOT NULL UNIQUE,
 numero INTEGER,solicitante_id TEXT NOT NULL,executor_id TEXT,
 cliente TEXT NOT NULL,filial TEXT NOT NULL,
 origem TEXT NOT NULL,local_coleta TEXT NOT NULL,destino TEXT NOT NULL,local_descarga TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK(status IN ('RASCUNHO','FILA','ANDAMENTO','PENDENTE','TROCADA')),
 motivo TEXT NOT NULL DEFAULT '',criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,enviado_em TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_troca_numero ON portal_troca_tickets(tenant_id,numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_troca_fila ON portal_troca_tickets(tenant_id,status,atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_troca_solicitante ON portal_troca_tickets(tenant_id,solicitante_id,criado_em DESC);
CREATE TABLE IF NOT EXISTS portal_troca_sequence(
 tenant_id TEXT PRIMARY KEY,ultimo_numero INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER IF NOT EXISTS trg_troca_numero AFTER INSERT ON portal_troca_tickets
 WHEN NEW.numero IS NULL BEGIN
 INSERT INTO portal_troca_sequence(tenant_id,ultimo_numero) VALUES(NEW.tenant_id,1)
 ON CONFLICT(tenant_id) DO UPDATE SET ultimo_numero=portal_troca_sequence.ultimo_numero+1;
 UPDATE portal_troca_tickets SET numero=(SELECT ultimo_numero FROM portal_troca_sequence WHERE tenant_id=NEW.tenant_id)
 WHERE id=NEW.id AND tenant_id=NEW.tenant_id;
END;
CREATE TABLE IF NOT EXISTS portal_troca_docs(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,ticket_id TEXT NOT NULL,
 slot TEXT NOT NULL CHECK(slot IN ('nota_origem','laudo','ticket_pesagem','ordem','nf_trocada')),
 drive_id TEXT NOT NULL,nome TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES portal_troca_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_troca_docs ON portal_troca_docs(tenant_id,ticket_id);
CREATE TABLE IF NOT EXISTS portal_troca_messages(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,ticket_id TEXT NOT NULL,
 autor_id TEXT NOT NULL,texto TEXT NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES portal_troca_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_troca_messages ON portal_troca_messages(tenant_id,ticket_id,criado_em);
CREATE TABLE IF NOT EXISTS portal_troca_history(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,ticket_id TEXT NOT NULL,
 autor_id TEXT NOT NULL,status TEXT NOT NULL,descricao TEXT NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES portal_troca_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_troca_history ON portal_troca_history(tenant_id,ticket_id,criado_em);
