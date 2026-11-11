-- Checklist privado por protocolo / transportadora.
CREATE TABLE IF NOT EXISTS portal_cadastro_checklist(
 tenant_id TEXT NOT NULL,ticket_id TEXT NOT NULL,item_key TEXT NOT NULL,
 estado TEXT NOT NULL CHECK(estado IN ('OK','PENDENTE','REVISAR')),
 autor_id TEXT NOT NULL,atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,ticket_id,item_key),
 FOREIGN KEY(ticket_id) REFERENCES portal_cadastro_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_cadastro_checklist_tenant_ticket ON portal_cadastro_checklist(tenant_id,ticket_id);
