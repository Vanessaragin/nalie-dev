alter table public.company_documents
  add column if not exists byte_size bigint,
  add column if not exists checksum_sha256 text,
  add column if not exists storage_status text not null default 'STORED',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

alter table public.company_documents
  drop constraint if exists company_documents_byte_size_check,
  add constraint company_documents_byte_size_check
    check (byte_size is null or byte_size >= 0),
  drop constraint if exists company_documents_checksum_sha256_check,
  add constraint company_documents_checksum_sha256_check
    check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  drop constraint if exists company_documents_storage_status_check,
  add constraint company_documents_storage_status_check
    check (storage_status in ('STORED', 'ARCHIVED'));

drop policy if exists "company manages documents" on public.company_documents;

create policy "company inserts documents"
on public.company_documents for insert to authenticated
with check (
  public.has_company_permission(company_id, 'documents.write')
  and uploaded_by = auth.uid()
  and storage_status = 'STORED'
  and archived_at is null
  and archived_by is null
);

create or replace function public.protect_company_document_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id is distinct from old.company_id
    or new.storage_path is distinct from old.storage_path
    or new.file_name is distinct from old.file_name
    or new.byte_size is distinct from old.byte_size
    or new.checksum_sha256 is distinct from old.checksum_sha256
    or new.uploaded_by is distinct from old.uploaded_by
    or new.created_at is distinct from old.created_at then
    raise exception 'A identidade e a integridade do arquivo são imutáveis.';
  end if;

  if (new.storage_status is distinct from old.storage_status
      or new.archived_at is distinct from old.archived_at
      or new.archived_by is distinct from old.archived_by)
     and not public.is_super_admin() then
    raise exception 'Somente a administração mestre pode arquivar um arquivo.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_company_document_identity_trigger
  on public.company_documents;
create trigger protect_company_document_identity_trigger
before update on public.company_documents
for each row execute function public.protect_company_document_identity();

create policy "company updates document classification"
on public.company_documents for update to authenticated
using (public.has_company_permission(company_id, 'documents.write'))
with check (public.has_company_permission(company_id, 'documents.write'));

create or replace function public.archive_company_document(
  target_document_id uuid,
  archive_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_document public.company_documents%rowtype;
begin
  if not public.is_super_admin() then
    raise exception 'Somente a administração mestre pode arquivar arquivos.';
  end if;

  if length(trim(coalesce(archive_reason, ''))) < 5 then
    raise exception 'Informe o motivo do arquivamento.';
  end if;

  select * into target_document
  from public.company_documents
  where id = target_document_id
  for update;

  if not found then
    raise exception 'Arquivo não encontrado.';
  end if;

  update public.company_documents
  set storage_status = 'ARCHIVED',
      archived_at = now(),
      archived_by = auth.uid()
  where id = target_document_id;

  insert into public.audit_logs (
    company_id, actor_profile_id, action, resource_type, resource_id, metadata
  ) values (
    target_document.company_id,
    auth.uid(),
    'DOCUMENT_ARCHIVED',
    'company_document',
    target_document.id::text,
    jsonb_build_object(
      'reason', trim(archive_reason),
      'file_name', target_document.file_name,
      'storage_path', target_document.storage_path,
      'checksum_sha256', target_document.checksum_sha256
    )
  );
end;
$$;

revoke all on function public.protect_company_document_identity() from public;
revoke all on function public.archive_company_document(uuid, text) from public;
grant execute on function public.archive_company_document(uuid, text) to authenticated;

-- Não existe política DELETE: nem usuários comuns nem a administração apagam
-- o registro. A remoção excepcional é um arquivamento auditado e preserva o
-- objeto original no bucket privado.
