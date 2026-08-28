-- O teste grátis recebe 10 usos de IA próprios, independentes da franquia de anúncios.
-- Planos pagos continuam usando a franquia mensal definida em plans.ai_credits.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_ai_credits_limit integer NOT NULL DEFAULT 10 CHECK (free_ai_credits_limit >= 0),
  ADD COLUMN IF NOT EXISTS free_ai_credits_used integer NOT NULL DEFAULT 0 CHECK (free_ai_credits_used >= 0);

CREATE OR REPLACE FUNCTION public.ai_credit_status(p_user_id uuid)
RETURNS TABLE(used integer, credit_limit integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := 0;
  v_used integer := 0;
  v_period date := date_trunc('month', now())::date;
  v_free_limit integer := 0;
  v_free_used integer := 0;
BEGIN
  IF p_user_id IS NULL OR (auth.uid() IS NOT NULL AND p_user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'invalid ai credit request';
  END IF;

  -- 1) Assinatura ativa/trialing.
  SELECT COALESCE(p.ai_credits, 0)
    INTO v_limit
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id
    AND s.status IN ('active','trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- 2) Licença ativa (compatibilidade com o modelo atual do SaaS).
  IF COALESCE(v_limit, 0) <= 0 THEN
    SELECT COALESCE(p.ai_credits, 0)
      INTO v_limit
    FROM public.licenses l
    JOIN public.plans p ON p.id = l.plan_id
    WHERE l.user_id = p_user_id
      AND l.status = 'active'
      AND p.kind <> 'ad_package'
      AND (l.expires_at IS NULL OR l.expires_at > now())
    ORDER BY l.expires_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF COALESCE(v_limit, 0) > 0 THEN
    SELECT COALESCE(u.used, 0)
      INTO v_used
    FROM public.ai_credit_usage u
    WHERE u.user_id = p_user_id AND u.period_start = v_period;

    v_used := COALESCE(v_used, 0);
    RETURN QUERY SELECT v_used, v_limit, GREATEST(v_limit - v_used, 0);
    RETURN;
  END IF;

  -- 3) Teste grátis: 10 créditos totais, sem renovação mensal automática.
  SELECT COALESCE(free_ai_credits_limit, 10), COALESCE(free_ai_credits_used, 0)
    INTO v_free_limit, v_free_used
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_free_used, v_free_limit, GREATEST(v_free_limit - v_free_used, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_credit(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS TABLE(allowed boolean, used integer, credit_limit integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := 0;
  v_used integer := 0;
  v_period date := date_trunc('month', now())::date;
  v_free_limit integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_amount < 1 OR p_amount > 100 OR (auth.uid() IS NOT NULL AND p_user_id <> auth.uid()) THEN
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

  IF COALESCE(v_limit, 0) <= 0 THEN
    SELECT COALESCE(p.ai_credits, 0)
      INTO v_limit
    FROM public.licenses l
    JOIN public.plans p ON p.id = l.plan_id
    WHERE l.user_id = p_user_id
      AND l.status = 'active'
      AND p.kind <> 'ad_package'
      AND (l.expires_at IS NULL OR l.expires_at > now())
    ORDER BY l.expires_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF COALESCE(v_limit, 0) > 0 THEN
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
    RETURN;
  END IF;

  SELECT free_ai_credits_limit, free_ai_credits_used
    INTO v_free_limit, v_used
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  v_free_limit := COALESCE(v_free_limit, 10);
  v_used := COALESCE(v_used, 0);

  IF v_used + p_amount > v_free_limit THEN
    RETURN QUERY SELECT false, v_used, v_free_limit, GREATEST(v_free_limit - v_used, 0);
    RETURN;
  END IF;

  UPDATE public.profiles
  SET free_ai_credits_used = free_ai_credits_used + p_amount
  WHERE id = p_user_id
  RETURNING free_ai_credits_used INTO v_used;

  RETURN QUERY SELECT true, v_used, v_free_limit, GREATEST(v_free_limit - v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_credit_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_credit_status(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_ai_credit(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid, integer) TO authenticated, service_role;
