insert into public.permissions (code, description)
values ('documents.read','Visualizar documentos'),('documents.write','Enviar e organizar documentos'),('documents.download','Baixar documentos') on conflict (code) do nothing;
create table if not exists public.company_documents (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 file_name text not null, storage_path text not null, category text not null default 'other', mime_type text,
 access_scope text not null default 'company', uploaded_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.company_documents enable row level security;
create policy "company reads documents" on public.company_documents for select using (public.has_company_permission(company_id,'documents.read'));
create policy "company manages documents" on public.company_documents for all using (public.has_company_permission(company_id,'documents.write')) with check (public.has_company_permission(company_id,'documents.write'));
