import type { Track } from './music-data';
import { supabase } from './supabase';

export type UserPlaylist = { id: string; title: string; tracks: Track[]; cover?: string };

type LibrarySnapshot = {
  favorites: Track[];
  playlists: UserPlaylist[];
  history: Track[];
};

const asTrack = (value: unknown): Track | null => {
  if (!value || typeof value !== 'object') return null;
  const track = value as Track;
  return typeof track.id === 'string' && typeof track.title === 'string' ? track : null;
};

/** Загружает личную медиатеку. Треки хранятся снимком, поэтому в ней работают и Audius, и свои загрузки. */
export async function loadUserLibrary(userId: string): Promise<LibrarySnapshot> {
  if (!supabase) return { favorites: [], playlists: [], history: [] };
  const [favoritesResult, playlistsResult, playlistTracksResult, historyResult] = await Promise.all([
    supabase.from('user_favorites').select('track_data').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('user_playlists').select('id, title, cover_url').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('user_playlist_tracks').select('playlist_id, track_data, position').eq('user_id', userId).order('position').order('added_at'),
    supabase.from('listening_history').select('track_data').eq('user_id', userId).order('played_at', { ascending: false }).limit(30),
  ]);

  const failure = [favoritesResult, playlistsResult, playlistTracksResult, historyResult].find(result => result.error);
  if (failure?.error) throw failure.error;
  const favorites = (favoritesResult.data ?? []).map((row: any) => asTrack(row.track_data)).filter(Boolean) as Track[];
  const history = (historyResult.data ?? []).map((row: any) => asTrack(row.track_data)).filter(Boolean) as Track[];
  const trackRows = playlistTracksResult.data ?? [];
  const playlists = (playlistsResult.data ?? []).map((playlist: any) => ({
    id: playlist.id,
    title: playlist.title,
    cover: playlist.cover_url ?? undefined,
    tracks: trackRows.filter((row: any) => row.playlist_id === playlist.id).map((row: any) => asTrack(row.track_data)).filter(Boolean) as Track[],
  }));
  return { favorites, playlists, history };
}

export async function setFavorite(userId: string, track: Track, enabled: boolean): Promise<boolean> {
  if (!supabase) return false;
  if (!enabled) {
    const { error } = await supabase.from('user_favorites').delete().eq('user_id', userId).eq('track_id', track.id);
    return !error;
  }
  const { error } = await supabase.from('user_favorites').upsert(
    { user_id: userId, track_id: track.id, track_data: track },
    { onConflict: 'user_id,track_id', ignoreDuplicates: true }
  );
  return !error;
}

export async function createUserPlaylist(userId: string, title: string): Promise<UserPlaylist | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('user_playlists').insert({ user_id: userId, title }).select('id, title').single();
  return error || !data ? null : { id: data.id, title: data.title, tracks: [] };
}

export async function addTracksToPlaylist(userId: string, playlistId: string, tracks: Track[], currentSize: number): Promise<boolean> {
  if (!supabase || tracks.length === 0) return true;
  const rows = tracks.map((track, index) => ({ user_id: userId, playlist_id: playlistId, track_id: track.id, track_data: track, position: currentSize + index }));
  const { error } = await supabase.from('user_playlist_tracks').upsert(rows, { onConflict: 'playlist_id,track_id', ignoreDuplicates: true });
  return !error;
}

export async function recordListening(userId: string, track: Track, source?: string): Promise<number | undefined> {
  if (!supabase) return;
  const history = await supabase.from('listening_history').upsert(
      { user_id: userId, track_id: track.id, track_data: track, played_at: new Date().toISOString() },
      { onConflict: 'user_id,track_id' }
    );
  if (history.error) throw history.error;
  if (!source) return;
  const { data, error } = await supabase.rpc('ritm_count_play', { track_key: track.id, play_source: source });
  if (error) throw error;
  return data == null ? undefined : Number(data);
}

export async function loadPlayCounts(trackIds: string[]): Promise<Record<string, number>> {
  if (!supabase || trackIds.length === 0) return {};
  const { data } = await supabase.from('track_stats').select('track_id, play_count').in('track_id', [...new Set(trackIds)]);
  return Object.fromEntries((data ?? []).map((row: any) => [String(row.track_id), Number(row.play_count) || 0]));
}

function legacyItems<T>(key: string): T[] {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export function hasLegacyLibrary(userId: string) {
  try {
    return !localStorage.getItem('ritm_imported_' + userId) &&
      ['ritm_my_music', 'ritm_user_playlists', 'ritm_recently_played'].some(key => legacyItems(key).length > 0);
  } catch { return false; }
}

export async function importLegacyLibrary(userId: string) {
  if (!supabase || !hasLegacyLibrary(userId)) return;
  const db = supabase;
  const favorites = legacyItems<unknown>('ritm_my_music').map(asTrack).filter((track): track is Track => track !== null);
  const history = legacyItems<unknown>('ritm_recently_played').map(asTrack).filter((track): track is Track => track !== null);
  const playlists = legacyItems<UserPlaylist>('ritm_user_playlists').filter(playlist =>
    playlist && typeof playlist.id === 'string' && typeof playlist.title === 'string' && Array.isArray(playlist.tracks));
  for (const track of favorites) if (!await setFavorite(userId, track, true)) throw new Error('favorites');
  if (history.length) {
    const rows = [...new Map(history.map(track => [track.id, track])).values()].map((track, index) => ({
      user_id: userId, track_id: track.id, track_data: track, played_at: new Date(946684800000 - index * 1000).toISOString(),
    }));
    const { error } = await db.from('listening_history').upsert(rows, { onConflict: 'user_id,track_id', ignoreDuplicates: true });
    if (error) throw error;
  }
  for (const playlist of playlists) {
    if (!playlist.title.trim()) continue;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId + '/' + playlist.id)));
    digest[6] = (digest[6] & 15) | 64;
    digest[8] = (digest[8] & 63) | 128;
    const hex = Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
    const id = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
    const { error } = await db.from('user_playlists').upsert({ id, user_id: userId, title: playlist.title.trim().slice(0, 80) }, { ignoreDuplicates: true });
    if (error) throw error;
    const tracks = playlist.tracks.map(asTrack).filter((track): track is Track => track !== null);
    if (!await addTracksToPlaylist(userId, id, [...new Map(tracks.map(track => [track.id, track])).values()], 0)) throw new Error('playlist');
  }
  localStorage.setItem('ritm_imported_' + userId, '1');
}
