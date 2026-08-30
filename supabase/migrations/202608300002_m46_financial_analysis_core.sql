-- M46: canonical financial analysis data. The consolidated customer export is
-- intentionally generated from these sources later; it is not stored as a copy.

create table public.movimentacoes_conta (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.companies(id) on delete cascade,
  import_batch_id uuid references public.import_batches(id) on delete restrict,
  banco_origem text not null check (btrim(banco_origem) <> ''),
  conta_final varchar(4) check (conta_final is null or conta_final ~ '^[0-9]{4}$'),
  data_movimentacao date not null,
  descricao_original text,
  contraparte text,
  tipo_operacao text,
  direcao text not null check (direcao in ('ENTRADA', 'SAIDA')),
  valor numeric(14,2) not null check (valor >= 0),
  categoria text,
  subcategoria text,
  arquivo_origem text,
  processamento_id text,
  id_operacao_banco text,
  registro_origem_hash char(64) check (
    registro_origem_hash is null or registro_origem_hash ~ '^[a-f0-9]{64}$'
  ),
  created_at timestamptz not null default now()
);

create table public.cartao_lancamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.companies(id) on delete cascade,
  import_batch_id uuid references public.import_batches(id) on delete restrict,
  banco_origem text not null check (btrim(banco_origem) <> ''),
  cartao_final varchar(4) check (cartao_final is null or cartao_final ~ '^[0-9]{4}$'),
  produto_cartao text,
  data_compra date,
  descricao_original text,
  contraparte text,
  valor_brl numeric(14,2) check (valor_brl is null or valor_brl >= 0),
  valor_usd numeric(14,2) check (valor_usd is null or valor_usd >= 0),
  cotacao_dolar numeric(14,6) check (cotacao_dolar is null or cotacao_dolar > 0),
  iof numeric(14,2) check (iof is null or iof >= 0),
  categoria text,
  subcategoria text,
  categoria_banco text,
  parcela_atual integer check (parcela_atual is null or parcela_atual >= 1),
  parcelas_total integer check (parcelas_total is null or parcelas_total >= 1),
  tipo_lancamento text,
  competencia_fatura date,
  data_fechamento date,
  data_vencimento date,
  arquivo_origem text,
  processamento_id text,
  registro_origem_hash char(64) check (
    registro_origem_hash is null or registro_origem_hash ~ '^[a-f0-9]{64}$'
  ),
  created_at timestamptz not null default now(),
  constraint cartao_lancamentos_valor_presente check (valor_brl is not null or valor_usd is not null),
  constraint cartao_lancamentos_parcela_valida check (
    parcela_atual is null or parcelas_total is null or parcela_atual <= parcelas_total
  )
);

create table public.cartao_parcelas_futuras (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.companies(id) on delete cascade,
  import_batch_id uuid references public.import_batches(id) on delete restrict,
  banco_origem text not null check (btrim(banco_origem) <> ''),
  cartao_final varchar(4) check (cartao_final is null or cartao_final ~ '^[0-9]{4}$'),
  data_prevista date not null,
  descricao_original text,
  contraparte text,
  valor_brl numeric(14,2) not null check (valor_brl >= 0),
  categoria text,
  subcategoria text,
  parcela_atual integer check (parcela_atual is null or parcela_atual >= 1),
  parcelas_total integer check (parcelas_total is null or parcelas_total >= 1),
  status_parcela text not null default 'PROJETADA'
    check (status_parcela in ('PROJETADA', 'REALIZADA', 'CANCELADA')),
  arquivo_origem text,
  processamento_id text,
  registro_origem_hash char(64) check (
    registro_origem_hash is null or registro_origem_hash ~ '^[a-f0-9]{64}$'
  ),
  created_at timestamptz not null default now(),
  constraint cartao_parcelas_futuras_parcela_valida check (
    parcela_atual is null or parcelas_total is null or parcela_atual <= parcelas_total
  )
);

create index movimentacoes_conta_cliente_data_idx
  on public.movimentacoes_conta (cliente_id, data_movimentacao desc);
create index movimentacoes_conta_categoria_idx
  on public.movimentacoes_conta (cliente_id, categoria, subcategoria);
create unique index movimentacoes_conta_operacao_banco_uidx
  on public.movimentacoes_conta (cliente_id, banco_origem, id_operacao_banco)
  where id_operacao_banco is not null;
create unique index movimentacoes_conta_hash_uidx
  on public.movimentacoes_conta (cliente_id, registro_origem_hash)
  where registro_origem_hash is not null;

create index cartao_lancamentos_cliente_competencia_idx
  on public.cartao_lancamentos (cliente_id, competencia_fatura desc, data_compra desc);
create index cartao_lancamentos_categoria_idx
  on public.cartao_lancamentos (cliente_id, categoria, subcategoria);
create unique index cartao_lancamentos_hash_uidx
  on public.cartao_lancamentos (cliente_id, registro_origem_hash)
  where registro_origem_hash is not null;

create index cartao_parcelas_futuras_cliente_data_idx
  on public.cartao_parcelas_futuras (cliente_id, data_prevista, status_parcela);
create index cartao_parcelas_futuras_categoria_idx
  on public.cartao_parcelas_futuras (cliente_id, categoria, subcategoria);
create unique index cartao_parcelas_futuras_hash_uidx
  on public.cartao_parcelas_futuras (cliente_id, registro_origem_hash)
  where registro_origem_hash is not null;

alter table public.movimentacoes_conta enable row level security;
alter table public.movimentacoes_conta force row level security;
alter table public.cartao_lancamentos enable row level security;
alter table public.cartao_lancamentos force row level security;
alter table public.cartao_parcelas_futuras enable row level security;
alter table public.cartao_parcelas_futuras force row level security;

grant select, insert, update, delete on public.movimentacoes_conta to authenticated;
grant select, insert, update, delete on public.cartao_lancamentos to authenticated;
grant select, insert, update, delete on public.cartao_parcelas_futuras to authenticated;

create policy movimentacoes_conta_read on public.movimentacoes_conta
for select to authenticated using (public.is_company_member(cliente_id));
create policy movimentacoes_conta_insert on public.movimentacoes_conta
for insert to authenticated with check (
  public.is_company_member(cliente_id)
  and public.company_imports_allowed(cliente_id)
  and (import_batch_id is null or exists (
    select 1 from public.import_batches b
    where b.id = import_batch_id and b.company_id = cliente_id and b.deleted_at is null
  ))
);
create policy movimentacoes_conta_admin_update on public.movimentacoes_conta
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy movimentacoes_conta_admin_delete on public.movimentacoes_conta
for delete to authenticated using (public.is_super_admin());

create policy cartao_lancamentos_read on public.cartao_lancamentos
for select to authenticated using (public.is_company_member(cliente_id));
create policy cartao_lancamentos_insert on public.cartao_lancamentos
for insert to authenticated with check (
  public.is_company_member(cliente_id)
  and public.company_imports_allowed(cliente_id)
  and (import_batch_id is null or exists (
    select 1 from public.import_batches b
    where b.id = import_batch_id and b.company_id = cliente_id and b.deleted_at is null
  ))
);
create policy cartao_lancamentos_admin_update on public.cartao_lancamentos
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy cartao_lancamentos_admin_delete on public.cartao_lancamentos
for delete to authenticated using (public.is_super_admin());

create policy cartao_parcelas_futuras_read on public.cartao_parcelas_futuras
for select to authenticated using (public.is_company_member(cliente_id));
create policy cartao_parcelas_futuras_insert on public.cartao_parcelas_futuras
for insert to authenticated with check (
  public.is_company_member(cliente_id)
  and public.company_imports_allowed(cliente_id)
  and (import_batch_id is null or exists (
    select 1 from public.import_batches b
    where b.id = import_batch_id and b.company_id = cliente_id and b.deleted_at is null
  ))
);
create policy cartao_parcelas_futuras_admin_update on public.cartao_parcelas_futuras
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy cartao_parcelas_futuras_admin_delete on public.cartao_parcelas_futuras
for delete to authenticated using (public.is_super_admin());

comment on table public.movimentacoes_conta is
  'Canonical bank statement movements used by analysis and the future consolidated export.';
comment on table public.cartao_lancamentos is
  'Canonical posted credit card entries used by analysis and the future consolidated export.';
comment on table public.cartao_parcelas_futuras is
  'Projected future card installments used by analysis and the future consolidated export.';
