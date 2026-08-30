create table if not exists public.site_branding (
  id text primary key check (id = 'nalie-main'),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  photo_url text not null default '/vanessa-login.jpeg',
  specialist_url text not null default 'https://wa.me/5511999990020',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.site_branding (id) values ('nalie-main') on conflict (id) do nothing;
alter table public.site_branding enable row level security;
create policy site_branding_public_read on public.site_branding for select to anon, authenticated using (true);
create policy site_branding_master_update on public.site_branding for update to authenticated
using (public.is_super_admin()) with check (public.is_super_admin() and updated_by = auth.uid());
grant select on public.site_branding to anon, authenticated;
grant update on public.site_branding to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('brand-assets','brand-assets',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy brand_assets_public_read on storage.objects for select to anon, authenticated using (bucket_id='brand-assets');
create policy brand_assets_master_insert on storage.objects for insert to authenticated with check (bucket_id='brand-assets' and public.is_super_admin());
create policy brand_assets_master_update on storage.objects for update to authenticated using (bucket_id='brand-assets' and public.is_super_admin()) with check (bucket_id='brand-assets' and public.is_super_admin());
