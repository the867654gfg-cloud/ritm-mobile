-- Владелец трека может удалить его аудиофайл и обложку, даже если они лежат не в его папке
-- (так загружались старые треки в public-user/). Совпадение точное: ссылка трека оканчивается путём файла.
create policy "music-storage: удалять файлы своих треков"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'music-storage'
    and exists (
      select 1 from public.tracks t
      where t.user_id = auth.uid()
        and (
          right(t.audio_url, length('/music-storage/' || storage.objects.name)) = '/music-storage/' || storage.objects.name
          or right(coalesce(t.cover_url, ''), length('/music-storage/' || storage.objects.name)) = '/music-storage/' || storage.objects.name
        )
    )
  );
