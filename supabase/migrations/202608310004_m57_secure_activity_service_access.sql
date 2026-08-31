-- M57: activity reads and writes are performed by authenticated server routes.
grant select, insert, update, delete on
  public.client_activities,
  public.admin_activities
to service_role;

grant usage, select on sequence public.client_activities_id_seq to service_role;
grant usage, select on sequence public.admin_activities_id_seq to service_role;
