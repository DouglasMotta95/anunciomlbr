DO $$ BEGIN
  CREATE TYPE public.plan_kind AS ENUM ('subscription','ad_package','subscription_with_ad_limit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS kind public.plan_kind NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS ad_quota integer,
  ADD COLUMN IF NOT EXISTS period_months integer,
  ADD COLUMN IF NOT EXISTS badge text;

ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS ads_quota integer,
  ADD COLUMN IF NOT EXISTS ads_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS published_ml_id text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE OR REPLACE FUNCTION public.ad_quota_summary(_user_id uuid)
RETURNS TABLE(quota integer, used integer, remaining integer, plan_name text, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lic AS (
    SELECT l.*, p.name AS plan_name, COALESCE(l.ads_quota, p.ad_quota, p.listing_limit) AS eff_quota
    FROM public.licenses l
    LEFT JOIN public.plans p ON p.id = l.plan_id
    WHERE l.user_id = _user_id
      AND l.status = 'active'
      AND (l.expires_at IS NULL OR l.expires_at > now())
  ),
  free AS (
    SELECT free_listings_limit, free_listings_used FROM public.profiles WHERE id = _user_id
  )
  SELECT
    COALESCE((SELECT SUM(COALESCE(eff_quota,0))::int FROM lic), 0)
      + COALESCE((SELECT free_listings_limit FROM free), 0) AS quota,
    COALESCE((SELECT SUM(ads_used)::int FROM lic), 0)
      + COALESCE((SELECT free_listings_used FROM free), 0) AS used,
    GREATEST(
      COALESCE((SELECT SUM(COALESCE(eff_quota,0))::int FROM lic), 0)
        + COALESCE((SELECT free_listings_limit FROM free), 0)
        - COALESCE((SELECT SUM(ads_used)::int FROM lic), 0)
        - COALESCE((SELECT free_listings_used FROM free), 0), 0) AS remaining,
    (SELECT plan_name FROM lic ORDER BY expires_at DESC NULLS LAST LIMIT 1) AS plan_name,
    (SELECT expires_at FROM lic ORDER BY expires_at DESC NULLS LAST LIMIT 1) AS expires_at
$$;

REVOKE ALL ON FUNCTION public.ad_quota_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_quota_summary(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_ad_quota(_user_id uuid, _amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_now integer;
  left_to_take integer := _amount;
  rec record;
  take integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN true; END IF;

  SELECT remaining INTO remaining_now FROM public.ad_quota_summary(_user_id);
  IF remaining_now < _amount THEN RETURN false; END IF;

  FOR rec IN
    SELECT l.id, COALESCE(l.ads_quota, p.ad_quota, p.listing_limit) AS eff_quota, l.ads_used
    FROM public.licenses l
    LEFT JOIN public.plans p ON p.id = l.plan_id
    WHERE l.user_id = _user_id AND l.status = 'active'
      AND (l.expires_at IS NULL OR l.expires_at > now())
    ORDER BY l.expires_at NULLS LAST
  LOOP
    EXIT WHEN left_to_take <= 0;
    IF rec.eff_quota IS NULL THEN
      UPDATE public.licenses SET ads_used = ads_used + left_to_take WHERE id = rec.id;
      left_to_take := 0;
      EXIT;
    END IF;
    take := LEAST(left_to_take, GREATEST(rec.eff_quota - rec.ads_used, 0));
    IF take > 0 THEN
      UPDATE public.licenses SET ads_used = ads_used + take WHERE id = rec.id;
      left_to_take := left_to_take - take;
    END IF;
  END LOOP;

  IF left_to_take > 0 THEN
    UPDATE public.profiles SET free_listings_used = free_listings_used + left_to_take WHERE id = _user_id;
  END IF;

  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.consume_ad_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ad_quota(uuid, integer) TO service_role;