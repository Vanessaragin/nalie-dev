-- M12: business-area menu personalization and statement-only marketplace imports.
alter type public.company_segment add value if not exists 'RETAIL';
alter type public.company_segment add value if not exists 'SERVICES';
alter type public.company_segment add value if not exists 'TRANSPORT';
alter type public.company_segment add value if not exists 'HEALTH';
alter type public.company_segment add value if not exists 'BEAUTY';
alter type public.company_segment add value if not exists 'PERSONAL';

alter table public.import_batches
  add column source_type text not null default 'BANK'
    check (source_type in ('BANK','MARKETPLACE','POS','OTHER')),
  add column marketplace text
    check (marketplace is null or marketplace in ('IFOOD','99FOOD','KEETA','UBER_EATS','DOORDASH'));

create or replace function public.ensure_company_default_modules()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.company_settings(company_id, enabled_modules)
  values (new.id, jsonb_build_object(
    'finance', true,
    'calendar', true,
    'fuel', true,
    'segment', new.segment::text
  ))
  on conflict (company_id) do update
  set enabled_modules = public.company_settings.enabled_modules
    || jsonb_build_object('fuel', true, 'segment', new.segment::text),
      updated_at = now();
  return new;
end;
$$;

create trigger ensure_company_default_modules
after insert or update of segment on public.companies
for each row execute function public.ensure_company_default_modules();

update public.company_settings
set enabled_modules = enabled_modules || jsonb_build_object('fuel', true),
    updated_at = now();
