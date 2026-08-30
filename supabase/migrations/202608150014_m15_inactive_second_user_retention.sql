-- M15: company administrators may suspend/reactivate the second user, never delete it.
revoke delete on public.company_users from authenticated;

create or replace function public.active_company_user_count(target_company_id uuid)
returns integer language sql stable security definer set search_path=public,pg_temp as $$
  select count(*)::integer from public.company_users
  where company_id=target_company_id and status='ACTIVE'
    and public.is_company_member(target_company_id);
$$;
revoke all on function public.active_company_user_count(uuid) from public;
grant execute on function public.active_company_user_count(uuid) to authenticated;

create or replace function public.set_second_user_active(target_membership_id uuid, make_active boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare target_company uuid; target_role text;
begin
  select cu.company_id,r.code into target_company,target_role
  from public.company_users cu join public.roles r on r.id=cu.role_id
  where cu.id=target_membership_id;
  if target_company is null or target_role<>'COMPANY_USER' or not public.has_company_permission(target_company,'users.roles.write') then
    raise exception 'Only the company administrator may change the second user status';
  end if;
  update public.company_users set status=case when make_active then 'ACTIVE'::public.record_status else 'INACTIVE'::public.record_status end,updated_at=now()
  where id=target_membership_id;
  insert into public.audit_logs(company_id,actor_profile_id,action,resource_type,resource_id,metadata)
  values(target_company,auth.uid(),case when make_active then 'SECOND_USER_REACTIVATED' else 'SECOND_USER_INACTIVATED' end,'company_user',target_membership_id::text,jsonb_build_object('data_retained',true));
end;
$$;
revoke all on function public.set_second_user_active(uuid,boolean) from public;
grant execute on function public.set_second_user_active(uuid,boolean) to authenticated;
