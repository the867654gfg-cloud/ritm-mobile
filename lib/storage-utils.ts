// Чистые функции для работы со ссылками на файлы в Supabase Storage (без зависимостей, легко тестировать).

/**
 * Достаёт путь файла в бакете из публичной ссылки.
 * https://xxx.supabase.co/storage/v1/object/public/music-storage/<uid>/a.mp3  ->  "<uid>/a.mp3"
 * Для чужих ссылок (например, с Audius) и пустых значений возвращает null.
 */
export function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const raw = url.slice(at + marker.length).split('?')[0].split('#')[0];
  try {
    const path = decodeURIComponent(raw);
    return path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

/** Пути всех файлов трека (аудио и обложка) без повторов */
export function trackFilePaths(
  rows: { audio_url?: string | null; cover_url?: string | null }[],
  bucket: string
): string[] {
  const paths = new Set<string>();
  for (const row of rows) {
    for (const url of [row.audio_url, row.cover_url]) {
      const p = storagePathFromPublicUrl(url, bucket);
      if (p) paths.add(p);
    }
  }
  return [...paths];
}
