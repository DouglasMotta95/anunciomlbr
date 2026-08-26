DELETE FROM public.licenses older
USING public.licenses newer
WHERE older.origin = 'mercado_pago'
  AND newer.origin = 'mercado_pago'
  AND older.note LIKE 'payment:%'
  AND older.note = newer.note
  AND older.created_at > newer.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS licenses_mercado_pago_payment_idx
ON public.licenses (note)
WHERE origin = 'mercado_pago' AND note LIKE 'payment:%';