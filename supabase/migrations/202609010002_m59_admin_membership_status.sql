-- M59: persist activation and suspension performed by the platform owner.
create or replace function public.set_company_user_active(
  target_membership_id uuid,
  make_active boolean
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
    raise exception 'Only the platform owner may change user status';
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
  set status = case
        when make_active then 'ACTIVE'::public.record_status
        else 'INACTIVE'::public.record_status
      end,
      accepted_at = case
        when make_active then coalesce(accepted_at, now())
        else accepted_at
      end,
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
    case when make_active then 'COMPANY_USER_ACTIVATED' else 'COMPANY_USER_INACTIVATED' end,
    'company_user',
    target_membership_id::text,
    jsonb_build_object(
      'profile_id', target_profile_id,
      'status', case when make_active then 'ACTIVE' else 'INACTIVE' end,
      'history_retained', true
    )
  );
end;
$$;

revoke all on function public.set_company_user_active(uuid, boolean) from public;
grant execute on function public.set_company_user_active(uuid, boolean) to authenticated;
