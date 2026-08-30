-- M10: multi-channel sales and orders, scoped by company with duplicate protection.
create type public.order_status as enum ('NEW', 'PREPARING', 'COMPLETED', 'CANCELLED');

insert into public.permissions (code, description) values
  ('sales.read', 'Read company sales and orders'),
  ('sales.write', 'Create and update company sales and orders')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'SUPER_ADMIN' and p.code in ('sales.read', 'sales.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'COMPANY_ADMIN' and p.code in ('sales.read', 'sales.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'COMPANY_USER' and p.code = 'sales.read'
on conflict do nothing;

create table public.sales_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  channel_type text not null check (channel_type in ('POS','MARKETPLACE','WHATSAPP','WEBSITE','MANUAL','OTHER')),
  external_source text not null default 'manual',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel_id uuid references public.sales_channels(id) on delete set null,
  external_source text not null default 'manual',
  external_order_id text not null,
  customer_name text,
  status public.order_status not null default 'NEW',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  fees numeric(14,2) not null default 0 check (fees >= 0),
  total numeric(14,2) not null check (total >= 0),
  currency char(3) not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  ordered_at timestamptz not null,
  imported_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (company_id, external_source, external_order_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null check (length(trim(product_name)) between 1 and 160),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  total numeric(14,2) not null check (total >= 0)
);

create index orders_company_ordered_idx on public.orders(company_id, ordered_at desc);
create index orders_company_status_idx on public.orders(company_id, status);
create index order_items_order_idx on public.order_items(order_id);

alter table public.sales_channels enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.sales_channels force row level security;
alter table public.orders force row level security;
alter table public.order_items force row level security;

grant select, insert, update, delete on public.sales_channels, public.orders, public.order_items to authenticated;

create policy sales_channels_read on public.sales_channels for select to authenticated
using (public.has_company_permission(company_id, 'sales.read'));
create policy sales_channels_write on public.sales_channels for all to authenticated
using (public.has_company_permission(company_id, 'sales.write'))
with check (public.has_company_permission(company_id, 'sales.write'));

create policy orders_read on public.orders for select to authenticated
using (public.has_company_permission(company_id, 'sales.read'));
create policy orders_write on public.orders for all to authenticated
using (public.has_company_permission(company_id, 'sales.write'))
with check (public.has_company_permission(company_id, 'sales.write'));

create policy order_items_read on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id and public.has_company_permission(o.company_id, 'sales.read')
));
create policy order_items_write on public.order_items for all to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id and public.has_company_permission(o.company_id, 'sales.write')
))
with check (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id and public.has_company_permission(o.company_id, 'sales.write')
));
