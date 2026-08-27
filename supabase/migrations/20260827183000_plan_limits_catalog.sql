-- Padroniza os limites comerciais dos planos sem alterar preços existentes.
-- A landing e o checkout já leem estes campos diretamente da tabela plans.

UPDATE public.plans
SET listing_limit = CASE lower(code)
  WHEN 'starter' THEN 100
  WHEN 'basic' THEN 100
  WHEN 'pro' THEN 500
  WHEN 'professional' THEN 500
  WHEN 'business' THEN 2000
  WHEN 'enterprise' THEN 10000
  ELSE listing_limit
END,
ai_credits = CASE lower(code)
  WHEN 'starter' THEN 50
  WHEN 'basic' THEN 50
  WHEN 'pro' THEN 250
  WHEN 'professional' THEN 250
  WHEN 'business' THEN 1000
  WHEN 'enterprise' THEN 5000
  ELSE ai_credits
END,
updated_at = now()
WHERE lower(code) IN ('starter','basic','pro','professional','business','enterprise');

-- Garante valores válidos quando o administrador editar planos futuramente.
ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_listing_limit_positive,
  ADD CONSTRAINT plans_listing_limit_positive CHECK (listing_limit IS NULL OR listing_limit > 0),
  DROP CONSTRAINT IF EXISTS plans_ai_credits_nonnegative,
  ADD CONSTRAINT plans_ai_credits_nonnegative CHECK (ai_credits IS NULL OR ai_credits >= 0);
