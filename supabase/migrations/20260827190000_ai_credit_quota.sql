-- Controle transacional de créditos de IA por usuário/período.
CREATE TABLE IF NOT EXISTS public.ai_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);

ALTER TABLE public.ai_credit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI usage" ON public.ai_credit_usage
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_ai_credit(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS TABLE(allowed boolean, used integer, credit_limit integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_used integer;
  v_period date := date_trunc('month', now())::date;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() OR p_amount < 1 OR p_amount > 100 THEN
    RAISE EXCEPTION 'invalid ai credit request';
  END IF;

  SELECT COALESCE(p.ai_credits, 0)
    INTO v_limit
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id
    AND s.status IN ('active','trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY s.created_at DESC
  LIMIT 1;

  v_limit := COALESCE(v_limit, 0);

  INSERT INTO public.ai_credit_usage(user_id, period_start, used)
  VALUES (p_user_id, v_period, 0)
  ON CONFLICT (user_id, period_start) DO NOTHING;

  SELECT u.used INTO v_used
  FROM public.ai_credit_usage u
  WHERE u.user_id = p_user_id AND u.period_start = v_period
  FOR UPDATE;

  IF v_used + p_amount > v_limit THEN
    RETURN QUERY SELECT false, v_used, v_limit, GREATEST(v_limit - v_used, 0);
    RETURN;
  END IF;

  UPDATE public.ai_credit_usage
  SET used = ai_credit_usage.used + p_amount, updated_at = now()
  WHERE user_id = p_user_id AND period_start = v_period
  RETURNING ai_credit_usage.used INTO v_used;

  RETURN QUERY SELECT true, v_used, v_limit, GREATEST(v_limit - v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_credit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid, integer) TO authenticated;
