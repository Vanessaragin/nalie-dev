-- M32: enforce per-user portal access without deleting memberships or history.
create type public.portal_access_level as enum ('COMPLETE', 'LIMITED', 'BLOCKED');

alter table public.company_users
  add column access_level public.portal_access_level not null default 'LIMITED';

update public.company_users cu
set access_level = case
  when r.code in ('SUPER_ADMIN', 'COMPANY_ADMIN') then 'COMPLETE'::public.portal_access_level
  else 'LIMITED'::public.portal_access_level
end
from public.roles r
where r.id = cu.role_id;

create or replace function public.can_access_portal()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.company_users cu on cu.profile_id = p.id
    join public.roles r on r.id = cu.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions permission on permission.id = rp.permission_id
    where p.id = auth.uid()
      and p.status = 'ACTIVE'
      and cu.status = 'ACTIVE'
      and cu.access_level <> 'BLOCKED'
      and permission.code = 'portal.access'
  );
$$;

create or replace function public.set_company_user_access_level(
  target_membership_id uuid,
  requested_level public.portal_access_level
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_company_id uuid;
  target_profile_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform owner may change portal access';
  end if;

  select company_id, profile_id
    into target_company_id, target_profile_id
  from public.company_users
  where id = target_membership_id
    and company_id is not null;

  if target_profile_id is null then
    raise exception 'Company membership not found';
  end if;

  update public.company_users
  set access_level = requested_level,
      updated_at = now()
  where id = target_membership_id;

  insert into public.audit_logs (
    company_id,
    actor_profile_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    target_company_id,
    auth.uid(),
    'USER_ACCESS_LEVEL_CHANGED',
    'company_user',
    target_membership_id::text,
    jsonb_build_object(
      'profile_id', target_profile_id,
      'access_level', requested_level,
      'history_retained', true
    )
  );
end;
$$;

revoke all on function public.can_access_portal() from public;
revoke all on function public.set_company_user_access_level(uuid, public.portal_access_level) from public;
grant execute on function public.can_access_portal() to authenticated;
grant execute on function public.set_company_user_access_level(uuid, public.portal_access_level) to authenticated;

create or replace function public.admin_list_company_users()
returns table (
  membership_id uuid,
  profile_name text,
  company_name text,
  role_name text,
  membership_status public.record_status,
  portal_access public.portal_access_level,
  accepted_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform owner may list all company users';
  end if;

  return query
  select
    cu.id,
    p.display_name,
    c.display_name,
    r.code,
    cu.status,
    cu.access_level,
    cu.accepted_at,
    cu.updated_at
  from public.company_users cu
  join public.profiles p on p.id = cu.profile_id
  join public.companies c on c.id = cu.company_id
  join public.roles r on r.id = cu.role_id
  where cu.company_id is not null
  order by c.display_name, p.display_name;
end;
$$;

revoke all on function public.admin_list_company_users() from public;
grant execute on function public.admin_list_company_users() to authenticated;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_super_admin() or exists (
    select 1 from public.company_users cu join public.roles r on r.id = cu.role_id
    join public.profiles p on p.id = cu.profile_id
    where cu.profile_id = auth.uid() and cu.company_id = target_company_id
      and p.status = 'ACTIVE' and cu.status = 'ACTIVE'
      and cu.access_level <> 'BLOCKED' and r.scope = 'COMPANY'
  );
$$;

create or replace function public.has_company_permission(target_company_id uuid, permission_code text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_super_admin() or exists (
    select 1 from public.company_users cu
    join public.profiles profile on profile.id = cu.profile_id
    join public.roles r on r.id = cu.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where cu.profile_id = auth.uid() and cu.company_id = target_company_id
      and profile.status = 'ACTIVE' and cu.status = 'ACTIVE'
      and cu.access_level <> 'BLOCKED'
      and r.scope = 'COMPANY' and p.code = permission_code
  );
$$;
