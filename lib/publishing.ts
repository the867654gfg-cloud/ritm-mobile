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

export async function publishTrack(userId: string, id: string, fields: TrackFields, audio: Blob, cover?: Blob) {
  if (!supabase) throw new Error('Сервис загрузки недоступен.');
  const tracks = supabase.from('tracks');
  const { data: existing, error: lookupError } = await tracks.select('id').eq('id', id).eq('user_id', userId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;
  const storage = supabase.storage.from('music-storage');
  const audioPath = userId + '/' + id + '/audio';
  const coverPath = userId + '/' + id + '/cover';
  async function upload(path: string, file: Blob) {
    const { error } = await storage.upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return storage.getPublicUrl(path).data.publicUrl;
  }
  const audioUrl = await upload(audioPath, audio);
  const coverUrl = cover ? await upload(coverPath, cover) : null;
  const { error } = await tracks.insert({
    ...fields, id, user_id: userId, audio_url: audioUrl, cover_url: coverUrl, cover_key: null,
  });
  if (error) throw error;
}
