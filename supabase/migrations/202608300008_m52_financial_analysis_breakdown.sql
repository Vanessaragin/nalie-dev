-- M52: company- and period-scoped financial breakdowns for the Analysis page.

create or replace function public.financial_analysis_breakdown(
  target_company_id uuid,
  period_start date,
  period_end date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if period_start is null or period_end is null or period_start > period_end then
    raise exception 'Periodo invalido.' using errcode = '22007';
  end if;
  if not (public.is_super_admin() or public.is_company_member(target_company_id)) then
    raise exception 'Empresa nao autorizada.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totals', jsonb_build_object(
      'entradas', coalesce((select sum(valor) from public.movimentacoes_conta where cliente_id = target_company_id and data_movimentacao between period_start and period_end and upper(direcao) = 'ENTRADA'), 0),
      'saidas', coalesce((select sum(valor) from public.movimentacoes_conta where cliente_id = target_company_id and data_movimentacao between period_start and period_end and upper(direcao) = 'SAIDA'), 0),
      'cartao', coalesce((select sum(coalesce(valor_brl, 0)) from public.cartao_lancamentos where cliente_id = target_company_id and data_compra between period_start and period_end), 0),
      'parcelas_futuras', coalesce((select sum(valor_brl) from public.cartao_parcelas_futuras where cliente_id = target_company_id and data_prevista between period_start and period_end and upper(status_parcela) not in ('PAGA', 'CANCELADA')), 0)
    ),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object('month', periodo_mes, 'entradas', entradas, 'saidas', saidas) order by periodo_mes)
      from (
        select date_trunc('month', data_movimentacao)::date as periodo_mes,
          sum(valor) filter (where upper(direcao) = 'ENTRADA') entradas,
          sum(valor) filter (where upper(direcao) = 'SAIDA') saidas
        from public.movimentacoes_conta
        where cliente_id = target_company_id and data_movimentacao between period_start and period_end
        group by 1
      ) grouped
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'value', value) order by value desc)
      from (
        select coalesce(nullif(categoria, ''), 'Sem categoria') name, sum(valor) value
        from public.movimentacoes_conta
        where cliente_id = target_company_id and data_movimentacao between period_start and period_end and upper(direcao) = 'SAIDA'
        group by 1 order by 2 desc limit 10
      ) grouped
    ), '[]'::jsonb),
    'institutions', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'records', records, 'value', value) order by value desc)
      from (
        select banco_origem name, count(*) records, sum(valor) value
        from public.movimentacoes_conta
        where cliente_id = target_company_id and data_movimentacao between period_start and period_end
        group by 1 order by 3 desc limit 10
      ) grouped
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.financial_analysis_breakdown(uuid, date, date) from public;
grant execute on function public.financial_analysis_breakdown(uuid, date, date) to authenticated;

comment on function public.financial_analysis_breakdown(uuid, date, date) is
  'Returns period totals and grouped financial data for one authorized company.';
