import type { Track } from './music-data';

// Only audio hosted by Ritm is eligible for repackaging.
export function packagedMedia(track: Track) {
  const base = process.env.EXPO_PUBLIC_RITM_MEDIA_URL?.replace(/\/+$/, '');
  if (!base || !/^https:\/\//i.test(base) ||
      !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(track.id) ||
      !/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/music-storage\/[^?#]+$/i.test(track.url || '')) return;
  const path = base + '/' + track.id;
  return { manifest: path + '/index.m3u8', offline: (quality: DownloadQuality) => path + '/' + (quality === 'lossless' ? 'lossless.flac' : quality + '.m4a') };
}

export const DOWNLOAD_QUALITIES = ['96', '160', '320'] as const;
export type DownloadQuality = typeof DOWNLOAD_QUALITIES[number] | 'lossless';

export async function hasLosslessDownload(track: Track, signal: AbortSignal) {
  const media = packagedMedia(track);
  if (!media) return false;
  try {
    const response = await fetch(media.offline('lossless'), { method: 'HEAD', signal });
    return response.ok && /^(audio\/|application\/octet-stream)/i.test(response.headers.get('content-type') || '');
  } catch { return false; }
}
