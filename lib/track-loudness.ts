import type { Track } from './music-data';
import { packagedMedia } from './stream-media';

export async function trackLoudnessGain(track: Track, signal: AbortSignal) {
  const media = packagedMedia(track);
  if (!media) return undefined;
  try {
    const response = await fetch(new URL('loudness.json', media.manifest).href, { signal });
    if (!response.ok) return undefined;
    const { integrated, truePeak } = await response.json();
    if (!Number.isFinite(integrated) || integrated < -70 || integrated > 0 ||
        !Number.isFinite(truePeak) || truePeak < -100 || truePeak > 9) return undefined;
    const adjustment = Math.min(0, -16 - integrated, -1.5 - truePeak);
    return 10 ** (Math.max(-12, adjustment) / 20);
  } catch {
    return undefined;
  }
}
