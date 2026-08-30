alter table public.companies add column if not exists entity_type text not null default 'company';
alter table public.companies add column if not exists legal_document text;
alter table public.companies add column if not exists address_text text;
alter table public.companies add column if not exists operating_days text;
alter table public.companies add column if not exists opens_at time;
alter table public.companies add column if not exists closes_at time;
alter table public.companies add column if not exists personal_profession text;
alter table public.companies add column if not exists personal_financial_goal text;
alter table public.companies add column if not exists personal_monthly_income numeric(14,2);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists preferred_locale text not null default 'pt-BR';
alter table public.profiles add column if not exists timezone_name text not null default 'America/Sao_Paulo';
