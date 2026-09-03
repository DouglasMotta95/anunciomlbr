ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_feature_flags_object_chk;
ALTER TABLE public.plans ADD CONSTRAINT plans_feature_flags_object_chk CHECK (jsonb_typeof(feature_flags) = 'object');

COMMENT ON COLUMN public.plans.feature_flags IS 'Chaves administrativas de acesso aos módulos. Ausência da chave preserva o comportamento atual; false bloqueia explicitamente o recurso.';
