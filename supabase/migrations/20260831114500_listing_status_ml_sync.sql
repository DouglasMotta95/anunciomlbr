-- Alinha os estados locais aos estados que o webhook oficial do Mercado Livre persiste.
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'inactive';
