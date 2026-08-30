-- M8: recurring service packages, first-access delivery and customer data export requests.
create table public.service_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  package_code text not null check (package_code in ('ESSENTIAL','MANAGEMENT','STRATEGIC')),
  recurring_amount numeric(12,2) not null check (recurring_amount >= 0),
  billing_day smallint not null check (billing_day between 1 and 28),
  starts_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index one_active_service_subscription_per_company
  on public.service_subscriptions(company_id) where active;

alter table public.service_payments
  add column subscription_id uuid references public.service_subscriptions(id) on delete set null,
  add column series_key uuid,
  add column is_prelaunch boolean not null default false;

create table public.user_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  target_email text not null,
  delivery_channel text not null check (delivery_channel in ('EMAIL','WHATSAPP','BOTH')),
  must_change_password boolean not null default true,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  accepted_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  format text not null check (format in ('ZIP','XLSX','JSON')),
  status text not null default 'REQUESTED' check (status in ('REQUESTED','PROCESSING','READY','DELIVERED','CANCELLED')),
  due_at timestamptz not null default (now() + interval '72 hours'),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.create_service_payment_prelaunch()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.service_payments (
    company_id, created_by, service_name, amount, due_date, subscription_id, series_key, is_prelaunch
  ) values (
    new.company_id, auth.uid(), new.package_code, new.recurring_amount,
    new.starts_on, new.id, new.id, true
  );
  return new;
end;
$$;
create trigger create_service_payment_prelaunch after insert on public.service_subscriptions
for each row execute function public.create_service_payment_prelaunch();

alter table public.service_subscriptions enable row level security; alter table public.service_subscriptions force row level security;
alter table public.user_invites enable row level security; alter table public.user_invites force row level security;
alter table public.data_export_requests enable row level security; alter table public.data_export_requests force row level security;
grant select, insert, update on public.service_subscriptions, public.user_invites, public.data_export_requests to authenticated;
create policy subscriptions_owner_only on public.service_subscriptions for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy invites_owner_create on public.user_invites for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin() and created_by = auth.uid());
create policy export_request_read on public.data_export_requests for select to authenticated using (public.is_super_admin() or public.is_company_member(company_id));
create policy export_request_insert on public.data_export_requests for insert to authenticated with check (public.is_company_member(company_id) and requested_by = auth.uid());
create policy export_request_owner_update on public.data_export_requests for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
