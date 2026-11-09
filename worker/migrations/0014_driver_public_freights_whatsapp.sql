-- WhatsApp explicitamente autorizado na publicação individual do frete.
-- Anúncios antigos permanecem sem contato até serem republicados.
ALTER TABLE driver_public_freights
  ADD COLUMN whatsapp_embarcador TEXT NOT NULL DEFAULT '';
