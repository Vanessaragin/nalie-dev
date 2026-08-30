alter table public.workforce_minimums add column if not exists production_per_hour numeric(10,2) not null default 1 check (production_per_hour >= 0);
alter table public.workforce_minimums add column if not exists production_unit text not null default 'activities';
alter table public.companies add column if not exists operating_hours_per_day numeric(5,2) not null default 8;
alter table public.companies add column if not exists operating_days_per_month integer not null default 26;
