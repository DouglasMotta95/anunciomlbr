-- Ajuste comercial para lançamento: mais capacidade de anúncios nos planos
-- e créditos de IA separados, com pacotes avulsos válidos por até 12 meses.

ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS ai_credits_used integer NOT NULL DEFAULT 0;

-- Planos principais: anúncios mais generosos e IA como recurso de consumo controlado.
UPDATE public.plans SET
  listing_limit = 250,
  ai_credits = 40,
  features = '["Busca e clonagem de anúncios","Até 250 criações/duplicações por ciclo","40 créditos de IA por ciclo","Editor e publicação no Mercado Livre"]'::jsonb
WHERE code = 'starter';

UPDATE public.plans SET
  listing_limit = 1000,
  ai_credits = 120,
  features = '["Tudo do Starter","Até 1.000 criações/duplicações por ciclo","120 créditos de IA por ciclo","Clonagem e otimização em massa","Relatórios de vendas"]'::jsonb
WHERE code = 'pro';

UPDATE public.plans SET
  listing_limit = 3000,
  ai_credits = 300,
  features = '["Tudo do Pro","Até 3.000 criações/duplicações por ciclo","300 créditos de IA por ciclo","Radar e oportunidades","Lucro e margem"]'::jsonb
WHERE code = 'premium';

UPDATE public.plans SET
  listing_limit = NULL,
  ai_credits = 800,
  features = '["Tudo do Premium","Criações/duplicações ilimitadas","800 créditos de IA por ciclo","Suporte prioritário"]'::jsonb
WHERE code = 'business';

-- Pacotes extras de anúncios. Não alteram o plano principal.
INSERT INTO public.plans
  (code,name,tagline,price_monthly_cents,listing_limit,ai_credits,features,highlighted,active,sort_order,kind,ad_quota,period_months,badge)
VALUES
  ('ads_extra_250','+250 anúncios','Capacidade extra para clonagem e criação',1990,NULL,0,'["250 anúncios extras","Validade de até 12 meses"]'::jsonb,false,true,101,'ad_package',250,12,NULL),
  ('ads_extra_750','+750 anúncios','Mais espaço para operações em volume',3990,NULL,0,'["750 anúncios extras","Validade de até 12 meses"]'::jsonb,true,true,102,'ad_package',750,12,'Mais escolhido'),
  ('ads_extra_2000','+2.000 anúncios','Para operações que precisam escalar',7990,NULL,0,'["2.000 anúncios extras","Validade de até 12 meses"]'::jsonb,false,true,103,'ad_package',2000,12,NULL),
  ('ads_extra_5000','+5.000 anúncios','Pacote de alto volume',14990,NULL,0,'["5.000 anúncios extras","Validade de até 12 meses"]'::jsonb,false,true,104,'ad_package',5000,12,'Maior volume')
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, tagline=EXCLUDED.tagline, price_monthly_cents=EXCLUDED.price_monthly_cents,
  features=EXCLUDED.features, highlighted=EXCLUDED.highlighted, active=true, sort_order=EXCLUDED.sort_order,
  kind='ad_package', ad_quota=EXCLUDED.ad_quota, period_months=12, ai_credits=0;

-- Pacotes extras de IA. O saldo não reseta mensalmente: fica na licença do pacote
-- e é consumido apenas depois da franquia de IA do ciclo principal.
INSERT INTO public.plans
  (code,name,tagline,price_monthly_cents,listing_limit,ai_credits,features,highlighted,active,sort_order,kind,ad_quota,period_months,badge)
VALUES
  ('ai_extra_50','+50 créditos de IA','Para otimizações e respostas pontuais',990,NULL,50,'["50 créditos de IA","Validade de até 12 meses"]'::jsonb,false,true,201,'ai_package',0,12,NULL),
  ('ai_extra_150','+150 créditos de IA','Reposição prática de créditos',2490,NULL,150,'["150 créditos de IA","Validade de até 12 meses"]'::jsonb,true,true,202,'ai_package',0,12,'Mais escolhido'),
  ('ai_extra_500','+500 créditos de IA','Para uso frequente de otimização',5990,NULL,500,'["500 créditos de IA","Validade de até 12 meses"]'::jsonb,false,true,203,'ai_package',0,12,NULL),
  ('ai_extra_1500','+1.500 créditos de IA','Pacote de alto volume de IA',12990,NULL,1500,'["1.500 créditos de IA","Validade de até 12 meses"]'::jsonb,false,true,204,'ai_package',0,12,'Maior volume')
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, tagline=EXCLUDED.tagline, price_monthly_cents=EXCLUDED.price_monthly_cents,
  ai_credits=EXCLUDED.ai_credits, features=EXCLUDED.features, highlighted=EXCLUDED.highlighted,
  active=true, sort_order=EXCLUDED.sort_order, kind='ai_package', ad_quota=0, period_months=12;

-- Status unificado: franquia do ciclo + saldo avulso ainda não consumido.
DROP FUNCTION IF EXISTS public.ai_credit_status(uuid);
CREATE FUNCTION public.ai_credit_status(p_user_id uuid)
RETURNS TABLE(used integer, credit_limit integer, remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_base_limit integer := 0;
  v_base_used integer := 0;
  v_extra_total integer := 0;
  v_extra_used integer := 0;
  v_period date := date_trunc('month', now())::date;
  v_has_paid boolean := false;
BEGIN
  SELECT COALESCE(p.ai_credits,0) INTO v_base_limit
  FROM public.subscriptions s
  JOIN public.plans p ON p.id=s.plan_id
  WHERE s.user_id=p_user_id
    AND s.status IN ('active','trialing')
    AND COALESCE(p.kind,'plan') NOT IN ('ad_package','ai_package')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY s.created_at DESC LIMIT 1;

  IF COALESCE(v_base_limit,0) > 0 THEN
    v_has_paid := true;
  ELSE
    SELECT COALESCE(p.ai_credits,0) INTO v_base_limit
    FROM public.licenses l
    JOIN public.plans p ON p.id=l.plan_id
    WHERE l.user_id=p_user_id AND l.status='active'
      AND COALESCE(p.kind,'plan') NOT IN ('ad_package','ai_package')
      AND (l.expires_at IS NULL OR l.expires_at > now())
    ORDER BY l.expires_at DESC NULLS FIRST LIMIT 1;
    v_has_paid := COALESCE(v_base_limit,0) > 0;
  END IF;

  IF v_has_paid THEN
    SELECT COALESCE(u.used,0) INTO v_base_used
    FROM public.ai_credit_usage u
    WHERE u.user_id=p_user_id AND u.period_start=v_period;
  ELSE
    v_base_limit := 10;
    SELECT COALESCE(u.used,0) INTO v_base_used
    FROM public.ai_credit_usage u
    WHERE u.user_id=p_user_id AND u.period_start='1970-01-01'::date;
  END IF;

  SELECT COALESCE(SUM(COALESCE(p.ai_credits,0)),0), COALESCE(SUM(l.ai_credits_used),0)
  INTO v_extra_total, v_extra_used
  FROM public.licenses l
  JOIN public.plans p ON p.id=l.plan_id
  WHERE l.user_id=p_user_id AND l.status='active' AND p.kind='ai_package'
    AND (l.expires_at IS NULL OR l.expires_at > now());

  used := v_base_used + v_extra_used;
  credit_limit := v_base_limit + v_extra_total;
  remaining := GREATEST(v_base_limit-v_base_used,0) + GREATEST(v_extra_total-v_extra_used,0);
  RETURN NEXT;
END $$;

DROP FUNCTION IF EXISTS public.consume_ai_credit(uuid,integer);
CREATE FUNCTION public.consume_ai_credit(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS TABLE(allowed boolean, used integer, credit_limit integer, remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_need integer := GREATEST(p_amount,1);
  v_base_limit integer := 0;
  v_base_used integer := 0;
  v_base_take integer := 0;
  v_period date := date_trunc('month', now())::date;
  v_has_paid boolean := false;
  v_row record;
  v_take integer;
  v_status record;
BEGIN
  -- Serializa consumo por usuário durante esta transação.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT COALESCE(p.ai_credits,0) INTO v_base_limit
  FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id
  WHERE s.user_id=p_user_id AND s.status IN ('active','trialing')
    AND COALESCE(p.kind,'plan') NOT IN ('ad_package','ai_package')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY s.created_at DESC LIMIT 1;

  IF COALESCE(v_base_limit,0) > 0 THEN v_has_paid:=true;
  ELSE
    SELECT COALESCE(p.ai_credits,0) INTO v_base_limit
    FROM public.licenses l JOIN public.plans p ON p.id=l.plan_id
    WHERE l.user_id=p_user_id AND l.status='active'
      AND COALESCE(p.kind,'plan') NOT IN ('ad_package','ai_package')
      AND (l.expires_at IS NULL OR l.expires_at > now())
    ORDER BY l.expires_at DESC NULLS FIRST LIMIT 1;
    v_has_paid:=COALESCE(v_base_limit,0)>0;
  END IF;

  IF NOT v_has_paid THEN v_base_limit:=10; v_period:='1970-01-01'::date; END IF;

  SELECT COALESCE(u.used,0) INTO v_base_used FROM public.ai_credit_usage u
  WHERE u.user_id=p_user_id AND u.period_start=v_period;

  SELECT * INTO v_status FROM public.ai_credit_status(p_user_id);
  IF COALESCE(v_status.remaining,0) < v_need THEN
    allowed:=false; used:=v_status.used; credit_limit:=v_status.credit_limit; remaining:=v_status.remaining; RETURN NEXT; RETURN;
  END IF;

  v_base_take:=LEAST(v_need,GREATEST(v_base_limit-v_base_used,0));
  IF v_base_take>0 THEN
    INSERT INTO public.ai_credit_usage(user_id,period_start,used,updated_at)
    VALUES(p_user_id,v_period,v_base_used+v_base_take,now())
    ON CONFLICT(user_id,period_start) DO UPDATE SET used=EXCLUDED.used,updated_at=now();
    v_need:=v_need-v_base_take;
  END IF;

  IF v_need>0 THEN
    FOR v_row IN
      SELECT l.id, COALESCE(p.ai_credits,0) AS credits, l.ai_credits_used
      FROM public.licenses l JOIN public.plans p ON p.id=l.plan_id
      WHERE l.user_id=p_user_id AND l.status='active' AND p.kind='ai_package'
        AND (l.expires_at IS NULL OR l.expires_at>now())
        AND l.ai_credits_used < COALESCE(p.ai_credits,0)
      ORDER BY l.expires_at ASC NULLS LAST, l.created_at ASC
      FOR UPDATE OF l
    LOOP
      EXIT WHEN v_need<=0;
      v_take:=LEAST(v_need,v_row.credits-v_row.ai_credits_used);
      UPDATE public.licenses SET ai_credits_used=ai_credits_used+v_take,updated_at=now() WHERE id=v_row.id;
      v_need:=v_need-v_take;
    END LOOP;
  END IF;

  SELECT * INTO v_status FROM public.ai_credit_status(p_user_id);
  allowed:=true; used:=v_status.used; credit_limit:=v_status.credit_limit; remaining:=v_status.remaining; RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.ai_credit_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid,integer) TO authenticated, service_role;
