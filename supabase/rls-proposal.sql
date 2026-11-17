-- ПРЕДЛОЖЕНИЕ. Я не видел вашу реальную схему и ничего из этого не применял.
-- Перед запуском проверьте имена таблицы, колонок и бакета и прогоните на копии/тестовом проекте.
--
-- Цель: любой может слушать, но загружать и удалять треки могут только вошедшие пользователи,
-- и только свои. Сейчас anon-ключ в браузере может, судя по коду, писать и удалять всё.

-- 1) Владелец трека (upload.tsx теперь пишет user_id вошедшего пользователя)
alter table public.tracks
  add column if not exists user_id uuid references auth.users (id) default auth.uid();

alter table public.tracks enable row level security;

-- 2) Таблица tracks
create policy "tracks: читать могут все"
  on public.tracks for select
  using (true);

create policy "tracks: добавлять свои"
  on public.tracks for insert to authenticated
  with check (user_id = auth.uid());

create policy "tracks: менять свои"
  on public.tracks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tracks: удалять свои"
  on public.tracks for delete to authenticated
  using (user_id = auth.uid());

-- 3) Storage: бакет music-storage, файлы лежат в папке <user_id>/...
create policy "music-storage: читать могут все"
  on storage.objects for select
  using (bucket_id = 'music-storage');

create policy "music-storage: загружать в свою папку"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'music-storage' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "music-storage: удалять из своей папки"
  on storage.objects for delete to authenticated
  using (bucket_id = 'music-storage' and (storage.foldername(name))[1] = auth.uid()::text);

-- ВАЖНО после применения:
--  * Загрузка без входа (папка 'public-user') перестанет работать: upload.tsx придётся
--    открывать только вошедшим пользователям.
--  * Старые строки с user_id = NULL станут «ничьими»: их никто не сможет удалить из приложения.
--    Присвойте их себе: update public.tracks set user_id = '<ваш uuid>' where user_id is null;
