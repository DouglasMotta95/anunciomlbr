CREATE TABLE public.ml_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id TEXT,
  topic TEXT NOT NULL,
  resource TEXT NOT NULL,
  ml_user_id TEXT,
  application_id TEXT,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  payload JSONB,
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ml_notifications_dedupe_idx ON public.ml_notifications (topic, resource, COALESCE(sent_at, received_at));
CREATE INDEX ml_notifications_user_idx ON public.ml_notifications (user_id, received_at DESC);

GRANT SELECT ON public.ml_notifications TO authenticated;
GRANT ALL ON public.ml_notifications TO service_role;

ALTER TABLE public.ml_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ML notifications"
  ON public.ml_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ML notifications"
  ON public.ml_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));