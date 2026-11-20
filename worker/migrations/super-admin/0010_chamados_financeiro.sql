-- Solicitações / Chamados: acrescenta categorias financeiras preservando os CHECKs,
-- as referências FK e todos os registros legados, sem reconstruir tabelas.
-- categoria_chamado prevalece sobre tipo_solicitacao somente para PAGAMENTO e PAGAMENTO_GUIA.
ALTER TABLE portal_pedidos_tickets ADD COLUMN categoria_chamado TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_pedidos_docs ADD COLUMN tipo_anexo TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_pedidos_categoria_chamado
 ON portal_pedidos_tickets(tenant_id,categoria_chamado,status,atualizado_em DESC);
