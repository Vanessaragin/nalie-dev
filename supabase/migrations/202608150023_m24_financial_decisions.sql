insert into public.permissions(code, description) values
 ('finance.decisions.read','Visualizar decisões financeiras')
on conflict (code) do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('SUPER_ADMIN','COMPANY_ADMIN') and p.code='finance.decisions.read'
on conflict do nothing;

create table if not exists public.financial_decisions (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 account_reference text not null, period_start date not null, opening_balance numeric(14,2), closing_balance numeric(14,2),
 account_analysis jsonb not null default '{}'::jsonb, consumption_analysis jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.financial_decisions enable row level security;
create policy "company manages financial decisions" on public.financial_decisions for all using (public.has_company_permission(company_id,'finance.decisions.read')) with check (public.has_company_permission(company_id,'finance.decisions.read'));
