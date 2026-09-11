-- Configure access from the simple administrator's profile, per target user.
begin;
create table public.simple_admin_user_access (
  delegate_id uuid not null references public.profiles(id) on delete cascade,
  target_membership_id uuid not null references public.company_users(id) on delete cascade,
  permissions text[] not null check (permissions <@ array['analysis','crm','activity','calendar','password_reset']::text[]),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(delegate_id, target_membership_id)
);
alter table public.simple_admin_user_access enable row level security;
alter table public.simple_admin_user_access force row level security;
revoke all on public.simple_admin_user_access from authenticated;
grant select on public.simple_admin_user_access to authenticated;
create policy simple_admin_access_read on public.simple_admin_user_access for select to authenticated
using (public.is_super_admin() or (delegate_id = auth.uid() and public.can_access_portal()));

create function public.is_protected_master(target_profile uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.company_users cu join public.roles r on r.id=cu.role_id where cu.profile_id=target_profile and r.code='SUPER_ADMIN')
    or exists(select 1 from public.profiles p where p.id=target_profile and lower(p.public_email) in ('naliedados@gmail.com','reginaragin@gmail.com'));
$$;

-- Preserve prior company-scoped authorizations, but keep reset targets explicit.
insert into public.simple_admin_user_access(delegate_id,target_membership_id,permissions,updated_by)
select g.delegate_id,cu.id,
  case when cu.id=any(g.reset_membership_ids) then g.permissions else array_remove(g.permissions,'password_reset') end,
  g.updated_by
from public.delegated_client_access g join public.company_users cu on cu.company_id=g.company_id
where cu.profile_id<>g.delegate_id and not public.is_protected_master(cu.profile_id) and not public.is_protected_master(g.delegate_id)
  and cardinality(case when cu.id=any(g.reset_membership_ids) then g.permissions else array_remove(g.permissions,'password_reset') end)>0;

create function public.simple_admin_configuration(target_delegate uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_super_admin() then raise exception 'Somente Super Master pode configurar o ADM simples'; end if;
  return jsonb_build_object(
    'users',(select coalesce(jsonb_agg(jsonb_build_object('id',cu.id,'profileId',p.id,'name',p.display_name,'email',p.public_email,
      'company',coalesce(c.display_name,'Plataforma'),'master',public.is_protected_master(p.id)) order by p.display_name,p.public_email),'[]')
      from public.company_users cu join public.profiles p on p.id=cu.profile_id left join public.companies c on c.id=cu.company_id),
    'grants',(select coalesce(jsonb_agg(jsonb_build_object('membershipId',g.target_membership_id,'permissions',g.permissions)),'[]')
      from public.simple_admin_user_access g where g.delegate_id=target_delegate)
  );
end;
$$;

create function public.set_simple_admin_access(target_delegate uuid,selections jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; target_id uuid; capabilities text[];
begin
  if not public.is_super_admin() then raise exception 'Somente Super Master pode alterar acessos'; end if;
  if target_delegate=auth.uid() or public.is_protected_master(target_delegate) then raise exception 'Super Master não é ADM simples'; end if;
  if selections is null or jsonb_typeof(selections)<>'array' then raise exception 'Seleção inválida'; end if;
  -- Serialize complete replacements for one delegate and validate before deleting.
  perform 1 from public.profiles where id=target_delegate for update;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if jsonb_array_length(selections)>0 and not exists(select 1 from public.profiles p join public.company_users cu on cu.profile_id=p.id
    where p.id=target_delegate and p.status='ACTIVE' and cu.status='ACTIVE' and cu.access_level<>'BLOCKED' and cu.company_id is not null)
  then raise exception 'ADM simples precisa de um login ativo'; end if;
  for item in select value from jsonb_array_elements(selections) loop
    target_id := (item->>'membershipId')::uuid;
    if jsonb_typeof(item->'permissions') is distinct from 'array' then raise exception 'Permissões inválidas'; end if;
    select array_agg(value) into capabilities from jsonb_array_elements_text(item->'permissions');
    if capabilities is null or array_position(capabilities,null) is not null or not capabilities <@ array['analysis','crm','activity','calendar','password_reset']::text[]
    then raise exception 'Marque ao menos uma permissão válida'; end if;
    if not exists(select 1 from public.company_users cu where cu.id=target_id and cu.company_id is not null
      and cu.profile_id<>target_delegate and not public.is_protected_master(cu.profile_id))
    then raise exception 'Próprio usuário e Super Master são protegidos'; end if;
  end loop;
  delete from public.simple_admin_user_access where delegate_id=target_delegate;
  for item in select value from jsonb_array_elements(selections) loop
    select array_agg(value) into capabilities from jsonb_array_elements_text(item->'permissions');
    insert into public.simple_admin_user_access values(target_delegate,(item->>'membershipId')::uuid,capabilities,auth.uid(),now());
  end loop;
  insert into public.audit_logs(actor_profile_id,action,resource_type,resource_id,metadata)
    values(auth.uid(),'SIMPLE_ADMIN_ACCESS_CHANGED','profile',target_delegate::text,jsonb_build_object('selections',selections));
end;
$$;

create or replace function public.list_delegated_clients()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',cu.id,'name',p.display_name || ' · ' || coalesce(p.public_email,c.display_name),
    'permissions',g.permissions) order by p.display_name),'[]')
  from public.simple_admin_user_access g join public.company_users cu on cu.id=g.target_membership_id
  join public.profiles p on p.id=cu.profile_id join public.companies c on c.id=cu.company_id
  where g.delegate_id=auth.uid() and public.can_access_portal() and cu.profile_id<>auth.uid() and not public.is_protected_master(cu.profile_id);
$$;

create function public.read_simple_admin_user(target_membership uuid,capability text)
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
        where company_id=target_company and assigned_profile_id=target_profile and scope='COMPANY' order by starts_at desc limit 200) e;
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

create or replace function public.can_reset_delegated_user(target_membership_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.is_super_admin() or exists(select 1 from public.simple_admin_user_access g join public.company_users cu on cu.id=g.target_membership_id
    where g.delegate_id=auth.uid() and cu.id=$1 and 'password_reset'=any(g.permissions)
      and public.can_access_portal() and cu.profile_id<>auth.uid() and not public.is_protected_master(cu.profile_id));
$$;
-- Remove the superseded company-wide read path; it must not bypass the selected users.
revoke execute on function public.read_delegated_client(uuid,text),public.delegated_access_configuration(uuid),
  public.set_delegated_client_access(uuid,uuid,text[],uuid[]) from authenticated;
revoke all on function public.is_protected_master(uuid),public.simple_admin_configuration(uuid),
  public.set_simple_admin_access(uuid,jsonb),public.read_simple_admin_user(uuid,text) from public;
grant execute on function public.simple_admin_configuration(uuid),public.set_simple_admin_access(uuid,jsonb),public.read_simple_admin_user(uuid,text) to authenticated;
commit;
