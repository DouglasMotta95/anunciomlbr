-- Alinha as RPCs de créditos de IA ao modelo realmente usado pelo ANÚNCIO ML.
-- O banco atual trabalha com licenses; subscriptions é opcional e não deve ser
-- requisito para consultar ou consumir a franquia de IA.

CREATE OR REPLACE FUNCTION public.ai_credit_status(p_user_id uuid)
RETURNS TABLE(used integer, credit_limit integer, remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_base_limit integer := 0;
  v_base_used integer := 0;
  v_extra_total integer := 0;
  v_extra_used integer := 0;
  v_period date := date_trunc('month', now())::date;
BEGIN
  IF p_user_id IS NULL OR (auth.uid() IS NOT NULL AND p_user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'invalid ai credit request';
  END IF;

  SELECT COALESCE(p.ai_credits,0) INTO v_base_limit
  FROM public.licenses l
  JOIN public.plans p ON p.id=l.plan_id
  WHERE l.user_id=p_user_id AND l.status='active'
    AND COALESCE(p.kind::text,'subscription') NOT IN ('ad_package','ai_package')
    AND (l.expires_at IS NULL OR l.expires_at > now())
  ORDER BY l.expires_at DESC NULLS FIRST, l.created_at DESC
  LIMIT 1;

  IF COALESCE(v_base_limit,0) <= 0 THEN
    v_base_limit := 10;
    v_period := '1970-01-01'::date;
  END IF;

  SELECT COALESCE(u.used,0) INTO v_base_used
  FROM public.ai_credit_usage u
  WHERE u.user_id=p_user_id AND u.period_start=v_period;
  v_base_used := COALESCE(v_base_used,0);

  SELECT COALESCE(SUM(COALESCE(p.ai_credits,0)),0)::int,
         COALESCE(SUM(LEAST(COALESCE(l.ai_credits_used,0),COALESCE(p.ai_credits,0))),0)::int
  INTO v_extra_total, v_extra_used
  FROM public.licenses l
  JOIN public.plans p ON p.id=l.plan_id
  WHERE l.user_id=p_user_id AND l.status='active' AND p.kind::text='ai_package'
    AND (l.expires_at IS NULL OR l.expires_at > now());

  used := v_base_used + v_extra_used;
  credit_limit := v_base_limit + v_extra_total;
  remaining := GREATEST(v_base_limit-v_base_used,0) + GREATEST(v_extra_total-v_extra_used,0);
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.consume_ai_credit(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS TABLE(allowed boolean, used integer, credit_limit integer, remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_need integer := p_amount;
  v_base_limit integer := 0;
  v_base_used integer := 0;
  v_base_take integer := 0;
  v_period date := date_trunc('month', now())::date;
  v_row record;
  v_take integer;
  v_status record;
BEGIN
  IF p_user_id IS NULL OR p_amount < 1 OR p_amount > 100 OR (auth.uid() IS NOT NULL AND p_user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'invalid ai credit request';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT COALESCE(p.ai_credits,0) INTO v_base_limit
  FROM public.licenses l
  JOIN public.plans p ON p.id=l.plan_id
  WHERE l.user_id=p_user_id AND l.status='active'
    AND COALESCE(p.kind::text,'subscription') NOT IN ('ad_package','ai_package')
    AND (l.expires_at IS NULL OR l.expires_at > now())
  ORDER BY l.expires_at DESC NULLS FIRST, l.created_at DESC
  LIMIT 1;

  IF COALESCE(v_base_limit,0) <= 0 THEN
    v_base_limit := 10;
    v_period := '1970-01-01'::date;
  END IF;

  SELECT COALESCE(u.used,0) INTO v_base_used
  FROM public.ai_credit_usage u
  WHERE u.user_id=p_user_id AND u.period_start=v_period;
  v_base_used := COALESCE(v_base_used,0);

  SELECT * INTO v_status FROM public.ai_credit_status(p_user_id);
  IF COALESCE(v_status.remaining,0) < v_need THEN
    allowed:=false; used:=v_status.used; credit_limit:=v_status.credit_limit; remaining:=v_status.remaining;
    RETURN NEXT; RETURN;
  END IF;

  v_base_take := LEAST(v_need,GREATEST(v_base_limit-v_base_used,0));
  IF v_base_take > 0 THEN
    INSERT INTO public.ai_credit_usage(user_id,period_start,used,updated_at)
    VALUES(p_user_id,v_period,v_base_used+v_base_take,now())
    ON CONFLICT(user_id,period_start) DO UPDATE SET used=EXCLUDED.used,updated_at=now();
    v_need := v_need-v_base_take;
  END IF;

  IF v_need > 0 THEN
    FOR v_row IN
      SELECT l.id, COALESCE(p.ai_credits,0) AS credits, COALESCE(l.ai_credits_used,0) AS ai_credits_used
      FROM public.licenses l
      JOIN public.plans p ON p.id=l.plan_id
      WHERE l.user_id=p_user_id AND l.status='active' AND p.kind::text='ai_package'
        AND (l.expires_at IS NULL OR l.expires_at>now())
        AND COALESCE(l.ai_credits_used,0) < COALESCE(p.ai_credits,0)
      ORDER BY l.expires_at ASC NULLS LAST, l.created_at ASC
      FOR UPDATE OF l
    LOOP
      EXIT WHEN v_need<=0;
      v_take:=LEAST(v_need,v_row.credits-v_row.ai_credits_used);
      UPDATE public.licenses
      SET ai_credits_used=COALESCE(ai_credits_used,0)+v_take,updated_at=now()
      WHERE id=v_row.id;
      v_need:=v_need-v_take;
    END LOOP;
  END IF;

  SELECT * INTO v_status FROM public.ai_credit_status(p_user_id);
  allowed:=true; used:=v_status.used; credit_limit:=v_status.credit_limit; remaining:=v_status.remaining;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.ai_credit_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_credit_status(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_ai_credit(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid, integer) TO authenticated, service_role;
