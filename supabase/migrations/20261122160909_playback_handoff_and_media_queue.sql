create table public.ritm_resume (
  user_id uuid primary key references auth.users (id) on delete cascade,
  track_data jsonb not null check (jsonb_typeof(track_data) = 'object' and octet_length(track_data::text) <= 32768),
  seconds integer not null check (seconds between 0 and 86400),
  playlist_id uuid references public.user_playlists (id) on delete set null,
  updated_at timestamptz not null default statement_timestamp()
);
alter table public.ritm_resume enable row level security;
revoke all on public.ritm_resume from anon, authenticated;
grant select, insert, update, delete on public.ritm_resume to authenticated;
create policy "Only own playback position" on public.ritm_resume to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid()) and
  (playlist_id is null or exists (
    select 1 from public.user_playlists p where p.id = playlist_id and p.user_id = (select auth.uid())
  ))
);

create table public.ritm_media_jobs (
  track_id text primary key references public.tracks (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  source_url text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'error')),
  updated_at timestamptz not null default statement_timestamp(),
  lease uuid,
  error_message text
);
alter table public.ritm_media_jobs enable row level security;
revoke all on public.ritm_media_jobs from anon, authenticated;
grant select on public.ritm_media_jobs to authenticated;
grant select, insert, update, delete on public.ritm_media_jobs to service_role;
create policy "Only own media jobs" on public.ritm_media_jobs for select to authenticated
using (owner_id = (select auth.uid()));
create index ritm_media_jobs_owner on public.ritm_media_jobs (owner_id);
create index ritm_media_jobs_pending on public.ritm_media_jobs (updated_at) where status in ('queued', 'processing');

create function public.ritm_queue_published_audio() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id is not null and new.audio_url like 'https://%/storage/v1/object/public/music-storage/%' then
    insert into public.ritm_media_jobs (track_id, owner_id, source_url)
      values (new.id, new.user_id, new.audio_url)
      on conflict (track_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.ritm_queue_published_audio() from public, anon, authenticated;
create trigger ritm_queue_published_audio after insert on public.tracks
for each row execute function public.ritm_queue_published_audio();

insert into public.ritm_media_jobs (track_id, owner_id, source_url)
select id, user_id, audio_url from public.tracks
where user_id is not null and audio_url like 'https://%/storage/v1/object/public/music-storage/%'
on conflict (track_id) do nothing;

create function public.ritm_claim_media_job() returns setof public.ritm_media_jobs
language sql security invoker set search_path = ''
as $$
  with candidate as (
    select track_id from public.ritm_media_jobs
    where status = 'queued' or (status = 'processing' and updated_at < statement_timestamp() - interval '45 minutes')
    order by updated_at
    limit 1 for update skip locked
  )
  update public.ritm_media_jobs j set status = 'processing', lease = gen_random_uuid(),
    updated_at = statement_timestamp(), error_message = null
  from candidate where j.track_id = candidate.track_id returning j.*;
$$;
revoke execute on function public.ritm_claim_media_job() from public, anon, authenticated;
grant execute on function public.ritm_claim_media_job() to service_role;

create function public.ritm_retry_media_job(track_key text) returns boolean
language sql security definer set search_path = ''
as $$
  with retried as (
    update public.ritm_media_jobs set status = 'queued', error_message = null, lease = null, updated_at = statement_timestamp()
    where track_id = track_key and owner_id = (select auth.uid()) and status = 'error'
    returning track_id
  )
  select exists (select 1 from retried);
$$;
revoke execute on function public.ritm_retry_media_job(text) from public, anon;
grant execute on function public.ritm_retry_media_job(text) to authenticated;
