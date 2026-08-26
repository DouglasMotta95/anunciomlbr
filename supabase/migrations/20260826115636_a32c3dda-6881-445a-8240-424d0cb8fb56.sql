ALTER TABLE public.site_visits
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_reason text;

CREATE INDEX IF NOT EXISTS site_visits_is_bot_idx ON public.site_visits (is_bot, created_at DESC);
CREATE INDEX IF NOT EXISTS site_visits_visitor_recent_idx ON public.site_visits (visitor_id, created_at DESC);

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;