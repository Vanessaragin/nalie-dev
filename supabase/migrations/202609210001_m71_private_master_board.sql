begin;
create table public.master_board_notes (
 id uuid primary key default gen_random_uuid(),
 category text not null check(length(trim(category)) between 1 and 80),
 title text not null check(length(trim(title)) between 1 and 160),
 body text not null default '' check(length(body)<=10000),
 explanation text not null default '' check(length(explanation)<=500),
 link_url text not null default '' check(link_url='' or link_url ~ '^https?://'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.master_board_notes enable row level security;
alter table public.master_board_notes force row level security;
revoke all on public.master_board_notes from anon,authenticated;
grant select,insert,update,delete on public.master_board_notes to authenticated;
create policy master_board_only on public.master_board_notes for all to authenticated
using(public.is_super_admin() and public.can_access_portal())
with check(public.is_super_admin() and public.can_access_portal());
commit;
