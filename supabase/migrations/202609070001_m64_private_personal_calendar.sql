-- M64: personal appointments are private from clients and other regular users.
-- The master administrator retains full moderation access.

grant delete on public.calendar_events to authenticated;

drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events
for select to authenticated using (
  public.is_super_admin()
  or
  (scope = 'PERSONAL' and assigned_profile_id = auth.uid())
  or
  (
    scope = 'COMPANY'
    and public.has_company_permission(company_id, 'calendar.read')
  )
);

drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events
for insert to authenticated with check (
  created_by = auth.uid()
  and (
    public.is_super_admin()
    or (scope = 'PERSONAL' and assigned_profile_id = auth.uid())
    or
    (
      scope = 'COMPANY'
      and public.has_company_permission(company_id, 'calendar.write')
    )
  )
);

drop policy if exists calendar_events_update on public.calendar_events;
create policy calendar_events_update on public.calendar_events
for update to authenticated
using (
  public.is_super_admin()
  or (scope = 'PERSONAL' and assigned_profile_id = auth.uid())
  or
  (
    scope = 'COMPANY'
    and public.has_company_permission(company_id, 'calendar.write')
  )
)
with check (
  public.is_super_admin()
  or (scope = 'PERSONAL' and assigned_profile_id = auth.uid())
  or
  (
    scope = 'COMPANY'
    and public.has_company_permission(company_id, 'calendar.write')
  )
);

drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_delete on public.calendar_events
for delete to authenticated using (
  public.is_super_admin()
  or (scope = 'PERSONAL' and assigned_profile_id = auth.uid())
  or
  (
    scope = 'COMPANY'
    and public.has_company_permission(company_id, 'calendar.write')
  )
);
