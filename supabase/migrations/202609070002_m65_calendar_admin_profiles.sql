-- M65: allow master administrators to schedule private events for admin profiles.

alter table public.calendar_events
  alter column company_id drop not null;

create or replace function public.list_calendar_admin_profiles()
returns table(profile_id uuid, display_name text, email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select profile.id, profile.display_name, coalesce(account.email, '')
  from public.profiles profile
  join auth.users account on account.id = profile.id
  where public.is_super_admin()
    and profile.status = 'ACTIVE'
    and exists (
      select 1
      from public.company_users membership
      join public.roles role on role.id = membership.role_id
      where membership.profile_id = profile.id
        and membership.company_id is null
        and membership.status = 'ACTIVE'
        and role.code = 'SUPER_ADMIN'
    )
  order by profile.display_name, account.email;
$$;

revoke all on function public.list_calendar_admin_profiles() from public;
grant execute on function public.list_calendar_admin_profiles() to authenticated;
