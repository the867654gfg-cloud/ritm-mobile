-- ===== 1. tracks: включаем RLS и заменяем 12 дублирующихся открытых политик на 4 понятные =====
alter table public.tracks alter column user_id set default auth.uid();

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'tracks' loop
    execute format('drop policy %I on public.tracks', r.policyname);
  end loop;
end $$;

alter table public.tracks enable row level security;

create policy "tracks: читать могут все"
  on public.tracks for select using (true);

create policy "tracks: добавлять свои"
  on public.tracks for insert to authenticated
  with check (user_id = auth.uid());

create policy "tracks: менять свои"
  on public.tracks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tracks: удалять свои"
  on public.tracks for delete to authenticated
  using (user_id = auth.uid());

-- ===== 2. Плейлисты и custom_tracks: убираем политики «разрешить всем» =====
drop policy if exists "Public Playlists All" on public.playlists;
drop policy if exists "Public Playlist Tracks All" on public.playlist_tracks;
drop policy if exists "Allow public insert" on public.custom_tracks;

-- ===== 3. Storage: убираем все открытые политики и оставляем минимально необходимые =====
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "music-storage: видеть свои файлы"
  on storage.objects for select to authenticated
  using (bucket_id = 'music-storage' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "music-storage: загружать в свою папку"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'music-storage' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "music-storage: менять в своей папке"
  on storage.objects for update to authenticated
  using (bucket_id = 'music-storage' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "music-storage: удалять из своей папки"
  on storage.objects for delete to authenticated
  using (bucket_id = 'music-storage' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: видеть свои файлы"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: загружать в свою папку"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: менять в своей папке"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: удалять из своей папки"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Ограничения бакета музыки: только аудио и картинки обложек, до 50 МБ на файл
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['audio/*', 'image/jpeg', 'image/png', 'image/webp']
where id = 'music-storage';
