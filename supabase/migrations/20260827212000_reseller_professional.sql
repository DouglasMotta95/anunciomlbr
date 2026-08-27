CREATE TABLE IF NOT EXISTS public.reseller_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_name text,
  last_license_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reseller_id, customer_email)
);
CREATE TABLE IF NOT EXISTS public.reseller_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('credit','license_debit','adjustment','refund')),
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reseller_wallet_transactions ON public.reseller_wallet_transactions(reseller_id,created_at DESC);
ALTER TABLE public.reseller_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_wallet_transactions ENABLE ROW LEVEL SECURITY;
