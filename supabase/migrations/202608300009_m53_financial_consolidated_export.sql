-- M53: final customer ZIP source. One authorized company, capped at 10k rows.

create or replace function public.financial_consolidated_export(target_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  total_rows bigint;
  result jsonb;
begin
  if not (public.is_super_admin() or public.is_company_member(target_company_id)) then
    raise exception 'Empresa nao autorizada.' using errcode = '42501';
  end if;

  select
    (select count(*) from public.movimentacoes_conta where cliente_id = target_company_id) +
    (select count(*) from public.cartao_lancamentos where cliente_id = target_company_id) +
    (select count(*) from public.cartao_parcelas_futuras where cliente_id = target_company_id)
  into total_rows;

  if total_rows > 10000 then
    return jsonb_build_object(
      'ok', false,
      'message', 'Arquivo extenso. Contacte o seu consultor.',
      'total_rows', total_rows
    );
  end if;

  select jsonb_build_object(
    'ok', true,
    'total_rows', total_rows,
    'movimentacoes_conta', coalesce((
      select jsonb_agg(jsonb_build_object(
        'banco_origem', banco_origem, 'conta_final', conta_final,
        'data_movimentacao', data_movimentacao, 'descricao_original', descricao_original,
        'contraparte', contraparte, 'tipo_operacao', tipo_operacao,
        'direcao', direcao, 'valor', valor, 'categoria', categoria,
        'subcategoria', subcategoria, 'arquivo_origem', arquivo_origem,
        'id_operacao_banco', id_operacao_banco
      ) order by data_movimentacao, created_at)
      from public.movimentacoes_conta where cliente_id = target_company_id
    ), '[]'::jsonb),
    'cartao_lancamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'banco_origem', banco_origem, 'cartao_final', cartao_final,
        'produto_cartao', produto_cartao, 'data_compra', data_compra,
        'descricao_original', descricao_original, 'contraparte', contraparte,
        'valor_brl', valor_brl, 'valor_usd', valor_usd,
        'cotacao_dolar', cotacao_dolar, 'iof', iof, 'categoria', categoria,
        'subcategoria', subcategoria, 'categoria_banco', categoria_banco,
        'parcela_atual', parcela_atual, 'parcelas_total', parcelas_total,
        'tipo_lancamento', tipo_lancamento, 'competencia_fatura', competencia_fatura,
        'data_fechamento', data_fechamento, 'data_vencimento', data_vencimento,
        'arquivo_origem', arquivo_origem
      ) order by coalesce(data_compra, competencia_fatura), created_at)
      from public.cartao_lancamentos where cliente_id = target_company_id
    ), '[]'::jsonb),
    'cartao_parcelas_futuras', coalesce((
      select jsonb_agg(jsonb_build_object(
        'banco_origem', banco_origem, 'cartao_final', cartao_final,
        'data_prevista', data_prevista, 'descricao_original', descricao_original,
        'contraparte', contraparte, 'valor_brl', valor_brl,
        'categoria', categoria, 'subcategoria', subcategoria,
        'parcela_atual', parcela_atual, 'parcelas_total', parcelas_total,
        'status_parcela', status_parcela, 'arquivo_origem', arquivo_origem
      ) order by data_prevista, created_at)
      from public.cartao_parcelas_futuras where cliente_id = target_company_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.financial_consolidated_export(uuid) from public;
grant execute on function public.financial_consolidated_export(uuid) to authenticated;

comment on function public.financial_consolidated_export(uuid) is
  'Returns the three canonical financial datasets for one authorized customer export.';
