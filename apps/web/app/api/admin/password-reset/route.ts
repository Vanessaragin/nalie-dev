import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type ResetBody = {
  membershipId?: string;
  channel?: 'email' | 'whatsapp' | 'both';
};

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Serviço de recuperação ainda não configurado.' },
      { status: 503 },
    );
  }

  const body = (await request.json()) as ResetBody;
  if (
    !body.membershipId ||
    !body.channel ||
    !['email', 'whatsapp', 'both'].includes(body.channel)
  ) {
    return NextResponse.json(
      { error: 'Solicitação inválida.' },
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
  const { data: membership, error: membershipError } = await adminClient
    .from('company_users')
    .select('profile_id')
    .eq('id', body.membershipId)
    .not('company_id', 'is', null)
    .single();
  if (membershipError || !membership) {
    return NextResponse.json(
      { error: 'Usuário não encontrado.' },
      { status: 404 },
    );
  }

  const { data: userData, error: userError } =
    await adminClient.auth.admin.getUserById(membership.profile_id);
  const email = userData.user?.email;
  if (userError || !email) {
    return NextResponse.json(
      { error: 'O usuário não possui e-mail válido.' },
      { status: 422 },
    );
  }

  const origin = (
    process.env.NALIE_PUBLIC_URL || 'https://naliebi.onrender.com'
  ).replace(/\/$/, '');
  const redirectTo = `${origin}/primeiro-acesso?mode=recovery`;
  let whatsappLink: string | undefined;

  if (body.channel === 'email' || body.channel === 'both') {
    const { error } = await authenticatedClient.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
  }

  if (body.channel === 'whatsapp' || body.channel === 'both') {
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (error || !data.properties?.action_link) {
      return NextResponse.json(
        { error: error?.message ?? 'Não foi possível gerar o link.' },
        { status: 502 },
      );
    }
    whatsappLink = data.properties.action_link;
  }

  const { error: requestError } = await authenticatedClient.rpc(
    'request_company_user_password_reset',
    {
      target_membership_id: body.membershipId,
      requested_channel: body.channel,
    },
  );
  if (requestError) {
    return NextResponse.json({ error: requestError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, whatsappLink });
}
