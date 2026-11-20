import { splitTrackTitle } from './catalog-search';

export async function audioTags(file: Blob, filename: string) {
  const fallback = splitTrackTitle(filename.replace(/\.[^.]+$/, ''));
  try {
    const { parseBlob } = await import('music-metadata');
    const { common, format } = await parseBlob(file, { duration: false, skipCovers: true });
    return {
      title: (common.title?.trim() || fallback.title || 'Без названия').slice(0, 150),
      artist: (common.artist?.trim() || fallback.artist).slice(0, 100),
      album: (common.album?.trim() || '').slice(0, 150),
      genre: (common.genre?.find(genre => genre.trim())?.trim() || '').slice(0, 80),
      duration: Number.isFinite(format.duration) ? Math.round(format.duration!) : 0,
    };
  } catch {
    return { title: (fallback.title || 'Без названия').slice(0, 150), artist: fallback.artist.slice(0, 100), album: '', genre: '', duration: 0 };
  }
}
