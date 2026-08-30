-- M43: autor da assinatura usado na cobrança automática inicial.

alter table public.service_subscriptions
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create or replace function public.create_service_payment_prelaunch()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.service_payments (
    company_id, created_by, service_name, amount, due_date,
    subscription_id, series_key, is_prelaunch, payment_status
  ) values (
    new.company_id,
    coalesce(new.created_by, auth.uid()),
    case new.package_code
      when 'ESSENTIAL' then 'Plano Essencial'
      when 'STRATEGIC' then 'Plano Estratégico'
      else 'Plano Gestão'
    end,
    new.recurring_amount, new.starts_on, new.id, new.id, true, 'PRELAUNCH'
  );
  return new;
end;
$$;

