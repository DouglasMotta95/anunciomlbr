-- Fundação comercial: multiconta interna, equipe e lotes auditáveis.
-- Não altera o OAuth/token legado nesta etapa: evita quebrar contas conectadas existentes.

create table if not exists public.seller_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  ml_user_id text,
  nickname text,
  label text not null default 'Conta Mercado Livre',
  status text not null default 'pending' check (status in ('pending','connected','disconnected')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists seller_accounts_owner_ml_uidx on public.seller_accounts(owner_user_id, ml_user_id) where ml_user_id is not null;
create index if not exists seller_accounts_owner_idx on public.seller_accounts(owner_user_id, created_at desc);
alter table public.seller_accounts enable row level security;
drop policy if exists seller_accounts_owner_all on public.seller_accounts;
create policy seller_accounts_owner_all on public.seller_accounts for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_email text not null,
  role text not null default 'viewer' check (role in ('owner','manager','operator','viewer')),
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, member_email)
);
create index if not exists workspace_members_owner_idx on public.workspace_members(owner_user_id, created_at desc);
alter table public.workspace_members enable row level security;
drop policy if exists workspace_members_owner_all on public.workspace_members;
create policy workspace_members_owner_all on public.workspace_members for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create table if not exists public.bulk_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null check (operation_type in ('pause','activate','price_simulation','stock_review','listing_review','copy_draft')),
  status text not null default 'draft' check (status in ('draft','simulated','confirmed','running','completed','failed')),
  target_listing_ids uuid[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  dry_run boolean not null default true,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz
);
create index if not exists bulk_operations_user_idx on public.bulk_operations(user_id, created_at desc);
alter table public.bulk_operations enable row level security;
drop policy if exists bulk_operations_user_all on public.bulk_operations;
create policy bulk_operations_user_all on public.bulk_operations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.product_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sku text,
  component_listing_ids uuid[] not null default '{}',
  component_quantities jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_kits_user_idx on public.product_kits(user_id, created_at desc);
alter table public.product_kits enable row level security;
drop policy if exists product_kits_user_all on public.product_kits;
create policy product_kits_user_all on public.product_kits for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.catalog_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  action_type text not null check (action_type in ('catalog_review','promotion_review','compatibility_review')),
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists catalog_actions_user_idx on public.catalog_actions(user_id, created_at desc);
alter table public.catalog_actions enable row level security;
drop policy if exists catalog_actions_user_all on public.catalog_actions;
create policy catalog_actions_user_all on public.catalog_actions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
