-- Remove duplicatas históricas de anúncios importados do Mercado Livre,
-- mantendo o registro mais recentemente atualizado por usuário + source_ml_id.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, source_ml_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.listings
  WHERE source_ml_id IS NOT NULL
)
DELETE FROM public.listings l
USING ranked r
WHERE l.id = r.id
  AND r.rn > 1;

-- Garante idempotência das próximas sincronizações/importações.
CREATE UNIQUE INDEX IF NOT EXISTS listings_user_source_ml_unique
  ON public.listings (user_id, source_ml_id)
  WHERE source_ml_id IS NOT NULL;
