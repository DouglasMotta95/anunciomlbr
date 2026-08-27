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
ALTER TABLE public.subscription_cancellation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own cancellation requests" ON public.subscription_cancellation_requests FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users create own cancellation requests" ON public.subscription_cancellation_requests FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
