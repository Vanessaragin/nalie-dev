// Isolated PostgreSQL authorization test. Usage: node tests/security/security-hardening.mjs /path/to/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const master = '00000000-0000-4000-8000-000000000002';
await db.exec(`
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table public.profiles(id uuid primary key, status text default 'ACTIVE', display_name text, full_name text, phone text, job_title text, preferred_locale text, timezone_name text, professional_whatsapp text, public_email text, instagram_handle text, facebook_url text, website_url text, professional_address text, updated_at timestamptz, must_change_password boolean default false);
create table public.roles(id uuid primary key, code text);
create table public.company_users(id uuid primary key, profile_id uuid, role_id uuid, access_level text default 'LIMITED');
create table public.weather_datasets(id uuid);
create table public.daily_weather(id uuid);
create table public.holiday_datasets(id uuid);
create table public.local_holidays(id uuid);
create table public.savings_goals(id uuid);
create table public.access_audit_logs(id uuid);
create function public.is_protected_master(target_profile uuid) returns boolean language sql as $$ select false $$;
grant usage on schema public, auth to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
alter table public.profiles enable row level security;
alter table public.company_users enable row level security;
create policy profiles_update_self on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy company_users_all on public.company_users for all to authenticated using (true) with check (true);
insert into auth.users values ('${user}','client@example.test'),('${master}','NalieDados@gmail.com');
insert into public.profiles(id,status,display_name) values ('${user}','SUSPENDED','Client'),('${master}','ACTIVE','Master');
insert into public.company_users(id,profile_id) values ('${user}','${user}');
`);
await db.exec(
  await readFile(
    new URL(
      '../../supabase/migrations/202611020001_m72_security_audit_hardening.sql',
      import.meta.url,
    ),
    'utf8',
  ),
);
await db.exec(`set request.jwt.claim.sub='${user}'; set role authenticated;`);

async function denied(sql) {
  await assert.rejects(db.exec(sql), /permission denied/);
}
for (const table of [
  'weather_datasets',
  'daily_weather',
  'holiday_datasets',
  'local_holidays',
  'savings_goals',
  'access_audit_logs',
])
  await denied(`select * from public.${table}`);
await denied(`update public.profiles set status='ACTIVE' where id='${user}'`);
await denied(
  `update public.profiles set must_change_password=false where id='${user}'`,
);
await denied(
  `update public.company_users set access_level='COMPLETE' where id='${user}'`,
);
await denied(
  `insert into public.company_users(id,profile_id) values ('${master}','${master}')`,
);
await db.exec(
  `update public.profiles set full_name='Client', public_email='naliedados@gmail.com' where id='${user}'`,
);
const check = async (id) =>
  (await db.query(`select public.is_protected_master('${id}') as value`))
    .rows[0].value;
await db.exec(`reset role;`);
assert.equal(await check(user), false);
assert.equal(await check(master), true);
console.log('security hardening: ok');
