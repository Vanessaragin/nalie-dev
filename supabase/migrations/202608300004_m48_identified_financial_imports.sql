-- M48: financial Excel packages must travel with the TXT that identifies the client.

alter table public.companies
  add column import_identifier varchar(64) unique
    check (import_identifier is null or import_identifier ~ '^[A-Za-z0-9._-]+$');

alter table public.import_batches
  add column import_kind text
    check (import_kind is null or import_kind in (
      'MOVIMENTACOES_CONTA',
      'CARTAO_LANCAMENTOS',
      'CARTAO_PARCELAS_FUTURAS'
    )),
  add column identification_filename text,
  add column identification_sha256 char(64)
    check (identification_sha256 is null or identification_sha256 ~ '^[a-f0-9]{64}$'),
  add column external_user_id varchar(64),
  add column identified_name text,
  add column source_file_path text,
  add column identification_file_path text,
  add column processing_status text not null default 'RECEBIDO'
    check (processing_status in ('RECEBIDO', 'VALIDANDO', 'PROCESSADO', 'ERRO')),
  add column processing_error text;

create index import_batches_external_user_idx
  on public.import_batches (external_user_id, imported_at desc)
  where external_user_id is not null;
create index import_batches_processing_status_idx
  on public.import_batches (company_id, processing_status, imported_at desc);

insert into storage.buckets (id, name, public)
values ('financial-imports', 'financial-imports', false)
on conflict (id) do update set public = false;

create policy financial_import_files_read
on storage.objects for select to authenticated
using (
  bucket_id = 'financial-imports'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
);

create policy financial_import_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'financial-imports'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
  and public.company_imports_allowed(((storage.foldername(name))[1])::uuid)
);

create policy financial_import_files_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'financial-imports' and public.is_super_admin());

comment on column public.companies.import_identifier is
  'Stable external id_usuario read from the TXT that accompanies every financial Excel import.';
comment on column public.import_batches.identification_sha256 is
  'SHA-256 of the TXT used to identify the company for this Excel import.';
