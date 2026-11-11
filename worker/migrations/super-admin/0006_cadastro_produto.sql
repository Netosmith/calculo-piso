-- Produto declarado pelo solicitante para identificação do card.
-- Chamados existentes permanecem sem produto até atualização expressa.
ALTER TABLE portal_cadastro_tickets ADD COLUMN produto TEXT NOT NULL DEFAULT '';
