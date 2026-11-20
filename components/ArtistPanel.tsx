import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { AvatarCircle, Notice, PrimaryButton } from './AuthUI';
import { CollectionPanel, TrackList } from './CollectionTools';
import { supabase } from '../lib/supabase';
import type { Track } from '../lib/music-data';

type Artist = { username: string; avatar_url: string | null; bio: string };
export function ArtistPanel({ id, viewer, close, mapTrack, play, signIn }: {
  id: string; viewer?: string; close: () => void; mapTrack: (row: unknown) => Track;
  play: (track: Track, queue: Track[]) => void; signIn: () => void;
}) {
  const [artist, setArtist] = useState<Artist>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    let active = true;
    void Promise.all([
      db.from('profiles').select('username,avatar_url,bio').eq('id', id).maybeSingle(),
      db.from('tracks').select('*').eq('user_id', id).order('published_at', { ascending: false, nullsFirst: false }),
      db.rpc('ritm_follower_count', { artist_id: id }),
      viewer ? db.from('ritm_follows').select('artist').eq('follower', viewer).eq('artist', id).maybeSingle() : null,
      db.from('ritm_hidden_tracks').select('track_id'),
    ]).then(([profile, songs, count, follow, visibility]) => {
      if (!active) return;
      if (profile.error || !profile.data || songs.error || count.error || follow?.error) {
        setError('Не удалось загрузить страницу автора.');
        return;
      }
      setArtist(profile.data);
      const hidden = new Set((visibility.data ?? []).map(item => item.track_id));
      setTracks((songs.data || []).filter(song => !hidden.has(song.id)).map(mapTrack));
      setFollowers(Number(count.data) || 0);
      setFollowing(Boolean(follow?.data));
    });
    return () => { active = false; };
  }, [id, viewer, mapTrack]);

  async function toggle() {
    if (!viewer) { signIn(); return; }
    if (!supabase || busy) return;
    setBusy(true);
    const action = following
      ? await supabase.from('ritm_follows').delete().eq('follower', viewer).eq('artist', id)
      : await supabase.from('ritm_follows').upsert({ follower: viewer, artist: id }, { ignoreDuplicates: true });
    if (action.error) setError('Не удалось изменить подписку.');
    else {
      setFollowing(!following);
      const count = await supabase.rpc('ritm_follower_count', { artist_id: id });
      if (!count.error) setFollowers(Number(count.data) || 0);
    }
    setBusy(false);
  }

  return <CollectionPanel title={artist?.username ?? 'Автор'} close={close}>
    {error ? <Notice kind="error" text={error} /> : null}
    {!artist && !error && <Text>Загружаем профиль…</Text>}
    {artist && <>
      <AvatarCircle name={artist.username} uri={artist.avatar_url} size={72} />
      {artist.bio ? <Text>{artist.bio}</Text> : null}
      <Text>Подписчики · {followers}</Text>
      {typeof window !== 'undefined' && <Text selectable>{new URL('?artist=' + id, window.location.href).href}</Text>}
      {viewer !== id && <PrimaryButton title={following ? 'Отписаться' : 'Подписаться'} loading={busy} onPress={() => void toggle()} />}
      <Text style={{ fontWeight: '800' }}>Треки автора</Text>
      {tracks.length ? <TrackList tracks={tracks} play={track => play(track, tracks)} /> : <Text>Пока нет опубликованных треков.</Text>}
    </>}
  </CollectionPanel>;
}
