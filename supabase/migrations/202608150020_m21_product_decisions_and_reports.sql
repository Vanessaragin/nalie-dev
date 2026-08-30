insert into public.permissions (code, description)
values ('reports.read', 'Visualizar e gerar relatórios'), ('product_decisions.write', 'Registrar decisões de produtos')
on conflict (code) do nothing;
create table if not exists public.product_decisions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  product_name text not null, answers jsonb not null default '{}'::jsonb, recommendation text not null,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  report_type text not null, period_start date, format text not null, requested_by uuid references auth.users(id),
  status text not null default 'requested', created_at timestamptz not null default now()
);
alter table public.product_decisions enable row level security; alter table public.report_exports enable row level security;
create policy "company manages product decisions" on public.product_decisions for all using (public.has_company_permission(company_id, 'product_decisions.write')) with check (public.has_company_permission(company_id, 'product_decisions.write'));
create policy "company manages report exports" on public.report_exports for all using (public.has_company_permission(company_id, 'reports.read')) with check (public.has_company_permission(company_id, 'reports.read'));
