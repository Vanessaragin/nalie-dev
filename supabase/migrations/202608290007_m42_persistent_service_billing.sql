-- M42: cobranças dos serviços visíveis por empresa e PIX persistente.

alter table public.site_branding
  add column if not exists pix_key text not null default 'financeiro@nalie.com';

alter table public.service_payments
  add column if not exists payment_status text not null default 'PENDING'
    check (payment_status in ('PRELAUNCH','PENDING','DUE_SOON','OVERDUE','AWAITING_CONFIRMATION','PAID','RECEIVED')),
  add column if not exists confirmation_submitted_at timestamptz,
  add column if not exists confirmation_file_path text;

update public.service_payments
set payment_status = case
  when paid_at is not null then 'PAID'
  when is_prelaunch then 'PRELAUNCH'
  when due_date < current_date then 'OVERDUE'
  when due_date <= current_date + 5 then 'DUE_SOON'
  else 'PENDING'
end;

create index if not exists service_payments_company_due_idx
  on public.service_payments(company_id, due_date desc, payment_status);

create policy service_payments_company_read
on public.service_payments for select to authenticated
using (public.is_company_member(company_id));

create policy subscriptions_company_read
on public.service_subscriptions for select to authenticated
using (public.is_company_member(company_id));

create or replace function public.submit_service_payment_confirmation(
  target_payment_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.service_payments
  set payment_status = 'AWAITING_CONFIRMATION',
      confirmation_submitted_at = now()
  where id = target_payment_id
    and public.is_company_member(company_id)
    and paid_at is null;
  if not found then
    raise exception 'Cobrança não encontrada ou não autorizada';
  end if;
end;
$$;
revoke all on function public.submit_service_payment_confirmation(uuid) from public;
grant execute on function public.submit_service_payment_confirmation(uuid) to authenticated;
