alter table public.user_playlists add column description text not null default '' check (char_length(description)<=1000), add column sort_order integer not null default 0;
create table public.ritm_playlist_listens (
 playlist_id uuid references public.user_playlists(id) on delete cascade,
 listener uuid references auth.users(id) on delete cascade,
 listened_on date not null default current_date,
 primary key (playlist_id,listener,listened_on)
);
alter table public.ritm_playlist_listens enable row level security;
create function public.ritm_playlist_count(playlist_key uuid) returns bigint language sql stable security definer set search_path='' as $$
 select count(*) from public.ritm_playlist_listens l where l.playlist_id=playlist_key and (
 exists(select 1 from public.user_playlists p where p.id=playlist_key and p.user_id=auth.uid()) or
 exists(select 1 from public.ritm_playlist_links s where s.playlist_id=playlist_key))
$$;
create function public.ritm_playlist_listen(playlist_key uuid) returns void language sql security definer set search_path='' as $$
 insert into public.ritm_playlist_listens(playlist_id,listener)
 select p.id,auth.uid() from public.user_playlists p where p.id=playlist_key and auth.uid() is not null
 and (p.user_id=auth.uid() or exists(select 1 from public.ritm_playlist_links s where s.playlist_id=p.id))
 on conflict do nothing
$$;
revoke all on function public.ritm_playlist_count(uuid),public.ritm_playlist_listen(uuid) from public;
grant execute on function public.ritm_playlist_count(uuid) to anon,authenticated;
grant execute on function public.ritm_playlist_listen(uuid) to authenticated;
