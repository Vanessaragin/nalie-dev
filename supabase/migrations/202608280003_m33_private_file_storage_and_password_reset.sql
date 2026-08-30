-- M33: private storage only. Uploaded files are preserved without parsing or treatment.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-files',
  'company-files',
  false,
  52428800,
  array[
    'application/pdf',
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy company_files_read on storage.objects for select to authenticated
using (
  bucket_id = 'company-files'
  and public.has_company_permission((storage.foldername(name))[1]::uuid, 'documents.read')
);

create policy company_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-files'
  and public.has_company_permission((storage.foldername(name))[1]::uuid, 'documents.write')
);

create policy company_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'company-files'
  and public.is_super_admin()
);

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cu.company_id
  from public.company_users cu
  where cu.profile_id = auth.uid()
    and cu.company_id is not null
    and cu.status = 'ACTIVE'
    and cu.access_level <> 'BLOCKED'
  order by cu.accepted_at nulls last
  limit 1;
$$;

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
  if not public.is_super_admin() then
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

  return request_id;
end;
$$;

revoke all on function public.current_company_id() from public;
revoke all on function public.request_company_user_password_reset(uuid, text) from public;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.request_company_user_password_reset(uuid, text) to authenticated;

