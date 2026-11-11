-- Solicitações de cadastro: metadados isolados por transportadora.
-- Documentos binários permanecem no Google Drive configurado para cada empresa.
CREATE TABLE IF NOT EXISTS portal_cadastro_tickets (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, protocolo TEXT NOT NULL UNIQUE,
 solicitante_id TEXT NOT NULL, motorista TEXT NOT NULL, contato_motorista TEXT NOT NULL,
 proprietario TEXT NOT NULL, contato_proprietario TEXT NOT NULL,
 placas TEXT NOT NULL, referencias_json TEXT NOT NULL, observacoes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'RASCUNHO', etapa TEXT NOT NULL DEFAULT 'RECEBIMENTO',
 executor_id TEXT, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, enviado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_cadastro_tenant_status ON portal_cadastro_tickets(tenant_id,status,criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_cadastro_tenant_owner ON portal_cadastro_tickets(tenant_id,solicitante_id,criado_em DESC);
CREATE TABLE IF NOT EXISTS portal_cadastro_docs (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, ticket_id TEXT NOT NULL,
 slot TEXT NOT NULL, drive_id TEXT NOT NULL, nome TEXT NOT NULL, mime TEXT NOT NULL,
 bytes INTEGER NOT NULL, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES portal_cadastro_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_cadastro_docs ON portal_cadastro_docs(tenant_id,ticket_id);
CREATE TABLE IF NOT EXISTS portal_cadastro_messages (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, ticket_id TEXT NOT NULL,
 autor_id TEXT NOT NULL, autor_perfil TEXT NOT NULL, texto TEXT NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES portal_cadastro_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_cadastro_messages ON portal_cadastro_messages(tenant_id,ticket_id,criado_em);
CREATE TABLE IF NOT EXISTS portal_cadastro_history (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, ticket_id TEXT NOT NULL,
 autor_id TEXT NOT NULL, status TEXT NOT NULL, etapa TEXT NOT NULL,
 motivo TEXT NOT NULL DEFAULT '', criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES portal_cadastro_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_cadastro_history ON portal_cadastro_history(tenant_id,ticket_id,criado_em);
