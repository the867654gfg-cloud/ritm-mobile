import type { ImageSourcePropType } from "react-native";

export type Track = {
  id: string;
  title: string;
  duration: number;
  genre: string;
  artist?: string;
  album?: string | null;
  version_kind?: import('./catalog-search').TrackVersion | null;
  /** Готовая ссылка на аудио (Audius или путь в Supabase Storage) */
  url?: string;
  /** Ссылка на аудио из таблицы tracks */
  audio_url?: string;
  cover_key?: string | null;
  cover_url?: string | null;
  /** id трека на Audius, нужен для запасного хоста */
  raw_id?: string | number;
  artist_id?: string;
  user_id?: string | null;
  created_at?: string;
  description?: string;
  published_at?: string;
  play_count?: number;
  is_demo?: boolean;
  source_url?: string | null;
  sort_order?: number;
};

export type Artist = {
  id: string;
  name: string;
  bio: string;
  image_key: string;
};

const COVERS: ImageSourcePropType[] = [
  { uri: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80" },
  { uri: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80" },
  { uri: "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=400&q=80" },
  { uri: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80" },
  { uri: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80" },
  { uri: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=400&q=80" },
  { uri: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=400&q=80" },
  { uri: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80" },
  { uri: "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=400&q=80" },
  { uri: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80" },
];

export const coverFor = (item?: Track | string | null): ImageSourcePropType => {
  if (typeof item === 'object' && item?.cover_url) {
    return { uri: item.cover_url };
  }
  if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
    return { uri: item };
  }

  const str = typeof item === 'object' ? item?.id || item?.title || '' : item || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COVERS.length;
  return COVERS[index];
};

export const time = (seconds: number) => {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
};
