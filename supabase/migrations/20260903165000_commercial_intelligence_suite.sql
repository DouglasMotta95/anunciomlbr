-- Suite comercial: regras seguras, palavras-chave e auditoria de precificacao.
CREATE TABLE IF NOT EXISTS public.automation_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL, signal text NOT NULL CHECK (signal IN ('low_stock','low_margin','competitor_change','stale_listing','health_score')),
 threshold numeric, action text NOT NULL DEFAULT 'create_opportunity' CHECK (action IN ('create_opportunity','notify','recommend_price')),
 enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user manages own automation rules" ON public.automation_rules;
CREATE POLICY "user manages own automation rules" ON public.automation_rules FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX IF NOT EXISTS automation_rules_user_idx ON public.automation_rules(user_id,enabled);

CREATE TABLE IF NOT EXISTS public.keyword_tracks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE, keyword text NOT NULL, last_position integer,
 last_checked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,listing_id,keyword)
);
ALTER TABLE public.keyword_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user manages own keyword tracks" ON public.keyword_tracks;
CREATE POLICY "user manages own keyword tracks" ON public.keyword_tracks FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE TABLE IF NOT EXISTS public.pricing_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL, previous_price_cents integer, suggested_price_cents integer NOT NULL,
 minimum_price_cents integer, target_margin_percent numeric, strategy text NOT NULL DEFAULT 'simulation', applied boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user reads own pricing audit" ON public.pricing_audit_log;
CREATE POLICY "user reads own pricing audit" ON public.pricing_audit_log FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "user inserts own pricing audit" ON public.pricing_audit_log FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE INDEX IF NOT EXISTS pricing_audit_user_idx ON public.pricing_audit_log(user_id,created_at DESC);