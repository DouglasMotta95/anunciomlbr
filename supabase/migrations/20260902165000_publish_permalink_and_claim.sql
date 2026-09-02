alter table public.listings
  add column if not exists published_permalink text,
  add column if not exists publishing_claim_token uuid,
  add column if not exists publishing_claimed_at timestamptz;

create unique index if not exists listings_publishing_claim_token_uidx
  on public.listings (publishing_claim_token)
  where publishing_claim_token is not null;

comment on column public.listings.source_permalink is 'Permalink do anúncio de origem/importado no Mercado Livre.';
comment on column public.listings.published_permalink is 'Permalink confirmado da nova publicação criada pelo ANÚNCIO ML.';
comment on column public.listings.publishing_claim_token is 'Token atômico de claim para impedir publicação concorrente.';
comment on column public.listings.publishing_claimed_at is 'Instante em que o claim de publicação foi adquirido.';
