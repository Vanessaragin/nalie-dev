alter table public.companies
  add column if not exists has_physical_location boolean not null default false,
  add column if not exists address_latitude numeric(10, 7),
  add column if not exists address_longitude numeric(10, 7),
  add column if not exists operating_schedule jsonb not null default '{}'::jsonb,
  add column if not exists open_holidays jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_address_latitude_range') then
    alter table public.companies add constraint companies_address_latitude_range
      check (address_latitude is null or address_latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_address_longitude_range') then
    alter table public.companies add constraint companies_address_longitude_range
      check (address_longitude is null or address_longitude between -180 and 180);
  end if;
end
$$;

comment on column public.companies.operating_schedule is
  'Horários individuais por dia da semana, armazenados como JSON.';
comment on column public.companies.open_holidays is
  'Feriados selecionados em que a empresa declara funcionamento.';
