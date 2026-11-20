const russian = 'абвгдежзийклмнопрстуфхцчшщъыьэюя';
const roman = 'a b v g d e zh z i y k l m n o p r s t u f kh ts ch sh shch _ y _ e yu ya'.split(' ');
const latinMap = Object.fromEntries([...russian].map((char, i) => [char, roman[i].replace('_', '')]));
const cyrillicMap = Object.fromEntries(roman.map((part, i) => [part, russian[i]]));
Object.assign(cyrillicMap, { c: 'к', h: 'х', j: 'й', q: 'к', w: 'в', x: 'кс', sch: 'щ', yo: 'ё', ye: 'е' });
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const latin = (value: string) => normalize(value).replace(/[а-я]/g, letter => latinMap[letter] ?? letter);
const cyrillic = (value: string) => normalize(value).replace(/shch|sch|zh|kh|ts|ch|sh|yu|ya|yo|ye|[a-z]/g, part => cyrillicMap[part] ?? part);
const alternateVersion = /\b(?:remix|cover|slowed|sped up|karaoke|instrumental|tribute|live|edit|rmx)\b|ремикс|кавер|караоке|концерт/iu;

export function searchScore(query: string, title: string, artist = '') {
  const wanted = latin(query);
  if (!wanted) return 0;
  const song = latin(title);
  const performer = latin(artist);
  const combined = [performer, song].filter(Boolean).join(' ');
  const penalty = alternateVersion.test(title) && !alternateVersion.test(query) ? 12 : 0;
  if (wanted === song || wanted === combined || wanted === [song, performer].filter(Boolean).join(' ')) return 100 - penalty;
  if (wanted === performer) return 76 - penalty;
  const terms = [...new Set(wanted.split(' '))];
  const words = new Set(combined.split(' '));
  const matches = terms.filter(word => words.has(word)).length;
  if (matches === terms.length) return 65 + (combined.includes(wanted) ? 7 : 0) - penalty;
  return Math.max(0, 40 * matches / terms.length - penalty);
}

export type ExternalTrack = { id: number; title: string; artist: string; album: string; url: string };
type AppleSong = {
  kind?: string; trackId?: number; trackName?: string; artistName?: string; collectionName?: string; trackViewUrl?: string;
};
const recent = new Map<string, { expires: number; rows: ExternalTrack[] }>();
let nextRequestAt = 0;

function cleanAppleSong(song: AppleSong): ExternalTrack | null {
  if (song.kind !== 'song' || !song.trackId || typeof song.trackName !== 'string' || typeof song.artistName !== 'string' ||
      typeof song.trackViewUrl !== 'string') return null;
  try {
    const url = new URL(song.trackViewUrl);
    if (url.protocol !== 'https:' || !['music.apple.com', 'itunes.apple.com'].includes(url.hostname) || url.username || url.password) return null;
    return { id: song.trackId, title: song.trackName, artist: song.artistName, album: song.collectionName ?? '', url: url.href };
  } catch { return null; }
}

async function fetchStore(term: string, country: 'ru' | 'us', signal: AbortSignal): Promise<ExternalTrack[]> {
  const cacheKey = country + ':' + normalize(term);
  const cached = recent.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.rows;
  const now = Date.now();
  const slot = Math.max(now, nextRequestAt);
  nextRequestAt = slot + 3200;
  if (slot > now) await new Promise<void>(resolve => setTimeout(resolve, slot - now));
  if (signal.aborted) throw new Error('cancelled');
  const url = new URL('https://itunes.apple.com/search');
  url.search = new URLSearchParams({ term, country, media: 'music', entity: 'song', limit: '28' }).toString();
  const response = await fetch(url.href, { signal });
  if (!response.ok) throw new Error('Apple Music: ' + response.status);
  const data: { results?: AppleSong[] } = await response.json();
  const rows = (data.results ?? []).map(cleanAppleSong).filter((song): song is ExternalTrack => song !== null);
  const oldest = recent.keys().next().value;
  if (recent.size >= 40 && oldest) recent.delete(oldest);
  recent.set(cacheKey, { rows, expires: Date.now() + 10 * 60 * 1000 });
  return rows;
}

export async function searchExternalCatalog(query: string, signal: AbortSignal) {
  const isRussian = /[а-яё]/i.test(query);
  const first = await fetchStore(query, isRussian ? 'ru' : 'us', signal);
  let candidates = first;
  if (!first.some(song => searchScore(query, song.title, song.artist) >= 65)) {
    const alternate = isRussian ? latin(query) : cyrillic(query);
    if (alternate && alternate !== normalize(query)) {
      try { candidates = [...first, ...await fetchStore(alternate, isRussian ? 'us' : 'ru', signal)]; }
      catch (error) { if (!first.length) throw error; }
    }
  }
  const ordered = candidates.map(song => ({ song, score: searchScore(query, song.title, song.artist) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return ordered.filter(({ song }) => {
    const identity = latin(song.artist) + ':' + latin(song.title);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).slice(0, 10).map(({ song }) => song);
}
