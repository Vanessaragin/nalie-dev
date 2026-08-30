update public.profiles
set avatar_path = '/vanessa-login.jpeg'
where avatar_path is distinct from '/vanessa-login.jpeg';

alter table public.profiles
  alter column avatar_path set default '/vanessa-login.jpeg';

create or replace function public.enforce_nalie_profile_photo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.avatar_path := '/vanessa-login.jpeg';
  return new;
end;
$$;

drop trigger if exists enforce_nalie_profile_photo_trigger on public.profiles;
create trigger enforce_nalie_profile_photo_trigger
before insert or update of avatar_path on public.profiles
for each row execute function public.enforce_nalie_profile_photo();

revoke all on function public.enforce_nalie_profile_photo() from public;

comment on column public.profiles.avatar_path is
  'Foto institucional fixa da Nalie. Alteração somente por implantação de código e migração administrativa.';
