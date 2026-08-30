insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code in ('SUPER_ADMIN','COMPANY_ADMIN') and p.code in (
  'workforce.read','workforce.write','planning.read','planning.write',
  'reports.read','product_decisions.write','documents.read','documents.write','documents.download'
)
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code='COMPANY_USER' and p.code in (
  'workforce.read','planning.read','reports.read','documents.read','documents.download'
)
on conflict do nothing;
