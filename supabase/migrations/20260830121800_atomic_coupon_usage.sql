-- Incrementa o uso do cupom em uma única operação para evitar perda de contagem
-- quando dois pagamentos são aprovados praticamente ao mesmo tempo.
create or replace function public.consume_coupon_use(_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.coupons
     set uses = coalesce(uses, 0) + 1
   where upper(code) = upper(trim(_code));

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.consume_coupon_use(text) from public, anon, authenticated;
grant execute on function public.consume_coupon_use(text) to service_role;
