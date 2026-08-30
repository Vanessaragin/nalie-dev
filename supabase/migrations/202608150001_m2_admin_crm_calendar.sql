-- M2: owner controls, client CRM, activity tracking and calendar overlays.
alter table public.profiles
  add column if not exists last_login_at timestamptz;

alter table public.company_users
  add column if not exists full_access boolean not null default false,
  add column if not exists activated_by uuid references public.profiles(id) on delete set null,
  add column if not exists activated_at timestamptz,
  add column if not exists deactivated_at timestamptz;

insert into public.permissions (code, description) values
  ('users.access.write', 'Set full or limited access for the additional company user'),
  ('calendar.read', 'Read company calendar'),
  ('calendar.write', 'Manage company calendar'),
  ('crm.read', 'Read company CRM history')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in (
  'users.access.write', 'calendar.read', 'calendar.write', 'crm.read'
) where r.code = 'COMPANY_ADMIN'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code = 'calendar.read'
where r.code = 'COMPANY_USER'
on conflict do nothing;

create table public.client_crm (
  company_id uuid primary key references public.companies(id) on delete cascade,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  lifecycle_stage text not null default 'ACTIVE',
  next_follow_up_at timestamptz,
  private_notes text,
  updated_at timestamptz not null default now()
);

create table public.client_activities (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('LOGIN','IMPORT','DOWNLOAD','CLASSIFICATION','USER_CHANGE','MEETING')),
  title text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);
create index client_activities_company_time_idx on public.client_activities(company_id, occurred_at desc);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  title text not null,
  theme text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  suggested_agenda jsonb not null default '[]'::jsonb check (jsonb_typeof(suggested_agenda) = 'array'),
  whatsapp_reminder_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create index calendar_events_company_starts_idx on public.calendar_events(company_id, starts_at);

alter table public.client_crm enable row level security;
alter table public.client_activities enable row level security;
alter table public.calendar_events enable row level security;
alter table public.client_crm force row level security;
alter table public.client_activities force row level security;
alter table public.calendar_events force row level security;

grant select, insert, update on public.client_crm, public.calendar_events to authenticated;
grant select, insert on public.client_activities to authenticated;
grant usage, select on sequence public.client_activities_id_seq to authenticated;

create policy client_crm_select on public.client_crm for select to authenticated
using (public.is_super_admin() or public.has_company_permission(company_id, 'crm.read'));
create policy client_crm_owner_write on public.client_crm for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy client_activities_select on public.client_activities for select to authenticated
using (public.is_super_admin() or public.has_company_permission(company_id, 'crm.read'));
create policy client_activities_insert on public.client_activities for insert to authenticated
with check (public.is_company_member(company_id));

create policy calendar_events_select on public.calendar_events for select to authenticated
using (public.is_super_admin() or public.has_company_permission(company_id, 'calendar.read'));
create policy calendar_events_insert on public.calendar_events for insert to authenticated
with check (public.has_company_permission(company_id, 'calendar.write'));
create policy calendar_events_update on public.calendar_events for update to authenticated
using (public.has_company_permission(company_id, 'calendar.write'))
with check (public.has_company_permission(company_id, 'calendar.write'));

-- A company administrator may invite only one additional account (two company users total).
create or replace function public.enforce_company_user_limit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_super_admin() and (
    select count(*) from public.company_users
    where company_id = new.company_id and status in ('INVITED','ACTIVE')
  ) >= 2 then
    raise exception 'Company administrators may invite only one additional user';
  end if;
  return new;
end;
$$;
create trigger company_user_limit before insert on public.company_users
for each row when (new.company_id is not null) execute function public.enforce_company_user_limit();

-- Only the platform owner can activate, suspend or deactivate memberships.
create or replace function public.owner_controls_membership_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status and not public.is_super_admin() then
    raise exception 'Only the platform administrator can change membership status';
  end if;
  return new;
end;
$$;
create trigger owner_controls_membership_status before update of status on public.company_users
for each row execute function public.owner_controls_membership_status();
