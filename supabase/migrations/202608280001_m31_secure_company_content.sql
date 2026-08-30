-- M31: secure BI/presentation publication metadata and private provider links.
create type public.company_content_kind as enum ('DASHBOARD', 'PRESENTATION');
create type public.company_content_provider as enum (
  'POWER_BI',
  'LOOKER_STUDIO',
  'POWERPOINT',
  'GOOGLE_SLIDES'
);
create type public.company_content_status as enum (
  'IN_PRODUCTION',
  'PUBLISHED',
  'INACTIVE'
);
create type public.company_content_scope as enum ('COMPANY', 'RESTRICTED');

insert into public.permissions (code, description)
values
  ('content.publications.read', 'Visualizar BI e apresentações publicados'),
  ('content.publications.manage', 'Gerenciar BI e apresentações por empresa')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'content.publications.read'
where r.code in ('COMPANY_ADMIN', 'COMPANY_USER')
on conflict do nothing;

create table public.company_content_publications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind public.company_content_kind not null,
  provider public.company_content_provider not null,
  title text not null check (length(trim(title)) between 2 and 160),
  status public.company_content_status not null default 'IN_PRODUCTION',
  access_scope public.company_content_scope not null default 'COMPANY',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, kind)
);

-- URLs and provider configuration remain outside the client-readable table.
create table public.company_content_secrets (
  publication_id uuid primary key references public.company_content_publications(id) on delete cascade,
  source_url text not null check (source_url ~ '^https://'),
  provider_resource_id text,
  provider_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provider_config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_content_user_access (
  publication_id uuid not null references public.company_content_publications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (publication_id, profile_id)
);

create index company_content_publications_company_status_idx
  on public.company_content_publications(company_id, status);
create index company_content_access_profile_idx
  on public.company_content_user_access(profile_id);

alter table public.company_content_publications enable row level security;
alter table public.company_content_secrets enable row level security;
alter table public.company_content_user_access enable row level security;
alter table public.company_content_publications force row level security;
alter table public.company_content_secrets force row level security;
alter table public.company_content_user_access force row level security;

grant select, insert, update, delete on public.company_content_publications to authenticated;
grant select, insert, update, delete on public.company_content_secrets to authenticated;
grant select, insert, update, delete on public.company_content_user_access to authenticated;

create policy content_publications_read on public.company_content_publications
for select to authenticated using (
  public.is_super_admin()
  or (
    status = 'PUBLISHED'
    and public.has_company_permission(company_id, 'content.publications.read')
    and (
      access_scope = 'COMPANY'
      or exists (
        select 1 from public.company_content_user_access access
        where access.publication_id = id and access.profile_id = auth.uid()
      )
    )
  )
);

create policy content_publications_manage on public.company_content_publications
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Provider URLs can only be read or changed by the platform owner.
create policy content_secrets_super_admin_only on public.company_content_secrets
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy content_access_read on public.company_content_user_access
for select to authenticated using (
  public.is_super_admin() or profile_id = auth.uid()
);

create policy content_access_manage on public.company_content_user_access
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

comment on table public.company_content_publications is
  'Client-readable metadata only; never stores provider URLs or embed secrets.';
comment on table public.company_content_secrets is
  'Private BI/presentation provider links; accessible only to SUPER_ADMIN.';
