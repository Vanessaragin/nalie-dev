-- M72: correções da auditoria de segurança de 2026-11-02.
begin;

-- Estas tabelas não são usadas pelo portal; apenas a service role deve acessá-las.
alter table public.weather_datasets enable row level security;
alter table public.weather_datasets force row level security;
alter table public.daily_weather enable row level security;
alter table public.daily_weather force row level security;
alter table public.holiday_datasets enable row level security;
alter table public.holiday_datasets force row level security;
alter table public.local_holidays enable row level security;
alter table public.local_holidays force row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_goals force row level security;
alter table public.access_audit_logs enable row level security;
alter table public.access_audit_logs force row level security;
revoke all on public.weather_datasets, public.daily_weather, public.holiday_datasets,
  public.local_holidays, public.savings_goals, public.access_audit_logs
  from anon, authenticated;

-- Vínculos e níveis de acesso mudam somente pelas funções auditadas e pela service role.
revoke insert, update, delete on public.company_users from anon, authenticated;

-- O usuário edita apenas os dados pessoais; status e controles de senha ficam protegidos.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (
  display_name, full_name, phone, job_title, preferred_locale, timezone_name,
  professional_whatsapp, public_email, instagram_handle, facebook_url, website_url,
  professional_address, updated_at
) on public.profiles to authenticated;

-- A proteção do master usa o e-mail de autenticação, que o usuário não altera em profiles.
create or replace function public.is_protected_master(target_profile uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.company_users cu join public.roles r on r.id=cu.role_id where cu.profile_id=target_profile and r.code='SUPER_ADMIN')
    or exists(select 1 from auth.users u where u.id=target_profile and lower(u.email) in ('naliedados@gmail.com','reginaragin@gmail.com'));
$$;
revoke all on function public.is_protected_master(uuid) from public;

commit;
