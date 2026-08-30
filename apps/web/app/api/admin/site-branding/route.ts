import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Configuração segura indisponível.' },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { pixKey?: string };
  const pixKey = body.pixKey?.trim() ?? '';
  if (!pixKey || pixKey.length > 180) {
    return NextResponse.json({ error: 'Chave PIX inválida.' }, { status: 400 });
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
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await adminClient
    .from('site_branding')
    .update({
      pix_key: pixKey,
      updated_by: String(claims.claims.sub),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'nalie-main')
    .select('pix_key')
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: 'Não foi possível atualizar a chave PIX.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ pixKey: data.pix_key });
}
