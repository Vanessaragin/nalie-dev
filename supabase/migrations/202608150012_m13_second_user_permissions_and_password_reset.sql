-- M13: client-owned second-user permissions and targeted password resets.
create table public.company_user_permission_overrides (
  company_user_id uuid not null references public.company_users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  allowed boolean not null default false,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  primary key (company_user_id, permission_id)
);

alter table public.company_user_permission_overrides enable row level security;
alter table public.company_user_permission_overrides force row level security;
grant select, insert, update, delete on public.company_user_permission_overrides to authenticated;
create policy second_user_permissions_read on public.company_user_permission_overrides for select to authenticated
using (exists (select 1 from public.company_users cu where cu.id = company_user_id and public.is_company_member(cu.company_id)));
create policy second_user_permissions_admin_write on public.company_user_permission_overrides for all to authenticated
using (exists (select 1 from public.company_users cu where cu.id = company_user_id and public.has_company_permission(cu.company_id, 'users.permissions.write')))
with check (exists (select 1 from public.company_users cu where cu.id = company_user_id and public.has_company_permission(cu.company_id, 'users.permissions.write')));

alter table public.password_reset_requests
  add column delivery_channel text not null default 'EMAIL' check (delivery_channel in ('EMAIL','WHATSAPP','BOTH')),
  add column expires_at timestamptz not null default (now() + interval '48 hours'),
  add column must_change_on_next_login boolean not null default true;

create index password_reset_target_created_idx on public.password_reset_requests(target_profile_id, created_at desc);
