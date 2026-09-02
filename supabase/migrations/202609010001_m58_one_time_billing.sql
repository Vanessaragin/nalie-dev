-- M58: allow a contracted service to generate only its initial charge.
alter table public.service_subscriptions
  drop constraint if exists service_subscriptions_billing_frequency_check;

alter table public.service_subscriptions
  add constraint service_subscriptions_billing_frequency_check
  check (billing_frequency in ('ONE_TIME','WEEKLY','BIWEEKLY','MONTHLY'));
