-- Pacotes avulsos de anúncios para clientes com plano ativo.
INSERT INTO public.plans (code, name, tagline, price_monthly_cents, listing_limit, ad_quota, ai_credits, features, highlighted, active, sort_order, kind, period_months, badge)
VALUES
  ('extra-10', '+10 anúncios', 'Pacote avulso para ampliar seu saldo', 990, 10, 10, 0, '["10 anúncios extras","Crédito adicional ao plano","Válido por 12 meses"]'::jsonb, false, true, 101, 'ad_package', 12, 'Avulso'),
  ('extra-25', '+25 anúncios', 'Pacote avulso para ampliar seu saldo', 1990, 25, 25, 0, '["25 anúncios extras","Crédito adicional ao plano","Válido por 12 meses"]'::jsonb, false, true, 102, 'ad_package', 12, 'Popular'),
  ('extra-50', '+50 anúncios', 'Pacote avulso para ampliar seu saldo', 3490, 50, 50, 0, '["50 anúncios extras","Crédito adicional ao plano","Válido por 12 meses"]'::jsonb, true, true, 103, 'ad_package', 12, 'Melhor custo'),
  ('extra-100', '+100 anúncios', 'Pacote avulso para ampliar seu saldo', 5990, 100, 100, 0, '["100 anúncios extras","Crédito adicional ao plano","Válido por 12 meses"]'::jsonb, false, true, 104, 'ad_package', 12, 'Volume')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  listing_limit = EXCLUDED.listing_limit,
  ad_quota = EXCLUDED.ad_quota,
  features = EXCLUDED.features,
  active = true,
  kind = 'ad_package',
  period_months = 12,
  badge = EXCLUDED.badge,
  updated_at = now();

-- Mantém o nome do plano principal no resumo, embora pacotes extras também somem na cota.
CREATE OR REPLACE FUNCTION public.my_ad_quota()
RETURNS TABLE(quota integer, used integer, remaining integer, plan_name text, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH lic AS (
    SELECT l.*, p.name AS plan_name, p.kind,
      COALESCE(l.ads_quota, p.ad_quota, p.listing_limit) AS eff_quota
    FROM public.licenses l
    LEFT JOIN public.plans p ON p.id = l.plan_id
    WHERE l.user_id = auth.uid() AND l.status = 'active'
      AND (l.expires_at IS NULL OR l.expires_at > now())
  ), free AS (
    SELECT free_listings_limit, free_listings_used FROM public.profiles WHERE id = auth.uid()
  )
  SELECT
    COALESCE((SELECT SUM(COALESCE(eff_quota,0))::int FROM lic),0)+COALESCE((SELECT free_listings_limit FROM free),0),
    COALESCE((SELECT SUM(ads_used)::int FROM lic),0)+COALESCE((SELECT free_listings_used FROM free),0),
    GREATEST(COALESCE((SELECT SUM(COALESCE(eff_quota,0))::int FROM lic),0)+COALESCE((SELECT free_listings_limit FROM free),0)-COALESCE((SELECT SUM(ads_used)::int FROM lic),0)-COALESCE((SELECT free_listings_used FROM free),0),0),
    (SELECT plan_name FROM lic WHERE kind <> 'ad_package' ORDER BY expires_at DESC NULLS LAST LIMIT 1),
    (SELECT expires_at FROM lic WHERE kind <> 'ad_package' ORDER BY expires_at DESC NULLS LAST LIMIT 1)
$$;
GRANT EXECUTE ON FUNCTION public.my_ad_quota() TO authenticated, service_role;
