-- M50: atomically transform a validated Excel payload into its canonical table.

alter table public.import_batches
  drop constraint import_batches_safe_row_count,
  drop constraint import_batches_source_file_size_check,
  add constraint import_batches_safe_row_count check (row_count <= 10000),
  add constraint import_batches_source_file_size_check
    check (source_file_size is null or source_file_size between 0 and 10485760);

create or replace function public.process_financial_import_rows(
  target_batch_id uuid,
  records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  batch public.import_batches%rowtype;
  record_count integer;
begin
  select * into batch
  from public.import_batches
  where id = target_batch_id
  for update;

  if batch.id is null then
    return jsonb_build_object('ok', false, 'message', 'Lote de importacao nao encontrado.');
  end if;
  if not (public.is_super_admin() or batch.uploaded_by = auth.uid()) then
    return jsonb_build_object('ok', false, 'message', 'Importacao nao autorizada.');
  end if;
  if not public.is_company_member(batch.company_id) then
    return jsonb_build_object('ok', false, 'message', 'Empresa nao autorizada.');
  end if;
  if batch.processing_status = 'PROCESSADO' then
    return jsonb_build_object('ok', false, 'message', 'Este arquivo ja foi processado.');
  end if;
  if jsonb_typeof(records) <> 'array' then
    return jsonb_build_object('ok', false, 'message', 'Conteudo financeiro invalido.');
  end if;

  record_count := jsonb_array_length(records);
  if record_count = 0 then
    return jsonb_build_object('ok', false, 'message', 'Inclua ao menos uma linha de dados.');
  end if;
  if record_count > 10000 then
    return jsonb_build_object('ok', false, 'message', 'Arquivo extenso. Contacte o seu consultor.');
  end if;
  if record_count <> batch.row_count then
    return jsonb_build_object('ok', false, 'message', 'Quantidade de linhas divergente.');
  end if;

  update public.import_batches
  set processing_status = 'VALIDANDO', processing_error = null
  where id = target_batch_id;

  begin
    if batch.import_kind = 'MOVIMENTACOES_CONTA' then
      insert into public.movimentacoes_conta (
        cliente_id, import_batch_id, banco_origem, conta_final,
        data_movimentacao, descricao_original, contraparte, tipo_operacao,
        direcao, valor, categoria, subcategoria, arquivo_origem,
        processamento_id, id_operacao_banco, registro_origem_hash
      )
      select
        batch.company_id, batch.id, item->>'banco_origem', nullif(item->>'conta_final', ''),
        (item->>'data_movimentacao')::date, nullif(item->>'descricao_original', ''),
        nullif(item->>'contraparte', ''), nullif(item->>'tipo_operacao', ''),
        item->>'direcao', (item->>'valor')::numeric,
        nullif(item->>'categoria', ''), nullif(item->>'subcategoria', ''),
        batch.original_filename, batch.id::text, nullif(item->>'id_operacao_banco', ''),
        item->>'registro_origem_hash'
      from jsonb_array_elements(records) item;
    elsif batch.import_kind = 'CARTAO_LANCAMENTOS' then
      insert into public.cartao_lancamentos (
        cliente_id, import_batch_id, banco_origem, cartao_final, produto_cartao,
        data_compra, descricao_original, contraparte, valor_brl, valor_usd,
        cotacao_dolar, iof, categoria, subcategoria, categoria_banco,
        parcela_atual, parcelas_total, tipo_lancamento, competencia_fatura,
        data_fechamento, data_vencimento, arquivo_origem, processamento_id,
        registro_origem_hash
      )
      select
        batch.company_id, batch.id, item->>'banco_origem', nullif(item->>'cartao_final', ''),
        nullif(item->>'produto_cartao', ''), nullif(item->>'data_compra', '')::date,
        nullif(item->>'descricao_original', ''), nullif(item->>'contraparte', ''),
        nullif(item->>'valor_brl', '')::numeric, nullif(item->>'valor_usd', '')::numeric,
        nullif(item->>'cotacao_dolar', '')::numeric, nullif(item->>'iof', '')::numeric,
        nullif(item->>'categoria', ''), nullif(item->>'subcategoria', ''),
        nullif(item->>'categoria_banco', ''), nullif(item->>'parcela_atual', '')::integer,
        nullif(item->>'parcelas_total', '')::integer, nullif(item->>'tipo_lancamento', ''),
        nullif(item->>'competencia_fatura', '')::date,
        nullif(item->>'data_fechamento', '')::date,
        nullif(item->>'data_vencimento', '')::date,
        batch.original_filename, batch.id::text, item->>'registro_origem_hash'
      from jsonb_array_elements(records) item;
    elsif batch.import_kind = 'CARTAO_PARCELAS_FUTURAS' then
      insert into public.cartao_parcelas_futuras (
        cliente_id, import_batch_id, banco_origem, cartao_final, data_prevista,
        descricao_original, contraparte, valor_brl, categoria, subcategoria,
        parcela_atual, parcelas_total, status_parcela, arquivo_origem,
        processamento_id, movimentacao_conta_id, registro_origem_hash
      )
      select
        batch.company_id, batch.id, item->>'banco_origem', nullif(item->>'cartao_final', ''),
        (item->>'data_prevista')::date, nullif(item->>'descricao_original', ''),
        nullif(item->>'contraparte', ''), (item->>'valor_brl')::numeric,
        nullif(item->>'categoria', ''), nullif(item->>'subcategoria', ''),
        nullif(item->>'parcela_atual', '')::integer,
        nullif(item->>'parcelas_total', '')::integer,
        coalesce(nullif(item->>'status_parcela', ''), 'PROJETADA'),
        batch.original_filename, batch.id::text,
        nullif(item->>'movimentacao_conta_id', '')::uuid,
        item->>'registro_origem_hash'
      from jsonb_array_elements(records) item;
    else
      raise exception 'Tipo de importacao financeira nao reconhecido.';
    end if;

    update public.import_batches
    set processing_status = 'PROCESSADO', processing_error = null
    where id = target_batch_id;
    return jsonb_build_object('ok', true, 'rows', record_count);
  exception when others then
    update public.import_batches
    set processing_status = 'ERRO', processing_error = left(sqlerrm, 1000)
    where id = target_batch_id;
    return jsonb_build_object(
      'ok', false,
      'message', 'O arquivo possui dados invalidos. Revise o modelo e tente novamente.'
    );
  end;
end;
$$;

revoke all on function public.process_financial_import_rows(uuid, jsonb) from public;
grant execute on function public.process_financial_import_rows(uuid, jsonb) to authenticated;

comment on function public.process_financial_import_rows(uuid, jsonb) is
  'Atomically writes a validated Excel payload into the canonical financial table selected by its import batch.';
