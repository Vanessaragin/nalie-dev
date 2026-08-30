insert into public.permissions (code, description)
values ('planning.read', 'Visualizar planejamento'), ('planning.write', 'Gerenciar planejamento')
on conflict (code) do nothing;

create table if not exists public.planning_goals (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  period_start date not null, goal_type text not null, target_value numeric(14,2) not null,
  scenario text not null default 'realistic', created_at timestamptz not null default now()
);
create table if not exists public.planning_actions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  title text not null, owner_name text, due_date date, priority text not null default 'medium',
  is_done boolean not null default false, created_at timestamptz not null default now()
);
alter table public.planning_goals enable row level security;
alter table public.planning_actions enable row level security;
create policy "company reads planning goals" on public.planning_goals for select using (public.has_company_permission(company_id, 'planning.read'));
create policy "company manages planning goals" on public.planning_goals for all using (public.has_company_permission(company_id, 'planning.write')) with check (public.has_company_permission(company_id, 'planning.write'));
create policy "company reads planning actions" on public.planning_actions for select using (public.has_company_permission(company_id, 'planning.read'));
create policy "company manages planning actions" on public.planning_actions for all using (public.has_company_permission(company_id, 'planning.write')) with check (public.has_company_permission(company_id, 'planning.write'));
