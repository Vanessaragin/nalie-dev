// Isolated PostgreSQL authorization test. Usage: node tests/security/delegated-access.mjs /path/to/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [
  master,
  delegate,
  client,
  outsider,
  company,
  otherCompany,
  targetMembership,
  ownMembership,
] = [1, 2, 3, 4, 5, 6, 7, 8].map(id);
await db.exec(`
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table public.profiles(id uuid primary key, status text, display_name text, public_email text, must_change_password boolean, updated_at timestamptz);
create table public.companies(id uuid primary key, display_name text);
create table public.roles(id uuid primary key, code text);
create table public.company_users(id uuid primary key, profile_id uuid, company_id uuid, role_id uuid, status text, access_level text);
create function public.is_super_admin() returns boolean language sql stable security definer as $$ select auth.uid() = '${master}'::uuid $$;
create function public.can_access_portal() returns boolean language sql stable security definer as $$ select exists(select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE') $$;
create table public.audit_logs(company_id uuid, actor_profile_id uuid, action text, resource_type text, resource_id text, metadata jsonb);
create table public.client_activities(id bigint generated always as identity, company_id uuid, profile_id uuid, kind text, title text, metadata jsonb, occurred_at timestamptz default now());
create table public.company_analysis_links(id uuid, company_id uuid, display_name text, source_url text, link_type text, status text);
create table public.client_crm(company_id uuid, contact_name text, contact_email text, contact_phone text, whatsapp text, contact_status text, client_status text);
create table public.calendar_events(id uuid, company_id uuid, scope text, title text, theme text, starts_at timestamptz, ends_at timestamptz);
create table public.password_reset_requests(id uuid default gen_random_uuid(), requested_by uuid, target_profile_id uuid, delivery_channel text, expires_at timestamptz, must_change_on_next_login boolean);
insert into profiles(id,status,display_name) values ('${master}','ACTIVE','Master'),('${delegate}','ACTIVE','Delegate'),('${client}','ACTIVE','Client'),('${outsider}','ACTIVE','Other');
insert into companies values ('${company}','Allowed'),('${otherCompany}','Forbidden');
insert into roles values ('${id(9)}','COMPANY_USER'),('${id(10)}','SUPER_ADMIN');
insert into company_users values ('${targetMembership}','${client}','${company}','${id(9)}','ACTIVE','COMPLETE'),('${ownMembership}','${delegate}','${otherCompany}','${id(9)}','ACTIVE','COMPLETE'),('${id(11)}','${master}',null,'${id(10)}','ACTIVE','COMPLETE');
insert into client_crm(company_id,contact_name) values ('${company}','Allowed contact'),('${otherCompany}','Secret contact');
insert into calendar_events(id,company_id,scope,title) values ('${id(12)}','${company}','PERSONAL','Private'),('${id(13)}','${company}','COMPANY','Shared');
`);
await db.exec(
  await readFile(
    new URL(
      '../../supabase/migrations/202609090001_m67_delegated_client_access.sql',
      import.meta.url,
    ),
    'utf8',
  ),
);
async function as(user) {
  await db.exec(
    `reset role; set request.jwt.claim.sub = '${user}'; set role authenticated;`,
  );
}
const query = (sql, params = []) => db.query(sql, params);
async function denied(sql, params = []) {
  await assert.rejects(query(sql, params));
}
const grantSql =
  'select set_delegated_client_access($1,$2,$3::text[],$4::uuid[])';
await as(master);
await query(grantSql, [
  company,
  delegate,
  ['crm', 'calendar', 'password_reset'],
  [targetMembership],
]);
await denied(grantSql, [company, delegate, ['super'], []]);
await denied(grantSql, [
  otherCompany,
  delegate,
  ['password_reset'],
  [targetMembership],
]);
await denied(grantSql, [
  otherCompany,
  delegate,
  ['password_reset'],
  [ownMembership],
]);
await as(delegate);
await denied(grantSql, [otherCompany, delegate, ['crm'], []]);
await denied(
  "insert into delegated_client_access values ($1,$2,'{crm}','{}',$2,now())",
  [otherCompany, delegate],
);
const listed = await query('select list_delegated_clients() as value');
assert.equal(listed.rows[0].value.length, 1);
assert.equal(listed.rows[0].value[0].id, company);
await denied("select read_delegated_client($1,'crm')", [otherCompany]);
await denied("select read_delegated_client($1,'analysis')", [company]);
const crm = await query("select read_delegated_client($1,'crm') as value", [
  company,
]);
assert.equal(crm.rows[0].value[0].name, 'Allowed contact');
const calendar = await query(
  "select read_delegated_client($1,'calendar') as value",
  [company],
);
assert.equal(calendar.rows[0].value.length, 1);
assert.equal(calendar.rows[0].value[0].title, 'Shared');
assert.equal(
  (await query('select can_reset_delegated_user($1) as value', [ownMembership]))
    .rows[0].value,
  false,
);
assert.equal(
  (
    await query('select can_reset_delegated_user($1) as value', [
      targetMembership,
    ])
  ).rows[0].value,
  true,
);
await denied("select request_company_user_password_reset($1,'email')", [
  ownMembership,
]);
await query("select request_company_user_password_reset($1,'email')", [
  targetMembership,
]);
await as(outsider);
assert.equal(
  (await query('select * from delegated_client_access')).rows.length,
  0,
);
await denied("select read_delegated_client($1,'crm')", [company]);
await as(master);
await query(grantSql, [company, delegate, [], []]);
await as(delegate);
await denied("select read_delegated_client($1,'crm')", [company]);
assert.equal(
  (
    await query('select can_reset_delegated_user($1) as value', [
      targetMembership,
    ])
  ).rows[0].value,
  false,
);
await db.exec('reset role');
const audit = await query(
  'select * from audit_logs where actor_profile_id=$1',
  [delegate],
);
assert.equal(
  audit.rows.filter((row) => row.action === 'DELEGATED_CLIENT_VIEW').length,
  2,
);
assert.equal(
  audit.rows.filter((row) => row.action === 'PASSWORD_RESET_REQUESTED').length,
  1,
);
// Exercise the outgoing, per-user configuration, including two users of one company.
await db.exec(`alter table calendar_events add column assigned_profile_id uuid;
update calendar_events set assigned_profile_id='${client}';
insert into company_users values ('${id(14)}','${outsider}','${company}','${id(9)}','ACTIVE','COMPLETE');
insert into client_activities(company_id,profile_id,kind,title) values ('${company}','${client}','LOGIN','Allowed login'),('${company}','${outsider}','LOGIN','Other login');
`);
await db.exec(
  await readFile(
    new URL(
      '../../supabase/migrations/202609100001_m68_simple_admin_user_selection.sql',
      import.meta.url,
    ),
    'utf8',
  ),
);
await as(master);
const selectedUsers = [
  {
    membershipId: targetMembership,
    permissions: ['calendar', 'activity', 'password_reset'],
  },
  { membershipId: id(14), permissions: ['crm'] },
];
await query('select set_simple_admin_access($1,$2::jsonb)', [
  delegate,
  JSON.stringify(selectedUsers),
]);
await denied('select set_simple_admin_access($1,$2::jsonb)', [
  delegate,
  JSON.stringify([{ membershipId: ownMembership, permissions: ['crm'] }]),
]);
await denied('select set_simple_admin_access($1,$2::jsonb)', [
  delegate,
  JSON.stringify([{ membershipId: id(11), permissions: ['crm'] }]),
]);
await denied('select set_simple_admin_access($1,$2::jsonb)', [master, '[]']);
await as(delegate);
await denied('select set_simple_admin_access($1,$2::jsonb)', [delegate, '[]']);
assert.equal(
  (await query('select list_delegated_clients() as value')).rows[0].value
    .length,
  2,
);
await denied("select read_simple_admin_user($1,'calendar')", [id(14)]);
await denied("select read_simple_admin_user($1,'crm')", [targetMembership]);
await denied("select read_delegated_client($1,'crm')", [company]);
const scopedActivity = await query(
  "select read_simple_admin_user($1,'activity') as value",
  [targetMembership],
);
assert.deepEqual(
  scopedActivity.rows[0].value.map((row) => row.title),
  ['Allowed login'],
);
await db.exec('reset role');
await db.exec(
  await readFile(
    new URL(
      '../../supabase/migrations/202609110001_m69_shared_company_calendar.sql',
      import.meta.url,
    ),
    'utf8',
  ),
);
await db.exec(`insert into calendar_events(id,company_id,scope,title,assigned_profile_id) values
('${id(91)}','${company}','COMPANY','Company shared',null),
('${id(92)}','${company}','PERSONAL','Private unassigned',null),
('${id(93)}','${company}','COMPANY','Other user', '${outsider}');`);
await db.exec('set role authenticated');
const scopedCalendar = await query(
  "select read_simple_admin_user($1,'calendar') as value",
  [targetMembership],
);
assert.deepEqual(scopedCalendar.rows[0].value.map((row) => row.title).sort(), [
  'Company shared',
  'Shared',
]);
assert.equal(
  (await query('select can_reset_delegated_user($1) as value', [id(14)]))
    .rows[0].value,
  false,
);
assert.equal(
  (await query('select can_reset_delegated_user($1) as value', [ownMembership]))
    .rows[0].value,
  false,
);
assert.equal(
  (
    await query('select can_reset_delegated_user($1) as value', [
      targetMembership,
    ])
  ).rows[0].value,
  true,
);
await as(master);
await query('select set_simple_admin_access($1,$2::jsonb)', [delegate, '[]']);
await as(delegate);
assert.equal(
  (await query('select list_delegated_clients() as value')).rows[0].value
    .length,
  0,
);
await denied("select read_simple_admin_user($1,'activity')", [
  targetMembership,
]);
await db.close();
console.log(
  'PASS: delegation, isolation, explicit capabilities, private calendars, self reset, revocation, RLS and audit',
);
