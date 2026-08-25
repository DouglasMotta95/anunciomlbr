-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.billing_period AS ENUM ('monthly','quarterly','semiannual','annual');
CREATE TYPE public.license_status AS ENUM ('available','active','expired','suspended','cancelled');
CREATE TYPE public.license_origin AS ENUM ('mercado_pago','pix_manual','courtesy','promo','partner','admin');
CREATE TYPE public.listing_status AS ENUM ('draft','active','paused','error');
CREATE TYPE public.job_status AS ENUM ('queued','processing','done','error');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  free_listings_used INT NOT NULL DEFAULT 0,
  free_listings_limit INT NOT NULL DEFAULT 10,
  onboarding_done BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PLANS
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  price_monthly_cents INT NOT NULL,
  listing_limit INT,
  ai_credits INT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  highlighted BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read" ON public.plans FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "plans admin write" ON public.plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PERIOD DISCOUNTS
CREATE TABLE public.period_discounts (
  period public.billing_period PRIMARY KEY,
  months INT NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.period_discounts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.period_discounts TO authenticated;
GRANT ALL ON public.period_discounts TO service_role;
ALTER TABLE public.period_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periods public read" ON public.period_discounts FOR SELECT USING (true);
CREATE POLICY "periods admin write" ON public.period_discounts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- LICENSES
CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  plan_id UUID REFERENCES public.plans ON DELETE SET NULL,
  period public.billing_period NOT NULL DEFAULT 'monthly',
  origin public.license_origin NOT NULL DEFAULT 'admin',
  status public.license_status NOT NULL DEFAULT 'available',
  note TEXT,
  starts_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.licenses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "licenses own read" ON public.licenses FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "licenses admin write" ON public.licenses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_licenses_updated BEFORE UPDATE ON public.licenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LISTINGS
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source_ml_id TEXT,
  source_permalink TEXT,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INT,
  cost_cents INT,
  fees_cents INT,
  stock INT NOT NULL DEFAULT 0,
  sku TEXT,
  category TEXT,
  condition TEXT DEFAULT 'new',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.listing_status NOT NULL DEFAULT 'draft',
  ai_score INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings own all" ON public.listings FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ML CONNECTION (public metadata)
CREATE TABLE public.ml_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  ml_user_id TEXT,
  nickname TEXT,
  connected BOOLEAN NOT NULL DEFAULT false,
  listings_count INT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.ml_connections TO authenticated;
GRANT ALL ON public.ml_connections TO service_role;
ALTER TABLE public.ml_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ml conn own read" ON public.ml_connections FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ml conn own delete" ON public.ml_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_mlconn_updated BEFORE UPDATE ON public.ml_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ML TOKENS (server only)
CREATE TABLE public.ml_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.ml_tokens TO service_role;
ALTER TABLE public.ml_tokens ENABLE ROW LEVEL SECURITY;

-- BULK JOBS
CREATE TABLE public.bulk_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  total INT NOT NULL DEFAULT 0,
  processed INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bulk_jobs TO authenticated;
GRANT ALL ON public.bulk_jobs TO service_role;
ALTER TABLE public.bulk_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs own all" ON public.bulk_jobs FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.bulk_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  plan_id UUID REFERENCES public.plans ON DELETE SET NULL,
  period public.billing_period NOT NULL DEFAULT 'monthly',
  amount_cents INT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mercado_pago',
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments own read" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- COUPONS
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_uses INT,
  uses INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons admin all" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ACTIVITY EVENTS
CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events own read" ON public.activity_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "events own insert" ON public.activity_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- SEED plans and periods (product catalog, not demo user data)
INSERT INTO public.plans (code,name,tagline,price_monthly_cents,listing_limit,ai_credits,features,highlighted,sort_order) VALUES
 ('starter','STARTER','Para começar a operar',4990,100,100,'["Busca de anúncios","Cópia individual","Editor de anúncios","10 anúncios grátis no teste"]'::jsonb,false,1),
 ('pro','PRO','O favorito dos vendedores',8990,500,500,'["Tudo do Starter","Cópia em massa","ANÚNCIO AI","Relatórios de vendas"]'::jsonb,true,2),
 ('premium','PREMIUM','Escala com inteligência',14990,2000,2000,'["Tudo do Pro","Radar de concorrentes","Oportunidades","Lucro e margem"]'::jsonb,false,3),
 ('business','BUSINESS','Operação profissional',24990,NULL,10000,'["Tudo do Premium","Anúncios ilimitados","Suporte prioritário","Multi-contas ML"]'::jsonb,false,4);

INSERT INTO public.period_discounts (period,months,discount_percent,label) VALUES
 ('monthly',1,0,'Mensal'),
 ('quarterly',3,10,'3 meses'),
 ('semiannual',6,15,'6 meses'),
 ('annual',12,25,'Anual');

-- LICENSE CODE GENERATOR
CREATE OR REPLACE FUNCTION public.generate_license_code(_plan_code TEXT)
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE part1 TEXT; part2 TEXT;
BEGIN
  part1 := upper(substr(md5(gen_random_uuid()::text),1,4));
  part2 := upper(substr(md5(gen_random_uuid()::text),1,4));
  RETURN 'AML-' || upper(coalesce(_plan_code,'GEN')) || '-' || part1 || '-' || part2;
END; $$;