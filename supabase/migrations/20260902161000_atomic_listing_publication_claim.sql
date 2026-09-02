-- Impede duas requisições concorrentes de publicarem o mesmo rascunho no Mercado Livre.
-- O claim fica persistido até a confirmação local do MLB criado. Em falhas ambíguas
-- de rede, ele não é liberado automaticamente para evitar publicação duplicada.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS publishing_claim_token text,
  ADD COLUMN IF NOT EXISTS publishing_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_listings_publishing_claim
  ON public.listings (publishing_claim_token)
  WHERE publishing_claim_token IS NOT NULL;

COMMENT ON COLUMN public.listings.publishing_claim_token IS
  'Token interno de exclusão mútua para publicação no Mercado Livre.';

COMMENT ON COLUMN public.listings.publishing_claimed_at IS
  'Momento em que a publicação externa foi reivindicada; não liberar automaticamente após falha ambígua.';
