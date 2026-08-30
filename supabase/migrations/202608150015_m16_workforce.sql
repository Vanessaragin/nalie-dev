insert into public.permissions (code, description)
values ('workforce.read', 'Visualizar mão de obra'), ('workforce.write', 'Gerenciar mão de obra')
on conflict (code) do nothing;

create table if not exists public.workforce_people (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  name text not null, role_name text not null, hourly_cost numeric(12,2) not null default 0,
  hired_on date, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.workforce_entries (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  person_id uuid not null references public.workforce_people(id), entry_date date not null,
  hours numeric(8,2) not null check (hours >= 0), total_cost numeric(12,2) not null check (total_cost >= 0),
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.workforce_people enable row level security;
alter table public.workforce_entries enable row level security;
create policy "company members read workforce" on public.workforce_people for select using (public.has_company_permission(company_id, 'workforce.read'));
create policy "company members manage workforce" on public.workforce_people for all using (public.has_company_permission(company_id, 'workforce.write')) with check (public.has_company_permission(company_id, 'workforce.write'));
create policy "company members read workforce entries" on public.workforce_entries for select using (public.has_company_permission(company_id, 'workforce.read'));
create policy "company members manage workforce entries" on public.workforce_entries for all using (public.has_company_permission(company_id, 'workforce.write')) with check (public.has_company_permission(company_id, 'workforce.write'));
