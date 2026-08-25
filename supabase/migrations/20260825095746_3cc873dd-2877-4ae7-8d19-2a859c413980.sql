CREATE TABLE public.ml_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

GRANT ALL ON public.ml_oauth_states TO service_role;

ALTER TABLE public.ml_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ml_oauth_states_expires ON public.ml_oauth_states (expires_at);