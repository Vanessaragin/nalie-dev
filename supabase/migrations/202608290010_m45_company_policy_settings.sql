-- M45: company-owned policy document persisted with the tenant settings.
alter table public.company_settings
  add column if not exists policies jsonb not null default '{}'::jsonb
    check (jsonb_typeof(policies) = 'object');

comment on column public.company_settings.policies is
  'Versioned policy document shown to users of this company.';
