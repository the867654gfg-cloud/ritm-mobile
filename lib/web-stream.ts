import Hls from 'hls.js';
import type { Track } from './music-data';
import { packagedMedia } from './stream-media';

const sessions = new WeakMap<HTMLAudioElement, { dispose: () => void }>();
const warm = new Map<string, number>();
let warming = 0;

export function detachStream(audio: HTMLAudioElement) {
  sessions.get(audio)?.dispose();
  sessions.delete(audio);
}

export function useTrackStream(audio: HTMLAudioElement, track: Track, direct: string): boolean {
  detachStream(audio);
  const media = packagedMedia(track);
  if (!media || !navigator.onLine) {
    audio.src = direct;
    return false;
  }
  if (audio.canPlayType('application/vnd.apple.mpegurl')) {
    audio.src = media.manifest;
    return true;
  }
  if (!Hls.isSupported()) {
    audio.src = direct;
    return false;
  }
  const hls = new Hls({
    startLevel: 0, maxBufferLength: 16, maxMaxBufferLength: 32,
    manifestLoadPolicy: { default: {
      maxTimeToFirstByteMs: 3000, maxLoadTimeMs: 4500, timeoutRetry: null, errorRetry: null,
    } },
  });
  sessions.set(audio, { dispose: () => hls.destroy() });
  hls.on(Hls.Events.ERROR, (_, error) => {
    if (!error.fatal) return;
    const playing = !audio.paused;
    const time = audio.currentTime;
    detachStream(audio);
    audio.src = direct;
    if (time > 0) audio.addEventListener('loadedmetadata', () => {
      if (audio.getAttribute('src') === direct && time < audio.duration) audio.currentTime = time;
    }, { once: true });
    if (playing) void audio.play().catch(() => {});
  });
  hls.attachMedia(audio);
  hls.loadSource(media.manifest);
  return true;
}

async function playlist(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Playlist unavailable');
  const body = await response.text();
  if (!body.startsWith('#EXTM3U')) throw new Error('Invalid playlist');
  return body;
}

export function warmTrack(track: Track, seconds = 8) {
  const media = packagedMedia(track);
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!media || !navigator.onLine || document.hidden || connection?.saveData ||
      connection?.effectiveType?.includes('2g') || warming >= 2 ||
      (warm.get(media.manifest) ?? 0) > Date.now()) return;
  while (warm.size >= 64) warm.delete(warm.keys().next().value!);
  warm.set(media.manifest, Date.now() + 60_000);
  warming++;
  const signal = AbortSignal.timeout(12_000);
  void (async () => {
    const master = await playlist(media.manifest, signal);
    const entry = master.split(/\r?\n/).find(line => line && !line.startsWith('#'));
    if (!entry) return;
    const variant = new URL(entry, media.manifest).href;
    const body = await playlist(variant, signal);
    const init = body.match(/#EXT-X-MAP:URI="([^"]+)"/)?.[1];
    const segments = [...body.matchAll(/#EXTINF:([\d.]+),[^\n]*\n([^\r\n]+)/g)];
    const files = init ? [init] : [];
    let total = 0;
    for (const [, duration, name] of segments) {
      files.push(name);
      total += Number(duration);
      if (total >= seconds || files.length >= 5) break;
    }
    for (const file of files) {
      const response = await fetch(new URL(file, variant), { signal, cache: 'force-cache' });
      if (!response.ok) throw new Error('Segment unavailable');
      await response.arrayBuffer();
    }
  })().catch(() => {}).finally(() => { warming--; });
}
