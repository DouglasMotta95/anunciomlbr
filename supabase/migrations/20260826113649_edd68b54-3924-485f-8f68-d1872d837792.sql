CREATE TABLE public.site_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  session_id text,
  path text NOT NULL DEFAULT '/',
  referrer text,
  source text NOT NULL DEFAULT 'direto',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  user_agent text,
  is_authenticated boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX site_visits_created_at_idx ON public.site_visits (created_at DESC);
CREATE INDEX site_visits_visitor_idx ON public.site_visits (visitor_id);

GRANT ALL ON public.site_visits TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site visits admin read" ON public.site_visits
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));