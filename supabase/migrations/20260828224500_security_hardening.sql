-- Hardening adicional do banco. Mantém a experiência do produto, mas reduz
-- privilégios do cliente ao mínimo necessário.

-- O usuário pode editar somente campos de perfil realmente controlados pela UI.
-- Franquias, consumo e e-mail não podem ser alterados diretamente pelo navegador.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, onboarding_done, last_seen_at) ON public.profiles TO authenticated;

-- Notificações são geradas pelo servidor. O cliente só pode marcá-las como lidas.
DO $$
BEGIN
  IF to_regclass('public.user_notifications') IS NOT NULL THEN
    REVOKE UPDATE ON public.user_notifications FROM authenticated;
    GRANT UPDATE (read_at) ON public.user_notifications TO authenticated;
  END IF;
END $$;

-- Funções SECURITY DEFINER devem ser sempre fail-closed quanto a EXECUTE.
-- Os blocos condicionais deixam a migration segura em ambientes onde alguma
-- função opcional ainda não foi criada.
DO $$
BEGIN
  IF to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
  END IF;

  IF to_regprocedure('public.ensure_referral_code()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.ensure_referral_code() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated, service_role;
  END IF;

  IF to_regprocedure('public.my_ad_quota()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.my_ad_quota() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.my_ad_quota() TO authenticated, service_role;
  END IF;

  IF to_regprocedure('public.ai_credit_status(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.ai_credit_status(uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.ai_credit_status(uuid) TO authenticated, service_role;
  END IF;

  IF to_regprocedure('public.consume_ai_credit(uuid,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.consume_ai_credit(uuid, integer) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid, integer) TO authenticated, service_role;
  END IF;
END $$;

-- Garante que tabelas de token/OAuth continuem exclusivamente server-side.
REVOKE ALL ON public.ml_tokens FROM anon, authenticated;
DO $$
BEGIN
  IF to_regclass('public.ml_oauth_states') IS NOT NULL THEN
    REVOKE ALL ON public.ml_oauth_states FROM anon, authenticated;
  END IF;
  IF to_regclass('public.listing_quota_claims') IS NOT NULL THEN
    REVOKE ALL ON public.listing_quota_claims FROM anon, authenticated;
  END IF;
END $$;
