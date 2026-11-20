-- Настройка регистрации и профилей. Запустите целиком в Supabase -> SQL Editor.
-- Скрипт можно запускать повторно. Таблицу tracks он не трогает (для неё см. rls-proposal.sql).
--
-- Что создаётся:
--   1) таблица profiles (имя пользователя и аватарка) + права доступа
--   2) триггер: при регистрации профиль создаётся автоматически из имени, указанного в форме
--   3) функция username_available(): проверка занятости имени прямо во время ввода
--   4) публичный бакет avatars: каждый пользователь меняет только свою папку

-- 1) Профили ---------------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  -- Те же правила, что и в приложении: 3-20 символов, латиница, кириллица, цифры и "_"
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_\u0400-\u04FF]{3,20}$')
);

-- Имена уникальны без учёта регистра: "Ivan" и "ivan" считаются одним именем
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

-- 2) Автосоздание профиля при регистрации ----------------------------------------------------
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
    -- Имя успели занять между проверкой и созданием: регистрацию не ломаем, имя можно сменить в профиле
    insert into public.profiles (id, username) values (new.id, fallback);
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для тех, кто зарегистрировался раньше (например, по magic link)
insert into public.profiles (id, username)
select u.id, 'user_' || substr(replace(u.id::text, '-', ''), 1, 8)
from auth.users u
on conflict do nothing;

-- 3) Проверка занятости имени ----------------------------------------------------------------
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

-- 4) Аватарки ----------------------------------------------------------------------------------
-- Бакет публичный (картинки открываются по ссылке), размер файла до 2 МБ, только изображения
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: читать могут все" on storage.objects;
create policy "avatars: читать могут все"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "avatars: загружать в свою папку" on storage.objects;
create policy "avatars: загружать в свою папку"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: менять в своей папке" on storage.objects;
create policy "avatars: менять в своей папке"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: удалять из своей папки" on storage.objects;
create policy "avatars: удалять из своей папки"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
