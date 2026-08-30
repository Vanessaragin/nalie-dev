-- M44: modelo comercial visível por tipo de cliente e frequência de cobrança.

alter table public.service_subscriptions
  add column if not exists customer_type text not null default 'COMPANY'
    check (customer_type in ('PERSON','COMPANY')),
  add column if not exists billing_frequency text not null default 'MONTHLY'
    check (billing_frequency in ('WEEKLY','BIWEEKLY','MONTHLY'));

create index if not exists service_subscriptions_billing_frequency_idx
  on public.service_subscriptions(active, billing_frequency, starts_on);

create or replace function public.create_service_payment_prelaunch()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.service_payments (
    company_id, created_by, service_name, amount, due_date,
    subscription_id, series_key, is_prelaunch, payment_status
  ) values (
    new.company_id,
    coalesce(new.created_by, auth.uid()),
    case new.customer_type
      when 'PERSON' then 'Serviço Nalie · Pessoa'
      else 'Serviço Nalie · Empresa'
    end,
    new.recurring_amount, new.starts_on, new.id, new.id, true, 'PRELAUNCH'
  );
  return new;
end;
$$;

