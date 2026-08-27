-- Indicação: captura o código no cadastro e recompensa quando o indicado vira cliente pagante.
CREATE OR REPLACE FUNCTION public.capture_signup_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_referrer uuid;
  v_reward integer;
BEGIN
  v_code := upper(trim(COALESCE(new.raw_user_meta_data->>'referral_code','')));
  IF v_code = '' THEN RETURN new; END IF;
  SELECT user_id, reward_ads INTO v_referrer, v_reward
  FROM public.referral_codes
  WHERE upper(code) = v_code AND active = true
  LIMIT 1;
  IF v_referrer IS NULL OR v_referrer = new.id THEN RETURN new; END IF;
  INSERT INTO public.referrals(referrer_user_id, referred_user_id, code, reward_ads)
  VALUES (v_referrer, new.id, v_code, COALESCE(v_reward,10))
  ON CONFLICT (referred_user_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_signup_referral ON auth.users;
CREATE TRIGGER trg_capture_signup_referral
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.capture_signup_referral();

CREATE OR REPLACE FUNCTION public.reward_referral_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_code text;
BEGIN
  IF new.status <> 'approved' OR new.user_id IS NULL THEN RETURN new; END IF;
  IF old.status = 'approved' THEN RETURN new; END IF;

  SELECT * INTO v_ref
  FROM public.referrals
  WHERE referred_user_id = new.user_id AND status IN ('registered','converted')
  FOR UPDATE
  LIMIT 1;
  IF v_ref.id IS NULL THEN RETURN new; END IF;

  SELECT public.generate_license_code('REF') INTO v_code;
  INSERT INTO public.licenses(
    code, plan_id, period, origin, status, user_id, activated_at,
    starts_at, expires_at, ads_quota, ads_used, note
  ) VALUES (
    v_code, NULL, 'annual', 'promo', 'active', v_ref.referrer_user_id, now(),
    now(), now() + interval '12 months', v_ref.reward_ads, 0, 'referral:' || v_ref.id::text
  );

  UPDATE public.referrals
  SET status = 'rewarded', converted_at = now()
  WHERE id = v_ref.id;

  INSERT INTO public.activity_events(user_id, kind, message, meta)
  VALUES (
    v_ref.referrer_user_id,
    'referral_reward',
    'Indicação convertida: anúncios extras liberados',
    jsonb_build_object('referral_id', v_ref.id, 'reward_ads', v_ref.reward_ads, 'license_code', v_code)
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_referral_after_payment ON public.payments;
CREATE TRIGGER trg_reward_referral_after_payment
AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.reward_referral_after_payment();
