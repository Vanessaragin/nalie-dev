-- M49: clients upload Excel only. The identifying TXT is generated beside the
-- original file on export. Large packages are rejected instead of processed.

create sequence if not exists public.company_import_identifier_seq;

create or replace function public.assign_company_import_identifier()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.import_identifier is null then
    new.import_identifier := 'USR' || lpad(
      nextval('public.company_import_identifier_seq')::text,
      6,
      '0'
    );
  end if;
  return new;
end;
$$;

create trigger assign_company_import_identifier_before_insert
before insert on public.companies
for each row execute function public.assign_company_import_identifier();

update public.companies
set import_identifier = 'USR' || lpad(
  nextval('public.company_import_identifier_seq')::text,
  6,
  '0'
)
where import_identifier is null;

alter table public.import_batches
  drop column identification_filename,
  drop column identification_sha256,
  drop column identification_file_path,
  add column source_file_size bigint
    check (source_file_size is null or source_file_size between 0 and 20971520),
  add constraint import_batches_safe_row_count
    check (row_count <= 50000) not valid;

alter table public.import_batches
  validate constraint import_batches_safe_row_count;

comment on column public.import_batches.source_file_size is
  'Excel byte size; files above 20 MiB are refused and redirected to the consultant.';
