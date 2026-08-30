create table if not exists public.workforce_minimums (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  role_name text not null,
  minimum_people integer not null default 0 check (minimum_people >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, role_name)
);

alter table public.workforce_minimums enable row level security;

create policy "company members read workforce minimums"
on public.workforce_minimums for select
using (public.has_company_permission(company_id, 'workforce.read'));

create policy "company members manage workforce minimums"
on public.workforce_minimums for all
using (public.has_company_permission(company_id, 'workforce.write'))
with check (public.has_company_permission(company_id, 'workforce.write'));
