-- M4: separate business/personal accounts and company fuel calculations.
create type public.account_scope as enum ('BUSINESS', 'PERSONAL');

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  scope public.account_scope not null default 'BUSINESS',
  kind text not null check (kind in ('CHECKING','SAVINGS','CREDIT_CARD','PIX','ACH','OTHER')),
  display_name text not null,
  institution_name text not null,
  masked_identifier text not null check (masked_identifier ~ '^\*\*\*[0-9]{2}$'),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  display_name text not null,
  vehicle_type text not null,
  fuel_type text not null,
  average_km_per_liter numeric(8,2) not null check (average_km_per_liter > 0),
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table public.fuel_calculations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  description text,
  distance_km numeric(10,2) not null check (distance_km >= 0),
  fuel_price numeric(10,2) not null check (fuel_price >= 0),
  liters_used numeric(10,2) not null check (liters_used >= 0),
  total_cost numeric(12,2) not null check (total_cost >= 0),
  created_at timestamptz not null default now()
);

alter table public.financial_accounts enable row level security;
alter table public.vehicles enable row level security;
alter table public.fuel_calculations enable row level security;
alter table public.financial_accounts force row level security;
alter table public.vehicles force row level security;
alter table public.fuel_calculations force row level security;
grant select, insert, update on public.financial_accounts, public.vehicles, public.fuel_calculations to authenticated;

create policy financial_accounts_access on public.financial_accounts for select to authenticated
using (public.is_company_member(company_id) and (scope = 'BUSINESS' or owner_profile_id = auth.uid() or public.is_super_admin()));
create policy financial_accounts_write on public.financial_accounts for all to authenticated
using (public.has_company_permission(company_id, 'company.settings.write'))
with check (public.has_company_permission(company_id, 'company.settings.write'));
create policy vehicles_access on public.vehicles for select to authenticated using (public.is_company_member(company_id));
create policy vehicles_write on public.vehicles for all to authenticated
using (public.has_company_permission(company_id, 'company.settings.write'))
with check (public.has_company_permission(company_id, 'company.settings.write'));
create policy fuel_calculations_access on public.fuel_calculations for select to authenticated using (public.is_company_member(company_id));
create policy fuel_calculations_write on public.fuel_calculations for insert to authenticated
with check (public.is_company_member(company_id) and created_by = auth.uid());
