-- M9: company users can message only the platform owner, never one another.
alter table public.message_threads
  add column owner_profile_id uuid references public.profiles(id) on delete restrict;

update public.message_threads
set owner_profile_id = (
  select membership.profile_id
  from public.company_users membership
  join public.roles role on role.id = membership.role_id
  where membership.company_id is null and membership.status = 'ACTIVE'
    and role.code = 'SUPER_ADMIN' and role.scope = 'PLATFORM'
  limit 1
)
where owner_profile_id is null;

alter table public.message_threads alter column owner_profile_id set not null;

drop policy if exists message_threads_select on public.message_threads;
drop policy if exists message_threads_insert on public.message_threads;
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;

create policy message_threads_direct_select on public.message_threads
for select to authenticated using (
  created_by = auth.uid() or owner_profile_id = auth.uid()
);

create policy message_threads_direct_insert on public.message_threads
for insert to authenticated with check (
  created_by = auth.uid()
  and public.is_company_member(company_id)
  and exists (
    select 1 from public.company_users owner_membership
    join public.roles owner_role on owner_role.id = owner_membership.role_id
    where owner_membership.profile_id = owner_profile_id
      and owner_membership.company_id is null
      and owner_membership.status = 'ACTIVE'
      and owner_role.code = 'SUPER_ADMIN'
      and owner_role.scope = 'PLATFORM'
  )
);

create policy messages_direct_select on public.messages
for select to authenticated using (exists (
  select 1 from public.message_threads thread
  where thread.id = thread_id
    and (thread.created_by = auth.uid() or thread.owner_profile_id = auth.uid())
));

create policy messages_direct_insert on public.messages
for insert to authenticated with check (
  sender_profile_id = auth.uid()
  and exists (
    select 1 from public.message_threads thread
    where thread.id = thread_id
      and (thread.created_by = auth.uid() or thread.owner_profile_id = auth.uid())
  )
);
