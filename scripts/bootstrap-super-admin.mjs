import fs from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path) {
  const values = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    values[line.slice(0, separator)] = line.slice(separator + 1).trim();
  }
  return values;
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error('Informe um e-mail válido como primeiro argumento.');
}

const env = loadEnv('.env');
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const origin = (env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
if (!url || !serviceRoleKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let authUser;
let invitationSent = false;
let page = 1;
while (!authUser) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  authUser = data.users.find((user) => user.email?.toLowerCase() === email);
  if (authUser || data.users.length < 100) break;
  page += 1;
}

if (!authUser) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/primeiro-acesso`,
    data: { full_name: 'Vanessa Rodrigues', nalie_role: 'SUPER_ADMIN' },
  });
  if (error || !data.user) throw error ?? new Error('Convite não criado.');
  authUser = data.user;
  invitationSent = true;
}

const { error: profileError } = await supabase.from('profiles').upsert({
  id: authUser.id,
  display_name: 'Vanessa Rodrigues',
  full_name: 'Vanessa Rodrigues',
  status: 'ACTIVE',
});
if (profileError) throw profileError;

const { data: role, error: roleError } = await supabase
  .from('roles')
  .select('id')
  .eq('code', 'SUPER_ADMIN')
  .single();
if (roleError || !role) throw roleError ?? new Error('Perfil SUPER_ADMIN ausente.');

const { data: membership, error: membershipError } = await supabase
  .from('company_users')
  .select('id')
  .eq('profile_id', authUser.id)
  .is('company_id', null)
  .maybeSingle();
if (membershipError) throw membershipError;

let membershipId = membership?.id;
if (membershipId) {
  const { error } = await supabase
    .from('company_users')
    .update({ role_id: role.id, status: 'ACTIVE', access_level: 'COMPLETE' })
    .eq('id', membershipId);
  if (error) throw error;
} else {
  const { data, error } = await supabase
    .from('company_users')
    .insert({
      company_id: null,
      profile_id: authUser.id,
      role_id: role.id,
      status: 'ACTIVE',
      access_level: 'COMPLETE',
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Vínculo administrativo não criado.');
  membershipId = data.id;
}

console.log(JSON.stringify({
  ok: true,
  invitationSent,
  authUserId: authUser.id,
  membershipId,
  companyId: null,
  role: 'SUPER_ADMIN',
}));
