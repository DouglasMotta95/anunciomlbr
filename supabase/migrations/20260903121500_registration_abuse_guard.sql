create table if not exists public.registration_abuse_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'attempt' check (status in ('attempt', 'registered', 'failed')),
  user_id uuid null references auth.users(id) on delete set null,
  email_hash text not null,
  ip_hash text not null,
  device_hash text not null,
  user_agent_hash text null,
  reservation_token_hash text not null unique
);

create index if not exists registration_abuse_device_idx
  on public.registration_abuse_events (device_hash, created_at desc);
create index if not exists registration_abuse_ip_idx
  on public.registration_abuse_events (ip_hash, created_at desc);
create index if not exists registration_abuse_email_idx
  on public.registration_abuse_events (email_hash, created_at desc);
create index if not exists registration_abuse_status_idx
  on public.registration_abuse_events (status, created_at desc);

alter table public.registration_abuse_events enable row level security;

revoke all on table public.registration_abuse_events from anon, authenticated;
grant all on table public.registration_abuse_events to service_role;

comment on table public.registration_abuse_events is
  'Sinais antiabuso de cadastro. IP, e-mail, aparelho e user-agent são armazenados somente como hashes salgados.';
