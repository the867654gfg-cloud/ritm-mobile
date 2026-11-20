// Логика поиска «лишних» файлов. Вынесена отдельно, чтобы её можно было проверить тестами без доступа к Supabase.

// Копия lib/storage-utils.ts (скрипт на чистом JS и не может импортировать TypeScript)
export function storagePathFromPublicUrl(url, bucket) {
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

/**
 * files:     [{ name, size, created_at, updated_at }]   все файлы бакета
 * trackRows: [{ audio_url, cover_url }]                  все записи таблицы tracks
 *
 * Лишним считается файл, на который не ссылается ни один трек. Свежие файлы (моложе minAgeHours)
 * и файлы без даты не трогаем: пока трек загружается, файл уже лежит в хранилище, а записи ещё нет.
 */
export function findOrphans(files, trackRows, { now = Date.now(), minAgeHours = 24, bucket = 'music-storage' } = {}) {
  const used = new Set();
  for (const row of trackRows) {
    for (const url of [row.audio_url, row.cover_url]) {
      const p = storagePathFromPublicUrl(url, bucket);
      if (p) used.add(p);
    }
  }

  const orphans = [];
  const skippedRecent = [];
  let usedCount = 0;
  for (const f of files) {
    if (used.has(f.name)) { usedCount++; continue; }
    const ts = Date.parse(f.updated_at || f.created_at || '');
    if (Number.isNaN(ts) || now - ts < minAgeHours * 3600 * 1000) skippedRecent.push(f);
    else orphans.push(f);
  }
  return { orphans, skippedRecent, usedCount };
}

export const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
