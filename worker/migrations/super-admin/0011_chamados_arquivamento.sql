-- Remoção lógica reversível de chamados, SEM apagar dados, arquivos e histórico.
-- Executar uma vez por ambiente, após 0010.
ALTER TABLE portal_pedidos_tickets ADD COLUMN excluido_em TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_pedidos_tickets ADD COLUMN excluido_por TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_pedidos_tickets ADD COLUMN excluido_motivo TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_pedidos_historico_finalizados
 ON portal_pedidos_tickets(tenant_id,status,excluido_em,atualizado_em DESC,id DESC);
