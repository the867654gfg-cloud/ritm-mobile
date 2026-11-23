const english = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const russian = 'ёйцукенгшщзхъфывапролджэячсмитьбю';

export function searchQueries(query: string) {
  const term = query.trim();
  if (!term) return [];
  const hasLatin = /[a-z]/i.test(term);
  const hasCyrillic = /[а-яё]/i.test(term);
  if (hasLatin === hasCyrillic || term.length < 3) return [term];
  const [from, to] = hasLatin ? [english, russian] : [russian, english];
  const corrected = Array.from(term.toLowerCase(), char => to[from.indexOf(char)] ?? char).join('');
  return corrected === term ? [term] : [term, corrected];
}
