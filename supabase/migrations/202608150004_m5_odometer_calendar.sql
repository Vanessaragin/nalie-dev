-- M5: dated odometer readings and calendar reminders for monthly mileage tracking.
create table public.odometer_readings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  reading_date date not null,
  odometer_km numeric(12,1) not null check (odometer_km >= 0),
  created_at timestamptz not null default now(),
  unique (vehicle_id, reading_date)
);

alter table public.odometer_readings enable row level security;
alter table public.odometer_readings force row level security;
grant select, insert, update on public.odometer_readings to authenticated;

create policy odometer_readings_access on public.odometer_readings
for select to authenticated using (public.is_company_member(company_id));

create policy odometer_readings_write on public.odometer_readings
for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id) and recorded_by = auth.uid());
