-- M14: company product catalog, cost composition and price history.
insert into public.permissions(code, description) values
  ('products.read', 'Read company product catalog and costs'),
  ('products.write', 'Create and update company products and costs')
on conflict (code) do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('SUPER_ADMIN','COMPANY_ADMIN') and p.code in ('products.read','products.write')
on conflict do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='COMPANY_USER' and p.code='products.read'
on conflict do nothing;

create table public.products(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 160),
  category text not null,
  sku text,
  unit text not null default 'unit',
  current_cost numeric(14,2) not null default 0 check(current_cost>=0),
  current_price numeric(14,2) not null default 0 check(current_price>=0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,name),
  unique(company_id,sku)
);
create table public.product_cost_components(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  component_name text not null,
  quantity numeric(14,4) not null check(quantity>0),
  unit_cost numeric(14,4) not null check(unit_cost>=0),
  effective_from date not null default current_date
);
create table public.product_price_history(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  cost numeric(14,2) not null check(cost>=0),
  price numeric(14,2) not null check(price>=0),
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now()
);
alter table public.products enable row level security;alter table public.products force row level security;
alter table public.product_cost_components enable row level security;alter table public.product_cost_components force row level security;
alter table public.product_price_history enable row level security;alter table public.product_price_history force row level security;
grant select,insert,update,delete on public.products,public.product_cost_components,public.product_price_history to authenticated;
create policy products_read on public.products for select to authenticated using(public.has_company_permission(company_id,'products.read'));
create policy products_write on public.products for all to authenticated using(public.has_company_permission(company_id,'products.write')) with check(public.has_company_permission(company_id,'products.write'));
create policy product_components_read on public.product_cost_components for select to authenticated using(exists(select 1 from public.products p where p.id=product_id and public.has_company_permission(p.company_id,'products.read')));
create policy product_components_write on public.product_cost_components for all to authenticated using(exists(select 1 from public.products p where p.id=product_id and public.has_company_permission(p.company_id,'products.write'))) with check(exists(select 1 from public.products p where p.id=product_id and public.has_company_permission(p.company_id,'products.write')));
create policy product_history_read on public.product_price_history for select to authenticated using(exists(select 1 from public.products p where p.id=product_id and public.has_company_permission(p.company_id,'products.read')));
create policy product_history_write on public.product_price_history for insert to authenticated with check(changed_by=auth.uid() and exists(select 1 from public.products p where p.id=product_id and public.has_company_permission(p.company_id,'products.write')));
