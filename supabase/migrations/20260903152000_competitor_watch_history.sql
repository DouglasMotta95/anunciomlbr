-- Evolui o radar de concorrentes para registrar snapshots reais e comparáveis.

ALTER TABLE public.competitor_watch
  ADD COLUMN IF NOT EXISTS last_sold_quantity integer,
  ADD COLUMN IF NOT EXISTS last_available_quantity integer;

CREATE TABLE IF NOT EXISTS public.competitor_watch_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id uuid NOT NULL REFERENCES public.competitor_watch(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_cents integer,
  status text,
  sold_quantity integer,
  available_quantity integer,
  title text,
  permalink text,
  captured_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_watch_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user manages own competitor snapshots" ON public.competitor_watch_snapshots;
CREATE POLICY "user manages own competitor snapshots"
ON public.competitor_watch_snapshots
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS competitor_watch_snapshots_watch_idx
  ON public.competitor_watch_snapshots(watch_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS competitor_watch_snapshots_user_idx
  ON public.competitor_watch_snapshots(user_id, captured_at DESC);
