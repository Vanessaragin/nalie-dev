-- M40: persistência dos campos já existentes na ficha administrativa do CRM.

alter table public.client_crm
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists whatsapp text,
  add column if not exists instagram_handle text,
  add column if not exists notes text,
  add column if not exists contact_status text not null default 'Lead',
  add column if not exists client_status text not null default 'Lead',
  add column if not exists service_interest text,
  add column if not exists contracted_service text,
  add column if not exists service_start_date date,
  add column if not exists contract_value numeric(14,2) check (contract_value is null or contract_value >= 0),
  add column if not exists periodicity text,
  add column if not exists owner_name text,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create index if not exists client_crm_status_idx
  on public.client_crm(client_status, contact_status, updated_at desc);

comment on table public.client_crm is
  'Ficha administrativa persistente do cliente, com uma linha por company_id.';

