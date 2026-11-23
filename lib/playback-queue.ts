import type { Track } from './music-data';

export function insertInQueue(queue: Track[], track: Track, next: boolean) {
  const remaining = queue.filter(item => item.id !== track.id);
  return next ? [track, ...remaining] : [...remaining, track];
}

export function moveQueueTrack(queue: Track[], from: number, to: number) {
  if (from < 0 || from >= queue.length || to < 0 || to >= queue.length || from === to) return queue;
  const ordered = [...queue];
  const [track] = ordered.splice(from, 1);
  ordered.splice(to, 0, track);
  return ordered;
}
