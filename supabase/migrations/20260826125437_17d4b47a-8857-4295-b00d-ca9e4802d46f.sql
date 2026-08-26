UPDATE public.plans SET ad_quota = 50, listing_limit = 50 WHERE code = 'starter';
UPDATE public.plans SET ad_quota = 100, listing_limit = 100 WHERE code = 'pro';
UPDATE public.plans SET ad_quota = 150, listing_limit = 150 WHERE code = 'premium';
UPDATE public.plans SET ad_quota = NULL, listing_limit = NULL WHERE code = 'business';

UPDATE public.licenses l
SET ads_quota = p.ad_quota
FROM public.plans p
WHERE l.plan_id = p.id AND l.ads_quota IS NULL AND p.ad_quota IS NOT NULL;