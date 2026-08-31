-- Mantém a franquia efetiva de criação/duplicação alinhada ao catálogo exibido.
-- my_ad_quota() prioriza plans.ad_quota, então listing_limit e ad_quota precisam
-- representar a mesma capacidade dos planos principais.
UPDATE public.plans SET listing_limit=250, ad_quota=250, updated_at=now() WHERE code='starter';
UPDATE public.plans SET listing_limit=1000, ad_quota=1000, updated_at=now() WHERE code='pro';
UPDATE public.plans SET listing_limit=3000, ad_quota=3000, updated_at=now() WHERE code='premium';
UPDATE public.plans SET listing_limit=NULL, ad_quota=NULL, updated_at=now() WHERE code='business';
