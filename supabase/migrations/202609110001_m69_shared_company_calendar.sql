-- Include shared company appointments without exposing personal events.
begin;
create or replace function public.read_simple_admin_user(target_membership uuid,capability text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; target_company uuid; target_profile uuid;
begin
  select cu.company_id,cu.profile_id into target_company,target_profile from public.company_users cu
  join public.simple_admin_user_access g on g.target_membership_id=cu.id and g.delegate_id=auth.uid()
  where cu.id=target_membership and capability=any(g.permissions) and public.can_access_portal()
    and cu.profile_id<>auth.uid() and not public.is_protected_master(cu.profile_id);
  if target_profile is null then raise exception 'Usuário ou função não autorizado'; end if;
  case capability
    when 'analysis' then
      select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',display_name,'url',source_url,'type',link_type)),'[]') into result
      from public.company_analysis_links where company_id=target_company and status='PUBLISHED';
    when 'crm' then
      select coalesce(jsonb_agg(jsonb_build_object('name',contact_name,'email',contact_email,'phone',contact_phone,'whatsapp',whatsapp,
        'contactStatus',contact_status,'clientStatus',client_status)),'[]') into result from public.client_crm where company_id=target_company;
    when 'activity' then
      select coalesce(jsonb_agg(to_jsonb(a)),'[]') into result from (select id,kind,title,occurred_at from public.client_activities
        where company_id=target_company and profile_id=target_profile order by occurred_at desc limit 200) a;
    when 'calendar' then
      select coalesce(jsonb_agg(to_jsonb(e)),'[]') into result from (select id,title,theme,starts_at,ends_at from public.calendar_events
        where company_id=target_company and (assigned_profile_id=target_profile or assigned_profile_id is null) and scope='COMPANY' order by starts_at desc limit 200) e;
    when 'password_reset' then
      select jsonb_build_array(jsonb_build_object('id',target_membership,'name',display_name,'email',public_email)) into result from public.profiles where id=target_profile;
    else raise exception 'Permissão inválida';
  end case;
  insert into public.audit_logs(company_id,actor_profile_id,action,resource_type,resource_id,metadata)
    values(target_company,auth.uid(),'SIMPLE_ADMIN_USER_VIEW','profile',target_profile::text,jsonb_build_object('capability',capability));
  insert into public.client_activities(company_id,profile_id,kind,title,metadata)
    values(target_company,auth.uid(),'USER_CHANGE','Consulta autorizada: ' || capability,jsonb_build_object('target_profile_id',target_profile,'capability',capability));
  return result;
end;
$$;

commit;
