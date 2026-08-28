-- A franquia de anúncios passa a ser consumida quando um anúncio é criado/copiado/duplicado
-- dentro do ANÚNCIO ML, e não somente quando ele é publicado no Mercado Livre.
-- O registro separado evita cobrança dupla e mantém o consumo mesmo se o anúncio for pausado/excluído.

CREATE TABLE IF NOT EXISTS public.listing_quota_claims (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_quota_claims_user_created_idx
  ON public.listing_quota_claims(user_id, created_at DESC);

GRANT ALL ON public.listing_quota_claims TO service_role;
ALTER TABLE public.listing_quota_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_listing_quota(_user_id uuid, _listing_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_consumed boolean;
BEGIN
  IF _user_id IS NULL OR _listing_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  SELECT user_id INTO v_owner
  FROM public.listings
  WHERE id = _listing_id;

  IF v_owner IS NULL OR v_owner <> _user_id THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.listing_quota_claims
    WHERE listing_id = _listing_id AND user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  SELECT public.consume_ad_quota(_user_id, 1) INTO v_consumed;
  IF COALESCE(v_consumed, false) IS NOT TRUE THEN
    RETURN false;
  END IF;

  INSERT INTO public.listing_quota_claims(listing_id, user_id)
  VALUES (_listing_id, _user_id)
  ON CONFLICT (listing_id) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_listing_quota(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_listing_quota(uuid, uuid) TO service_role;
