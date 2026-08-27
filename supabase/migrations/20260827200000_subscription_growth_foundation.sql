-- Fundação para onboarding, notificações, valor percebido e retenção.
CREATE TABLE IF NOT EXISTS public.user_product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_product_events_user_created ON public.user_product_events(user_id, created_at DESC);
ALTER TABLE public.user_product_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own product events" ON public.user_product_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

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
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notification preferences" ON public.user_notification_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.subscription_retention_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid,
  reason text NOT NULL,
  details text,
  accepted_alternative text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_retention_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users create own retention feedback" ON public.subscription_retention_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own retention feedback" ON public.subscription_retention_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);

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
ALTER TABLE public.monthly_value_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own monthly value" ON public.monthly_value_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
