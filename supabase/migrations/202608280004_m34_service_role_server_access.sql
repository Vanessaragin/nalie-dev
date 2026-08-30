-- Minimal server-only access used to provision companies and users.
-- The service role key must never be exposed to browser code.
grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.companies,
  public.company_settings,
  public.profiles,
  public.roles,
  public.company_users
to service_role;
