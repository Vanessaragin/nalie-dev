-- M39: links de análise por empresa e perfil limitado explícito.

create table if not exists public.company_analysis_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  link_type text not null check (link_type in ('DASHBOARD', 'PRESENTATION', 'EXCEL_1', 'EXCEL_2')),
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  source_url text not null check (source_url ~ '^https://'),
  access_scope public.company_content_scope not null default 'COMPANY',
  status public.company_content_status not null default 'PUBLISHED',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, link_type)
);

create index if not exists company_analysis_links_company_idx
  on public.company_analysis_links(company_id, status);

alter table public.company_analysis_links enable row level security;
alter table public.company_analysis_links force row level security;
grant select, insert, update, delete on public.company_analysis_links to authenticated;

create policy company_analysis_links_read
on public.company_analysis_links for select to authenticated
using (
  public.is_super_admin()
  or (
    status = 'PUBLISHED'
    and public.is_company_member(company_id)
    and (
      access_scope = 'COMPANY'
      or public.has_company_permission(company_id, 'content.publications.read')
    )
  )
);

create policy company_analysis_links_manage
on public.company_analysis_links for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin() and updated_by = auth.uid());

create or replace function public.has_company_permission(
  target_company_id uuid,
  permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.company_users cu
    join public.profiles profile on profile.id = cu.profile_id
    join public.roles r on r.id = cu.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where cu.profile_id = auth.uid()
      and cu.company_id = target_company_id
      and profile.status = 'ACTIVE'
      and cu.status = 'ACTIVE'
      and cu.access_level <> 'BLOCKED'
      and r.scope = 'COMPANY'
      and p.code = permission_code
      and (
        cu.access_level = 'COMPLETE'
        or permission_code = 'portal.access'
        or exists (
          select 1
          from public.company_user_permission_overrides override_permission
          where override_permission.company_user_id = cu.id
            and override_permission.permission_id = p.id
            and override_permission.allowed
        )
      )
  );
$$;

insert into public.company_user_permission_overrides (
  company_user_id,
  permission_id,
  allowed,
  changed_by
)
select
  cu.id,
  p.id,
  true,
  coalesce(cu.invited_by, cu.profile_id)
from public.company_users cu
cross join public.permissions p
where cu.company_id is not null
  and cu.access_level = 'LIMITED'
  and p.code in (
    'content.publications.read',
    'calendar.read',
    'company.profile.read',
    'company.settings.read'
  )
on conflict (company_user_id, permission_id)
do update set allowed = excluded.allowed, changed_by = excluded.changed_by, changed_at = now();

comment on table public.company_analysis_links is
  'Links nomeados de BI, PowerPoint e Excel, isolados por company_id.';
