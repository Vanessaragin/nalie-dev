-- M45: comprovantes privados vinculados à empresa e à cobrança do serviço.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy payment_receipts_company_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payment-receipts'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
);

create policy payment_receipts_company_read
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-receipts'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
);

drop function if exists public.submit_service_payment_confirmation(uuid);

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
end;
$$;

revoke all on function public.submit_service_payment_confirmation(uuid, text) from public;
grant execute on function public.submit_service_payment_confirmation(uuid, text) to authenticated;
