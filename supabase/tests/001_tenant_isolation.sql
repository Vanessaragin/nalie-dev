begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-a@example.test', crypt('synthetic-only', gen_salt('bf')), now()),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@example.test', crypt('synthetic-only', gen_salt('bf')), now()),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-b@example.test', crypt('synthetic-only', gen_salt('bf')), now()),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super@example.test', crypt('synthetic-only', gen_salt('bf')), now());

insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-000000000101', 'Synthetic Admin A'),
  ('00000000-0000-0000-0000-000000000102', 'Synthetic User A'),
  ('00000000-0000-0000-0000-000000000201', 'Synthetic Admin B'),
  ('00000000-0000-0000-0000-000000000301', 'Synthetic Super Admin');

insert into public.companies (id, legal_name, display_name, segment, country, base_currency, timezone)
values
  ('00000000-0000-0000-0000-00000000000a', 'Synthetic Company A LLC', 'Company A', 'FOOD', 'BR', 'BRL', 'America/Sao_Paulo'),
  ('00000000-0000-0000-0000-00000000000b', 'Synthetic Company B LLC', 'Company B', 'CLEANING', 'US', 'USD', 'America/New_York');

insert into public.company_settings (company_id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

insert into public.company_users (company_id, profile_id, role_id, status, accepted_at)
select '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000101', id, 'ACTIVE', now()
from public.roles where code = 'COMPANY_ADMIN';
insert into public.company_users (company_id, profile_id, role_id, status, accepted_at)
select '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000102', id, 'ACTIVE', now()
from public.roles where code = 'COMPANY_USER';
insert into public.company_users (company_id, profile_id, role_id, status, accepted_at)
select '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000201', id, 'ACTIVE', now()
from public.roles where code = 'COMPANY_ADMIN';
insert into public.company_users (company_id, profile_id, role_id, status, accepted_at)
select null, '00000000-0000-0000-0000-000000000301', id, 'ACTIVE', now()
from public.roles where code = 'SUPER_ADMIN';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$ select display_name from public.companies order by display_name $$,
  $$ values ('Company A'::text) $$,
  'Company A admin reads only Company A'
);
select is_empty(
  $$ update public.companies set display_name = 'Forbidden' where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'Company A admin cannot update Company B'
);
select ok(public.has_company_permission('00000000-0000-0000-0000-00000000000a', 'company.settings.write'), 'Company admin can update own settings');
select isnt(public.has_company_permission('00000000-0000-0000-0000-00000000000a', 'admin.console.access'), true, 'Company admin cannot access platform console');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select isnt(public.has_company_permission('00000000-0000-0000-0000-00000000000a', 'company.settings.write'), true, 'Company user cannot update settings');
select is_empty(
  $$ update public.company_settings set version = version + 1 where company_id = '00000000-0000-0000-0000-00000000000a' returning company_id $$,
  'Company user update is denied by RLS'
);
select isnt(public.has_company_permission('00000000-0000-0000-0000-00000000000a', 'users.invite'), true, 'Company user cannot invite users');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
select ok(public.is_super_admin(), 'SUPER_ADMIN platform membership is explicit');
select results_eq(
  $$ select count(*)::bigint from public.companies $$,
  $$ values (2::bigint) $$,
  'SUPER_ADMIN reads both companies'
);

select * from finish();
rollback;
