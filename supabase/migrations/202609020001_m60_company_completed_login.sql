create or replace function public.company_has_completed_login(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    (public.is_super_admin() or public.is_company_member(target_company_id))
    and exists (
      select 1
      from public.company_users cu
      join auth.users au on au.id = cu.profile_id
      where cu.company_id = target_company_id
        and cu.status = 'ACTIVE'
        and au.last_sign_in_at is not null
    );
$$;

revoke all on function public.company_has_completed_login(uuid) from public;
grant execute on function public.company_has_completed_login(uuid) to authenticated;

