create or replace function public.audit_calendar_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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
  return new;
end;
$$;

drop trigger if exists audit_calendar_event_insert_trigger on public.calendar_events;
create trigger audit_calendar_event_insert_trigger
after insert on public.calendar_events
for each row execute function public.audit_calendar_event_insert();

grant select, insert on table public.client_activities to service_role;
grant usage, select on sequence public.client_activities_id_seq to service_role;

insert into public.client_activities (
  company_id, profile_id, kind, title, metadata, occurred_at
)
select
  ce.company_id,
  ce.created_by,
  'MEETING',
  ce.title,
  jsonb_build_object('eventId', ce.id, 'startsAt', ce.starts_at),
  ce.created_at
from public.calendar_events ce
where not exists (
  select 1
  from public.client_activities ca
  where ca.kind = 'MEETING'
    and ca.metadata ->> 'eventId' = ce.id::text
);

insert into public.client_activities (
  company_id, profile_id, kind, title, metadata, occurred_at
)
select
  cu.company_id,
  au.id,
  'LOGIN',
  'Acesso ao portal',
  jsonb_build_object('source', 'auth.users'),
  au.last_sign_in_at
from auth.users au
join public.company_users cu on cu.profile_id = au.id
where cu.company_id is not null
  and au.last_sign_in_at is not null
  and not exists (
    select 1
    from public.client_activities ca
    where ca.kind = 'LOGIN'
      and ca.profile_id = au.id
      and ca.occurred_at = au.last_sign_in_at
  );
