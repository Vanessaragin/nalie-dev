-- M1: identity, permission matrix, tenant isolation and private company assets.
create extension if not exists pgcrypto;

create type public.company_segment as enum ('FOOD', 'CONSTRUCTION', 'CLEANING');
create type public.supported_locale as enum ('pt-BR', 'en-US');
create type public.record_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED', 'INACTIVE');
create type public.role_scope as enum ('PLATFORM', 'COMPANY');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (length(trim(legal_name)) between 2 and 200),
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  logo_path text,
  primary_color text not null default '#24243C' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#8876DF' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  segment public.company_segment not null,
  subsegment text,
  country char(2) not null check (country ~ '^[A-Z]{2}$'),
  region text,
  city text,
  base_currency char(3) not null check (base_currency ~ '^[A-Z]{3}$'),
  default_locale public.supported_locale not null default 'pt-BR',
  timezone text not null,
  headcount_range text,
  revenue_range text,
  branch_count integer not null default 1 check (branch_count > 0),
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled_modules jsonb not null default '{}'::jsonb check (jsonb_typeof(enabled_modules) = 'object'),
  regional_options jsonb not null default '{}'::jsonb check (jsonb_typeof(regional_options) = 'object'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  preferred_locale public.supported_locale not null default 'pt-BR',
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]+$'),
  scope public.role_scope not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.]+$'),
  description text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status public.record_status not null default 'INVITED',
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index company_users_company_profile_unique
  on public.company_users(company_id, profile_id) where company_id is not null;
create unique index company_users_platform_profile_unique
  on public.company_users(profile_id) where company_id is null;
create index company_users_profile_status_idx on public.company_users(profile_id, status);
create index company_users_company_status_idx on public.company_users(company_id, status);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null check (length(action) between 3 and 100),
  resource_type text not null check (length(resource_type) between 2 and 80),
  resource_id text,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_logs_company_created_idx on public.audit_logs(company_id, created_at desc);

insert into public.roles (code, scope, description) values
  ('SUPER_ADMIN', 'PLATFORM', 'Consultant platform administrator'),
  ('COMPANY_ADMIN', 'COMPANY', 'Company administrator'),
  ('COMPANY_USER', 'COMPANY', 'Company member with limited permissions');

insert into public.permissions (code, description) values
  ('admin.console.access', 'Access platform administration'),
  ('audit.read', 'Read company audit history'),
  ('company.profile.read', 'Read company profile'),
  ('company.settings.read', 'Read company settings'),
  ('company.settings.write', 'Update company settings'),
  ('portal.access', 'Access company portal'),
  ('users.invite', 'Invite company users'),
  ('users.read', 'Read company memberships'),
  ('users.roles.write', 'Change company roles');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'SUPER_ADMIN';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in (
  'audit.read', 'company.profile.read', 'company.settings.read', 'company.settings.write',
  'portal.access', 'users.invite', 'users.read', 'users.roles.write'
) where r.code = 'COMPANY_ADMIN';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in (
  'company.profile.read', 'company.settings.read', 'portal.access'
) where r.code = 'COMPANY_USER';

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.company_users cu join public.roles r on r.id = cu.role_id
    where cu.profile_id = auth.uid() and cu.company_id is null
      and cu.status = 'ACTIVE' and r.code = 'SUPER_ADMIN' and r.scope = 'PLATFORM'
  );
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_super_admin() or exists (
    select 1 from public.company_users cu join public.roles r on r.id = cu.role_id
    where cu.profile_id = auth.uid() and cu.company_id = target_company_id
      and cu.status = 'ACTIVE' and r.scope = 'COMPANY'
  );
$$;

create or replace function public.has_company_permission(target_company_id uuid, permission_code text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_super_admin() or exists (
    select 1 from public.company_users cu
    join public.roles r on r.id = cu.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where cu.profile_id = auth.uid() and cu.company_id = target_company_id
      and cu.status = 'ACTIVE' and r.scope = 'COMPANY' and p.code = permission_code
  );
$$;

revoke all on function public.is_super_admin() from public;
revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.has_company_permission(uuid, text) from public;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.has_company_permission(uuid, text) to authenticated;

create or replace function public.validate_company_user_scope()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare selected_scope public.role_scope;
begin
  select scope into selected_scope from public.roles where id = new.role_id;
  if (selected_scope = 'PLATFORM' and new.company_id is not null)
    or (selected_scope = 'COMPANY' and new.company_id is null) then
    raise exception 'Role scope does not match membership scope';
  end if;
  return new;
end;
$$;
create trigger company_users_scope_guard before insert or update on public.company_users
for each row execute function public.validate_company_user_scope();

alter table public.companies enable row level security;
alter table public.company_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.company_users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.companies force row level security;
alter table public.company_settings force row level security;
alter table public.profiles force row level security;
alter table public.roles force row level security;
alter table public.permissions force row level security;
alter table public.role_permissions force row level security;
alter table public.company_users force row level security;
alter table public.audit_logs force row level security;

grant select on public.companies, public.company_settings, public.profiles,
  public.roles, public.permissions, public.role_permissions, public.company_users,
  public.audit_logs to authenticated;
grant update on public.companies, public.company_settings, public.profiles,
  public.company_users to authenticated;
grant insert on public.companies, public.company_users to authenticated;

create policy companies_select on public.companies for select to authenticated
using (public.is_company_member(id));
create policy companies_insert on public.companies for insert to authenticated
with check (public.is_super_admin());
create policy companies_update on public.companies for update to authenticated
using (public.has_company_permission(id, 'company.settings.write'))
with check (public.has_company_permission(id, 'company.settings.write'));

create policy company_settings_select on public.company_settings for select to authenticated
using (public.has_company_permission(company_id, 'company.settings.read'));
create policy company_settings_update on public.company_settings for update to authenticated
using (public.has_company_permission(company_id, 'company.settings.write'))
with check (public.has_company_permission(company_id, 'company.settings.write'));

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_super_admin() or exists (
  select 1 from public.company_users mine join public.company_users theirs
    on mine.company_id = theirs.company_id
  where mine.profile_id = auth.uid() and mine.status = 'ACTIVE'
    and theirs.profile_id = profiles.id and theirs.status = 'ACTIVE'
));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy roles_read on public.roles for select to authenticated using (true);
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);

create policy company_users_select on public.company_users for select to authenticated
using (profile_id = auth.uid() or public.is_super_admin() or (
  company_id is not null and public.has_company_permission(company_id, 'users.read')
));
create policy company_users_insert on public.company_users for insert to authenticated
with check (company_id is not null and public.has_company_permission(company_id, 'users.invite'));
create policy company_users_update on public.company_users for update to authenticated
using (company_id is not null and public.has_company_permission(company_id, 'users.roles.write'))
with check (company_id is not null and public.has_company_permission(company_id, 'users.roles.write'));

create policy audit_logs_select on public.audit_logs for select to authenticated
using (company_id is not null and public.has_company_permission(company_id, 'audit.read'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-assets', 'company-assets', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy company_assets_read on storage.objects for select to authenticated
using (bucket_id = 'company-assets' and public.is_company_member((storage.foldername(name))[1]::uuid));
create policy company_assets_write on storage.objects for insert to authenticated
with check (bucket_id = 'company-assets' and public.has_company_permission((storage.foldername(name))[1]::uuid, 'company.settings.write'));
create policy company_assets_update on storage.objects for update to authenticated
using (bucket_id = 'company-assets' and public.has_company_permission((storage.foldername(name))[1]::uuid, 'company.settings.write'));
create policy company_assets_delete on storage.objects for delete to authenticated
using (bucket_id = 'company-assets' and public.has_company_permission((storage.foldername(name))[1]::uuid, 'company.settings.write'));
