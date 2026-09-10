-- Delegation never grants SUPER_ADMIN or membership in another company.
begin;
create table public.delegated_client_access (
  company_id uuid not null references public.companies(id) on delete cascade,
  delegate_id uuid not null references public.profiles(id) on delete cascade,
  permissions text[] not null default '{}',
  reset_membership_ids uuid[] not null default '{}',
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (company_id, delegate_id),
  check (permissions <@ array['analysis','crm','activity','calendar','password_reset']::text[])
);
alter table public.delegated_client_access enable row level security;
alter table public.delegated_client_access force row level security;
-- Writes are available only through the validating, audited owner RPC.
revoke all on public.delegated_client_access from authenticated;
grant select on public.delegated_client_access to authenticated;
create policy delegated_access_read on public.delegated_client_access for select to authenticated
using (public.is_super_admin() or (delegate_id = auth.uid() and public.can_access_portal()));

create function public.has_delegated_client_access(target_company uuid, capability text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.can_access_portal() and exists (
    select 1 from public.delegated_client_access
    where company_id = target_company and delegate_id = auth.uid()
      and capability = any(permissions)
  );
$$;

create function public.set_delegated_client_access(
  target_company uuid, target_delegate uuid, capabilities text[], reset_memberships uuid[]
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_super_admin() then raise exception 'Apenas ADM Master pode alterar acessos'; end if;
  if cardinality(capabilities) > 0 and (target_delegate = auth.uid() or not exists (
    select 1 from public.profiles p join public.company_users cu on cu.profile_id = p.id
    where p.id = target_delegate and p.status = 'ACTIVE' and cu.status = 'ACTIVE'
      and cu.access_level <> 'BLOCKED' and cu.company_id is not null
  ) or exists (
    select 1 from public.company_users cu join public.roles r on r.id = cu.role_id
    where cu.profile_id = target_delegate and r.code = 'SUPER_ADMIN'
  )) then raise exception 'Selecione um usuário ativo que não seja ADM Master'; end if;
  if capabilities is null or reset_memberships is null or not capabilities <@ array['analysis','crm','activity','calendar','password_reset']::text[]
    or array_position(capabilities, null) is not null or array_position(reset_memberships, null) is not null
  then raise exception 'Permissões inválidas'; end if;
  if exists (
    select 1 from unnest(reset_memberships) mid where not exists (
      select 1 from public.company_users cu join public.roles r on r.id = cu.role_id
      where cu.id = mid and cu.company_id = target_company and cu.profile_id <> target_delegate
        and r.code <> 'SUPER_ADMIN'
        and not exists (select 1 from public.company_users other_cu join public.roles other_r on other_r.id = other_cu.role_id
          where other_cu.profile_id = cu.profile_id and other_r.code = 'SUPER_ADMIN')
    )
  ) then raise exception 'Usuário de redefinição não autorizado'; end if;
  if cardinality(capabilities) = 0 then
    delete from public.delegated_client_access where company_id = target_company and delegate_id = target_delegate;
  else
    insert into public.delegated_client_access values (
      target_company, target_delegate, capabilities,
      case when 'password_reset' = any(capabilities) then reset_memberships else '{}'::uuid[] end, auth.uid(), now()
    ) on conflict (company_id, delegate_id) do update set
      permissions = excluded.permissions, reset_membership_ids = excluded.reset_membership_ids,
      updated_by = auth.uid(), updated_at = now();
  end if;
  insert into public.audit_logs(company_id, actor_profile_id, action, resource_type, resource_id, metadata)
    values(target_company, auth.uid(), 'DELEGATED_ACCESS_CHANGED', 'profile', target_delegate::text,
      jsonb_build_object('permissions', capabilities, 'reset_memberships', reset_memberships));
end;
$$;

create function public.delegated_access_configuration(target_company uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_super_admin() then raise exception 'Acesso não autorizado'; end if;
  return jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'email', p.public_email) order by p.display_name), '[]')
      from public.profiles p where p.status = 'ACTIVE'
      and exists (select 1 from public.company_users cu where cu.profile_id = p.id and cu.company_id is not null and cu.status = 'ACTIVE' and cu.access_level <> 'BLOCKED')
      and not exists (select 1 from public.company_users cu join public.roles r on r.id = cu.role_id where cu.profile_id = p.id and r.code = 'SUPER_ADMIN')),
    'memberships', (select coalesce(jsonb_agg(jsonb_build_object('id', cu.id, 'profileId', p.id, 'name', p.display_name, 'email', p.public_email)), '[]')
      from public.company_users cu join public.profiles p on p.id = cu.profile_id
      where cu.company_id = target_company
      and not exists (select 1 from public.company_users other_cu join public.roles r on r.id = other_cu.role_id where other_cu.profile_id = p.id and r.code = 'SUPER_ADMIN')),
    'grants', (select coalesce(jsonb_agg(to_jsonb(g)), '[]') from public.delegated_client_access g where company_id = target_company)
  );
end;
$$;

create function public.list_delegated_clients()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.display_name, 'permissions', g.permissions) order by c.display_name), '[]')
  from public.delegated_client_access g join public.companies c on c.id = g.company_id
  where g.delegate_id = auth.uid() and public.can_access_portal();
$$;

create function public.read_delegated_client(target_company uuid, capability text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if not public.has_delegated_client_access(target_company, capability) then raise exception 'Acesso não autorizado'; end if;
  case capability
    when 'analysis' then
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', display_name, 'url', source_url, 'type', link_type)), '[]') into result
      from public.company_analysis_links where company_id = target_company and status = 'PUBLISHED';
    when 'crm' then
      select coalesce(jsonb_agg(jsonb_build_object('name', contact_name, 'email', contact_email, 'phone', contact_phone,
        'whatsapp', whatsapp, 'contactStatus', contact_status, 'clientStatus', client_status)), '[]') into result
      from public.client_crm where company_id = target_company;
    when 'activity' then
      select coalesce(jsonb_agg(to_jsonb(a)), '[]') into result from (
        select id, kind, title, occurred_at from public.client_activities where company_id = target_company order by occurred_at desc limit 200
      ) a;
    when 'calendar' then
      select coalesce(jsonb_agg(to_jsonb(e)), '[]') into result from (
        select id, title, theme, starts_at, ends_at from public.calendar_events
        where company_id = target_company and scope = 'COMPANY' order by starts_at desc limit 200
      ) e;
    when 'password_reset' then
      select coalesce(jsonb_agg(jsonb_build_object('id', cu.id, 'name', p.display_name, 'email', p.public_email)), '[]') into result
      from public.company_users cu join public.profiles p on p.id = cu.profile_id
      join public.delegated_client_access g on g.company_id = cu.company_id and g.delegate_id = auth.uid()
      where cu.company_id = target_company and cu.id = any(g.reset_membership_ids) and cu.profile_id <> auth.uid()
        and not exists (select 1 from public.company_users other_cu join public.roles r on r.id = other_cu.role_id where other_cu.profile_id = p.id and r.code = 'SUPER_ADMIN');
    else raise exception 'Permissão inválida';
  end case;
  insert into public.audit_logs(company_id, actor_profile_id, action, resource_type, resource_id, metadata)
    values(target_company, auth.uid(), 'DELEGATED_CLIENT_VIEW', 'company', target_company::text, jsonb_build_object('capability', capability));
  insert into public.client_activities(company_id, profile_id, kind, title, metadata)
    values(target_company, auth.uid(), 'USER_CHANGE', 'Consulta autorizada: ' || capability, jsonb_build_object('action', 'DELEGATED_CLIENT_VIEW', 'capability', capability));
  return result;
end;
$$;

create function public.can_reset_delegated_user(target_membership_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_super_admin() or exists (
    select 1 from public.company_users cu
    join public.delegated_client_access g on g.company_id = cu.company_id and g.delegate_id = auth.uid()
    where cu.id = target_membership_id and cu.profile_id <> auth.uid()
      and cu.id = any(g.reset_membership_ids) and public.has_delegated_client_access(cu.company_id, 'password_reset')
      and not exists (select 1 from public.company_users other_cu join public.roles r on r.id = other_cu.role_id
        where other_cu.profile_id = cu.profile_id and r.code = 'SUPER_ADMIN')
  );
$$;

revoke all on function public.has_delegated_client_access(uuid,text), public.set_delegated_client_access(uuid,uuid,text[],uuid[]),
  public.delegated_access_configuration(uuid), public.list_delegated_clients(), public.read_delegated_client(uuid,text),
  public.can_reset_delegated_user(uuid) from public;
grant execute on function public.has_delegated_client_access(uuid,text), public.set_delegated_client_access(uuid,uuid,text[],uuid[]),
  public.delegated_access_configuration(uuid), public.list_delegated_clients(), public.read_delegated_client(uuid,text),
  public.can_reset_delegated_user(uuid) to authenticated;
create or replace function public.request_company_user_password_reset(
  target_membership_id uuid,
  requested_channel text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_profile uuid;
  target_company uuid;
  request_id uuid;
  normalized_channel text := upper(requested_channel);
begin
  if not public.can_reset_delegated_user(target_membership_id) then
    raise exception 'Only the platform owner may request password resets';
  end if;
  if normalized_channel not in ('EMAIL', 'WHATSAPP', 'BOTH') then
    raise exception 'Invalid delivery channel';
  end if;

  select profile_id, company_id into target_profile, target_company
  from public.company_users
  where id = target_membership_id and company_id is not null;

  if target_profile is null then
    raise exception 'Company user not found';
  end if;

  insert into public.password_reset_requests (
    requested_by,
    target_profile_id,
    delivery_channel,
    expires_at,
    must_change_on_next_login
  ) values (
    auth.uid(),
    target_profile,
    normalized_channel,
    now() + interval '48 hours',
    true
  ) returning id into request_id;

  update public.profiles
  set must_change_password = true,
      updated_at = now()
  where id = target_profile;

  insert into public.audit_logs (
    company_id, actor_profile_id, action, resource_type, resource_id, metadata
  ) values (
    target_company,
    auth.uid(),
    'PASSWORD_RESET_REQUESTED',
    'profile',
    target_profile::text,
    jsonb_build_object('request_id', request_id, 'channel', normalized_channel, 'expires_in_hours', 48)
  );

  insert into public.client_activities(company_id, profile_id, kind, title, metadata)
    values(target_company, auth.uid(), 'USER_CHANGE', 'Redefinição de senha solicitada', jsonb_build_object('target_profile_id', target_profile, 'request_id', request_id));
  return request_id;
end;
$$;


commit;
