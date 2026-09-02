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
  companyId?: string;
  provisionAccess?: boolean;
  personType?: 'physical' | 'legal';
  name?: string;
  company?: string;
  legalDocument?: string;
  city?: string;
  state?: string;
  contractedService?: string;
  contractValue?: number;
  startDate?: string;
  firstBillingDate?: string;
  periodicity?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  notes?: string;
  contactStatus?: string;
  clientStatus?: string;
  serviceInterest?: string;
  owner?: string;
  users?: ProvisionUser[];
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message;
  return 'Cadastro não concluído. Revise os dados e tente novamente.';
}

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
  const existingCompanyId = body.companyId?.trim() || undefined;
  const provisionAccess = body.provisionAccess === true;
  const users = (body.users ?? [])
    .map((user) => ({
      name: user.name?.trim() ?? '',
      email: user.email?.trim().toLowerCase() ?? '',
    }))
    .filter((user) => user.name || user.email);
  if (
    !['physical', 'legal'].includes(body.personType ?? '') ||
    name.length < 2 ||
    company.length < 2 ||
    users.length < 1 ||
    users.length > 2 ||
    users.some(
      (user) => user.name.length < 2 || !emailPattern.test(user.email),
    ) ||
    (users.length === 2 && users[0].email === users[1].email)
  ) {
    return NextResponse.json(
      {
        error:
          'Preencha o cliente e ao menos um usuário. O segundo usuário é opcional.',
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
  let createdCompanyId: string | undefined;
  const invitedUserIds: string[] = [];
  try {
    const legalDocument = body.legalDocument?.replace(/\D/g, '') ?? '';
    if (!existingCompanyId) {
      const [{ data: companyWithSameName }, documentMatch] = await Promise.all([
        adminClient
          .from('companies')
          .select('id, display_name')
          .ilike('display_name', company)
          .limit(1)
          .maybeSingle(),
        body.personType === 'legal' && legalDocument
          ? adminClient
              .from('companies')
              .select('id, display_name')
              .eq('legal_document', legalDocument)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (companyWithSameName || documentMatch.data) {
        const existingName =
          companyWithSameName?.display_name ?? documentMatch.data?.display_name;
        return NextResponse.json(
          { error: `O cliente ${existingName || company} já existe.` },
          { status: 409 },
        );
      }
    }

    for (const user of provisionAccess ? users : []) {
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

    let companyId = existingCompanyId;
    if (companyId) {
      const { data: existingCompany, error: existingCompanyError } =
        await adminClient
          .from('companies')
          .select('id')
          .eq('id', companyId)
          .single();
      if (existingCompanyError || !existingCompany)
        throw new Error('Contato não encontrado para liberar o acesso.');
    } else {
      const { data: createdCompany, error: companyError } = await adminClient
        .from('companies')
        .insert({
          legal_name: company,
          display_name: company,
          entity_type: body.personType === 'physical' ? 'personal' : 'company',
          legal_document:
            body.personType === 'legal' ? legalDocument || null : null,
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
      companyId = createdCompany.id;
      createdCompanyId = createdCompany.id;
    }

    if (!companyId) throw new Error('Não foi possível identificar o contato.');

    let memberships: Array<{ id: string; profile_id: string }> = [];
    const provisioned: Array<{ user: User; invitationSent: boolean }> = [];

    if (provisionAccess) {
      const { data: roles, error: rolesError } = await adminClient
        .from('roles')
        .select('id, code')
        .in('code', ['COMPANY_ADMIN', 'COMPANY_USER']);
      if (rolesError) throw rolesError;
      const roleIds = Object.fromEntries(
        (roles ?? []).map((role) => [role.code, role.id]),
      );
      if (!roleIds.COMPANY_ADMIN || !roleIds.COMPANY_USER)
        throw new Error('Perfis da empresa não configurados.');

      const origin = new URL(request.url).origin;
      for (const user of users) {
        let authUser = await findUserByEmail(adminClient, user.email);
        let invitationSent = false;
        if (!authUser) {
          const { data, error } =
            await adminClient.auth.admin.inviteUserByEmail(user.email, {
              redirectTo: `${origin}/primeiro-acesso`,
              data: { full_name: user.name, company_id: companyId },
            });
          if (error || !data.user)
            throw error ?? new Error('Convite não criado.');
          authUser = data.user;
          invitedUserIds.push(data.user.id);
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

      const { data, error: membershipError } = await adminClient
        .from('company_users')
        .insert(
          provisioned.map(({ user }, index) => ({
            company_id: companyId,
            profile_id: user.id,
            role_id: index === 0 ? roleIds.COMPANY_ADMIN : roleIds.COMPANY_USER,
            status: 'INVITED',
            access_level: index === 0 ? 'COMPLETE' : 'LIMITED',
            full_access: index === 0,
          })),
        )
        .select('id, profile_id');
      if (membershipError) throw membershipError;
      memberships = data ?? [];

      const limitedMembership = memberships[1];
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
    }

    const { error: crmError } = await adminClient.from('client_crm').upsert({
      company_id: companyId,
      contact_name: name,
      contact_phone: body.phone?.replace(/\D/g, '') || null,
      contact_email: body.email?.trim().toLowerCase() || null,
      whatsapp: body.whatsapp?.replace(/\D/g, '') || null,
      instagram_handle: body.instagram?.trim() || null,
      notes: body.notes?.trim() || null,
      lifecycle_stage: body.clientStatus?.trim() || 'Não contratado',
      contact_status: body.contactStatus?.trim() || 'Lead',
      client_status: body.clientStatus?.trim() || 'Não contratado',
      service_interest: body.serviceInterest?.trim() || null,
      contracted_service: body.contractedService?.trim() || null,
      service_start_date: body.startDate?.trim() || null,
      contract_value: Number(body.contractValue ?? 0),
      periodicity: body.periodicity?.trim() || null,
      owner_name: body.owner?.trim() || null,
      updated_by: claims.claims.sub,
      updated_at: new Date().toISOString(),
    });
    if (crmError) throw crmError;

    const contractValue = Number(body.contractValue ?? 0);
    const contracted = body.clientStatus !== 'Não contratado';
    if (contracted && contractValue >= 0) {
      const frequency =
        body.periodicity === 'Cobrança única'
          ? 'ONE_TIME'
          : body.periodicity === 'Semanal'
            ? 'WEEKLY'
            : body.periodicity === 'Quinzenal'
              ? 'BIWEEKLY'
              : 'MONTHLY';
      const startsOn = /^\d{4}-\d{2}-\d{2}$/.test(body.firstBillingDate ?? '')
        ? body.firstBillingDate!
        : (() => {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
            return nextMonth.toISOString().slice(0, 10);
          })();
      const billingDay = Math.min(
        28,
        Math.max(1, Number(startsOn.slice(8, 10))),
      );
      const accessUntil = new Date(`${startsOn}T12:00:00`);
      accessUntil.setMonth(accessUntil.getMonth() + 1);
      accessUntil.setDate(accessUntil.getDate() - 1);
      const subscriptionValues = {
        company_id: companyId,
        package_code: 'MANAGEMENT',
        customer_type: body.personType === 'physical' ? 'PERSON' : 'COMPANY',
        billing_frequency: frequency,
        recurring_amount: contractValue,
        billing_day: billingDay,
        starts_on: startsOn,
        access_until: accessUntil.toISOString().slice(0, 10),
        active: true,
        created_by: claims.claims.sub,
      };
      const { data: currentSubscription, error: currentSubscriptionError } =
        await adminClient
          .from('service_subscriptions')
          .select('id')
          .eq('company_id', companyId)
          .eq('active', true)
          .maybeSingle();
      if (currentSubscriptionError) throw currentSubscriptionError;
      const subscriptionResult = currentSubscription
        ? await adminClient
            .from('service_subscriptions')
            .update(subscriptionValues)
            .eq('id', currentSubscription.id)
        : await adminClient
            .from('service_subscriptions')
            .insert(subscriptionValues);
      const subscriptionError = subscriptionResult.error;
      if (subscriptionError) throw subscriptionError;
      if (currentSubscription) {
        const { error: paymentError } = await adminClient
          .from('service_payments')
          .update({
            amount: contractValue,
            due_date: startsOn,
            service_name: body.contractedService?.trim() || 'Serviço Nalie',
          })
          .eq('subscription_id', currentSubscription.id)
          .eq('is_prelaunch', true);
        if (paymentError) throw paymentError;
      }
    }

    return NextResponse.json({
      ok: true,
      companyId,
      accessProvisioned: provisionAccess,
      users: memberships.map((membership, index) => ({
        id: membership.profile_id,
        membershipId: membership.id,
        email: users[index].email,
        access: index === 0 ? 'COMPLETE' : 'LIMITED',
        invitationSent: provisioned[index].invitationSent,
      })),
    });
  } catch (error) {
    if (createdCompanyId)
      await adminClient.from('companies').delete().eq('id', createdCompanyId);
    await Promise.all(
      invitedUserIds.map((userId) => adminClient.auth.admin.deleteUser(userId)),
    );
    return NextResponse.json(
      {
        error: errorMessage(error),
      },
      { status: 500 },
    );
  }
}
