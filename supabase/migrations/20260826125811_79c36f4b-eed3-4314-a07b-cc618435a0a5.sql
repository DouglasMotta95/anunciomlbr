-- Auditoria administrativa
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL DEFAULT 'license',
  entity_id text,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit logs admin read" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_audit_logs_created ON public.admin_audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_target ON public.admin_audit_logs (target_user_id);

-- Configuração dos alertas de vencimento
CREATE TABLE public.license_alert_settings (
  id boolean PRIMARY KEY DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  days integer[] NOT NULL DEFAULT ARRAY[30, 10, 7, 3],
  subject_template text NOT NULL DEFAULT 'Sua licença ANÚNCIO ML vence em {{dias}} dia(s)',
  body_template text NOT NULL DEFAULT E'Olá {{nome}},\n\nSua licença {{codigo}} do plano {{plano}} vence em {{dias}} dia(s), no dia {{validade}}.\n\nRenove agora para não perder o acesso ao radar de produtos, à IA de anúncios e à publicação automática no Mercado Livre.\n\n{{link_renovacao}}\n\nEquipe ANÚNCIO ML',
  from_name text NOT NULL DEFAULT 'ANÚNCIO ML',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT license_alert_settings_singleton CHECK (id)
);

GRANT SELECT, INSERT, UPDATE ON public.license_alert_settings TO authenticated;
GRANT ALL ON public.license_alert_settings TO service_role;
ALTER TABLE public.license_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert settings admin all" ON public.license_alert_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_alert_settings_updated BEFORE UPDATE ON public.license_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.license_alert_settings (id) VALUES (true);

-- Histórico de avisos enviados
CREATE TABLE public.license_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  day_bucket integer NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'sent',
  recipient text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.license_alert_log TO authenticated;
GRANT ALL ON public.license_alert_log TO service_role;
ALTER TABLE public.license_alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert log read" ON public.license_alert_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE UNIQUE INDEX idx_alert_log_unique ON public.license_alert_log (license_id, day_bucket, channel);
CREATE INDEX idx_alert_log_created ON public.license_alert_log (created_at DESC);