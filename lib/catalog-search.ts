const russian = 'абвгдежзийклмнопрстуфхцчшщъыьэюя';
const roman = 'a b v g d e zh z i y k l m n o p r s t u f kh ts ch sh shch _ y _ e yu ya'.split(' ');
const latinMap = Object.fromEntries([...russian].map((char, i) => [char, roman[i].replace('_', '')]));
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const latin = (value: string) => normalize(value).replace(/[а-я]/g, letter => latinMap[letter] ?? letter);
const alternateVersion = /\b(?:remix|cover|slowed|sped up|karaoke|instrumental|tribute|live|edit|rmx)\b|ремикс|кавер|караоке|концерт/iu;

export const TRACK_VERSIONS = { original: 'Оригинал', remix: 'Ремикс', cover: 'Кавер', other: 'Другая версия' } as const;
export type TrackVersion = keyof typeof TRACK_VERSIONS;

export function trackVersion(title: string, version?: TrackVersion | null): TrackVersion {
  if (version) return version;
  if (/\b(?:cover|tribute)\b|кавер/iu.test(title)) return 'cover';
  if (/\b(?:remix|rmx|rework|mashup)\b|ремикс/iu.test(title)) return 'remix';
  if (alternateVersion.test(title)) return 'other';
  return 'original';
}

export function splitTrackTitle(value: string) {
  const left = value.replace(/^\s*\d{1,4}[.)]\s+/, '').trim();
  const match = /^(.+?)\s+[-–—]\s+(.+)$/.exec(left);
  return match ? { artist: match[1].trim(), title: match[2].trim() } : { title: left, artist: '' };
}

function nearby(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return false;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  let before = row;
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) next[j] = Math.min(next[j], before[j - 2] + 1);
    }
    before = row;
    row = next;
  }
  return row[b.length] <= limit;
}

export function searchScore(query: string, title: string, artist = '', album = '', version?: TrackVersion | null) {
  const wanted = latin(query);
  if (!wanted) return 0;
  const parsed = splitTrackTitle(title);
  const song = latin(artist ? title : parsed.title);
  const performer = latin(artist || parsed.artist);
  const combined = [performer, song].filter(Boolean).join(' ');
  const penalty = trackVersion(title, version) !== 'original' && !alternateVersion.test(query) ? 12 : 0;
  if (wanted === song || wanted === combined || wanted === [song, performer].filter(Boolean).join(' ')) return 100 - penalty;
  if (wanted === performer) return 76 - penalty;
  const terms = [...new Set(wanted.split(' '))];
  if (wanted === latin(album)) return 70 - penalty;
  const words = [...new Set([combined, latin(album)].join(' ').split(' '))].filter(Boolean);
  const scores = terms.map(word => {
    if (words.includes(word)) return 1;
    if (word.length >= 3 && words.some(candidate => candidate.startsWith(word))) return 0.8;
    if (word.length >= 4 && words.some(candidate => nearby(word, candidate, word.length >= 8 ? 2 : 1))) return 0.6;
    return 0;
  });
  if (scores.some(score => score === 0)) return 0;
  return 40 + 35 * scores.reduce<number>((sum, score) => sum + score, 0) / terms.length - penalty;
}
