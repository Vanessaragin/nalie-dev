-- M3: prioritized appointments and private two-way client messaging.
create type public.event_priority as enum ('HIGH', 'MEDIUM', 'NORMAL');

alter table public.calendar_events
  add column if not exists priority public.event_priority not null default 'NORMAL',
  add column if not exists booked_with_owner boolean not null default false;

create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  subject text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index message_threads_company_time_idx on public.message_threads(company_id, last_message_at desc);
create index messages_thread_time_idx on public.messages(thread_id, created_at);

alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.message_threads force row level security;
alter table public.messages force row level security;
grant select, insert, update on public.message_threads, public.messages to authenticated;
grant usage, select on sequence public.messages_id_seq to authenticated;

create policy message_threads_select on public.message_threads for select to authenticated
using (public.is_company_member(company_id));
create policy message_threads_insert on public.message_threads for insert to authenticated
with check (public.is_company_member(company_id) and created_by = auth.uid());
create policy messages_select on public.messages for select to authenticated
using (exists (select 1 from public.message_threads t where t.id = thread_id and public.is_company_member(t.company_id)));
create policy messages_insert on public.messages for insert to authenticated
with check (sender_profile_id = auth.uid() and exists (
  select 1 from public.message_threads t where t.id = thread_id and public.is_company_member(t.company_id)
));
