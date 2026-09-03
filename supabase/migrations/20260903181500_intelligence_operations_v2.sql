CREATE TABLE IF NOT EXISTS public.keyword_track_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 track_id uuid NOT NULL REFERENCES public.keyword_tracks(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 position integer,
 result_window integer NOT NULL DEFAULT 50,
 found boolean NOT NULL DEFAULT false,
 captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.keyword_track_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user manages own keyword snapshots" ON public.keyword_track_snapshots;
CREATE POLICY "user manages own keyword snapshots" ON public.keyword_track_snapshots FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX IF NOT EXISTS keyword_track_snapshots_track_idx ON public.keyword_track_snapshots(track_id,captured_at DESC);

ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS minimum_margin_percent numeric;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS minimum_price_cents integer;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS maximum_price_cents integer;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT true;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS last_evaluated_at timestamptz;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS last_result jsonb;

CREATE TABLE IF NOT EXISTS public.automation_rule_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, matched_count integer NOT NULL DEFAULT 0,
 result jsonb NOT NULL DEFAULT '{}'::jsonb, executed_external_action boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_rule_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user reads own automation runs" ON public.automation_rule_runs;
CREATE POLICY "user reads own automation runs" ON public.automation_rule_runs FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX IF NOT EXISTS automation_rule_runs_user_idx ON public.automation_rule_runs(user_id,created_at DESC);
