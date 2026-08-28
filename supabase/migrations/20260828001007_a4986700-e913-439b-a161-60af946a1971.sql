
-- 1. Índice único de anúncios importados
CREATE UNIQUE INDEX IF NOT EXISTS listings_user_source_ml_unique
  ON public.listings (user_id, source_ml_id) WHERE source_ml_id IS NOT NULL;

-- 2. Créditos de IA
CREATE TABLE IF NOT EXISTS public.ai_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);
GRANT SELECT ON public.ai_credit_usage TO authenticated;
GRANT ALL ON public.ai_credit_usage TO service_role;
ALTER TABLE public.ai_credit_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own AI usage" ON public.ai_credit_usage;
CREATE POLICY "Users can view own AI usage" ON public.ai_credit_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_ai_credit(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS TABLE(allowed boolean, used integer, credit_limit integer, remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit integer;
  v_used integer;
  v_period date := date_trunc('month', now())::date;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() OR p_amount < 1 OR p_amount > 100 THEN
    RAISE EXCEPTION 'invalid ai credit request';
  END IF;

  SELECT COALESCE(SUM(COALESCE(p.ai_credits, 0)), 0)::int INTO v_limit
  FROM public.licenses l
  LEFT JOIN public.plans p ON p.id = l.plan_id
  WHERE l.user_id = p_user_id AND l.status = 'active'
    AND (l.expires_at IS NULL OR l.expires_at > now());

  v_limit := COALESCE(v_limit, 0);

  INSERT INTO public.ai_credit_usage(user_id, period_start, used)
  VALUES (p_user_id, v_period, 0) ON CONFLICT (user_id, period_start) DO NOTHING;

  SELECT u.used INTO v_used FROM public.ai_credit_usage u
  WHERE u.user_id = p_user_id AND u.period_start = v_period FOR UPDATE;

  IF v_used + p_amount > v_limit THEN
    RETURN QUERY SELECT false, v_used, v_limit, GREATEST(v_limit - v_used, 0);
    RETURN;
  END IF;

  UPDATE public.ai_credit_usage SET used = ai_credit_usage.used + p_amount, updated_at = now()
  WHERE user_id = p_user_id AND period_start = v_period
  RETURNING ai_credit_usage.used INTO v_used;

  RETURN QUERY SELECT true, v_used, v_limit, GREATEST(v_limit - v_used, 0);
END; $$;
REVOKE ALL ON FUNCTION public.consume_ai_credit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid, integer) TO authenticated;

-- 3. Revendedores, indicações, radar e ações do vendedor
CREATE TABLE IF NOT EXISTS public.resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  discount_percent numeric(5,2) NOT NULL DEFAULT 20 CHECK (discount_percent >= 0 AND discount_percent <= 80),
  wallet_cents integer NOT NULL DEFAULT 0 CHECK (wallet_cents >= 0),
  total_sales_cents integer NOT NULL DEFAULT 0 CHECK (total_sales_cents >= 0),
  total_commission_cents integer NOT NULL DEFAULT 0 CHECK (total_commission_cents >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.reseller_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  sale_price_cents integer NOT NULL CHECK (sale_price_cents >= 0),
  reseller_cost_cents integer NOT NULL CHECK (reseller_cost_cents >= 0),
  commission_cents integer NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  reward_ads integer NOT NULL DEFAULT 10 CHECK (reward_ads >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','converted','rewarded','cancelled')),
  reward_ads integer NOT NULL DEFAULT 0 CHECK (reward_ads >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  UNIQUE(referred_user_id)
);
CREATE TABLE IF NOT EXISTS public.competitor_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ml_item_id text NOT NULL,
  title text,
  permalink text,
  last_price_cents integer,
  last_status text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, ml_item_id)
);
CREATE TABLE IF NOT EXISTS public.seller_action_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  dismissed_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_key)
);
GRANT SELECT ON public.resellers, public.reseller_sales, public.referral_codes, public.referrals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_watch, public.seller_action_state TO authenticated;
GRANT ALL ON public.resellers, public.reseller_sales, public.referral_codes, public.referrals, public.competitor_watch, public.seller_action_state TO service_role;
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_watch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_action_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reseller can view self" ON public.resellers;
CREATE POLICY "reseller can view self" ON public.resellers FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "reseller can view own sales" ON public.reseller_sales;
CREATE POLICY "reseller can view own sales" ON public.reseller_sales FOR SELECT TO authenticated USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "user can view own referral code" ON public.referral_codes;
CREATE POLICY "user can view own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user can view own referrals" ON public.referrals;
CREATE POLICY "user can view own referrals" ON public.referrals FOR SELECT TO authenticated USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());
DROP POLICY IF EXISTS "user manages own competitor watch" ON public.competitor_watch;
CREATE POLICY "user manages own competitor watch" ON public.competitor_watch FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user manages own seller action state" ON public.seller_action_state;
CREATE POLICY "user manages own seller action state" ON public.seller_action_state FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS reseller_sales_reseller_created_idx ON public.reseller_sales(reseller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS competitor_watch_user_idx ON public.competitor_watch(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals(referrer_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = auth.uid();
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  v_code := upper(substr(replace(auth.uid()::text,'-',''),1,8));
  INSERT INTO public.referral_codes(user_id, code) VALUES (auth.uid(), v_code)
  ON CONFLICT (user_id) DO UPDATE SET active = true RETURNING code INTO v_code;
  RETURN v_code;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated;

-- 4. Produto/notificações/retenção
CREATE TABLE IF NOT EXISTS public.user_product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_product_events_user_created ON public.user_product_events(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  quota_alerts boolean NOT NULL DEFAULT true,
  sales_alerts boolean NOT NULL DEFAULT true,
  stock_alerts boolean NOT NULL DEFAULT true,
  opportunity_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_to text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','critical')),
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created ON public.user_notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_dedupe ON public.user_notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.subscription_retention_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid,
  reason text NOT NULL,
  details text,
  accepted_alternative text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.monthly_value_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  listings_created integer NOT NULL DEFAULT 0,
  listings_optimized integer NOT NULL DEFAULT 0,
  ai_actions integer NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  units_sold integer NOT NULL DEFAULT 0,
  revenue_cents bigint NOT NULL DEFAULT 0,
  estimated_minutes_saved integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start)
);
GRANT SELECT ON public.user_product_events, public.monthly_value_snapshots TO authenticated;
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_preferences TO authenticated;
GRANT SELECT, INSERT ON public.subscription_retention_feedback TO authenticated;
GRANT ALL ON public.user_product_events, public.user_notification_preferences, public.user_notifications, public.subscription_retention_feedback, public.monthly_value_snapshots TO service_role;
ALTER TABLE public.user_product_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_retention_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_value_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own product events" ON public.user_product_events;
CREATE POLICY "Users read own product events" ON public.user_product_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users manage own notification preferences" ON public.user_notification_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own notifications" ON public.user_notifications;
CREATE POLICY "Users read own notifications" ON public.user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own notifications" ON public.user_notifications;
CREATE POLICY "Users update own notifications" ON public.user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users create own retention feedback" ON public.subscription_retention_feedback;
CREATE POLICY "Users create own retention feedback" ON public.subscription_retention_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own retention feedback" ON public.subscription_retention_feedback;
CREATE POLICY "Users read own retention feedback" ON public.subscription_retention_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own monthly value" ON public.monthly_value_snapshots;
CREATE POLICY "Users read own monthly value" ON public.monthly_value_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 5. Recuperação de vendas (admin) e revenda profissional
CREATE TABLE IF NOT EXISTS public.sales_recovery_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('generated','contacted','resolved','ignored')),
  message text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_recovery_payment ON public.sales_recovery_actions(payment_id,created_at DESC);
GRANT ALL ON public.sales_recovery_actions TO service_role;
ALTER TABLE public.sales_recovery_actions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.reseller_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_name text,
  last_license_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reseller_id, customer_email)
);
CREATE TABLE IF NOT EXISTS public.reseller_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('credit','license_debit','adjustment','refund')),
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reseller_wallet_transactions ON public.reseller_wallet_transactions(reseller_id,created_at DESC);
GRANT SELECT ON public.reseller_customers, public.reseller_wallet_transactions TO authenticated;
GRANT ALL ON public.reseller_customers, public.reseller_wallet_transactions TO service_role;
ALTER TABLE public.reseller_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reseller reads own customers" ON public.reseller_customers;
CREATE POLICY "reseller reads own customers" ON public.reseller_customers FOR SELECT TO authenticated USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "reseller reads own wallet" ON public.reseller_wallet_transactions;
CREATE POLICY "reseller reads own wallet" ON public.reseller_wallet_transactions FOR SELECT TO authenticated USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));

-- 6. Cancelamentos
CREATE TABLE IF NOT EXISTS public.subscription_cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','retained','processed','withdrawn')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_cancellation_user ON public.subscription_cancellation_requests(user_id,requested_at DESC);
GRANT SELECT, INSERT ON public.subscription_cancellation_requests TO authenticated;
GRANT ALL ON public.subscription_cancellation_requests TO service_role;
ALTER TABLE public.subscription_cancellation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own cancellation requests" ON public.subscription_cancellation_requests;
CREATE POLICY "Users read own cancellation requests" ON public.subscription_cancellation_requests FOR SELECT TO authenticated USING (auth.uid()=user_id);
DROP POLICY IF EXISTS "Users create own cancellation requests" ON public.subscription_cancellation_requests;
CREATE POLICY "Users create own cancellation requests" ON public.subscription_cancellation_requests FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
