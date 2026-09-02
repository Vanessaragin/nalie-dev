import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const allowedKinds = new Set(['LOGIN', 'DOWNLOAD', 'MEETING']);

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey)
    return NextResponse.json(
      { error: 'Configuração indisponível.' },
      { status: 503 },
    );

  const cookieStore = await cookies();
  const authenticated = createServerClient(url, publishableKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined },
  });
  const [{ data: claims }, { data: isAdministrator }] = await Promise.all([
    authenticated.auth.getClaims(),
    authenticated.rpc('is_super_admin'),
  ]);
  if (!claims?.claims)
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

  const body = (await request.json()) as {
    kind?: string;
    title?: string;
    companyId?: string;
    metadata?: Record<string, unknown>;
  };
  if (!allowedKinds.has(body.kind ?? '') || !body.title?.trim())
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });

  let companyId = body.companyId ?? '';
  if (!isAdministrator) {
    const { data: ownCompanyId } =
      await authenticated.rpc('current_company_id');
    companyId = String(ownCompanyId ?? '');
  }
  if (!/^[0-9a-f-]{36}$/i.test(companyId))
    return NextResponse.json({ ok: true, ignored: true });

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.from('client_activities').insert({
    company_id: companyId,
    profile_id: String(claims.claims.sub),
    kind: body.kind,
    title: body.title.trim(),
    metadata: body.metadata ?? {},
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.kind === 'LOGIN')
    await admin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', String(claims.claims.sub));
  return NextResponse.json({ ok: true });
}
