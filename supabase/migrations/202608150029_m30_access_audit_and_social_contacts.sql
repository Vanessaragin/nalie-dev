create table if not exists public.access_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  company_id uuid references public.companies(id),
  event_type text not null check (event_type in ('login_success','login_failure','logout','password_reset')),
  ip_address inet,
  user_agent text,
  city text,
  country_code text,
  occurred_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists public_email text,
  add column if not exists professional_whatsapp text,
  add column if not exists linkedin_url text,
  add column if not exists instagram_handle text,
  add column if not exists facebook_url text,
  add column if not exists website_url text,
  add column if not exists professional_address text;
