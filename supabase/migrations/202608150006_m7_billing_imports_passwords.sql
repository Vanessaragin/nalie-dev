-- M7: owner-only service billing, duplicate-safe imports and password lifecycle metadata.
create table public.service_payments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict, service_name text not null,
  amount numeric(12,2) not null check (amount >= 0), currency char(3) not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  due_date date not null, paid_at timestamptz, private_notes text, created_at timestamptz not null default now()
);
create table public.import_batches (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict, institution_name text not null,
  original_filename text not null, content_sha256 char(64) not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  row_count integer not null default 0 check (row_count >= 0), imported_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete set null, unique (company_id, content_sha256)
);
alter table public.profiles add column if not exists must_change_password boolean not null default true,
  add column if not exists password_changed_at timestamptz, add column if not exists password_expires_at timestamptz;
create table public.password_reset_requests (
  id uuid primary key default gen_random_uuid(), requested_by uuid not null references public.profiles(id) on delete restrict,
  target_profile_id uuid not null references public.profiles(id) on delete cascade, completed_at timestamptz,
  created_at timestamptz not null default now()
);
insert into public.permissions (code, description) values
  ('imports.delete', 'Delete complete import batches'), ('users.permissions.write', 'Set additional user permissions')
on conflict (code) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in ('imports.delete', 'users.permissions.write')
where r.code = 'COMPANY_ADMIN' on conflict do nothing;
alter table public.service_payments enable row level security; alter table public.service_payments force row level security;
alter table public.import_batches enable row level security; alter table public.import_batches force row level security;
alter table public.password_reset_requests enable row level security; alter table public.password_reset_requests force row level security;
grant select, insert, update on public.service_payments, public.import_batches, public.password_reset_requests to authenticated;
create policy service_payments_owner_only on public.service_payments for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy import_batches_read on public.import_batches for select to authenticated using (public.is_company_member(company_id));
create policy import_batches_insert on public.import_batches for insert to authenticated
with check (public.is_company_member(company_id) and uploaded_by = auth.uid());
create policy import_batches_delete on public.import_batches for update to authenticated
using (public.is_super_admin() or public.has_company_permission(company_id, 'imports.delete'))
with check (deleted_at is not null and deleted_by = auth.uid());
create policy password_resets_owner_only on public.password_reset_requests for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin() and requested_by = auth.uid());
