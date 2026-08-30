-- M51: safe, company-scoped financial summary for the Analysis workspace.

alter table public.import_batches
  drop constraint import_batches_safe_row_count,
  add constraint import_batches_safe_row_count check (row_count between 1 and 10000);

create or replace function public.financial_analysis_summary(target_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not (public.is_super_admin() or public.is_company_member(target_company_id)) then
    raise exception 'Empresa nao autorizada.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'movimentacoes', (select count(*) from public.movimentacoes_conta where cliente_id = target_company_id),
    'entradas', coalesce((select sum(valor) from public.movimentacoes_conta where cliente_id = target_company_id and upper(direcao) = 'ENTRADA'), 0),
    'saidas', coalesce((select sum(valor) from public.movimentacoes_conta where cliente_id = target_company_id and upper(direcao) = 'SAIDA'), 0),
    'cartao', coalesce((select sum(coalesce(valor_brl, 0)) from public.cartao_lancamentos where cliente_id = target_company_id), 0),
    'parcelas_futuras', coalesce((select sum(valor_brl) from public.cartao_parcelas_futuras where cliente_id = target_company_id and upper(status_parcela) not in ('PAGA', 'CANCELADA')), 0),
    'ultima_movimentacao', (select max(data_movimentacao) from public.movimentacoes_conta where cliente_id = target_company_id)
  ) into result;

  return result;
end;
$$;

revoke all on function public.financial_analysis_summary(uuid) from public;
grant execute on function public.financial_analysis_summary(uuid) to authenticated;

comment on function public.financial_analysis_summary(uuid) is
  'Returns only the financial totals the current user may see for one company.';
