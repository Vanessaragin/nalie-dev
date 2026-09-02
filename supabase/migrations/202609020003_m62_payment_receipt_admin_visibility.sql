drop policy if exists payment_receipts_company_read on storage.objects;
create policy payment_receipts_company_read
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-receipts'
  and (
    public.is_super_admin()
    or public.is_company_member(((storage.foldername(name))[1])::uuid)
  )
);

create or replace function public.submit_service_payment_confirmation(
  target_payment_id uuid,
  receipt_file_path text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_company_id uuid;
begin
  select company_id into target_company_id
  from public.service_payments
  where id = target_payment_id
    and public.is_company_member(company_id)
    and paid_at is null;

  if target_company_id is null then
    raise exception 'Cobrança não encontrada ou não autorizada';
  end if;

  if receipt_file_path is not null and receipt_file_path not like
    target_company_id::text || '/' || target_payment_id::text || '/%'
  then
    raise exception 'Caminho do comprovante inválido';
  end if;

  update public.service_payments
  set payment_status = 'AWAITING_CONFIRMATION',
      confirmation_submitted_at = now(),
      confirmation_file_path = receipt_file_path
  where id = target_payment_id;

  insert into public.client_activities (
    company_id, profile_id, kind, title, metadata
  ) values (
    target_company_id,
    auth.uid(),
    'PAYMENT',
    'Comprovante de pagamento enviado',
    jsonb_build_object(
      'paymentId', target_payment_id,
      'receiptPath', receipt_file_path
    )
  );
end;
$$;

revoke all on function public.submit_service_payment_confirmation(uuid, text) from public;
grant execute on function public.submit_service_payment_confirmation(uuid, text) to authenticated;
