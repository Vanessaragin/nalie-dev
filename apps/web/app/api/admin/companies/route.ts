import { createServerClient } from '@supabase/ssr';
import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type ProvisionUser = { name?: string; email?: string };
type CompanyBody = {
  personType?: 'physical' | 'legal';
  name?: string;
  company?: string;
  city?: string;
  state?: string;
  contractedService?: string;
  contractValue?: number;
  startDate?: string;
  periodicity?: string;
  users?: ProvisionUser[];
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findUserByEmail(adminClient: SupabaseClient, email: string) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );
    if (user || data.users.length < 100) return user;
  }
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Cadastro seguro ainda não configurado.' },
      { status: 503 },
    );
  }

  const body = (await request.json()) as CompanyBody;
  const name = body.name?.trim() ?? '';
  const company = body.company?.trim() || name;
  const users = (body.users ?? []).map((user) => ({
    name: user.name?.trim() ?? '',
    email: user.email?.trim().toLowerCase() ?? '',
  }));
  if (
    !['physical', 'legal'].includes(body.personType ?? '') ||
    name.length < 2 ||
    company.length < 2 ||
    users.length !== 2 ||
    users.some(
      (user) => user.name.length < 2 || !emailPattern.test(user.email),
    ) ||
    users[0].email === users[1].email
  ) {
    return NextResponse.json(
      {
        error: 'Preencha a empresa e os dois usuários com e-mails diferentes.',
      },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const authenticatedClient = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => undefined,
    },
  });
  const { data: claims, error: claimsError } =
    await authenticatedClient.auth.getClaims();
  if (claimsError || !claims?.claims) {
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  }
  const { data: isOwner, error: ownerError } =
    await authenticatedClient.rpc('is_super_admin');
  if (ownerError || !isOwner) {
    return NextResponse.json(
      { error: 'Acesso não autorizado.' },
      { status: 403 },
    );
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    for (const user of users) {
      const existing = await findUserByEmail(adminClient, user.email);
      if (existing) {
        const { data: membership } = await adminClient
          .from('company_users')
          .select('id')
          .eq('profile_id', existing.id)
          .not('company_id', 'is', null)
          .maybeSingle();
        if (membership) {
          return NextResponse.json(
            { error: `${user.email} já pertence a outra empresa.` },
            { status: 409 },
          );
        }
      }
    }

    const { data: roles, error: rolesError } = await adminClient
      .from('roles')
      .select('id, code')
      .in('code', ['COMPANY_ADMIN', 'COMPANY_USER']);
    if (rolesError) throw rolesError;
    const roleIds = Object.fromEntries(
      (roles ?? []).map((role) => [role.code, role.id]),
    );
    if (!roleIds.COMPANY_ADMIN || !roleIds.COMPANY_USER) {
      throw new Error('Perfis da empresa não configurados.');
    }

    const { data: createdCompany, error: companyError } = await adminClient
      .from('companies')
      .insert({
        legal_name: company,
        display_name: company,
        entity_type: body.personType === 'physical' ? 'personal' : 'company',
        segment: body.personType === 'physical' ? 'PERSONAL' : 'SERVICES',
        country: 'BR',
        region: body.state?.trim() || null,
        city: body.city?.trim() || null,
        base_currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    if (companyError || !createdCompany) throw companyError;

    const origin = new URL(request.url).origin;
    const provisioned: Array<{ user: User; invitationSent: boolean }> = [];
    for (const user of users) {
      let authUser = await findUserByEmail(adminClient, user.email);
      let invitationSent = false;
      if (!authUser) {
        const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
          user.email,
          {
            redirectTo: `${origin}/primeiro-acesso`,
            data: { full_name: user.name, company_id: createdCompany.id },
          },
        );
        if (error || !data.user)
          throw error ?? new Error('Convite não criado.');
        authUser = data.user;
        invitationSent = true;
      }
      provisioned.push({ user: authUser, invitationSent });
    }

    const { error: profileError } = await adminClient.from('profiles').upsert(
      provisioned.map(({ user }, index) => ({
        id: user.id,
        display_name: users[index].name,
        full_name: users[index].name,
        public_email: users[index].email,
        status: 'ACTIVE',
      })),
    );
    if (profileError) throw profileError;

    const { data: memberships, error: membershipError } = await adminClient
      .from('company_users')
      .insert(
        provisioned.map(({ user }, index) => ({
          company_id: createdCompany.id,
          profile_id: user.id,
          role_id: index === 0 ? roleIds.COMPANY_ADMIN : roleIds.COMPANY_USER,
          status: 'INVITED',
          access_level: index === 0 ? 'COMPLETE' : 'LIMITED',
          full_access: index === 0,
        })),
      )
      .select('id, profile_id');
    if (membershipError) throw membershipError;

    const limitedMembership = memberships?.[1];
    if (limitedMembership) {
      const { data: limitedPermissions, error: permissionError } =
        await adminClient
          .from('permissions')
          .select('id')
          .in('code', [
            'content.publications.read',
            'calendar.read',
            'company.profile.read',
            'company.settings.read',
          ]);
      if (permissionError) throw permissionError;
      const { error: overrideError } = await adminClient
        .from('company_user_permission_overrides')
        .upsert(
          (limitedPermissions ?? []).map((permission) => ({
            company_user_id: limitedMembership.id,
            permission_id: permission.id,
            allowed: true,
            changed_by: claims.claims.sub,
          })),
        );
      if (overrideError) throw overrideError;
    }

    await adminClient.from('client_crm').upsert({
      company_id: createdCompany.id,
      lifecycle_stage: 'ACTIVE',
    });

    const contractValue = Number(body.contractValue ?? 0);
    if (contractValue > 0) {
      const frequency =
        body.periodicity === 'Semanal'
          ? 'WEEKLY'
          : body.periodicity === 'Quinzenal'
            ? 'BIWEEKLY'
            : 'MONTHLY';
      const startsOn = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate ?? '')
        ? body.startDate!
        : new Date().toISOString().slice(0, 10);
      const billingDay = Math.min(
        28,
        Math.max(1, Number(startsOn.slice(8, 10))),
      );
      const accessUntil = new Date(`${startsOn}T12:00:00`);
      accessUntil.setMonth(accessUntil.getMonth() + 1);
      accessUntil.setDate(accessUntil.getDate() - 1);
      const { error: subscriptionError } = await adminClient
        .from('service_subscriptions')
        .insert({
          company_id: createdCompany.id,
          package_code: 'MANAGEMENT',
          customer_type: body.personType === 'physical' ? 'PERSON' : 'COMPANY',
          billing_frequency: frequency,
          recurring_amount: contractValue,
          billing_day: billingDay,
          starts_on: startsOn,
          access_until: accessUntil.toISOString().slice(0, 10),
          active: true,
          created_by: claims.claims.sub,
        });
      if (subscriptionError) throw subscriptionError;
    }

    return NextResponse.json({
      ok: true,
      companyId: createdCompany.id,
      users: (memberships ?? []).map((membership, index) => ({
        id: membership.profile_id,
        membershipId: membership.id,
        email: users[index].email,
        access: index === 0 ? 'COMPLETE' : 'LIMITED',
        invitationSent: provisioned[index].invitationSent,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Cadastro não concluído.',
      },
      { status: 500 },
    );
  }
}
