alter table public.tracks
  add column published_at timestamptz,
  add column artist text check (char_length(artist) <= 100),
  add column description text check (char_length(description) <= 1000);
alter table public.tracks alter column published_at set default now();
create index if not exists tracks_by_owner_idx on public.tracks (user_id);
alter table public.profiles add column bio text not null default '' check (char_length(bio) <= 600);

alter table public.user_playlists add column cover_url text check (char_length(cover_url) <= 2000);
alter table public.user_playlists add constraint ritm_playlist_owner_key unique (id, user_id);
alter table public.user_playlist_tracks add constraint ritm_playlist_track_owner_fk
  foreign key (playlist_id, user_id) references public.user_playlists (id, user_id) on delete cascade;
create index ritm_playlist_items_owner_idx on public.user_playlist_tracks (user_id, playlist_id, position);

create table public.ritm_playlist_links (
  playlist_id uuid primary key,
  user_id uuid not null,
  foreign key (playlist_id, user_id) references public.user_playlists (id, user_id) on delete cascade
);
alter table public.ritm_playlist_links enable row level security;
grant select, insert, delete on public.ritm_playlist_links to authenticated;
create policy ritm_own_links on public.ritm_playlist_links for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The shared view returns only the title, cover and publicly available catalogue tracks.
create or replace function public.ritm_shared_playlist(link_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('title', p.title, 'cover', p.cover_url, 'tracks',
    coalesce((select jsonb_agg(case when t.id is not null then to_jsonb(t) - 'user_id'
      else jsonb_build_object('id', pt.track_id, 'title', left(pt.track_data->>'title',150),
        'artist', left(pt.track_data->>'artist',100), 'genre', left(pt.track_data->>'genre',80))
      end order by pt.position, pt.added_at)
      from public.user_playlist_tracks pt left join public.tracks t on t.id = pt.track_id
      where pt.playlist_id = p.id and pt.user_id = p.user_id
      and (t.id is not null or pt.track_id ~ '^audius_[A-Za-z0-9]{1,32}$')), '[]'::jsonb))
  from public.ritm_playlist_links l join public.user_playlists p on p.id = l.playlist_id
  where l.playlist_id = link_id;
$$;
revoke all on function public.ritm_shared_playlist(uuid) from public, anon, authenticated;
grant execute on function public.ritm_shared_playlist(uuid) to anon, authenticated;

create function public.ritm_edit_playlist(playlist_key uuid, new_title text, new_cover text, track_keys text[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  update public.user_playlists set title = new_title, cover_url = new_cover
    where id = playlist_key and user_id = (select auth.uid());
  if not found then raise exception 'playlist unavailable'; end if;
  delete from public.user_playlist_tracks where playlist_id = playlist_key and not (track_id = any(track_keys));
  update public.user_playlist_tracks item set position = sorted.pos - 1
    from unnest(track_keys) with ordinality sorted(id, pos)
    where item.playlist_id = playlist_key and item.track_id = sorted.id;
end;
$$;
revoke all on function public.ritm_edit_playlist(uuid,text,text,text[]) from public, anon;
grant execute on function public.ritm_edit_playlist(uuid,text,text,text[]) to authenticated;

create function public.ritm_toggle_playlist_link(playlist_key uuid, enabled boolean)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if enabled then
    insert into public.ritm_playlist_links values (playlist_key, auth.uid()) on conflict do nothing;
  else
    delete from public.ritm_playlist_links where playlist_id = playlist_key;
  end if;
end;
$$;
revoke all on function public.ritm_toggle_playlist_link(uuid,boolean) from public, anon;
grant execute on function public.ritm_toggle_playlist_link(uuid,boolean) to authenticated;

create table public.ritm_follows (
  follower uuid references auth.users(id) on delete cascade,
  artist uuid references public.profiles(id) on delete cascade,
  primary key (follower, artist), check (follower <> artist)
);
create index ritm_follows_artist_idx on public.ritm_follows (artist);
alter table public.ritm_follows enable row level security;
grant select, insert, delete on public.ritm_follows to authenticated;
create policy ritm_own_follows on public.ritm_follows for all to authenticated
  using (follower = (select auth.uid())) with check (follower = (select auth.uid()));
create function public.ritm_follower_count(artist_id uuid)
returns bigint language sql stable security definer set search_path = ''
as $$ select count(*) from public.ritm_follows where artist = artist_id $$;
revoke all on function public.ritm_follower_count(uuid) from public, anon, authenticated;
grant execute on function public.ritm_follower_count(uuid) to anon, authenticated;

create table public.ritm_reports (
  reporter uuid references auth.users(id) on delete cascade default auth.uid(),
  track_id text check (char_length(track_id) between 1 and 150),
  reason text not null check (char_length(trim(reason)) between 5 and 500),
  created_at timestamptz not null default now(),
  primary key (reporter, track_id)
);
alter table public.ritm_reports enable row level security;
grant insert on public.ritm_reports to authenticated;
create policy ritm_submit_report on public.ritm_reports for insert to authenticated
  with check (reporter = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ritm-drafts', 'ritm-drafts', false, 52428800, array['audio/*', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create schema if not exists ritm_internal;
revoke all on schema ritm_internal from public, anon, authenticated;
grant usage on schema ritm_internal to authenticated;
create function ritm_internal.can_upload_draft()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (select count(*) from storage.objects
  where bucket_id = 'ritm-drafts' and (storage.foldername(name))[1] = auth.uid()::text) < 40;
$$;
revoke all on function ritm_internal.can_upload_draft() from public, anon;
grant execute on function ritm_internal.can_upload_draft() to authenticated;
create policy ritm_read_draft_files on storage.objects for select to authenticated
  using (bucket_id = 'ritm-drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy ritm_delete_draft_files on storage.objects for delete to authenticated
  using (bucket_id = 'ritm-drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy ritm_insert_draft_files on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ritm-drafts' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select ritm_internal.can_upload_draft())
  );

create table public.ritm_drafts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 150),
  artist text check (char_length(artist) <= 100),
  genre text check (char_length(genre) <= 80),
  description text check (char_length(description) <= 1000),
  duration integer not null,
  audio_path text not null check (split_part(audio_path, '/', 1) = user_id::text),
  cover_path text check (split_part(cover_path, '/', 1) = user_id::text),
  created_at timestamptz not null default now()
);
create index ritm_drafts_owner_idx on public.ritm_drafts (user_id, created_at desc);
alter table public.ritm_drafts enable row level security;
grant select, insert, update, delete on public.ritm_drafts to authenticated;
create policy ritm_own_drafts on public.ritm_drafts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.ritm_daily_plays (
  track_id text references public.tracks(id) on delete cascade,
  day date,
  source text,
  plays bigint not null default 0,
  primary key (track_id, day, source)
);
alter table public.ritm_daily_plays enable row level security;
grant select on public.ritm_daily_plays to authenticated;
create policy ritm_owner_analytics on public.ritm_daily_plays for select to authenticated
  using (exists (select 1 from public.tracks t where t.id = track_id and t.user_id = (select auth.uid())));

create table ritm_internal.recent_counts (
  listener uuid references auth.users(id) on delete cascade,
  track_id text check (char_length(track_id) between 1 and 150),
  counted_at timestamptz not null,
  primary key (listener, track_id)
);
create function public.ritm_count_play(track_key text, play_source text)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); total bigint;
begin
  if uid is null or track_key is null or char_length(track_key) not between 1 and 150 then
    raise exception 'invalid playback';
  end if;
  if not exists (select 1 from public.tracks where id = track_key) and track_key !~ '^audius_[A-Za-z0-9]{1,32}$' then
    return null;
  end if;
  insert into ritm_internal.recent_counts values (uid, track_key, now())
  on conflict (listener, track_id) do update set counted_at = excluded.counted_at
    where ritm_internal.recent_counts.counted_at <= now() - interval '1 minute';
  if found then
    insert into public.track_stats(track_id, play_count) values (track_key, 1)
      on conflict (track_id) do update set play_count = public.track_stats.play_count + 1, updated_at = now();
    insert into public.ritm_daily_plays(track_id, day, source, plays)
      select id, (now() at time zone 'UTC')::date,
        case when play_source in ('catalog', 'library', 'playlist', 'artist', 'shared') then play_source else 'other' end, 1
      from public.tracks where id = track_key
      on conflict (track_id, day, source) do update set plays = public.ritm_daily_plays.plays + 1;
  end if;
  select play_count into total from public.track_stats where track_id = track_key;
  return total;
end;
$$;
revoke all on function public.ritm_count_play(text,text) from public, anon, authenticated;
grant execute on function public.ritm_count_play(text,text) to authenticated;
-- Retain the previous client contract while applying the same duplicate-play guard.
create or replace function public.record_track_play(track_key text)
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform public.ritm_count_play(track_key, 'other'); end; $$;
