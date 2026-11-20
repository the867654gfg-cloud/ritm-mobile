import type { Track } from './music-data';

export type MusicTags = { bpm?: number; key?: string };

const major = ['B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E'];
const minor = ['G#', 'D#', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const notes: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function wheel(value?: string) {
  const key = value?.trim().replaceAll('♯', '#').replaceAll('♭', 'b')
    .replace(/\s+flat\b/i, 'b').replace(/\s+sharp\b/i, '#') ?? '';
  const direct = key.match(/^(1[0-2]|[1-9])\s*([AB])$/i);
  if (direct) return { number: Number(direct[1]), minor: direct[2].toUpperCase() === 'A' };
  const match = key.match(/^([A-G][#b]?)\s*(maj(?:or)?|min(?:or)?|m)?$/i);
  if (!match) return;
  const [, note, mode] = match;
  const isMinor = Boolean(mode && !mode.toLowerCase().startsWith('maj'));
  const pitch = (name: string) => (notes[name[0].toUpperCase()] + (name[1] === '#' ? 1 : name[1]?.toLowerCase() === 'b' ? -1 : 0) + 12) % 12;
  return { number: (isMinor ? minor : major).findIndex(name => pitch(name) === pitch(note)) + 1, minor: isMinor };
}

export function harmonicMatches(track: Track, candidates: Track[], tags: (track: Track) => MusicTags) {
  const source = tags(track);
  const origin = wheel(source.key);
  const sourceBpm = source.bpm;
  if (!sourceBpm || sourceBpm <= 0 || !origin) return [];
  return candidates.flatMap(candidate => {
    if (candidate.id === track.id) return [];
    const { bpm, key } = tags(candidate);
    const target = wheel(key);
    if (!bpm || bpm <= 0 || !target) return [];
    const difference = Math.abs(origin.number - target.number);
    if (!(difference === 0 || (origin.minor === target.minor && (difference === 1 || difference === 11)))) return [];
    const tempo = Math.min(...[bpm, bpm * 2, bpm / 2].map(value => Math.abs(value / sourceBpm - 1)));
    return tempo <= 0.10 ? [{ track: candidate, bpm, key, score: tempo + (difference ? 0.02 : 0) }] : [];
  }).sort((a, b) => a.score - b.score).slice(0, 5);
}
