-- Revenda pré-paga: o parceiro compra saldo e emite chaves sem acesso ao admin.
CREATE OR REPLACE FUNCTION public.reseller_issue_license(p_plan_id uuid, p_period public.billing_period DEFAULT 'monthly')
RETURNS TABLE(license_code text, reseller_cost_cents integer, suggested_sale_cents integer, wallet_remaining_cents integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reseller public.resellers%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_cost integer;
  v_code text;
  v_months integer := 1;
  v_license_id uuid;
BEGIN
  SELECT * INTO v_reseller FROM public.resellers WHERE user_id = auth.uid() FOR UPDATE;
  IF v_reseller.id IS NULL OR v_reseller.status <> 'active' THEN
    RAISE EXCEPTION 'reseller_not_active';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND active = true AND kind <> 'ad_package';
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'plan_not_available'; END IF;

  v_months := CASE p_period WHEN 'quarterly' THEN 3 WHEN 'semiannual' THEN 6 WHEN 'annual' THEN 12 ELSE 1 END;
  v_cost := GREATEST(100, round((v_plan.price_monthly_cents * v_months) * (1 - (v_reseller.discount_percent / 100.0)))::integer);
  IF v_reseller.wallet_cents < v_cost THEN RAISE EXCEPTION 'insufficient_reseller_wallet'; END IF;

  SELECT public.generate_license_code(v_plan.code) INTO v_code;
  INSERT INTO public.licenses(code, plan_id, period, origin, status, starts_at, expires_at, note, created_by)
  VALUES (v_code, v_plan.id, p_period, 'partner', 'available', now(), now() + make_interval(months => v_months), 'reseller:' || v_reseller.id::text, auth.uid())
  RETURNING id INTO v_license_id;

  UPDATE public.resellers
  SET wallet_cents = wallet_cents - v_cost,
      total_sales_cents = total_sales_cents + (v_plan.price_monthly_cents * v_months),
      total_commission_cents = total_commission_cents + ((v_plan.price_monthly_cents * v_months) - v_cost),
      updated_at = now()
  WHERE id = v_reseller.id;

  INSERT INTO public.reseller_sales(reseller_id, license_id, plan_id, sale_price_cents, reseller_cost_cents, commission_cents, status)
  VALUES (v_reseller.id, v_license_id, v_plan.id, v_plan.price_monthly_cents * v_months, v_cost, (v_plan.price_monthly_cents * v_months) - v_cost, 'completed');

  RETURN QUERY SELECT v_code, v_cost, v_plan.price_monthly_cents * v_months, v_reseller.wallet_cents - v_cost;
END;
$$;

REVOKE ALL ON FUNCTION public.reseller_issue_license(uuid, public.billing_period) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseller_issue_license(uuid, public.billing_period) TO authenticated;
