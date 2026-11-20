create table ritm_internal.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade
);
insert into ritm_internal.moderators
select id from public.profiles
where id = '7f74f154-6326-4b17-b232-007ebeaba86c';

create function ritm_internal.is_moderator()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from ritm_internal.moderators where user_id = auth.uid()) $$;
revoke all on function ritm_internal.is_moderator() from public, anon;
grant execute on function ritm_internal.is_moderator() to authenticated;

create function public.ritm_is_moderator()
returns boolean language sql stable security invoker set search_path = ''
as $$ select ritm_internal.is_moderator() $$;
revoke all on function public.ritm_is_moderator() from public, anon;
grant execute on function public.ritm_is_moderator() to authenticated;

create table public.ritm_hidden_tracks (
  track_id text primary key check (char_length(track_id) between 1 and 150),
  hidden_at timestamptz not null default now()
);
alter table public.ritm_hidden_tracks enable row level security;
grant select on public.ritm_hidden_tracks to anon, authenticated;
grant insert (track_id), delete on public.ritm_hidden_tracks to authenticated;
create policy ritm_visibility_read on public.ritm_hidden_tracks for select to anon, authenticated using (true);
create policy ritm_visibility_hide on public.ritm_hidden_tracks for insert to authenticated with check ((select ritm_internal.is_moderator()));
create policy ritm_visibility_restore on public.ritm_hidden_tracks for delete to authenticated using ((select ritm_internal.is_moderator()));

create policy ritm_catalog_visible_guest on public.tracks as restrictive for select to anon
  using (not exists (select 1 from public.ritm_hidden_tracks h where h.track_id = tracks.id));
create policy ritm_catalog_visible_account on public.tracks as restrictive for select to authenticated
  using (not exists (select 1 from public.ritm_hidden_tracks h where h.track_id = tracks.id)
    or user_id = (select auth.uid()) or (select ritm_internal.is_moderator()));

alter table public.ritm_reports add column reviewed_at timestamptz;
revoke insert on public.ritm_reports from authenticated;
grant insert (reporter, track_id, reason) on public.ritm_reports to authenticated;
grant select, update (reviewed_at) on public.ritm_reports to authenticated;
create policy ritm_read_reports on public.ritm_reports for select to authenticated using ((select ritm_internal.is_moderator()));
create policy ritm_review_reports on public.ritm_reports for update to authenticated
  using ((select ritm_internal.is_moderator())) with check ((select ritm_internal.is_moderator()));

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
      and (t.id is not null or pt.track_id ~ '^audius_[A-Za-z0-9]{1,32}$')
      and not exists (select 1 from public.ritm_hidden_tracks h where h.track_id = pt.track_id)), '[]'::jsonb))
  from public.ritm_playlist_links l join public.user_playlists p on p.id = l.playlist_id
  where l.playlist_id = link_id;
$$;

alter table public.ritm_daily_plays add column listens bigint not null default 0;
alter table public.track_stats add column listen_count bigint not null default 0;

create table ritm_internal.play_sessions (
  listener uuid references auth.users(id) on delete cascade,
  track_id text,
  ticket uuid not null,
  source text not null,
  minimum_seconds integer not null,
  started_at timestamptz not null,
  qualified boolean not null default false,
  primary key (listener, track_id)
);

create function public.ritm_begin_listen(track_key text, play_source text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  song_duration integer;
  required_seconds integer;
  listen_ticket uuid := gen_random_uuid();
  total bigint;
  safe_source text := case when play_source in ('catalog','library','playlist','artist','shared') then play_source else 'other' end;
begin
  if uid is null or track_key is null or char_length(track_key) not between 1 and 150 then
    raise exception 'invalid playback';
  end if;
  if exists (select 1 from public.ritm_hidden_tracks where track_id = track_key) then return null; end if;
  select duration into song_duration from public.tracks where id = track_key;
  if not found and track_key !~ '^audius_[A-Za-z0-9]{1,32}$' then return null; end if;
  required_seconds := case when song_duration between 1 and 37 then greatest(1, ceil(song_duration * 0.8)::integer) else 30 end;
  select public.ritm_count_play(track_key, safe_source) into total;
  insert into ritm_internal.play_sessions (listener, track_id, ticket, source, minimum_seconds, started_at)
    values (uid, track_key, listen_ticket, safe_source, required_seconds, now())
  on conflict (listener, track_id) do update set
    ticket = excluded.ticket, source = excluded.source, minimum_seconds = excluded.minimum_seconds,
    started_at = excluded.started_at, qualified = false
    where ritm_internal.play_sessions.started_at <= now() - interval '1 minute'
    returning ticket into listen_ticket;
  return jsonb_build_object('ticket', listen_ticket, 'seconds', required_seconds, 'starts', total);
end;
$$;

create function public.ritm_finish_listen(track_key text, listen_ticket uuid)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare play ritm_internal.play_sessions; total bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if exists (select 1 from public.ritm_hidden_tracks where track_id = track_key) then return null; end if;
  update ritm_internal.play_sessions set qualified = true
    where listener = auth.uid() and track_id = track_key and ticket = listen_ticket
      and not qualified and started_at <= now() - make_interval(secs => minimum_seconds)
      and started_at > now() - interval '24 hours'
    returning * into play;
  if not found then return null; end if;
  update public.track_stats set listen_count = listen_count + 1
    where track_id = track_key returning listen_count into total;
  insert into public.ritm_daily_plays (track_id, day, source, listens)
    select id, (now() at time zone 'UTC')::date, play.source, 1 from public.tracks where id = track_key
    on conflict (track_id, day, source) do update set listens = public.ritm_daily_plays.listens + 1;
  return total;
end;
$$;
revoke all on function public.ritm_begin_listen(text,text), public.ritm_finish_listen(text,uuid) from public, anon;
grant execute on function public.ritm_begin_listen(text,text), public.ritm_finish_listen(text,uuid) to authenticated;
