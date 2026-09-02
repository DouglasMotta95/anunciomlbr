-- Uma conta de vendedor do Mercado Livre pode estar ativa em apenas um login
-- do ANÚNCIO ML. Mantemos a vinculação ativa mais antiga e apenas desativamos
-- duplicatas já existentes; nenhum anúncio local é apagado.
with ranked as (
  select
    user_id,
    row_number() over (
      partition by ml_user_id
      order by created_at asc nulls last, user_id asc
    ) as rn
  from public.ml_connections
  where connected = true
    and ml_user_id is not null
),
deactivated as (
  update public.ml_connections c
  set connected = false,
      updated_at = now()
  from ranked r
  where c.user_id = r.user_id
    and r.rn > 1
  returning c.user_id
)
delete from public.ml_tokens t
using deactivated d
where t.user_id = d.user_id;

create unique index if not exists ml_connections_connected_ml_user_uidx
  on public.ml_connections (ml_user_id)
  where connected = true and ml_user_id is not null;

comment on index public.ml_connections_connected_ml_user_uidx is
  'Impede a mesma conta Mercado Livre de ficar conectada simultaneamente a mais de um usuário do ANÚNCIO ML.';
