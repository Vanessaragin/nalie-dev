create table if not exists public.weather_datasets (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users(id),
  source_name text not null,
  reference_month date not null,
  file_name text not null,
  city_count integer not null default 0,
  status text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_weather (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.weather_datasets(id) on delete cascade,
  city text not null,
  region text,
  country_code text not null,
  weather_date date not null,
  condition_code text not null,
  temperature_min numeric,
  temperature_max numeric,
  precipitation_mm numeric,
  unique (dataset_id, city, region, country_code, weather_date)
);
