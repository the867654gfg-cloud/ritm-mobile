import { supabase } from './supabase';
import type { TrackVersion } from './catalog-search';

export type TrackFields = {
  title: string;
  artist: string;
  album: string;
  genre: string;
  description: string;
  duration: number;
  version_kind: TrackVersion | null;
};

export async function publishTrack(userId: string, id: string, fields: TrackFields, audio: Blob, cover?: Blob, sharedCover?: string) {
  if (!supabase) throw new Error('Сервис загрузки недоступен.');
  const tracks = supabase.from('tracks');
  const { data: existing, error: lookupError } = await tracks.select('audio_url, cover_url').eq('id', id).eq('user_id', userId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { url: existing.audio_url as string, cover_url: existing.cover_url as string | null };
  const storage = supabase.storage.from('music-storage');
  const audioPath = userId + '/' + id + '/audio';
  const coverPath = userId + '/' + id + '/cover';
  async function upload(path: string, file: Blob) {
    const { error } = await storage.upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return storage.getPublicUrl(path).data.publicUrl;
  }
  const audioUrl = await upload(audioPath, audio);
  const coverUrl = sharedCover || (cover ? await upload(coverPath, cover) : null);
  const { error } = await tracks.insert({
    ...fields, id, user_id: userId, audio_url: audioUrl, cover_url: coverUrl, cover_key: null,
  });
  if (error) throw error;
  return { url: audioUrl, cover_url: coverUrl };
}

export async function uploadPlaylistCover(userId: string, playlistId: string, fileId: string, jpeg: Blob) {
  if (!supabase) throw new Error('Хранилище недоступно.');
  const bucket = supabase.storage.from('music-storage');
  const path = userId + '/playlist-covers/' + playlistId + '/' + fileId + '.jpg';
  const { error } = await bucket.upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}
