create table if not exists public.holiday_datasets (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users(id),
  country_code text not null,
  city text not null,
  reference_year integer not null check (reference_year between 2020 and 2100),
  file_name text not null,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'error')),
  created_at timestamptz not null default now(),
  unique (country_code, city, reference_year, file_name)
);

create table if not exists public.local_holidays (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.holiday_datasets(id) on delete cascade,
  holiday_date date not null,
  holiday_name text not null,
  holiday_scope text not null default 'city'
    check (holiday_scope in ('national', 'state', 'city')),
  unique (dataset_id, holiday_date, holiday_name)
);

alter table public.companies
  add column if not exists holiday_country_code text,
  add column if not exists holiday_city text;
