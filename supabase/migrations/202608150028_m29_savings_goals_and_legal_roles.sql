create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  saved_amount numeric(14,2) not null default 0 check (saved_amount >= 0),
  due_date date not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists professional_role text;

comment on column public.profiles.professional_role is
  'Função profissional, incluindo advogado/paralegal, gestor, financeiro e outras.';
