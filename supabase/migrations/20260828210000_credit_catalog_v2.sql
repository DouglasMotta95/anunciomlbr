-- Catálogo comercial v2: créditos de IA e anúncios separados, com franquias
-- mais generosas nos planos principais e pacotes extras opcionais.

-- Franquia de IA por ciclo dos planos principais.
UPDATE public.plans
SET ai_credits = 100,
    features = '["Busca e clonagem de anúncios","Até 250 criações/duplicações por ciclo","100 créditos de IA por ciclo","Editor e publicação no Mercado Livre"]'::jsonb
WHERE code = 'starter';

UPDATE public.plans
SET ai_credits = 300,
    features = '["Tudo do Starter","Até 1.000 criações/duplicações por ciclo","300 créditos de IA por ciclo","Clonagem e otimização em massa","Relatórios de vendas"]'::jsonb
WHERE code = 'pro';

UPDATE public.plans
SET ai_credits = 750,
    features = '["Tudo do Pro","Até 3.000 criações/duplicações por ciclo","750 créditos de IA por ciclo","Radar e oportunidades","Lucro e margem"]'::jsonb
WHERE code = 'premium';

UPDATE public.plans
SET ai_credits = 1000,
    features = '["Tudo do Premium","Criações/duplicações ilimitadas","1.000 créditos de IA por ciclo","Suporte prioritário"]'::jsonb
WHERE code = 'business';

-- Mantém compras antigas válidas, mas retira os pacotes antigos da vitrine.
UPDATE public.plans SET active = false WHERE kind = 'ai_package';
UPDATE public.plans SET active = false WHERE kind = 'ad_package';

-- Pacotes opcionais de IA. Um crédito corresponde a uma ação simples de IA;
-- gerar imagem custa 1 crédito por imagem. Aplicar/salvar resultado não cobra novamente.
INSERT INTO public.plans
  (code,name,tagline,price_monthly_cents,listing_limit,ai_credits,features,highlighted,active,sort_order,kind,ad_quota,period_months,badge)
VALUES
  ('ai_extra_100','100 créditos de IA','Para complementar o uso do plano',990,NULL,100,'["100 créditos de IA","Textos, otimizações e análises","1 crédito por imagem gerada","Validade de até 12 meses"]'::jsonb,false,true,201,'ai_package',0,12,NULL),
  ('ai_extra_300','300 créditos de IA','Mais liberdade para usar a IA no dia a dia',1990,NULL,300,'["300 créditos de IA","Textos, otimizações e análises","1 crédito por imagem gerada","Validade de até 12 meses"]'::jsonb,true,true,202,'ai_package',0,12,'Mais escolhido'),
  ('ai_extra_750','750 créditos de IA','Para operações com uso frequente de IA',3990,NULL,750,'["750 créditos de IA","Textos, otimizações e análises","1 crédito por imagem gerada","Validade de até 12 meses"]'::jsonb,false,true,203,'ai_package',0,12,'Melhor custo'),
  ('ai_extra_1500','1.500 créditos de IA','Alto volume para quem usa IA todos os dias',6990,NULL,1500,'["1.500 créditos de IA","Textos, otimizações e análises","1 crédito por imagem gerada","Validade de até 12 meses"]'::jsonb,false,true,204,'ai_package',0,12,'Maior volume')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  ai_credits = EXCLUDED.ai_credits,
  features = EXCLUDED.features,
  highlighted = EXCLUDED.highlighted,
  active = true,
  sort_order = EXCLUDED.sort_order,
  kind = 'ai_package',
  ad_quota = 0,
  period_months = 12,
  badge = EXCLUDED.badge;

-- Pacotes opcionais de anúncios extras. Eles aumentam apenas a franquia de
-- criação/duplicação e não consomem nem alteram o saldo de IA.
INSERT INTO public.plans
  (code,name,tagline,price_monthly_cents,listing_limit,ai_credits,features,highlighted,active,sort_order,kind,ad_quota,period_months,badge)
VALUES
  ('ads_extra_25','25 anúncios extras','Uma recarga rápida para operações pontuais',990,NULL,0,'["25 criações/duplicações extras","Não altera seus créditos de IA","Validade de até 12 meses"]'::jsonb,false,true,101,'ad_package',25,12,NULL),
  ('ads_extra_100','100 anúncios extras','Mais capacidade sem precisar trocar de plano',2490,NULL,0,'["100 criações/duplicações extras","Não altera seus créditos de IA","Validade de até 12 meses"]'::jsonb,true,true,102,'ad_package',100,12,'Mais escolhido'),
  ('ads_extra_300','300 anúncios extras','Para quem trabalha com mais volume',4990,NULL,0,'["300 criações/duplicações extras","Não altera seus créditos de IA","Validade de até 12 meses"]'::jsonb,false,true,103,'ad_package',300,12,'Melhor custo'),
  ('ads_extra_1000','1.000 anúncios extras','Pacote de escala para operações maiores',9990,NULL,0,'["1.000 criações/duplicações extras","Não altera seus créditos de IA","Validade de até 12 meses"]'::jsonb,false,true,104,'ad_package',1000,12,'Maior volume')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  ai_credits = 0,
  features = EXCLUDED.features,
  highlighted = EXCLUDED.highlighted,
  active = true,
  sort_order = EXCLUDED.sort_order,
  kind = 'ad_package',
  ad_quota = EXCLUDED.ad_quota,
  period_months = 12,
  badge = EXCLUDED.badge;
