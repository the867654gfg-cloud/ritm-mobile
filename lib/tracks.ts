import { supabase } from './supabase';
import { trackFilePaths } from './storage-utils';

const BUCKET = 'music-storage';

export type DeleteTracksResult = {
  /** id треков, которые реально удалены из базы */
  deletedIds: string[];
  /** id треков, которые удалить не удалось (например, чужие) */
  failedIds: string[];
  /** сколько файлов убрано из хранилища */
  filesRemoved: number;
  /** true, если часть файлов осталась в хранилище */
  filesLeft: boolean;
};

/**
 * Удаляет треки вместе с их файлами. Раньше удалялась только запись в базе, а аудио и обложка
 * оставались в хранилище и занимали место.
 *
 * Порядок важен: сначала файлы, потом запись. Право удалить файл проверяется по записи трека
 * (владелец трека может удалить его файлы), поэтому после удаления записи файл удалить уже нельзя.
 */
export async function deleteTracksWithFiles(ids: string[]): Promise<DeleteTracksResult> {
  const result: DeleteTracksResult = { deletedIds: [], failedIds: [...ids], filesRemoved: 0, filesLeft: false };
  if (!supabase || ids.length === 0) return result;

  try {
    // 1. Какие файлы принадлежат этим трекам
    const { data: rows } = await supabase.from('tracks').select('audio_url, cover_url').in('id', ids);
    const paths = trackFilePaths(rows ?? [], BUCKET);

    // 2. Удаляем файлы. Storage не сообщает об ошибке, если прав нет, а просто возвращает меньше файлов, чем просили
    if (paths.length > 0) {
      const { data: removed, error } = await supabase.storage.from(BUCKET).remove(paths);
      result.filesRemoved = removed?.length ?? 0;
      result.filesLeft = !!error || result.filesRemoved < paths.length;
    }

    // 3. Удаляем записи. select('id') возвращает только то, что реально удалено (чужие треки защита не пропустит)
    const { data: deleted, error: dbError } = await supabase.from('tracks').delete().in('id', ids).select('id');
    if (!dbError && deleted) {
      result.deletedIds = deleted.map((r: { id: string }) => r.id);
      result.failedIds = ids.filter((id) => !result.deletedIds.includes(id));
    }
  } catch (e) {
    console.warn('Не удалось удалить треки', e);
  }
  return result;
}
