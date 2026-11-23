type Candidate = { id: string; genre?: string | null; play_count?: number; published_at?: string | null; created_at?: string | null };

export function forYou<T extends Candidate>(catalog: T[], favorites: T[], engagement: Record<string, number>, hidden: string[]) {
  const genres = new Map<string, number>();
  const favoriteIds = new Set(favorites.map(track => track.id));
  const excluded = new Set(hidden);
  for (const track of favorites) {
    const genre = track.genre?.trim().toLowerCase();
    if (genre) genres.set(genre, (genres.get(genre) ?? 0) + 1);
  }
  const now = Date.now();
  return catalog.flatMap((track, index) => {
    if (favoriteIds.has(track.id) || excluded.has(track.id)) return [];
    const genre = track.genre?.trim().toLowerCase() ?? '';
    const date = Date.parse(track.published_at ?? track.created_at ?? '');
    const freshness = Number.isFinite(date) ? Math.exp(-Math.max(0, now - date) / (45 * 86_400_000)) : 0;
    const score = 6 * Math.log1p(genres.get(genre) ?? 0) + 2 * (engagement[track.id] ?? 0)
      + 2 * freshness + Math.log1p(Math.max(0, track.play_count ?? 0)) / 2 + 3 / (1 + index);
    return [{ track, score }];
  }).sort((a, b) => b.score - a.score).slice(0, 24).map(item => item.track);
}
