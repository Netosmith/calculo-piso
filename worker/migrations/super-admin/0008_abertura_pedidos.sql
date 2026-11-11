-- Abertura de Pedidos em D1 TENANTS_DB, isolada por tenant, sem misturar cadastros.
CREATE TABLE IF NOT EXISTS portal_pedidos_tickets(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,protocolo TEXT NOT NULL UNIQUE,
 numero INTEGER,solicitante_id TEXT NOT NULL,executor_id TEXT,
 email TEXT NOT NULL DEFAULT '',
 nome_solicitante TEXT NOT NULL,
 telefone_whats TEXT NOT NULL,
 unidade_embarque TEXT NOT NULL,
 numero_pedido_oc TEXT NOT NULL,
 nfe_manifestada TEXT NOT NULL,
 tomador_cnpj TEXT NOT NULL,
 coleta_ie TEXT NOT NULL,
 entrega_cnpj TEXT NOT NULL,
 entrega_ie TEXT NOT NULL,
 frete_empresa TEXT NOT NULL,
 frete_motorista TEXT NOT NULL,
 adiantamento_pct TEXT NOT NULL,
 icms TEXT NOT NULL DEFAULT '',
 produto TEXT NOT NULL,
 especie TEXT NOT NULL,
 tag TEXT NOT NULL,
 obs TEXT NOT NULL DEFAULT '',
 coordenadas_coleta TEXT NOT NULL DEFAULT '',
 coordenadas_entrega TEXT NOT NULL DEFAULT '',
 numero_pedido_sistema TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK(status IN ('RASCUNHO','FILA','ANDAMENTO','PENDENTE','FINALIZADO')),
 motivo TEXT NOT NULL DEFAULT '',criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,enviado_em TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_numero ON portal_pedidos_tickets(tenant_id,numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_fila ON portal_pedidos_tickets(tenant_id,status,atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_solicitante ON portal_pedidos_tickets(tenant_id,solicitante_id,criado_em DESC);
CREATE TABLE IF NOT EXISTS portal_pedidos_sequence(
 tenant_id TEXT PRIMARY KEY,ultimo_numero INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER IF NOT EXISTS trg_pedidos_numero AFTER INSERT ON portal_pedidos_tickets
 WHEN NEW.numero IS NULL BEGIN
 INSERT INTO portal_pedidos_sequence(tenant_id,ultimo_numero) VALUES(NEW.tenant_id,1)
 ON CONFLICT(tenant_id) DO UPDATE SET ultimo_numero=portal_pedidos_sequence.ultimo_numero+1;
 UPDATE portal_pedidos_tickets SET numero=(SELECT ultimo_numero FROM portal_pedidos_sequence WHERE tenant_id=NEW.tenant_id)
 WHERE id=NEW.id AND tenant_id=NEW.tenant_id;
END;
CREATE TABLE IF NOT EXISTS portal_pedidos_docs(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,ticket_id TEXT NOT NULL,
 slot TEXT NOT NULL CHECK(slot IN ('nota','nota_coleta','liberacao','rota_pedagio','tabela_antt')),
 drive_id TEXT NOT NULL,nome TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES portal_pedidos_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_pedidos_docs ON portal_pedidos_docs(tenant_id,ticket_id);
CREATE TABLE IF NOT EXISTS portal_pedidos_messages(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,ticket_id TEXT NOT NULL,
 autor_id TEXT NOT NULL,texto TEXT NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES portal_pedidos_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_pedidos_messages ON portal_pedidos_messages(tenant_id,ticket_id,criado_em);
CREATE TABLE IF NOT EXISTS portal_pedidos_history(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,ticket_id TEXT NOT NULL,
 autor_id TEXT NOT NULL,status TEXT NOT NULL,descricao TEXT NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES portal_pedidos_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_pedidos_history ON portal_pedidos_history(tenant_id,ticket_id,criado_em);
