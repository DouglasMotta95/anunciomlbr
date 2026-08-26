CREATE POLICY "ml oauth states server only"
  ON public.ml_oauth_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ml tokens server only"
  ON public.ml_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "plans public read" ON public.plans;

CREATE POLICY "plans public active read"
  ON public.plans
  FOR SELECT
  TO anon, authenticated
  USING (active);

CREATE POLICY "plans admin read all"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));