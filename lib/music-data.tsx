export type Track = {
  id: string;
  title: string;
  audio_url: string;
  cover_url?: string;
  genre?: string;
  duration?: number;
};

export type Artist = {
  id: string;
  name: string;
  bio?: string;
  avatar_url?: string;
};

export function time(sec?: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function coverFor(track: Track | null): any {
  if (track?.cover_url && track.cover_url.startsWith('data:')) {
    return { uri: track.cover_url };
  }
  if (track?.cover_url && track.cover_url.startsWith('http')) {
    return { uri: track.cover_url };
  }
  return { uri: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80' };
}
