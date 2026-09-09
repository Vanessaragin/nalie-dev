-- M66: personal admin events have no company and must not create company activity rows.

create or replace function public.audit_calendar_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id is not null then
    insert into public.client_activities (
      company_id, profile_id, kind, title, metadata, occurred_at
    ) values (
      new.company_id,
      new.created_by,
      'MEETING',
      new.title,
      jsonb_build_object('eventId', new.id, 'startsAt', new.starts_at),
      new.created_at
    );
  end if;
  return new;
end;
$$;
