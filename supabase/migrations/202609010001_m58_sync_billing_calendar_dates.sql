-- M58: mantém o lembrete do calendário sincronizado com o vencimento da cobrança.
create or replace function public.sync_payment_calendar_reminder()
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
  )
  on conflict (billing_payment_id) do update set
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at;
  return new;
end;
$$;

drop trigger if exists create_payment_calendar_reminder on public.service_payments;
create trigger create_payment_calendar_reminder
after insert or update of due_date on public.service_payments
for each row execute function public.sync_payment_calendar_reminder();
