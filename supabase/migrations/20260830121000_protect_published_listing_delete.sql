-- Evita apagar apenas o registro local enquanto o anúncio continua publicado no Mercado Livre.
-- Anúncios que já foram encerrados podem ser removidos normalmente do painel.
create or replace function public.protect_published_listing_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.published_ml_id is not null and coalesce(old.status, '') <> 'closed' then
    raise exception 'Não é possível excluir um anúncio ainda publicado no Mercado Livre. Pause ou encerre o anúncio antes de removê-lo.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_published_listing_delete on public.listings;
create trigger protect_published_listing_delete
before delete on public.listings
for each row
execute function public.protect_published_listing_delete();
