import { supabase } from './supabase';
import { storagePathFromPublicUrl } from './storage-utils';

const BUCKET = 'music-storage';

export type DeleteTracksResult = { deletedIds: string[]; failedIds: string[]; filesLeft: boolean };

export async function deleteTracksWithFiles(userId: string, ids: string[]): Promise<DeleteTracksResult> {
  const result: DeleteTracksResult = { deletedIds: [], failedIds: [], filesLeft: false };
  const db = supabase;
  const uniqueIds = [...new Set(ids)];
  if (!db) return { ...result, failedIds: uniqueIds };
  for (let i = 0; i < uniqueIds.length; i += 50) {
    const batch = uniqueIds.slice(i, i + 50);
    const { data: rows, error } = await db.from('tracks').select('id, audio_url, cover_url, cover_key')
      .eq('user_id', userId).in('id', batch);
    if (error) continue;

    const deleteRows = (keys: string[]) => db.from('tracks').delete().eq('user_id', userId).in('id', keys).select('id');
    const deletion = await deleteRows(batch);
    const deleted = new Set<string>(deletion.data?.map(row => row.id) ?? []);
    if (deletion.error) {
      for (const row of rows ?? []) {
        const single = await deleteRows([row.id]);
        if (single.data?.length) deleted.add(row.id);
      }
    }
    result.deletedIds.push(...deleted);

    const paths = new Set<string>();
    for (const row of rows ?? []) {
      if (!deleted.has(row.id)) continue;
      for (const url of [row.audio_url, row.cover_url, row.cover_key]) {
        const path = storagePathFromPublicUrl(url, BUCKET);
        if (!path) continue;
        // A legacy path may also be used by another recording. The track's own directory is safe to clean.
        if (path.startsWith(userId + '/' + row.id + '/')) paths.add(path);
        else if (!path.startsWith(userId + '/playlist-covers/')) result.filesLeft = true;
      }
    }
    if (paths.size) {
      const { error: storageError } = await db.storage.from(BUCKET).remove([...paths]);
      if (storageError) result.filesLeft = true;
    }
  }
  const removed = new Set(result.deletedIds);
  result.failedIds = uniqueIds.filter(id => !removed.has(id));
  return result;
}
