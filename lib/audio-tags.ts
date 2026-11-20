import { splitTrackTitle } from './catalog-search';
import { getWebFileContentType } from './track-cover';

export async function audioTags(file: Blob, filename: string) {
  const fallback = splitTrackTitle(filename.replace(/\.[^.]+$/, ''));
  try {
    const { parseBlob } = await import('music-metadata');
    const { common, format } = await parseBlob(file, { duration: false });
    let cover: Blob | undefined;
    const pictures = common.picture ?? [];
    const front = pictures.find(picture => /front/i.test(picture.type || ''));
    for (const picture of front ? [front, ...pictures.filter(picture => picture !== front)] : pictures) {
      const type = picture.format.toLowerCase().replace(/^image\/jpg$/, 'image/jpeg');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(type) || picture.data.byteLength > 5 * 1024 * 1024) continue;
      const blob = new Blob([Uint8Array.from(picture.data)], { type });
      try { await getWebFileContentType(blob); cover = blob; break; } catch {}
    }
    return {
      title: (common.title?.trim() || fallback.title || 'Без названия').slice(0, 150),
      artist: (common.artist?.trim() || fallback.artist).slice(0, 100),
      album: (common.album?.trim() || '').slice(0, 150),
      genre: (common.genre?.find(genre => genre.trim())?.trim() || '').slice(0, 80),
      duration: Number.isFinite(format.duration) ? Math.round(format.duration!) : 0,
      cover,
    };
  } catch {
    return { title: (fallback.title || 'Без названия').slice(0, 150), artist: fallback.artist.slice(0, 100), album: '', genre: '', duration: 0 };
  }
}
