-- M56: align database grants and RLS with every write path used by the portal.

-- Secure server routes use service_role, but PostgreSQL privileges still apply.
grant select on public.roles, public.permissions to service_role;
grant select, insert, update, delete on
  public.client_crm,
  public.service_subscriptions,
  public.company_user_permission_overrides
to service_role;
grant select, update on public.site_branding to service_role;

-- Browser writes that had policies but no matching table privileges.
grant select, insert, update, delete on public.company_documents to authenticated;
grant select, insert on public.report_exports to authenticated;

-- The platform administrator manages CRM data for all companies.
drop policy if exists client_activities_insert on public.client_activities;
create policy client_activities_insert on public.client_activities
for insert to authenticated with check (
  public.is_super_admin() or public.is_company_member(company_id)
);

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
for update to authenticated
using (
  public.is_super_admin()
  or public.has_company_permission(id, 'company.settings.write')
)
with check (
  public.is_super_admin()
  or public.has_company_permission(id, 'company.settings.write')
);

drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events
for insert to authenticated with check (
  created_by = auth.uid()
  and (
    public.is_super_admin()
    or (scope = 'PERSONAL' and assigned_profile_id = auth.uid())
    or (
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
  or public.has_company_permission(company_id, 'calendar.write')
)
with check (
  public.is_super_admin()
  or public.has_company_permission(company_id, 'calendar.write')
);

drop policy if exists "company manages report exports" on public.report_exports;
create policy "company manages report exports" on public.report_exports
for all to authenticated
using (
  public.is_super_admin()
  or public.has_company_permission(company_id, 'reports.read')
)
with check (
  public.is_super_admin()
  or public.has_company_permission(company_id, 'reports.read')
);

drop policy if exists "company reads documents" on public.company_documents;
create policy "company reads documents" on public.company_documents
for select to authenticated using (
  public.is_super_admin()
  or public.has_company_permission(company_id, 'documents.read')
);

drop policy if exists "company manages documents" on public.company_documents;
create policy "company manages documents" on public.company_documents
for all to authenticated
using (
  public.is_super_admin()
  or public.has_company_permission(company_id, 'documents.write')
)
with check (
  public.is_super_admin()
  or public.has_company_permission(company_id, 'documents.write')
);
