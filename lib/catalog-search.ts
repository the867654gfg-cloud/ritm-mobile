const russian = 'абвгдежзийклмнопрстуфхцчшщъыьэюя';
const roman = 'a b v g d e zh z i y k l m n o p r s t u f kh ts ch sh shch _ y _ e yu ya'.split(' ');
const latinMap = Object.fromEntries([...russian].map((char, i) => [char, roman[i].replace('_', '')]));
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const latin = (value: string) => normalize(value).replace(/[а-я]/g, letter => latinMap[letter] ?? letter);
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
