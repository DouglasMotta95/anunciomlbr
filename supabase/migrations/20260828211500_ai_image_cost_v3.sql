-- Catálogo comercial v3: alinha a comunicação persistida dos pacotes de IA
-- à regra real do produto. Cada imagem gerada por IA usa 3 créditos.

UPDATE public.plans
SET features = '["100 créditos de IA","Textos, otimizações e análises","3 créditos por imagem gerada","Validade de até 12 meses"]'::jsonb
WHERE code = 'ai_extra_100' AND kind = 'ai_package';

UPDATE public.plans
SET features = '["300 créditos de IA","Textos, otimizações e análises","3 créditos por imagem gerada","Validade de até 12 meses"]'::jsonb
WHERE code = 'ai_extra_300' AND kind = 'ai_package';

UPDATE public.plans
SET features = '["750 créditos de IA","Textos, otimizações e análises","3 créditos por imagem gerada","Validade de até 12 meses"]'::jsonb
WHERE code = 'ai_extra_750' AND kind = 'ai_package';

UPDATE public.plans
SET features = '["1.500 créditos de IA","Textos, otimizações e análises","3 créditos por imagem gerada","Validade de até 12 meses"]'::jsonb
WHERE code = 'ai_extra_1500' AND kind = 'ai_package';
