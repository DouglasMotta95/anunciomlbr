CREATE TABLE IF NOT EXISTS public.sales_recovery_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('generated','contacted','resolved','ignored')),
  message text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_recovery_payment ON public.sales_recovery_actions(payment_id,created_at DESC);
ALTER TABLE public.sales_recovery_actions ENABLE ROW LEVEL SECURITY;
