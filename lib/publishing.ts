import { supabase } from './supabase';

export type Draft = {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  genre: string;
  description: string;
  duration: number;
  audio_path: string;
  cover_path: string | null;
};

const PRIVATE = 'ritm-drafts';
const PUBLIC = 'music-storage';

export async function saveDraft(userId: string, fields: Pick<Draft, 'title' | 'artist' | 'genre' | 'description' | 'duration'>, audio: Blob, cover?: Blob) {
  if (!supabase) throw new Error('Сервис загрузки недоступен.');
  const db = supabase;
  const id = crypto.randomUUID();
  const audioPath = userId + '/' + id + '/audio';
  const coverPath = cover ? userId + '/' + id + '/cover' : null;
  const stored: string[] = [];
  const storage = db.storage.from(PRIVATE);
  try {
    for (const [path, file] of [[audioPath, audio], [coverPath, cover]] as const) {
      if (!path || !file) continue;
      const { error } = await storage.upload(path, file, { contentType: file.type });
      if (error) throw error;
      stored.push(path);
    }
    const draft: Draft = { ...fields, id, user_id: userId, audio_path: audioPath, cover_path: coverPath };
    const { error } = await db.from('ritm_drafts').insert(draft);
    if (error) throw error;
    return draft;
  } catch (error) {
    if (stored.length) await storage.remove(stored);
    throw error;
  }
}

export async function publishDraft(draft: Draft) {
  if (!supabase) throw new Error('Сервис загрузки недоступен.');
  const { data: existing, error: lookupError } = await supabase.from('tracks').select('id').eq('id', draft.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;
  const paths = [draft.audio_path, draft.cover_path];
  const storage = supabase.storage.from(PUBLIC);
  const urls: (string | null)[] = [];
  for (const path of paths) {
    if (!path) { urls.push(null); continue; }
    const { data, error } = await supabase.storage.from(PRIVATE).download(path);
    if (error) throw error;
    const uploaded = await storage.upload(path, data, { upsert: true, contentType: data.type });
    if (uploaded.error) throw uploaded.error;
    urls.push(storage.getPublicUrl(path).data.publicUrl);
  }
  const { error } = await supabase.from('tracks').insert({
    id: draft.id, user_id: draft.user_id, title: draft.title, artist: draft.artist, genre: draft.genre,
    description: draft.description, duration: draft.duration, audio_url: urls[0], cover_url: urls[1], cover_key: null,
  });
  if (error && error.code !== '23505') throw error;
}

export async function discardDraft(draft: Draft) {
  if (!supabase) throw new Error('Сервис загрузки недоступен.');
  const { error } = await supabase.from('ritm_drafts').delete().eq('id', draft.id);
  if (error) throw error;
  await supabase.storage.from(PRIVATE).remove([draft.audio_path, ...(draft.cover_path ? [draft.cover_path] : [])]);
}
