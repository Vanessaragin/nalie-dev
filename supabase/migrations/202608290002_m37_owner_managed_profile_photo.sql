create or replace function public.enforce_nalie_profile_photo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.avatar_path := coalesce(new.avatar_path, '/vanessa-login.jpeg');
    return new;
  end if;

  if new.avatar_path is distinct from old.avatar_path
     and not public.is_super_admin() then
    raise exception 'Somente a administração mestre pode alterar a foto oficial.';
  end if;

  return new;
end;
$$;

comment on column public.profiles.avatar_path is
  'Foto oficial administrada exclusivamente pela administração mestre da Nalie.';
