REVOKE ALL ON FUNCTION public.ad_quota_summary(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.my_ad_quota()
RETURNS TABLE(quota integer, used integer, remaining integer, plan_name text, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH lic AS (
    SELECT l.*, p.name AS plan_name, COALESCE(l.ads_quota, p.ad_quota, p.listing_limit) AS eff_quota
    FROM public.licenses l
    LEFT JOIN public.plans p ON p.id = l.plan_id
    WHERE l.user_id = auth.uid()
      AND l.status = 'active'
      AND (l.expires_at IS NULL OR l.expires_at > now())
  ),
  free AS (
    SELECT free_listings_limit, free_listings_used FROM public.profiles WHERE id = auth.uid()
  )
  SELECT
    COALESCE((SELECT SUM(COALESCE(eff_quota,0))::int FROM lic), 0)
      + COALESCE((SELECT free_listings_limit FROM free), 0),
    COALESCE((SELECT SUM(ads_used)::int FROM lic), 0)
      + COALESCE((SELECT free_listings_used FROM free), 0),
    GREATEST(
      COALESCE((SELECT SUM(COALESCE(eff_quota,0))::int FROM lic), 0)
        + COALESCE((SELECT free_listings_limit FROM free), 0)
        - COALESCE((SELECT SUM(ads_used)::int FROM lic), 0)
        - COALESCE((SELECT free_listings_used FROM free), 0), 0),
    (SELECT plan_name FROM lic ORDER BY expires_at DESC NULLS LAST LIMIT 1),
    (SELECT expires_at FROM lic ORDER BY expires_at DESC NULLS LAST LIMIT 1)
$$;

GRANT EXECUTE ON FUNCTION public.my_ad_quota() TO authenticated, service_role;