CREATE OR REPLACE FUNCTION public.ai_credit_status(p_user_id uuid)
RETURNS TABLE(used integer, credit_limit integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_used integer;
  v_period date := date_trunc('month', now())::date;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
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

  SELECT COALESCE(u.used, 0)
    INTO v_used
  FROM public.ai_credit_usage u
  WHERE u.user_id = p_user_id
    AND u.period_start = v_period;

  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT v_used, v_limit, GREATEST(v_limit - v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_credit_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_credit_status(uuid) TO authenticated;
