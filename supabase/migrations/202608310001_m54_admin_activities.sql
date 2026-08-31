-- M54: private platform activities shared by the two master administrators.
create table if not exists public.admin_activities (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  activity_type text not null,
  title text not null,
  due_at date not null,
  priority text not null check (priority in ('Alta', 'Média', 'Normal')),
  owner_name text not null,
  completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_activities_due_idx
  on public.admin_activities(due_at, completed);

alter table public.admin_activities enable row level security;
alter table public.admin_activities force row level security;

grant select, insert, update, delete on public.admin_activities to authenticated;
grant usage, select on sequence public.admin_activities_id_seq to authenticated;

create policy admin_activities_master_access on public.admin_activities
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin() and profile_id = auth.uid());

comment on table public.admin_activities is
  'Platform-owner activities, separate from every customer company.';
