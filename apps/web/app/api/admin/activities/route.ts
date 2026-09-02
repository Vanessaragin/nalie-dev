import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type ActivityBody = {
  companyId?: string;
  title?: string;
  type?: string;
  dueAt?: string;
  priority?: 'Alta' | 'Média' | 'Normal';
  owner?: string;
  administrator?: boolean;
};

async function authorizedClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey) return null;
  const cookieStore = await cookies();
  const authenticatedClient = createServerClient(url, publishableKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined },
  });
  const { data: claims, error: claimsError } =
    await authenticatedClient.auth.getClaims();
  if (claimsError || !claims?.claims) return null;
  const { data: isOwner, error: ownerError } =
    await authenticatedClient.rpc('is_super_admin');
  if (ownerError || !isOwner) return null;
  return {
    userId: claims.claims.sub,
    admin: createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export async function GET() {
  const access = await authorizedClients();
  if (!access)
    return NextResponse.json(
      { error: 'Acesso não autorizado.' },
      { status: 403 },
    );
  const [clientResult, adminResult] = await Promise.all([
    access.admin
      .from('client_activities')
      .select(
        'id,company_id,kind,title,metadata,occurred_at,company:companies(display_name),profile:profiles(display_name)',
      )
      .order('occurred_at', { ascending: false }),
    access.admin
      .from('admin_activities')
      .select(
        'id,activity_type,title,due_at,priority,owner_name,completed,metadata',
      )
      .order('due_at', { ascending: true }),
  ]);
  if (clientResult.error || adminResult.error)
    return NextResponse.json(
      { error: clientResult.error?.message ?? adminResult.error?.message },
      { status: 500 },
    );
  return NextResponse.json({
    clientActivities: clientResult.data ?? [],
    adminActivities: adminResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const access = await authorizedClients();
  if (!access)
    return NextResponse.json(
      { error: 'Acesso não autorizado.' },
      { status: 403 },
    );
  const body = (await request.json()) as ActivityBody;
  const title = body.title?.trim() ?? '';
  const dueAt = body.dueAt?.trim() ?? '';
  if (
    title.length < 2 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dueAt) ||
    !['Alta', 'Média', 'Normal'].includes(body.priority ?? '')
  )
    return NextResponse.json(
      { error: 'Revise os dados da atividade.' },
      { status: 400 },
    );

  if (body.administrator) {
    const { data, error } = await access.admin
      .from('admin_activities')
      .insert({
        profile_id: access.userId,
        activity_type: body.type?.trim() || 'Atividade administrativa',
        title,
        due_at: dueAt,
        priority: body.priority,
        owner_name: body.owner?.trim() || 'Vanessa Rodrigues',
        completed: false,
      })
      .select('id')
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: `ADMIN-${data.id}` });
  }

  if (!body.companyId)
    return NextResponse.json(
      { error: 'Selecione um cliente.' },
      { status: 400 },
    );
  const { data, error } = await access.admin
    .from('client_activities')
    .insert({
      company_id: body.companyId,
      profile_id: access.userId,
      kind: 'NEXT_ACTION',
      title,
      metadata: {
        type: body.type?.trim() || '',
        dueAt,
        priority: body.priority,
        owner: body.owner?.trim() || '',
        completed: false,
      },
    })
    .select('id')
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: String(data.id) });
}

export async function DELETE(request: Request) {
  const access = await authorizedClients();
  if (!access)
    return NextResponse.json(
      { error: 'Acesso não autorizado.' },
      { status: 403 },
    );
  const body = (await request.json()) as {
    id?: string;
    administrator?: boolean;
  };
  const rawId = body.id?.replace(/^ADMIN-/, '') ?? '';
  if (!/^\d+$/.test(rawId))
    return NextResponse.json({ error: 'Atividade inválida.' }, { status: 400 });
  const table = body.administrator ? 'admin_activities' : 'client_activities';
  const { data, error } = await access.admin
    .from(table)
    .delete()
    .eq('id', rawId)
    .select('id')
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { error: 'Atividade não encontrada.' },
      { status: 404 },
    );
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const access = await authorizedClients();
  if (!access)
    return NextResponse.json(
      { error: 'Acesso não autorizado.' },
      { status: 403 },
    );
  const body = (await request.json()) as ActivityBody & {
    id?: string;
    stage?: string;
  };
  const rawId = body.id?.replace(/^ADMIN-/, '') ?? '';
  const stages = ['A fazer', 'Em andamento', 'Aguardando', 'Concluído'];
  const editingDetails = body.title !== undefined;
  if (
    !/^\d+$/.test(rawId) ||
    (!editingDetails && !stages.includes(body.stage ?? ''))
  )
    return NextResponse.json(
      { error: 'Etapa da atividade inválida.' },
      { status: 400 },
    );
  const administrator = body.id?.startsWith('ADMIN-') === true;
  const table = administrator ? 'admin_activities' : 'client_activities';
  const { data: current, error: readError } = await access.admin
    .from(table)
    .select('metadata')
    .eq('id', rawId)
    .maybeSingle();
  if (readError)
    return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current)
    return NextResponse.json(
      { error: 'Atividade não encontrada.' },
      { status: 404 },
    );
  const metadata = {
    ...((current.metadata as Record<string, unknown> | null) ?? {}),
    ...(body.stage
      ? {
          workflowStage: body.stage,
          completed: body.stage === 'Concluído',
        }
      : {}),
    ...(editingDetails
      ? {
          type: body.type?.trim() || '',
          dueAt: body.dueAt,
          priority: body.priority,
          owner: body.owner?.trim() || '',
        }
      : {}),
  };
  if (
    editingDetails &&
    ((body.title?.trim().length ?? 0) < 2 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.dueAt ?? '') ||
      !['Alta', 'Média', 'Normal'].includes(body.priority ?? ''))
  )
    return NextResponse.json(
      { error: 'Revise os dados da atividade.' },
      { status: 400 },
    );
  const { error } = await access.admin
    .from(table)
    .update(
      administrator
        ? {
            metadata,
            ...(body.stage ? { completed: body.stage === 'Concluído' } : {}),
            ...(editingDetails
              ? {
                  activity_type:
                    body.type?.trim() || 'Atividade administrativa',
                  title: body.title?.trim(),
                  due_at: body.dueAt,
                  priority: body.priority,
                  owner_name: body.owner?.trim() || 'Vanessa Rodrigues',
                }
              : {}),
          }
        : {
            metadata,
            ...(editingDetails ? { title: body.title?.trim() } : {}),
          },
    )
    .eq('id', rawId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
