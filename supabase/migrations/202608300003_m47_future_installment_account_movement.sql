-- M47: reconcile projected card installments with the bank movement that paid them.
-- The relationship is optional while an installment is still projected and many
-- installments may be settled by the same statement movement (one card invoice).

alter table public.cartao_parcelas_futuras
  add column movimentacao_conta_id uuid
    references public.movimentacoes_conta(id) on delete set null,
  add column realizada_at timestamptz;

create index cartao_parcelas_futuras_movimentacao_idx
  on public.cartao_parcelas_futuras (movimentacao_conta_id)
  where movimentacao_conta_id is not null;

create or replace function public.validate_future_installment_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  movement_client_id uuid;
begin
  if new.movimentacao_conta_id is null then
    if new.status_parcela = 'REALIZADA' then
      raise exception 'A parcela realizada precisa estar vinculada a uma movimentacao da conta.';
    end if;
    new.realizada_at := null;
    return new;
  end if;

  select cliente_id
    into movement_client_id
    from public.movimentacoes_conta
   where id = new.movimentacao_conta_id;

  if movement_client_id is null then
    raise exception 'Movimentacao da conta nao encontrada.';
  end if;

  if movement_client_id <> new.cliente_id then
    raise exception 'A parcela e a movimentacao precisam pertencer ao mesmo cliente.';
  end if;

  new.status_parcela := 'REALIZADA';
  new.realizada_at := coalesce(new.realizada_at, now());
  return new;
end;
$$;

revoke all on function public.validate_future_installment_movement() from public;

create trigger validate_future_installment_movement_before_write
before insert or update of cliente_id, movimentacao_conta_id, status_parcela
on public.cartao_parcelas_futuras
for each row execute function public.validate_future_installment_movement();

comment on column public.cartao_parcelas_futuras.movimentacao_conta_id is
  'Bank statement movement that settled this projected installment; several installments may share one invoice payment.';
comment on column public.cartao_parcelas_futuras.realizada_at is
  'Timestamp when the projected installment was reconciled with its account movement.';
