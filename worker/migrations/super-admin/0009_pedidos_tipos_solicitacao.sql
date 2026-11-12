-- Tipos adicionais de solicitações dentro do módulo Abertura de Pedidos.
-- Migração segura para a tabela existente: protocolos, histórico e anexos preservados.
ALTER TABLE portal_pedidos_tickets
  ADD COLUMN tipo_solicitacao TEXT NOT NULL DEFAULT 'PEDIDO'
  CHECK(tipo_solicitacao IN ('PEDIDO','CORRECAO_PEDIDO','CTE_COMPLEMENTAR','CARTA_CORRECAO'));
ALTER TABLE portal_pedidos_tickets
  ADD COLUMN dados_especificos_json TEXT NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_pedidos_tenant_tipo_status
  ON portal_pedidos_tickets(tenant_id,tipo_solicitacao,status,atualizado_em DESC);
