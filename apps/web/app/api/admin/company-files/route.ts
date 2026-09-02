import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const allowedTypes = new Set([
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
]);

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey)
    return NextResponse.json(
      { error: 'Configuração segura indisponível.' },
      { status: 503 },
    );

  const cookieStore = await cookies();
  const authenticatedClient = createServerClient(url, publishableKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined },
  });
  const [{ data: claims }, { data: isAdministrator }] = await Promise.all([
    authenticatedClient.auth.getClaims(),
    authenticatedClient.rpc('is_super_admin'),
  ]);
  if (!claims?.claims || !isAdministrator)
    return NextResponse.json(
      { error: 'Acesso não autorizado.' },
      { status: 403 },
    );

  const form = await request.formData();
  const companyId = String(form.get('companyId') ?? '');
  const file = form.get('file');
  if (!/^[0-9a-f-]{36}$/i.test(companyId) || !(file instanceof File))
    return NextResponse.json(
      { error: 'Selecione a empresa e o arquivo.' },
      { status: 400 },
    );
  if (file.size === 0 || file.size > MAX_FILE_SIZE)
    return NextResponse.json(
      { error: 'O arquivo deve ter entre 1 byte e 50 MB.' },
      { status: 400 },
    );
  const mimeType = file.type || 'application/octet-stream';
  if (!allowedTypes.has(mimeType))
    return NextResponse.json(
      { error: `Formato não aceito: ${mimeType}.` },
      { status: 400 },
    );

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('display_name,import_identifier')
    .eq('id', companyId)
    .single();
  if (companyError || !company)
    return NextResponse.json(
      { error: 'Empresa não encontrada.' },
      { status: 404 },
    );

  const bytes = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const storagePath = `${companyId}/${claims.claims.sub}/${id}/${safeName}`;
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const { error: uploadError } = await admin.storage
    .from('company-files')
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
  if (uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: document, error: documentError } = await admin
    .from('company_documents')
    .insert({
      id,
      company_id: companyId,
      file_name: file.name,
      storage_path: storagePath,
      category: 'stored_upload',
      mime_type: mimeType,
      access_scope: 'company',
      uploaded_by: String(claims.claims.sub),
      byte_size: file.size,
      checksum_sha256: checksum,
    })
    .select('created_at')
    .single();
  if (documentError) {
    await admin.storage.from('company-files').remove([storagePath]);
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }
  return NextResponse.json({
    id,
    storagePath,
    checksum,
    createdAt: document.created_at,
    companyName: company.display_name,
    importIdentifier: company.import_identifier ?? companyId,
  });
}
