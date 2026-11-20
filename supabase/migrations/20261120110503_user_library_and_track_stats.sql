-- Личная медиатека. JSON-снимок сохраняет внешние (Audius) треки так же, как и треки из public.tracks.
create table if not exists public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  track_data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists public.user_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.user_playlist_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id uuid not null references public.user_playlists(id) on delete cascade,
  track_id text not null,
  track_data jsonb not null,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

create table if not exists public.listening_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  track_data jsonb not null,
  played_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create index if not exists listening_history_user_played_at_idx on public.listening_history (user_id, played_at desc);
create index if not exists user_playlists_user_created_at_idx on public.user_playlists (user_id, created_at desc);

alter table public.user_favorites enable row level security;
alter table public.user_playlists enable row level security;
alter table public.user_playlist_tracks enable row level security;
alter table public.listening_history enable row level security;

create policy "favorites: own rows" on public.user_favorites for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "playlists: own rows" on public.user_playlists for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "playlist tracks: own rows" on public.user_playlist_tracks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "history: own rows" on public.listening_history for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.user_favorites, public.user_playlists, public.user_playlist_tracks, public.listening_history to authenticated;

-- Общий счётчик нужен только для отображения, поэтому пользователи могут читать его, но не менять напрямую.
create table if not exists public.track_stats (
  track_id text primary key,
  play_count bigint not null default 0 check (play_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.track_stats enable row level security;
create policy "track stats: public read" on public.track_stats for select using (true);
grant select on public.track_stats to anon, authenticated;

create or replace function public.record_track_play(track_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or length(trim(track_key)) = 0 then
    raise exception 'authentication required';
  end if;
  insert into public.track_stats (track_id, play_count, updated_at)
  values (trim(track_key), 1, now())
  on conflict (track_id) do update set play_count = public.track_stats.play_count + 1, updated_at = now();
end;
$$;
revoke all on function public.record_track_play(text) from public, anon;
grant execute on function public.record_track_play(text) to authenticated;
