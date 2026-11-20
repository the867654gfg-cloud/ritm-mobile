-- При удалении трека убираем его и из избранного, и из плейлистов, а не блокируем удаление
alter table public.favorites
  drop constraint favorites_track_id_fkey,
  add constraint favorites_track_id_fkey foreign key (track_id) references public.tracks (id) on delete cascade;

alter table public.playlist_tracks
  drop constraint playlist_tracks_track_id_fkey,
  add constraint playlist_tracks_track_id_fkey foreign key (track_id) references public.tracks (id) on delete cascade;
