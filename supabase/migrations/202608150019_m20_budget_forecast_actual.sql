create table if not exists public.planning_versions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  period_start date not null, version_type text not null check (version_type in ('budget', 'forecast', 'actual')),
  scenario text not null default 'realistic', status text not null default 'draft',
  assumptions jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique (company_id, period_start, version_type)
);
create table if not exists public.planning_values (
  id uuid primary key default gen_random_uuid(), version_id uuid not null references public.planning_versions(id) on delete cascade,
  company_id uuid not null references public.companies(id), category text not null, amount numeric(14,2) not null,
  source text not null default 'manual', created_at timestamptz not null default now(), unique(version_id, category)
);
alter table public.planning_versions enable row level security;
alter table public.planning_values enable row level security;
create policy "company reads planning versions" on public.planning_versions for select using (public.has_company_permission(company_id, 'planning.read'));
create policy "company manages planning versions" on public.planning_versions for all using (public.has_company_permission(company_id, 'planning.write')) with check (public.has_company_permission(company_id, 'planning.write'));
create policy "company reads planning values" on public.planning_values for select using (public.has_company_permission(company_id, 'planning.read'));
create policy "company manages planning values" on public.planning_values for all using (public.has_company_permission(company_id, 'planning.write')) with check (public.has_company_permission(company_id, 'planning.write'));
