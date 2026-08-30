-- M6: separate private personal appointments from company calendar overlays.
create type public.calendar_scope as enum ('COMPANY', 'PERSONAL');

alter table public.calendar_events
  add column scope public.calendar_scope not null default 'COMPANY';

create index calendar_events_assignee_scope_idx
  on public.calendar_events(assigned_profile_id, scope, starts_at);

drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events
for select to authenticated using (
  (scope = 'PERSONAL' and assigned_profile_id = auth.uid())
  or
  (scope = 'COMPANY' and (
    public.is_super_admin()
    or public.has_company_permission(company_id, 'calendar.read')
  ))
);

drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events
for insert to authenticated with check (
  created_by = auth.uid()
  and (
    (scope = 'PERSONAL' and assigned_profile_id = auth.uid())
    or
    (scope = 'COMPANY' and public.has_company_permission(company_id, 'calendar.write'))
  )
);
