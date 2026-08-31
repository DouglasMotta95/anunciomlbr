-- Reduz privilégios de runtime sem alterar os CRUDs usados pela aplicação.
-- RLS não protege TRUNCATE, e clientes web não precisam criar triggers/FKs.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

-- Tabelas estritamente server-only: tokens, estados OAuth e consumo interno de franquia.
REVOKE ALL ON public.ml_tokens FROM anon, authenticated;
REVOKE ALL ON public.ml_oauth_states FROM anon, authenticated;
REVOKE ALL ON public.listing_quota_claims FROM anon, authenticated;
GRANT ALL ON public.ml_tokens, public.ml_oauth_states, public.listing_quota_claims TO service_role;
