-- M11: preserve paid history while controlling new imports per company.
alter table public.service_subscriptions
  add column access_until date,
  add column imports_blocked boolean not null default false,
  add column imports_allowed_override boolean,
  add column access_changed_at timestamptz,
  add column access_changed_by uuid references public.profiles(id) on delete set null;

update public.service_subscriptions
set access_until = starts_on + interval '1 month' - interval '1 day'
where access_until is null;
alter table public.service_subscriptions alter column access_until set not null;

create or replace function public.company_imports_allowed(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_super_admin() or coalesce((
    select coalesce(
      s.imports_allowed_override,
      not s.imports_blocked and current_date <= s.access_until
    )
    from public.service_subscriptions s
    where s.company_id = target_company_id and s.active
    order by s.created_at desc limit 1
  ), false);
$$;
revoke all on function public.company_imports_allowed(uuid) from public;
grant execute on function public.company_imports_allowed(uuid) to authenticated;

-- Reading existing batches is always preserved. Only new uploads depend on renewal.
drop policy if exists import_batches_insert on public.import_batches;
create policy import_batches_insert on public.import_batches for insert to authenticated
with check (
  public.is_company_member(company_id)
  and public.company_imports_allowed(company_id)
  and uploaded_by = auth.uid()
);

-- Apply the same company-wide gate to imported orders without blocking updates to history.
drop policy if exists orders_write on public.orders;
create policy orders_insert on public.orders for insert to authenticated
with check (
  public.has_company_permission(company_id, 'sales.write')
  and public.company_imports_allowed(company_id)
);
create policy orders_update on public.orders for update to authenticated
using (public.has_company_permission(company_id, 'sales.write'))
with check (public.has_company_permission(company_id, 'sales.write'));
create policy orders_delete on public.orders for delete to authenticated
using (public.has_company_permission(company_id, 'sales.write'));

alter table public.calendar_events
  add column billing_payment_id uuid unique references public.service_payments(id) on delete cascade;

create or replace function public.create_payment_calendar_reminder()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.calendar_events (
    company_id, created_by, title, theme, starts_at, ends_at,
    suggested_agenda, scope, billing_payment_id
  ) values (
    new.company_id, new.created_by, 'Vencimento do serviço Nalie', 'Renovação',
    new.due_date::timestamp + interval '9 hours',
    new.due_date::timestamp + interval '9 hours 30 minutes',
    jsonb_build_array('Confirmar pagamento', 'Liberar próximo período de importação'),
    'COMPANY', new.id
  ) on conflict (billing_payment_id) do nothing;
  return new;
end;
$$;
create trigger create_payment_calendar_reminder
after insert on public.service_payments
for each row execute function public.create_payment_calendar_reminder();

create or replace function public.set_company_import_access(
  target_company_id uuid,
  allow_imports boolean,
  reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform owner may change company import access';
  end if;
  update public.service_subscriptions
  set imports_allowed_override = allow_imports,
      imports_blocked = not allow_imports,
      access_changed_at = now(),
      access_changed_by = auth.uid()
  where company_id = target_company_id and active;
  insert into public.audit_logs(company_id, actor_profile_id, action, resource_type, metadata)
  values (target_company_id, auth.uid(), case when allow_imports then 'IMPORTS_RELEASED' else 'IMPORTS_BLOCKED' end,
    'service_subscription', jsonb_build_object('reason', reason, 'affects_all_company_users', true));
end;
$$;
revoke all on function public.set_company_import_access(uuid, boolean, text) from public;
grant execute on function public.set_company_import_access(uuid, boolean, text) to authenticated;
