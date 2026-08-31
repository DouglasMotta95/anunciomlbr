-- O catálogo de créditos usa planos do tipo ai_package.
-- Esta migration precisa rodar antes de credit_catalog_v2 para que o novo valor
-- do enum esteja comprometido antes dos INSERTs que o utilizam.
ALTER TYPE public.plan_kind ADD VALUE IF NOT EXISTS 'ai_package';
