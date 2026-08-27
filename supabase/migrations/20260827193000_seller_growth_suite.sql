-- Seller Growth Suite: revendedores, indicações, radar e ações do vendedor.

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

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_watch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_action_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reseller can view self" ON public.resellers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "reseller can view own sales" ON public.reseller_sales FOR SELECT TO authenticated USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));
CREATE POLICY "user can view own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user can view own referrals" ON public.referrals FOR SELECT TO authenticated USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());
CREATE POLICY "user manages own competitor watch" ON public.competitor_watch FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user manages own seller action state" ON public.seller_action_state FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS reseller_sales_reseller_created_idx ON public.reseller_sales(reseller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS competitor_watch_user_idx ON public.competitor_watch(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals(referrer_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = auth.uid();
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  v_code := upper(substr(replace(auth.uid()::text,'-',''),1,8));
  INSERT INTO public.referral_codes(user_id, code) VALUES (auth.uid(), v_code)
  ON CONFLICT (user_id) DO UPDATE SET active = true
  RETURNING code INTO v_code;
  RETURN v_code;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated;
