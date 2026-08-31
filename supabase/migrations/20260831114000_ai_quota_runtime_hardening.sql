-- Corrige a infraestrutura de créditos de IA e fecha privilégios excessivos de funções públicas.

ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS ai_credits_used integer NOT NULL DEFAULT 0 CHECK (ai_credits_used >= 0);

REVOKE ALL ON FUNCTION public.ensure_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.my_ad_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_ad_quota() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.protect_published_listing_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_published_listing_delete() TO service_role;
