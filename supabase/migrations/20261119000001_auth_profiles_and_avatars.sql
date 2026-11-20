-- Профили пользователей
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_\u0400-\u04FF]{3,20}$')
);

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles: читать могут все" on public.profiles;
create policy "profiles: читать могут все"
  on public.profiles for select using (true);

drop policy if exists "profiles: создавать свой" on public.profiles;
create policy "profiles: создавать свой"
  on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles: менять свой" on public.profiles;
create policy "profiles: менять свой"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted   text := new.raw_user_meta_data ->> 'username';
  fallback text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
begin
  if wanted is null or wanted !~ '^[A-Za-z0-9_\u0400-\u04FF]{3,20}$' then
    wanted := fallback;
  end if;

  begin
    insert into public.profiles (id, username) values (new.id, wanted);
  exception when unique_violation then
    insert into public.profiles (id, username) values (new.id, fallback);
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для уже существующих пользователей
insert into public.profiles (id, username)
select u.id, 'user_' || substr(replace(u.id::text, '-', ''), 1, 8)
from auth.users u
on conflict do nothing;

-- Проверка занятости имени
create or replace function public.username_available(name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- Бакет аватарок
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
