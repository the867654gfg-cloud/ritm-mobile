alter table public.tracks
  add column album text check (char_length(album) <= 150),
  add column version_kind text check (version_kind in ('original','remix','cover','other'));
alter table public.ritm_drafts
  add column album text check (char_length(album) <= 150),
  add column version_kind text check (version_kind in ('original','remix','cover','other'));

create function public.ritm_update_track_batch(edits jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare owner_id uuid := auth.uid(); updated jsonb;
begin
  if owner_id is null or jsonb_typeof(edits) is distinct from 'array' then raise exception 'Invalid editor or changes'; end if;
  if jsonb_array_length(edits) not between 1 and 500 then raise exception 'Edit between 1 and 500 tracks'; end if;
  if exists (
    select 1 from jsonb_array_elements(edits) entry(item)
    where jsonb_typeof(item) is distinct from 'object' or nullif(item->>'id','') is null
      or (item ? 'title' and (nullif(btrim(item->>'title'),'') is null or char_length(item->>'title') > 150))
      or char_length(item->>'genre') > 80
  ) then raise exception 'Invalid track metadata'; end if;
  with changed as (
    update public.tracks as track
    set title = case when item ? 'title' then btrim(item->>'title') else track.title end,
        artist = case when item ? 'artist' then nullif(btrim(item->>'artist'),'') else track.artist end,
        album = case when item ? 'album' then nullif(btrim(item->>'album'),'') else track.album end,
        genre = case when item ? 'genre' then nullif(btrim(item->>'genre'),'') else track.genre end,
        version_kind = case when item ? 'version_kind' then nullif(item->>'version_kind','') else track.version_kind end
    from jsonb_array_elements(edits) entry(item)
    where track.id = item->>'id' and track.user_id = owner_id
    returning track.id, track.title, track.artist, track.album, track.genre, track.version_kind
  )
  select coalesce(jsonb_agg(changed), '[]'::jsonb) into updated from changed;
  if jsonb_array_length(updated) <> jsonb_array_length(edits) then
    raise exception 'An edited track is duplicated, missing or not owned by the caller';
  end if;
  return updated;
end;
$$;
revoke all on function public.ritm_update_track_batch(jsonb) from public, anon, authenticated;
grant execute on function public.ritm_update_track_batch(jsonb) to authenticated;
