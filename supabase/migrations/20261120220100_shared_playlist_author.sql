create or replace function public.ritm_shared_playlist(link_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'author_id',p.user_id,'title',p.title,'cover',p.cover_url,'description',p.description,'tracks',
 coalesce((select jsonb_agg(case when t.id is not null then to_jsonb(t)-'user_id'
 else jsonb_build_object('id',pt.track_id,'title',left(pt.track_data->>'title',150),'artist',left(pt.track_data->>'artist',100),'genre',left(pt.track_data->>'genre',80)) end order by pt.position,pt.added_at)
 from public.user_playlist_tracks pt left join public.tracks t on t.id=pt.track_id where pt.playlist_id=p.id and pt.user_id=p.user_id
 and (t.id is not null or pt.track_id ~ '^audius_[A-Za-z0-9]{1,32}$')
 and not exists(select 1 from public.ritm_hidden_tracks h where h.track_id=pt.track_id)),'[]'::jsonb))
 from public.ritm_playlist_links l join public.user_playlists p on p.id=l.playlist_id where l.playlist_id=link_id
$$;
