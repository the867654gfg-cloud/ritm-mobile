import { readableTrackText } from '../../lib/track-text';
import { DragRow, moved } from '../../components/DragRow';
import { UploadForm } from '../../components/UploadForm';
import { RememberedScroll } from '../../components/RememberedScroll';
import { harmonicMatches, type MusicTags } from '../../lib/harmonic';
import { PlaybackClock, createPlaybackClock } from '../../components/PlaybackClock';
import { createContext, useContext, useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Text, View, Pressable, Image, Modal, TextInput, ScrollView, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useMusic } from '../../lib/music';
import { Track } from '../../lib/music-data';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { AvatarCircle, Field, PrimaryButton } from '../../components/AuthUI';
import { CollectionPanel, EditPlaylist, TrackList } from '../../components/CollectionTools';
import { ArtistPanel } from '../../components/ArtistPanel';
import { EditTrack, ModerationPanel } from '../../components/CatalogTools';
import { searchScore, splitTrackTitle, TRACK_VERSIONS, trackVersion, type TrackVersion } from '../../lib/catalog-search';
import { BatchTrackEditor, type TrackMetadata } from '../../components/BatchTrackEditor';
import { EqualizerPanel } from '../../components/EqualizerPanel';
import { TrackQuality } from '../../components/TrackQuality';
import { FullPlayer } from '../../components/FullPlayer';
import { BrowserAudio, CROSSFADE_OPTIONS } from '../../lib/browser-audio';
import Constants from 'expo-constants';
import { clearOffline, offlineTracks, rememberOffline } from '../../lib/offline';
import { deleteTracksWithFiles, DeleteTracksResult } from '../../lib/tracks';
import { addTracksToPlaylist, createUserPlaylist, hasLegacyLibrary, importLegacyLibrary, loadPlayCounts, loadUserLibrary, qualifyListening, recordListening, setFavorite, UserPlaylist, ListeningTicket } from '../../lib/user-library';

function WebIcon({ name, size = 18, color = '#1c1c1e' }: { name: string; size?: number; color?: string }) {
  const paths: { [key: string]: string } = {
    'shuffle': 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.45 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
    'repeat': 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
    'play-skip-back': 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
    'play': 'M8 5v14l11-7z',
    'pause': 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
    'play-skip-forward': 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
    'heart': 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    'heart-outline': 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
    'options-outline': 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
    'volume-low': 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z',
    'volume-mute': 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
    'close': 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    'close-circle': 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z',
    'ellipsis-vertical': 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
    'add-outline': 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    'trash-outline': 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    'play-circle': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
    'checkmark': 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z'
  };

  const path = paths[name];
  if (!path) {
    return <Text style={{ fontSize: size, color, textAlign: 'center' }}>•</Text>;
  }

  if (Platform.OS === 'web') {
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
        {/* @ts-ignore */}
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block' }}>
          {/* @ts-ignore */}
          <path d={path} />
        </svg>
      </View>
    );
  }

  return <Text style={{ fontSize: size, color, textAlign: 'center' }}>•</Text>;
}

const GENRES = [
  'Все жанры', 'Deep House', 'Chillout', 'Minimal House', 'Pop', 
  'Electronic', 'Lofi', 'Jazz', 'Rap', 'Trap', 'Techno', 'Rock',
  'Blues', 'R&B/Soul', 'House', 'Drum & Bass', 'Dubstep', 'Ambient', 'Reggae', 'Metal', 'Funk'
];

const GENRE_ALIASES: Record<string, string[]> = {
  Rap: ['Hip-Hop/Rap', 'Hip Hop', 'Hip-Hop', 'Хип-хоп', 'Хип хоп', 'Рэп', 'Rap/Rus', 'rusrap', 'Russian Rap'],
  Pop: ['Поп', 'Pop Music'], Rock: ['Рок'], Jazz: ['Джаз'], Electronic: ['Электроника'],
  Lofi: ['Lo-Fi'],
  'Drum & Bass': ['Drum and Bass', 'DnB'],
};

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop';

const AUDIUS_HOSTS = [
  'https://discoveryprovider.audius.co',
  'https://audius-dp.culper.io',
  'https://audius-metadata-5.figment.io'
];

let audiusHostsCache: string[] | null = null;

// Актуальные хосты Audius отдаёт их API. Жёстко зашитый список остаётся запасным.
async function getAudiusHosts(): Promise<string[]> {
  if (audiusHostsCache) return audiusHostsCache;
  let hosts: string[] = AUDIUS_HOSTS;
  try {
    const res = await fetch('https://api.audius.co');
    const json = await res.json();
    const fresh = Array.isArray(json?.data)
      ? json.data.filter((h: any) => typeof h === 'string' && h.startsWith('https://'))
      : [];
    // Перемешиваем, чтобы не нагружать один и тот же узел
    if (fresh.length > 0) hosts = [...fresh].sort(() => Math.random() - 0.5);
  } catch (e) {}
  audiusHostsCache = hosts;
  return hosts;
}

function formatTime(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatDate(value?: string): string {
  if (!value) return 'дата не указана';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'дата не указана' : date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
}

const basePath = (Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/$/, '');
type TrackCards = Record<string, { path: string; thumbnail?: string; music?: MusicTags; cover?: string | null; artist?: string; album?: string; quality?: { format: string; kbps: number } }>;
type PlaybackProgress = { id: string; seconds: number; time: number; position: number; ticket?: ListeningTicket; sending?: boolean };
const TrackCardsContext = createContext<TrackCards>({});
const trackRow = {
  flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 17, marginBottom: 7,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.62)',
} as const;
const trackArtwork = { width: 40, height: 40, borderRadius: 10, marginRight: 12, flexShrink: 0 } as const;

function mapCloudTrack(item: any): Track {
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ewrbxlrenzorutlvdgil.supabase.co';
  let resolvedCover = '';

  if (item.cover_url && typeof item.cover_url === 'string' && item.cover_url.trim().startsWith('http')) {
    resolvedCover = item.cover_url.trim();
  } else if (item.cover_key && typeof item.cover_key === 'string' && item.cover_key.trim().startsWith('http')) {
    resolvedCover = item.cover_key.trim();
  } else if (item.cover_key) {
    const cleanKey = item.cover_key.replace(/^\/+/, '');
    resolvedCover = `${SUPABASE_URL}/storage/v1/object/public/music-storage/${cleanKey}`;
  } else if (item.artwork) {
    resolvedCover = item.artwork;
  }

  let dur = Number(item.duration);
  if (!dur || isNaN(dur) || dur <= 5) dur = 180;

  return {
    id: String(item.id),
    title: readableTrackText(item.title || '') || 'Без названия',
    music: item.music,
    artist: readableTrackText(item.artist || ''),
    album: item.album ? readableTrackText(item.album) : item.album,
    version_kind: item.version_kind,
    genre: readableTrackText(item.genre || ''),
    duration: dur,
    url: item.audio_url || item.url || (/^audius_[A-Za-z0-9]{1,32}$/.test(item.id) ? 'https://api.audius.co/v1/tracks/' + item.id.slice(7) + '/stream?app_name=RITM_APP' : ''),
    cover_url: resolvedCover,
    cover_key: item.cover_key,
    small_cover_url: item.small_cover_url,
    fileDuration: item.fileDuration ?? (Number(item.duration) > 0 ? Number(item.duration) : undefined),
    created_at: item.created_at || item.release_date || item.createdAt,
    published_at: item.published_at || item.release_date,
    user_id: item.user_id,
    description: item.description,
  };
}

function TrackByline({ track, extras = [] }: { track: Track; extras?: string[] }) {
  const cards = useContext(TrackCardsContext);
  const card = cards[track.id];
  const artist = track.artist?.trim() || card?.artist || splitTrackTitle(track.title).artist || 'Исполнитель не указан';
  const album = track.album?.trim() || card?.album;
  return <Text numberOfLines={2} style={{ fontSize: 11, color: '#686871' }}>
    {[artist, album, ...extras].filter(Boolean).join(' · ')}
  </Text>;
}

function TrackCoverImage({ track, style, override }: { track: Track | null; style: any; override?: string }) {
  const cards = useContext(TrackCardsContext);
  const [failedUris, setFailedUris] = useState<string[]>([]);
  const original = track?.cover_url || track?.cover_key || '';
  const repair = track && cards[track.id]?.cover;
  // User replacements use a new owner-scoped URL and should win over the last build's repair.
  const preferred = override || (/\/[^/]+_cover\.jpg(?:\?|$)/.test(original) && repair !== undefined ? (repair || '') : original || repair || '');
  const coverUri = failedUris.includes(preferred) && repair && repair !== preferred ? repair : preferred;
  const hasCover = Boolean(coverUri && !failedUris.includes(coverUri));
  const colors = ['#49265a', '#244855', '#573041', '#293b66', '#49425f'];
  const color = colors[(track?.id.charCodeAt(0) || 0) % colors.length];
  const initial = track?.title.trim().match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? '♪';
  return <View style={[style, { overflow: 'hidden', backgroundColor: hasCover ? '#e5e5ea' : color, justifyContent: 'center', alignItems: 'center' }]}>
    {hasCover
      ? <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" onError={() => setFailedUris(previous => [...previous, coverUri])} />
      : <Text accessibilityLabel="Обложка по умолчанию" style={{ fontSize: typeof style?.width === 'number' && style.width <= 60 ? 17 : 40, fontWeight: '800', color: '#ffffffdd' }}>{initial}</Text>}
  </View>;
}

function mapAudiusTrack(item: any, host: string): Track {
  return { id: 'audius_' + item.id, title: item.title, artist: item.user?.name, genre: readableTrackText(item.genre || ''),
    music: { bpm: Number(item.bpm) || undefined, key: item.musical_key || undefined },
    duration: item.duration || 180, fileDuration: Number(item.duration) || undefined, url: host + '/v1/tracks/' + item.id + '/stream?app_name=RITM_APP',
    raw_id: item.id, small_cover_url: item.artwork?.['150x150'], cover_url: item.artwork?.['480x480'] || item.artwork?.['150x150'],
    published_at: item.release_date, description: item.description };
}

function trackAudioUrl(track: Track) {
  const raw = (track.url || (track as any).audio_url || (track as any).audioUrl || '').trim();
  if (!raw || /^(https?:|blob:)/.test(raw)) return raw;
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ewrbxlrenzorutlvdgil.supabase.co';
  const path = raw.replace(/^\/+/, '');
  return base + '/' + (path.startsWith('storage/v1/object/public/') ? path : 'storage/v1/object/public/music-storage/' + path);
}

type PreparedTransition = {
  audio: HTMLAudioElement;
  track: Track;
  request: number;
  approved: boolean;
  starting: boolean;
};

export default function CatalogRoute() {
  const { user, loading } = useAuth();
  if (loading && (typeof navigator === 'undefined' || navigator.onLine)) return <ActivityIndicator style={{ flex: 1 }} color="#fa233b" />;
  return <CatalogScreen key={user?.id ?? 'guest'} />;
}

function CatalogScreen() {
  let m: any = {};
  try {
    m = useMusic() || {};
  } catch (e) {
    m = {};
  }

  const { user: authUser, profile: authProfile, loading: authLoading, signOut } = useAuth();
  const [trackCards, setTrackCards] = useState<TrackCards>({});
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [batchTracks, setBatchTracks] = useState<Track[] | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  const [authorResults, setAuthorResults] = useState<{ id: string; username: string }[]>([]);
  const [audiusAuthors, setAudiusAuthors] = useState<{ id: string; name: string }[]>([]);
  const [externalArtist, setExternalArtist] = useState<{ name: string; tracks: Track[] } | null>(null);
  const openingArtist = useRef(0);
  const compact = useWindowDimensions().width < 780;
  const [playlistEdit, setPlaylistEdit] = useState<UserPlaylist | null>(null);
  const [playlistAuthorOnly, setPlaylistAuthorOnly] = useState(false);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [reportTrack, setReportTrack] = useState<Track | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [shared, setShared] = useState<{ title: string; tracks: Track[]; cover?: string; description?: string; author_id?: string } | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [offlineList, setOfflineList] = useState(offlineTracks);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const [importing, setImporting] = useState(false);
  const userProfile = {
    isLoggedIn: !!authUser,
    name: authProfile?.username || authUser?.user_metadata?.username || 'Пользователь',
    phoneOrEmail: authUser?.email || '',
    avatarUrl: authProfile?.avatar_url || '',
  };

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEqualizerModal, setShowEqualizerModal] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const returnToFullPlayer = useRef(false);
  const [selectedTrackMenu, setSelectedTrackMenu] = useState<{ track: Track; source: 'network' | 'my_music' | 'uploads' } | null>(null);
  const [selectedTrackDetails, setSelectedTrackDetails] = useState<Track | null>(null);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [selectedPlaylistModal, setSelectedPlaylistModal] = useState<{ id?: string; title: string; tracks: Track[]; cover?: string; description?: string; author_id?: string } | null>(null);
  
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>(() => {
    if (!authUser && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ritm_user_playlists');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [myMusicTracks, setMyMusicTracks] = useState<Track[]>(() => {
    if (!authUser && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ritm_my_music');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.map((t: any) => mapCloudTrack(t));
        }
      } catch (e) {}
    }
    return [];
  });

  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>(() => {
    if (!authUser && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ritm_recently_played');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.map((t: any) => mapCloudTrack(t));
        }
      } catch (e) {}
    }
    return [];
  });

  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [uploadsSort, setUploadsSort] = useState<'number' | 'title' | 'duration'>('number');
  const [myMusicSort, setMyMusicSort] = useState<'number' | 'title' | 'duration'>('number');

  useEffect(() => {
    if (!authUser && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('ritm_user_playlists', JSON.stringify(userPlaylists));
      } catch (e) {}
    }
  }, [userPlaylists]);

  useEffect(() => {
    if (!authUser && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('ritm_my_music', JSON.stringify(myMusicTracks));
      } catch (e) {}
    }
  }, [myMusicTracks]);

  useEffect(() => {
    if (!authUser && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('ritm_recently_played', JSON.stringify(recentlyPlayed));
      } catch (e) {}
    }
  }, [recentlyPlayed]);

  const [searchQuery, setSearchQuery] = useState('');
  const [versionFilter, setVersionFilter] = useState<TrackVersion | null>(null);
  const searchCatalog = useRef<{ tracks: Track[]; expires: number }>();
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string>('Все жанры');

  const [cloudUploadedTracks, setCloudUploadedTracks] = useState<Track[]>([]);
  const [globalSearchResults, setGlobalSearchResults] = useState<Track[]>([]);
  const [hiddenTrackIds, setHiddenTrackIds] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [playCounts, setPlayCounts] = useState<Record<string, { starts: number; listens: number }>>({});

  const listPositions = useRef({ main: { y: 0 }, uploads: { y: 0 }, my_music: { y: 0 } });
  const [updateReady, setUpdateReady] = useState(false);
  const updatePending = useRef(false);
  const [downloadIds, setDownloadIds] = useState<string[]>([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const editingInProgress = useRef(false);
  editingInProgress.current = Boolean(showUploadPanel || editingTrack || batchTracks || playlistEdit || showCreatePlaylistModal || reportTrack);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const current = document.querySelector('meta[name="ritm-version"]')?.getAttribute('content');
    if (!current) return;
    const controller = new AbortController();
    async function check() {
      if (!navigator.onLine || updatePending.current) return;
      try {
        const response = await fetch(basePath + '/version.json?t=' + Date.now(), { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const { version } = await response.json();
        if (typeof version === 'string' && version !== current && !controller.signal.aborted) {
          updatePending.current = true;
          setUpdateReady(true);
        }
      } catch {}
    }
    void check();
    const timer = setInterval(check, 60000);
    window.addEventListener('focus', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); controller.abort(); };
  }, []);
  const [activeTab, setActiveTab] = useState<'main' | 'uploads' | 'my_music'>('main');
  
  const [volume, setVolume] = useState(0.7);
  const [prevVolume, setPrevVolume] = useState(0.7);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [normalization, setNormalization] = useState(() => {
    try { return localStorage.getItem('ritm_normalize_volume') === 'true'; } catch { return false; }
  });
  const [crossfade, setCrossfade] = useState<number>(() => {
    try { return CROSSFADE_OPTIONS.find(value => String(value) === localStorage.getItem('ritm_crossfade_seconds')) ?? 0; }
    catch { return 0; }
  });

  const [clock] = useState(createPlaybackClock);
  const setCurrentTime = clock.write;
  const pendingSeek = useRef<ReturnType<typeof setTimeout>>();
  function cancelPendingSeek() {
    clearTimeout(pendingSeek.current);
    pendingSeek.current = undefined;
  }
  useEffect(() => cancelPendingSeek, []);
  const [trackDuration, setTrackDuration] = useState(0);

  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const spareAudio = useRef<HTMLAudioElement>();
  const mixer = useRef<BrowserAudio>();
  const preparedTransition = useRef<PreparedTransition>();
  const fadingTrack = useRef<{ audio: HTMLAudioElement; timer: ReturnType<typeof setTimeout>; session?: PlaybackProgress }>();
  const playRequest = useRef(0);
  const playingRequest = useRef(0);
  const queuedNext = useRef<Track[]>([]);
  const previousTracks = useRef<Track[]>([]);
  const [nextTracks, setNextTracks] = useState<Track[]>([]);
  const playback = useRef<PlaybackProgress>();
  const playContext = useRef('Слушать');
  const volumeBarContainerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const slider = volumeBarContainerRef.current;
    if (Platform.OS !== 'web' || !slider?.addEventListener) return;
    const adjust = (event: WheelEvent) => {
      if (!event.deltaY || event.ctrlKey) return;
      event.preventDefault();
      setVolume(value => Math.max(0, Math.min(1, Math.round((value - Math.sign(event.deltaY) * 0.05) * 100) / 100)));
    };
    slider.addEventListener('wheel', adjust, { passive: false });
    return () => slider.removeEventListener('wheel', adjust);
  }, [compact]);

  const searchAbortRef = useRef<AbortController | null>(null);


  const loadCloudTracks = useCallback(async () => {
    if (!supabase) return;
    if (!authUser) return;
    try {
      const { data } = await supabase
        .from('tracks')
        .select('*')
        .eq('user_id', authUser.id)
        .not('audio_url', 'is', null)
        .neq('audio_url', '')
        .order('id', { ascending: false });

      if (data) {
        const mapped = data.map((item: any) => mapCloudTrack(item));
        setCloudUploadedTracks(mapped);
      }
    } catch (e) {}
  }, [authUser?.id]);

  useFocusEffect(useCallback(() => {
    if (activeTab === 'uploads') void loadCloudTracks();
  }, [activeTab, loadCloudTracks]));

  const refreshLibrary = async () => {
    if (!authUser) return;
    try {
      const library = await loadUserLibrary(authUser.id);
      setMyMusicTracks(library.favorites);
      setUserPlaylists(library.playlists);
      setRecentlyPlayed(library.history);
    } catch { setNotice('Не удалось загрузить медиатеку. Обновите страницу.'); }
  };

  useEffect(() => {
    let cancelled = false;
    if (!authUser || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    void loadUserLibrary(authUser.id).then(library => {
      if (cancelled) return;
      setMyMusicTracks(library.favorites);
      setUserPlaylists(library.playlists);
      setRecentlyPlayed(library.history);
    }).catch(() => { if (!cancelled) setNotice('Не удалось загрузить медиатеку. Обновите страницу.'); });
    return () => { cancelled = true; };
  }, [authUser?.id]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !supabase) return;
    const db = supabase;
    let active = true;
    void fetch(basePath + '/track-cards.json').then(response => response.ok ? response.json() : {}).then(data => {
      if (active) setTrackCards(data);
    }).catch(() => {});
    const params = new URL(window.location.href).searchParams;
    const author = params.get('artist');
    if (author && /^[\da-f-]{36}$/i.test(author)) setArtistId(author);
    const trackId = params.get('track');
    if (trackId && /^[a-zA-Z0-9_-]{1,150}$/.test(trackId)) void (async () => {
      const status = await db.from('ritm_hidden_tracks').select('track_id').eq('track_id', trackId).maybeSingle();
      let track: Track | undefined;
      if (!status.data && !status.error) {
        if (/^audius_[a-zA-Z0-9]{1,32}$/.test(trackId)) {
          const [host] = await getAudiusHosts();
          const response = await fetch(host + '/v1/tracks/' + trackId.slice(7) + '?app_name=RITM_APP', { signal: AbortSignal.timeout(10000) });
          const item = (response.ok ? await response.json() : null)?.data;
          if (item?.id) track = mapAudiusTrack(item, host);
        } else {
          const result = await db.from('tracks').select('*').eq('id', trackId).maybeSingle();
          if (result.data) track = mapCloudTrack(result.data);
        }
      }
      if (!active) return;
      if (track) setSelectedTrackDetails(track);
      else setNotice('Трек недоступен по этой ссылке.');
    })().catch(() => { if (active) setNotice('Не удалось открыть трек по ссылке.'); });
    const id = params.get('playlist');
    if (id && /^[\da-f-]{36}$/i.test(id)) void db.rpc('ritm_shared_playlist', { link_id: id }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setNotice('Плейлист недоступен по этой ссылке.');
      else setSelectedPlaylistModal({ id: data.id, title: data.title, description: data.description, author_id: data.author_id, cover: data.cover, tracks: data.tracks.map(mapCloudTrack) });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authUser) void supabase?.rpc('ritm_is_moderator').then(({ data }) => setCanModerate(data === true));
  }, [authUser?.id]);

  useEffect(() => {
    if (!selectedTrackDetails || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    let active = true;
    void loadPlayCounts([selectedTrackDetails.id]).then(counts => {
      if (active) setPlayCounts(previous => ({ ...previous, ...counts }));
    }).catch(() => {});
    return () => { active = false; };
  }, [selectedTrackDetails?.id]);

  const fetchRecommendedMusic = async (query: string, genre: string) => {
    const db = supabase;
    if (!db) {
      setSearchError(true);
      return;
    }
    // Отменяем предыдущий запрос: иначе запоздавший ответ на старый запрос перезапишет свежие результаты
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    setSearchError(false);
    let aggregated: Track[] = [];
    let failedSources = 0;

    try {
      const term = query.trim();
      const genreNames = [genre, ...(GENRE_ALIASES[genre] ?? [])];
      const matchesGenre = (value: string) => genre === 'Все жанры' || genreNames.some(name => name.toLowerCase() === value.trim().toLowerCase());
      const match = '%' + term.replace(/[\\%_*]/g, char => '\\' + char) + '%';
      const localCatalog = async () => {
        const cached = searchCatalog.current;
        if (term.length < 2 && cached && cached.expires > Date.now()) return cached.tracks;
        const tracks: Track[] = [];
        const pageSize = 250;
        for (let from = 0; ; from += pageSize) {
          const select = db.from('tracks').select('*').not('audio_url', 'is', null).neq('audio_url', '').order('published_at', { ascending: false, nullsFirst: false }).order('id');
          const { data, error } = await select.range(from, from + pageSize - 1).abortSignal(controller.signal);
          if (error) throw error;
          tracks.push(...(data ?? []).map(mapCloudTrack));
          if (!data || data.length < pageSize) break;
        }
        if (!controller.signal.aborted) searchCatalog.current = { tracks, expires: Date.now() + 120000 };
        return tracks;
      };
      const [local, authors, visibility] = await Promise.all([
        localCatalog().catch(() => null),
        term.length >= 2 ? db.from('profiles').select('id,username').ilike('username', match).limit(12).abortSignal(controller.signal) : null,
        db.from('ritm_hidden_tracks').select('track_id').abortSignal(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      if (!local || authors?.error || visibility.error) failedSources++;
      setAuthorResults(authors?.data ?? []);
      const matchingProfiles = new Set(authors?.data?.map(author => author.id) ?? []);
      const omitted = new Set([...hiddenTrackIds, ...(visibility.data ?? []).map(item => item.track_id)]);
      const scores = new Map<Track, number>();
      const score = (track: Track) => {
        let value = scores.get(track);
        if (value === undefined) {
          value = searchScore(term, track.title, track.artist, track.album ?? '', track.version_kind);
          scores.set(track, value);
        }
        return value;
      };
      const localMatches = new Set<string>();
      for (const track of local ?? []) {
        if (!matchesGenre(track.genre)) continue;
        if (term.length < 2 || score(track) > 0 || (track.user_id && matchingProfiles.has(track.user_id))) {
          aggregated.push(track);
          localMatches.add(track.id);
        }
      }
      setGlobalSearchResults(term.length >= 2 ? aggregated.filter(track => !omitted.has(track.id)).sort((a, b) => score(b) - score(a)) : aggregated.filter(track => !omitted.has(track.id)));

      const hosts = await getAudiusHosts();
      if (controller.signal.aborted) return;
      const host = hosts[0];
      const searchTerm = query.trim().length >= 2 ? query.trim() : (genre !== 'Все жанры' ? genre : '');

      let urlsToFetch: string[] = [];
      if (term.length < 2 && genre !== 'Все жанры' && !['Chillout', 'Minimal House'].includes(genre)) {
        const audiusGenre = genre === 'Rap' || genre === 'Lofi' ? GENRE_ALIASES[genre][0] : genre;
        urlsToFetch = [`${host}/v1/tracks/trending?app_name=RITM_APP&limit=100&genre=${encodeURIComponent(audiusGenre)}`];
      } else if (searchTerm) {
        urlsToFetch = [`${host}/v1/tracks/search?query=${encodeURIComponent(searchTerm)}&app_name=RITM_APP&limit=100`];
      } else {
        urlsToFetch = [
          `${host}/v1/tracks/trending?app_name=RITM_APP&limit=100`,
          `${host}/v1/tracks/search?query=Deep%20House&app_name=RITM_APP&limit=100`,
        ];
      }

      const [responses, accountResults] = await Promise.all([
        Promise.all(urlsToFetch.map(u => fetch(u, { signal: controller.signal }).then(r => r.json()).catch(() => null))),
        term.length >= 2 ? fetch(host + '/v1/users/search?query=' + encodeURIComponent(term) + '&limit=8&app_name=RITM_APP', { signal: controller.signal })
          .then(r => r.ok ? r.json() : null).catch(() => null) : null,
      ]);
      
      if (controller.signal.aborted) return;
      setAudiusAuthors(Array.isArray(accountResults?.data) ? accountResults.data.filter((item: any) =>
        typeof item.name === 'string' && /^[a-zA-Z0-9]{1,32}$/.test(item.id)) : []);
      if (responses.every(r => !r)) failedSources++;

      responses.forEach((res) => {
        if (res && res.data && Array.isArray(res.data)) {
          const items = res.data.map((item: any) => mapAudiusTrack(item, host))
            .filter((track: Track) => matchesGenre(track.genre));
          aggregated.push(...items);
        }
      });

      const filtered = [...new Map(aggregated.map(t => [t.id, t])).values()].filter(t => !omitted.has(t.id));
      const ranked = term.length >= 2 ? filtered.map(track => ({ track, score: score(track) }))
        .filter(item => item.score > 0 || localMatches.has(item.track.id))
        .sort((a, b) => Number(localMatches.has(b.track.id)) - Number(localMatches.has(a.track.id)) || b.score - a.score).map(item => item.track) : filtered;
      setGlobalSearchResults(ranked);
      if (filtered.length === 0 && failedSources > 0) setSearchError(true);
    } catch (err) {
      if (!controller.signal.aborted) setSearchError(true);
    } finally {
      // Индикатор гасит только последний запрос, отменённый его не трогает
      if (searchAbortRef.current === controller) setIsSearching(false);
    }
  };

  useEffect(() => {
    if (offline) { searchAbortRef.current?.abort(); setIsSearching(false); return; }
    const timer = setTimeout(() => { void fetchRecommendedMusic(searchQuery, selectedGenre); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedGenre, hiddenTrackIds, catalogRevision, offline]);

  const applyTrackUpdates = (updates: (Track | TrackMetadata)[]) => {
    const byId = new Map(updates.map(track => [track.id, track]));
    const swap = (tracks: Track[]) => tracks.map(track => {
      const update = byId.get(track.id);
      return update ? { ...track, ...update } : track;
    });
    searchCatalog.current = undefined;
    setCloudUploadedTracks(swap);
    setGlobalSearchResults(swap);
    setMyMusicTracks(swap);
    setRecentlyPlayed(swap);
    setUserPlaylists(previous => previous.map(playlist => ({ ...playlist, tracks: swap(playlist.tracks) })));
    setUpcoming(swap(queuedNext.current));
    setCatalogRevision(revision => revision + 1);
  };

  const openAudiusArtist = async (author: { id: string; name: string }) => {
    const request = ++openingArtist.current;
    try {
      const [host] = await getAudiusHosts();
      const [response, visibility] = await Promise.all([
        fetch(host + '/v1/users/' + author.id + '/tracks?limit=50&app_name=RITM_APP', { signal: AbortSignal.timeout(10000) }),
        supabase?.from('ritm_hidden_tracks').select('track_id'),
      ]);
      if (!response.ok || visibility?.error) throw new Error();
      const json = await response.json();
      const hidden = new Set((visibility?.data ?? []).map(item => item.track_id));
      if (request === openingArtist.current) setExternalArtist({
        name: author.name, tracks: (json.data ?? []).map((item: any) => mapAudiusTrack(item, host)).filter((track: Track) => !hidden.has(track.id)),
      });
    } catch {
      if (request === openingArtist.current) setNotice('Не удалось открыть исполнителя Audius.');
    }
  };

  useEffect(() => () => { searchAbortRef.current?.abort(); }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof Audio === 'undefined') return;
    const first = new Audio();
    const second = new Audio();
    first.crossOrigin = second.crossOrigin = 'anonymous';
    webAudioRef.current = first;
    spareAudio.current = second;
    setActiveAudio(first);
    return () => {
      playRequest.current++;
      cancelTransition();
      for (const audio of [first, second]) {
        clearAudio(audio);
        m.releaseAudioElement?.(audio);
      }
      m.clearTrack?.();
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem('ritm_normalize_volume', String(normalization)); } catch {}
    if (!normalization) {
      if (webAudioRef.current) mixer.current?.resetLevel(webAudioRef.current);
      if (spareAudio.current) mixer.current?.resetLevel(spareAudio.current);
    }
  }, [normalization]);

  useEffect(() => {
    try { localStorage.setItem('ritm_crossfade_seconds', String(crossfade)); } catch {}
    cancelTransition();
  }, [crossfade, m.playbackSpeed]);

  useEffect(() => { cancelTransition(false); }, [isShuffle, isRepeat, nextTracks]);

  useEffect(() => {
    if (mixer.current) mixer.current.setVolume(volume);
    else if (webAudioRef.current) webAudioRef.current.volume = volume;
  }, [volume]);

  function clearAudio(audio: HTMLAudioElement) {
    audio.pause();
    if (audio.hasAttribute('src')) {
      audio.removeAttribute('src');
      audio.load();
    }
    mixer.current?.setFade(audio, 1);
  }

  function finishFade(tail: NonNullable<typeof fadingTrack.current>) {
    if (fadingTrack.current !== tail) return;
    fadingTrack.current = undefined;
    clearTimeout(tail.timer);
    if (tail.session) countPlayback(tail.audio, tail.session);
    clearAudio(tail.audio);
  }

  function cancelTransition(includeTail = true) {
    const prepared = preparedTransition.current;
    preparedTransition.current = undefined;
    if (prepared) clearAudio(prepared.audio);
    if (includeTail && fadingTrack.current) {
      finishFade(fadingTrack.current);
      if (webAudioRef.current) mixer.current?.setFade(webAudioRef.current, 1);
    }
  }

  function countPlayback(audio: HTMLAudioElement, session = playback.current) {
    if (!session) return;
    const now = performance.now();
    const elapsed = (now - session.time) / 1000;
    const progress = (audio.currentTime - session.position) / Math.max(audio.playbackRate, 0.1);
    if (!audio.seeking && (!audio.paused || audio.ended) && progress > 0 && progress <= elapsed + 0.75) {
      session.seconds += Math.min(elapsed, progress);
    }
    session.time = now;
    session.position = audio.currentTime;
    const ticket = session.ticket;
    if (!ticket?.ticket || session.sending || session.seconds + 0.05 < ticket.seconds) return;
    session.sending = true;
    void qualifyListening(session.id, ticket.ticket).then(listens => {
      if (listens === undefined) { session.sending = false; return; }
      setPlayCounts(previous => ({ ...previous, [session.id]: { starts: previous[session.id]?.starts ?? ticket.starts, listens } }));
    }).catch(() => { session.sending = false; });
  }

  useEffect(() => {
    if (activeAudio) {
      const audio = activeAudio;
      audio.playbackRate = m.playbackSpeed || 1;
      
      const updateTime = () => {
        if (audio !== webAudioRef.current) return;
        countPlayback(audio);
        if (normalization) mixer.current?.measureLevel(audio);
        if (pendingSeek.current !== undefined) return;
        checkTransition(audio);
        {
          const dur = audio.duration || trackDuration || 0;
          if (dur > 0) {
            setCurrentTime(Math.min(audio.currentTime, dur));
          } else {
            setCurrentTime(audio.currentTime);
          }
        } 
      };
      const updateDuration = () => {
        if (audio === webAudioRef.current && Number.isFinite(audio.duration) && audio.duration > 0) setTrackDuration(audio.duration);
      };

      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      const ended = () => {
        if (audio !== webAudioRef.current) return;
        countPlayback(audio);
        if (playingRequest.current !== playRequest.current) return;
        if (updatePending.current && navigator.onLine && !editingInProgress.current &&
          window.location.pathname.replace(/\/$/, '') === basePath) {
          window.location.reload();
          return;
        }
        cancelTransition();
        if (isRepeat && m.currentTrack) void safePlayTrack(m.currentTrack, undefined, playContext.current, 0, true);
        else if (queuedNext.current.length) handleNext();
        else void m.pauseTrack();
      };
      const resetClock = () => {
        if (playback.current) {
          playback.current.time = performance.now();
          playback.current.position = audio.currentTime;
        }
      };
      audio.addEventListener('seeking', resetClock);
      audio.addEventListener('playing', resetClock);
      audio.addEventListener('ended', ended);
      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', ended);
        audio.removeEventListener('seeking', resetClock);
        audio.removeEventListener('playing', resetClock);
      };
    }
  }, [activeAudio, isShuffle, isRepeat, trackDuration, m.currentTrack, m.playbackSpeed, crossfade, normalization, nextTracks, volume]);

  const seekTo = (seconds: number) => {
    const audio = webAudioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || !Number.isFinite(seconds)) return;
    cancelTransition();
    const target = Math.max(0, Math.min(seconds, audio.duration));
    setCurrentTime(target);
    cancelPendingSeek();
    pendingSeek.current = setTimeout(() => {
      pendingSeek.current = undefined;
      if (audio === webAudioRef.current && Number.isFinite(audio.duration)) audio.currentTime = target;
    }, 85);
  };

  const stopAudio = () => {
    cancelTransition();
    if (Platform.OS === 'web' && webAudioRef.current) {
      clearAudio(webAudioRef.current);
      setCurrentTime(0);
    }
    try { if (typeof m?.pauseTrack === 'function') m.pauseTrack(); } catch (e) {}
  };

  const setUpcoming = (items: Track[]) => { queuedNext.current = items; setNextTracks(items); };
  const visibilityRequest = useRef<AbortController>();
  useEffect(() => () => visibilityRequest.current?.abort(), []);

  const safePlayTrack = async (track: Track, queueList?: Track[], context?: string, startAt = 0, fromQueue = false, back = false) => {
    cancelPendingSeek();
    const request = ++playRequest.current;
    visibilityRequest.current?.abort();
    cancelTransition();
    const audio = webAudioRef.current;
    if (audio) mixer.current = m.attachAudioElement?.(audio, volume) ?? mixer.current;
    if (supabase && (Platform.OS !== 'web' || navigator.onLine)) {
      const controller = new AbortController();
      visibilityRequest.current = controller;
      const visible = await supabase.from('ritm_hidden_tracks').select('track_id').eq('track_id', track.id).abortSignal(controller.signal).maybeSingle();
      if (request !== playRequest.current) return;
      if (visible.data || visible.error) {
        playingRequest.current = request;
        if (audio?.ended) void m.pauseTrack();
        setNotice('Этот трек сейчас недоступен.');
        return;
      }
    }
    const last = m.currentTrack as Track | null;
    if (!back && last && last.id !== track.id) previousTracks.current = [...previousTracks.current, last].slice(-60);
    playContext.current = context || 'Слушать';
    stopAudio();
    playback.current = undefined;
    if (!fromQueue) {
      const list = queueList ?? globalSearchResults;
      const start = list.findIndex(item => item.id === track.id);
      setUpcoming(list.slice(start + 1).filter(item => item.id !== track.id));
    }

    let playableTrack = track;
    try {
      if (typeof m?.playTrack === 'function') {
        const res = await m.playTrack(track, queueList ? queueList.map(t => t.id) : undefined, context);
        if (res) playableTrack = res;
      }
    } catch (e) {}

    const rawUrl = trackAudioUrl(playableTrack);

    setTrackDuration(track.duration || playableTrack?.duration || 180);
    setCurrentTime(0);

    if (Platform.OS === 'web' && webAudioRef.current) {
      const audio = webAudioRef.current;
      if (request !== playRequest.current) return;
      if (!rawUrl) { void m.pauseTrack(); setNotice('У трека нет доступного аудиофайла.'); return; }
      try {
        audio.src = rawUrl;
        if (!mixer.current) audio.volume = volume;
        audio.playbackRate = m?.playbackSpeed || 1.0;
        mixer.current?.resetLevel(audio);
        try { await audio.play(); } catch (error) {
          const audiusId = track.raw_id || (track.id.startsWith('audius_') ? track.id.slice(7) : null);
          if (!audiusId || request !== playRequest.current) throw error;
          audio.src = `${audiusHostsCache?.[1] ?? AUDIUS_HOSTS[1]}/v1/tracks/${audiusId}/stream?app_name=RITM_APP`;
          await audio.play();
        }
        if (request !== playRequest.current) return;
        if (startAt > 0 && startAt < audio.duration) audio.currentTime = startAt;
        playingRequest.current = request;
        registerPlayback(track, audio, context);
      } catch {
        if (request === playRequest.current) {
          void m.pauseTrack();
          setNotice('Этот трек сейчас не удалось воспроизвести.');
        }
      }
    }
  };

  function registerPlayback(track: Track, audio: HTMLAudioElement, context = playContext.current) {
    setRecentlyPlayed(previous => [track, ...previous.filter(item => item.id !== track.id)].slice(0, 30));
    if (!authUser || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    const entry: PlaybackProgress = { id: track.id, seconds: 0, time: performance.now(), position: audio.currentTime };
    playback.current = entry;
    const source = context === 'Автор' ? 'artist' : context === 'Общий плейлист' ? 'shared'
      : context === 'Моя музыка' ? 'library' : context === 'Слушать' ? 'catalog' : 'playlist';
    void recordListening(authUser.id, track, source).then(ticket => {
      if (!ticket) return;
      entry.ticket = ticket;
      setPlayCounts(previous => ({ ...previous, [track.id]: { starts: ticket.starts, listens: previous[track.id]?.listens ?? 0 } }));
    }).catch(() => setNotice('Не удалось синхронизировать прослушивание.'));
  }

  function nextIndex() {
    const items = queuedNext.current;
    return isShuffle ? Math.floor(Math.random() * items.length) : 0;
  }

  function takeFromQueue(index: number) {
    const items = queuedNext.current;
    setUpcoming(items.filter((_, i) => i !== index));
    return items[index];
  }

  function checkTransition(outgoing: HTMLAudioElement) {
    if (updatePending.current || !crossfade || isRepeat || fadingTrack.current || !mixer.current || !spareAudio.current ||
      outgoing.paused || outgoing.seeking || playingRequest.current !== playRequest.current) return;
    const remaining = (outgoing.duration - outgoing.currentTime) / outgoing.playbackRate;
    if (!Number.isFinite(remaining) || remaining <= 0.2 || remaining > crossfade + 10) return;
    let prepared = preparedTransition.current;
    if (!prepared) {
      const track = queuedNext.current[nextIndex()];
      const rawUrl = track && trackAudioUrl(track);
      if (!rawUrl) return;
      const audio = spareAudio.current;
      if (!m.attachAudioElement?.(audio, volume, false)) return;
      mixer.current.setFade(audio, 0);
      mixer.current.resetLevel(audio);
      audio.playbackRate = outgoing.playbackRate;
      audio.preload = 'auto';
      const plan: PreparedTransition = { audio, track, request: playRequest.current, approved: !supabase || !navigator.onLine, starting: false };
      preparedTransition.current = prepared = plan;
      if (plan.approved) audio.src = rawUrl;
      else void (async () => {
        try {
          const visibility = await supabase!.from('ritm_hidden_tracks').select('track_id').eq('track_id', track.id).maybeSingle();
          if (preparedTransition.current !== plan || visibility.data || visibility.error) return;
          plan.approved = true;
          audio.src = rawUrl;
        } catch {}
      })();
    }
    if (remaining > crossfade || !prepared.approved || prepared.starting || prepared.audio.readyState < 3) return;
    const plan = prepared;
    plan.starting = true;
    void plan.audio.play().then(() => {
      if (preparedTransition.current !== plan || plan.request !== playRequest.current) return;
      if (updatePending.current) { cancelTransition(false); return; }
      const index = queuedNext.current.findIndex(item => item.id === plan.track.id);
      const seconds = Math.min(crossfade, (outgoing.duration - outgoing.currentTime) / outgoing.playbackRate);
      if (index < 0 || outgoing.paused || outgoing.seeking || seconds <= 0.15 || !mixer.current) {
        cancelTransition(false);
        return;
      }
      preparedTransition.current = undefined;
      const session = playback.current;
      const previous = m.currentTrack as Track | null;
      if (previous) previousTracks.current = [...previousTracks.current, previous].slice(-60);
      playback.current = undefined;
      webAudioRef.current = plan.audio;
      spareAudio.current = outgoing;
      const tail = { audio: outgoing, session, timer: setTimeout(() => finishFade(tail), seconds * 1000 + 120) };
      fadingTrack.current = tail;
      mixer.current.setFade(outgoing, 1, 0, seconds);
      mixer.current.setFade(plan.audio, 0, 1, seconds);
      const track = takeFromQueue(index);
      setActiveAudio(plan.audio);
      setCurrentTime(plan.audio.currentTime);
      setTrackDuration(plan.audio.duration || track.duration || 0);
      void m.playTrack(track);
      registerPlayback(track, plan.audio);
    }).catch(() => {
      // The normal end-of-track path also handles autoplay or buffering failures.
    });
  }

  const handleNext = () => {
    const items = queuedNext.current;
    if (!items.length) return;
    void safePlayTrack(takeFromQueue(nextIndex()), undefined, playContext.current, 0, true);
  };

  const handlePrevious = () => {
    const track = previousTracks.current.pop();
    if (!track) return;
    const current = m.currentTrack as Track | null;
    if (current) setUpcoming([current, ...queuedNext.current.filter(item => item.id !== current.id)]);
    void safePlayTrack(track, undefined, playContext.current, 0, true, true);
  };

  const handleTogglePlay = async () => {
    if (!m.currentTrack && queuedNext.current.length) { handleNext(); return; }
    if (Platform.OS === 'web' && webAudioRef.current && webAudioRef.current.src) {
      if (webAudioRef.current.paused) {
        mixer.current = m.attachAudioElement?.(webAudioRef.current, volume) ?? mixer.current;
        try {
          await webAudioRef.current.play();
          await m.resumeTrack();
        } catch { setNotice('Этот трек сейчас не удалось воспроизвести.'); }
      } else {
        cancelTransition();
        webAudioRef.current.pause();
        await m.pauseTrack();
      }
      return;
    }
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      const restored = prevVolume > 0 ? prevVolume : 0.7;
      setVolume(restored);
    }
  };

  function playerPanel(open: () => void) {
    returnToFullPlayer.current = showFullPlayer;
    setShowFullPlayer(false);
    open();
  }

  function closePlayerPanel(close: () => void) {
    close();
    if (returnToFullPlayer.current && m.currentTrack) setShowFullPlayer(true);
    returnToFullPlayer.current = false;
  }

  const toggleAddToMyMusic = async (track: Track) => {
    if (!authUser) {
      router.push('/sign-in');
      return;
    }
    const exists = myMusicTracks.some(t => t.id === track.id);
    const saved = await setFavorite(authUser.id, track, !exists);
    if (!saved) { setNotice('Не удалось обновить избранное.'); return; }
    if (exists) {
      setMyMusicTracks(prev => prev.filter(t => t.id !== track.id));
    } else {
      setMyMusicTracks(prev => [track, ...prev]);
    }
  };

  const removingUploads = useRef(false);
  async function removeUploads(ids: string[]): Promise<DeleteTracksResult | undefined> {
    if (!authUser || removingUploads.current) return;
    removingUploads.current = true;
    try {
      const result = await deleteTracksWithFiles(authUser.id, ids);
      const removed = new Set(result.deletedIds);
      const keep = (track: Track) => !removed.has(track.id);
      setCloudUploadedTracks(previous => previous.filter(keep));
      setGlobalSearchResults(previous => previous.filter(keep));
      setMyMusicTracks(previous => previous.filter(keep));
      setRecentlyPlayed(previous => previous.filter(keep));
      setUserPlaylists(previous => previous.map(playlist => ({ ...playlist, tracks: playlist.tracks.filter(keep) })));
      setSelectedPlaylistModal(previous => previous ? { ...previous, tracks: previous.tracks.filter(keep) } : null);
      setSelectedTrackDetails(previous => previous && keep(previous) ? previous : null);
      if (removed.size) {
        searchAbortRef.current?.abort();
        searchCatalog.current = undefined;
        setCatalogRevision(value => value + 1);
        previousTracks.current = previousTracks.current.filter(keep);
        setUpcoming(queuedNext.current.filter(keep));
        if (m.currentTrack && removed.has(m.currentTrack.id)) {
          playRequest.current++;
          stopAudio();
          m.clearTrack();
        }
      }
      const remaining = result.failedIds.length ? ' Осталось удалить: ' + result.failedIds.length + '.' : '';
      const files = result.filesLeft ? ' Часть файлов осталась в хранилище.' : '';
      setNotice('Удалено из каталога: ' + removed.size + '.' + remaining + files);
      return result;
    } catch { setNotice('Не удалось завершить удаление. Обнови список и попробуй ещё раз.'); }
    finally { removingUploads.current = false; }
  }

  const handleRemoveTrack = async (track: Track, source: 'my_music' | 'uploads') => {
    if (source === 'my_music') {
      if (authUser && await setFavorite(authUser.id, track, false)) setMyMusicTracks(prev => prev.filter(t => t.id !== track.id));
    } else if (source === 'uploads') {
      await removeUploads([track.id]);
    }
    setSelectedTrackMenu(null);
  };

  const handleBatchRemove = async (source: 'my_music' | 'uploads') => {
    if (source === 'my_music') {
      const tracks = myMusicTracks.filter((track) => selectedTrackIds.includes(track.id));
      if (!authUser) return;
      const results = await Promise.all(tracks.map((track) => setFavorite(authUser.id, track, false)));
      const removed = new Set(tracks.filter((_, index) => results[index]).map(track => track.id));
      setMyMusicTracks(prev => prev.filter(track => !removed.has(track.id)));
      if (removed.size !== tracks.length) setNotice('Часть треков не удалось убрать из избранного.');
    } else if (source === 'uploads') {
      const result = await removeUploads(selectedTrackIds);
      if (result) setSelectedTrackIds(result.failedIds);
      setSelectedTrackMenu(null);
      return;
    }
    setSelectedTrackIds([]);
    setSelectedTrackMenu(null);
  };

  const handleBatchAddToMyMusic = async () => {
    if (!authUser) { router.push('/sign-in'); return; }
    const targetTracks = activeTab === 'uploads' ? cloudUploadedTracks : myMusicTracks;
    const tracksToAdd = targetTracks.filter(t => selectedTrackIds.includes(t.id));
    const existingIds = new Set(myMusicTracks.map(t => t.id));
    const newItems = tracksToAdd.filter(t => !existingIds.has(t.id));
    const results = await Promise.all(newItems.map((track) => setFavorite(authUser.id, track, true)));
    const savedItems = newItems.filter((_, index) => results[index]);
    setMyMusicTracks(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      return [...savedItems.filter(t => !existingIds.has(t.id)), ...prev];
    });
    setSelectedTrackIds([]);
    setSelectedTrackMenu(null);
  };

  const handleBatchAddToPlaylist = async (playlistId: string) => {
    if (!authUser) { router.push('/sign-in'); return; }
    const targetTracks = activeTab === 'uploads' ? cloudUploadedTracks : myMusicTracks;
    const tracksToAdd = targetTracks.filter(t => selectedTrackIds.includes(t.id));
    
    const playlist = userPlaylists.find((item) => item.id === playlistId);
    if (!playlist || !await addTracksToPlaylist(authUser.id, playlistId, tracksToAdd, playlist.tracks.length)) return;
    setUserPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId) {
        const existingIds = new Set(pl.tracks.map(t => t.id));
        const newItems = tracksToAdd.filter(t => !existingIds.has(t.id));
        return { ...pl, tracks: [...pl.tracks, ...newItems] };
      }
      return pl;
    }));
    setSelectedTrackIds([]);
    setSelectedTrackMenu(null);
    setShowPlaylistSelector(false);
  };

  const toggleSelectTrack = (id: string) => {
    setSelectedTrackIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (list: Track[]) => {
    const allIds = list.map(t => t.id);
    if (selectedTrackIds.length === allIds.length) {
      setSelectedTrackIds([]);
    } else {
      setSelectedTrackIds(allIds);
    }
  };

  const sortTracks = (list: Track[], sortType: 'number' | 'title' | 'duration') => {
    const copy = [...list];
    if (sortType === 'title') {
      return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortType === 'duration') {
      return copy.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    }
    return copy;
  };

  const orderKey = 'ritm.uploadOrder.' + (authUser?.id ?? '');
  const [orderRevision, setOrderRevision] = useState(0);
  const sortedUploads = useMemo(() => {
    const list = sortTracks(cloudUploadedTracks, uploadsSort);
    if (uploadsSort !== 'number') return list;
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(orderKey) || '[]');
      const ranks = new Map(ids.map((id, index) => [id, index]));
      return list.sort((a, b) => (ranks.get(a.id) ?? -1) - (ranks.get(b.id) ?? -1));
    } catch { return list; }
  }, [cloudUploadedTracks, uploadsSort, orderRevision, orderKey]);
  function reorderUploads(from: string, to: string) {
    try { localStorage.setItem(orderKey, JSON.stringify(moved(sortedUploads, from, to).map(track => track.id))); }
    catch { setNotice('Не удалось сохранить порядок загрузок.'); return; }
    setUploadsSort('number'); setOrderRevision(value => value + 1);
  }
  const [savingOrder, setSavingOrder] = useState(false);
  const [playlistAuthor, setPlaylistAuthor] = useState('');
  useEffect(() => {
    let active = true;
    setPlaylistAuthor('');
    const id = selectedPlaylistModal?.author_id || authUser?.id;
    if (id) void supabase?.from('profiles').select('username').eq('id', id).maybeSingle().then(({ data }) => { if (active) setPlaylistAuthor(data?.username || 'Автор'); });
    return () => { active = false; };
  }, [selectedPlaylistModal?.author_id, selectedPlaylistModal?.id, authUser?.id]);
  const [playlistMenu, setPlaylistMenu] = useState<{ playlistId: string; trackId: string } | null>(null);
  const [playlistCounts, setPlaylistCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let active = true;
    for (const playlist of userPlaylists) void supabase?.rpc('ritm_playlist_count', { playlist_key: playlist.id }).then(({ data }) => {
      if (active && typeof data === 'number') setPlaylistCounts(values => ({ ...values, [playlist.id]: data }));
    });
    return () => { active = false; };
  }, [userPlaylists]);
  async function sharePlaylist(id: string) {
    try {
      const result = await supabase?.rpc('ritm_toggle_playlist_link', { playlist_key: id, enabled: true });
      if (!result || result.error) throw new Error();
      const url = location.origin + basePath + '/?playlist=' + encodeURIComponent(id);
      if (navigator.share) await navigator.share({ url });
      else { await navigator.clipboard.writeText(url); setNotice('Ссылка на плейлист скопирована.'); }
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice('Не удалось поделиться плейлистом.'); }
  }
  async function reorderCards(from: string, to: string) {
    const previous = userPlaylists;
    const next = moved(previous, from, to);
    setUserPlaylists(next);
    const results = await Promise.all(next.map((item, index) => supabase!.from('user_playlists').update({ sort_order: index }).eq('id', item.id).eq('user_id', authUser!.id)));
    if (results.some(result => result.error)) { setNotice('Не удалось сохранить порядок плейлистов.'); void refreshLibrary(); }
  }
  const playingInPlaylist = !!selectedPlaylistModal?.tracks.some(track => track.id === m.currentTrack?.id);
  async function reorderPlaylist(from: string, to: string) {
    const previous = selectedPlaylistModal;
    if (!previous?.id || savingOrder || !supabase) return;
    const tracks = moved(previous.tracks, from, to);
    if (tracks === previous.tracks) return;
    setSavingOrder(true);
    setSelectedPlaylistModal({ ...previous, tracks });
    try {
      const { error } = await supabase.rpc('ritm_edit_playlist', { playlist_key: previous.id, new_title: previous.title,
        new_cover: previous.cover ?? null, track_keys: tracks.map(track => track.id) });
      if (error) throw error;
      setUserPlaylists(items => items.map(item => item.id === previous.id ? { ...item, tracks } : item));
    } catch {
      setSelectedPlaylistModal(current => current?.id === previous.id ? previous : current);
      setNotice('Не удалось сохранить порядок плейлиста.');
    } finally { setSavingOrder(false); }
  }
  const sortedLibrary = useMemo(() => sortTracks(myMusicTracks, myMusicSort), [myMusicTracks, myMusicSort]);

  const handleAddTrackToPlaylist = async (playlistId: string, track: Track) => {
    if (!authUser) { router.push('/sign-in'); return; }
    const playlist = userPlaylists.find((item) => item.id === playlistId);
    if (!playlist || !await addTracksToPlaylist(authUser.id, playlistId, [track], playlist.tracks.length)) return;
    setUserPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId) {
        const exists = pl.tracks.some(t => t.id === track.id);
        if (!exists) return { ...pl, tracks: [...pl.tracks, track] };
      }
      return pl;
    }));
    setSelectedTrackMenu(null);
    setShowPlaylistSelector(false);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistTitle.trim()) return;
    if (!authUser) { router.push('/sign-in'); return; }
    const newPl = await createUserPlaylist(authUser.id, newPlaylistTitle.trim());
    if (!newPl) { setNotice('Не удалось создать плейлист.'); return; }
    setUserPlaylists(prev => [newPl, ...prev]);
    setNewPlaylistTitle('');
    setShowCreatePlaylistModal(false);
  };

  const isCurrentTrackFavorite = m?.currentTrack 
    ? myMusicTracks.some(t => t.id === m.currentTrack.id) 
    : false;

  const catalogResults = useMemo(() => versionFilter ? globalSearchResults.filter(track => trackVersion(track.title, track.version_kind) === versionFilter) : globalSearchResults, [versionFilter, globalSearchResults]);
  const [visibleCount, setVisibleCount] = useState(50);
  useEffect(() => setVisibleCount(50), [searchQuery, selectedGenre, versionFilter]);
  const smartPlaylists = useMemo(() => [
    { id: 'smart_trending', title: '🔥 Популярное', tracks: globalSearchResults.slice(0, 50), cover_url: globalSearchResults[0]?.cover_url || '' },
    { id: 'smart_recent', title: '🕒 Недавно прослушиваемые', tracks: recentlyPlayed, cover_url: recentlyPlayed[0]?.cover_url || '' },
    { id: 'smart_favorites', title: 'На основе избранного', tracks: globalSearchResults.filter(track => myMusicTracks.some(favorite => favorite.genre && favorite.genre === track.genre) && !myMusicTracks.some(favorite => favorite.id === track.id)).slice(0, 24), cover_url: '' },
    { id: 'smart_week', title: 'Микс недели', tracks: [...globalSearchResults].sort((a, b) => {
      const week = Math.floor(Date.now() / 604800000);
      const rank = (id: string) => [...(week + id)].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
      return rank(a.id) - rank(b.id);
    }).slice(0, 20), cover_url: '' },
  ], [globalSearchResults, recentlyPlayed, myMusicTracks]);

  const suggestions = useMemo(() => selectedTrackDetails ? harmonicMatches(
    selectedTrackDetails,
    [...new Map([...globalSearchResults, ...cloudUploadedTracks, ...myMusicTracks].map(track => [track.id, track])).values()],
    track => ({ ...trackCards[track.id]?.music, ...track.music }),
  ) : [], [selectedTrackDetails, trackCards, globalSearchResults, cloudUploadedTracks, myMusicTracks]);
  const activeDuration = trackDuration || m?.currentTrack?.duration || 0;

  const mediaActions = useRef({ next: handleNext, previous: handlePrevious, seek: seekTo, cancelTransition });
  mediaActions.current = { next: handleNext, previous: handlePrevious, seek: seekTo, cancelTransition };
  useEffect(() => {
    if (Platform.OS !== 'web' || !('mediaSession' in navigator) || !m.currentTrack) return;
    const media = navigator.mediaSession;
    const track: Track = m.currentTrack;
    const artwork = track.cover_url;
    media.metadata = new MediaMetadata({ title: track.title, artist: track.artist || 'Ритм', artwork: artwork ? [{ src: artwork }] : [] });
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => { void webAudioRef.current?.play().then(m.resumeTrack).catch(() => {}); },
      pause: () => { mediaActions.current.cancelTransition(); webAudioRef.current?.pause(); void m.pauseTrack(); },
      nexttrack: () => mediaActions.current.next(),
      previoustrack: () => mediaActions.current.previous(),
      seekto: details => { if (typeof details.seekTime === 'number') mediaActions.current.seek(details.seekTime); },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { media.setActionHandler(action as MediaSessionAction, handler); } catch {}
    }
    return () => {
      media.metadata = null;
      for (const action of Object.keys(handlers)) {
        try { media.setActionHandler(action as MediaSessionAction, null); } catch {}
      }
    };
  }, [m.currentTrack?.id]);
  useEffect(() => {
    if (Platform.OS === 'web' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = !m.currentTrack ? 'none' : m.isPlaying ? 'playing' : 'paused';
    }
  }, [m.currentTrack?.id, m.isPlaying]);

  return (
    <TrackCardsContext.Provider value={trackCards}>
    <View style={{ flex: 1, flexDirection: 'column', backgroundColor: '#f2f2f7' }}>
      <View style={{ flex: 1, flexDirection: compact ? 'column' : 'row', overflow: 'hidden' }}>
        
        {/* ЛЕВОЕ МЕНЮ */}
        <View style={{ 
          width: compact ? '100%' : 250,
          backgroundColor: '#fafafa', 
          borderRightWidth: 1, 
          borderColor: 'rgba(0, 0, 0, 0.08)', 
          paddingVertical: compact ? 8 : 24,
          paddingHorizontal: 16,
          zIndex: 50
        }}>
          <View style={{ marginBottom: compact ? 6 : 28, zIndex: 60 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#000000', letterSpacing: -0.5 }}>Ритм<Text style={{ color: '#fa233b' }}>.</Text></Text>
            </View>

            {authLoading ? (
              <View style={{ height: 34 }} />
            ) : !userProfile?.isLoggedIn ? (
              <View style={{ flexDirection: 'row', gap: 6, width: '100%' }}>
                <Pressable onPress={() => router.push('/sign-in')} style={{ flex: 1, backgroundColor: 'rgba(250, 35, 59, 0.1)', paddingVertical: 7, borderRadius: 12, alignItems: 'center', outlineStyle: 'none' as any }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#fa233b' }}>Вход</Text>
                </Pressable>
                <Pressable onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'register' } })} style={{ flex: 1, backgroundColor: '#fa233b', paddingVertical: 7, borderRadius: 12, alignItems: 'center', outlineStyle: 'none' as any }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#ffffff' }}>Регистрация</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setShowProfileMenu(!showProfileMenu)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, outlineStyle: 'none' as any }}>
                <AvatarCircle uri={userProfile.avatarUrl} name={userProfile.name} size={48} ring />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', color: '#000000' }}>{userProfile.name}</Text>
                  <Text style={{ fontSize: 14, color: '#68686e' }}>{showProfileMenu ? 'Профиль ▲' : 'Профиль ▼'}</Text>
                </View>
              </Pressable>
            )}
            {showProfileMenu && userProfile.isLoggedIn ? (
              <View nativeID="ritm-profile-menu" style={{ marginTop: 8, backgroundColor: '#ffffff', borderRadius: 12, padding: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}>
                {canModerate && <PrimaryButton title="Модерация" variant="soft" onPress={() => { setShowProfileMenu(false); setShowModeration(true); }} />}
                <Pressable onPress={() => { setShowProfileMenu(false); router.push('/profile'); }} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, outlineStyle: 'none' as any }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1c1c1e' }}>Мой профиль</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{userProfile.phoneOrEmail}</Text>
                </Pressable>
                <Pressable onPress={async () => { setShowProfileMenu(false); await signOut(); }} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, outlineStyle: 'none' as any }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#d70015' }}>Выйти</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <Text style={{ fontSize: 10, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 4 }}>Медиатека</Text>
          <View style={{ gap: 6, flexDirection: compact ? 'row' : 'column', flexWrap: 'wrap' }}>
            {[
              ...(authUser ? [{ id: 'my_music', label: 'Моя музыка' }] : []),
              { id: 'main', label: 'Слушать' },
              ...(authUser ? [{ id: 'uploads', label: 'Загруженные' }] : []),
            ].map((tab: any) => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable 
                  key={tab.id}
                  onPress={() => { if (tab.id === 'main') { searchCatalog.current = undefined; setCatalogRevision(value => value + 1); } setActiveTab(tab.id); setSelectedTrackIds([]); }}
                  style={{ 
                    paddingVertical: 11, 
                    paddingHorizontal: 14, 
                    borderRadius: 12, 
                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                    shadowColor: isActive ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: isActive ? 2 : 0,
                    outlineStyle: 'none' as any
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: isActive ? '700' : '500', color: isActive ? '#fa233b' : '#1c1c1e' }}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <View key={activeTab} nativeID="ritm-tab" style={{ flex: 1, paddingTop: compact ? 10 : 32, paddingHorizontal: compact ? 12 : 28, paddingBottom: compact ? 145 : 120, backgroundColor: '#f2f2f7' }}>
          {notice ? <Pressable accessibilityRole="button" accessibilityLabel="Закрыть уведомление" onPress={() => setNotice('')}>
            <Text style={{ padding: 10, marginBottom: 8, borderRadius: 10, backgroundColor: '#fff', color: '#292930' }}>{notice} · Закрыть</Text>
          </Pressable> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: compact ? 21 : 32, fontWeight: '800', color: '#000000', flexShrink: 1 }}>
              {activeTab === 'main' ? 'Слушать' : activeTab === 'uploads' ? 'Загруженные треки' : 'Моя музыка'}
            </Text>

            {activeTab === 'uploads' && (
              <Pressable 
                onPress={() => setShowUploadPanel(true)}
                style={{ 
                  backgroundColor: '#fa233b', 
                  paddingHorizontal: 18, 
                  paddingVertical: 10, 
                  borderRadius: 8,
                  shadowColor: '#fa233b',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 3,
                  outlineStyle: 'none' as any
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>+ Загрузить</Text>
              </Pressable>
            )}
          </View>

          {/* ПАНЕЛЬ СОРТИРОВКИ И МНОЖЕСТВЕННОГО ВЫБОРА */}
          {(activeTab === 'uploads' || activeTab === 'my_music') && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable 
                  onPress={() => toggleSelectAll(activeTab === 'uploads' ? cloudUploadedTracks : myMusicTracks)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, outlineStyle: 'none' as any }}
                >
                  <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#fa233b', backgroundColor: selectedTrackIds.length > 0 ? '#fa233b' : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                    {selectedTrackIds.length > 0 && <WebIcon name="checkmark" size={12} color="#ffffff" />}
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1c1c1e' }}>
                    {selectedTrackIds.length > 0 ? `Выбрано: ${selectedTrackIds.length}` : 'Выбрать все'}
                  </Text>
                </Pressable>
              </View>
              {activeTab === 'uploads' && authUser && selectedTrackIds.length > 0 && <PrimaryButton
                title={'Редактировать выбранные · ' + selectedTrackIds.length} variant="soft" onPress={() => {
                  const selected = new Set(selectedTrackIds);
                  const editable = cloudUploadedTracks.filter(track => selected.has(track.id) && track.user_id === authUser.id);
                  if (editable.length > 500) { setNotice('Выбери до 500 треков за раз.'); return; }
                  if (editable.length) setBatchTracks(editable);
                }} />}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, color: '#8e8e93', fontWeight: '600' }}>Сортировка:</Text>
                {[
                  { id: 'number', label: '№' },
                  { id: 'title', label: 'Название' },
                  { id: 'duration', label: 'Длительность' },
                ].map((s) => {
                  const currentSort = activeTab === 'uploads' ? uploadsSort : myMusicSort;
                  const isSel = currentSort === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        if (activeTab === 'uploads') setUploadsSort(s.id as any);
                        else setMyMusicSort(s.id as any);
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                        backgroundColor: isSel ? '#fa233b' : 'rgba(0,0,0,0.04)',
                        outlineStyle: 'none' as any
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isSel ? '#ffffff' : '#1c1c1e' }}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ВКЛАДКА 1: СЛУШАТЬ */}
          {updateReady && <View style={{ marginBottom: 8 }}>
            <Text>Доступно обновление. Если играет музыка, сайт обновится после трека.</Text>
            <PrimaryButton variant="soft" title="Обновить сейчас" onPress={() => window.location.reload()} />
          </View>}
          {activeTab === 'main' && (
            <RememberedScroll position={listPositions.current.main} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {offline && offlineList.length > 0 && <View style={{ gap: 8 }}>
                <Text style={{ fontWeight: '800' }}>Скачано на этом устройстве</Text>
                <TrackList tracks={offlineList} play={track => void safePlayTrack(track, offlineList, 'Скачанные')} />
                {authUser && <PrimaryButton title="Очистить скачанные" variant="soft" onPress={() => void clearOffline().then(() => setOfflineList([])).catch(() => setNotice('Не удалось очистить скачанные треки.'))} />}
              </View>}

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
                <TextInput
                  placeholder="Поиск треков и исполнителей..."
                  placeholderTextColor="#8e8e93"
                  value={searchQuery}
                  onChangeText={value => { if (!searchQuery.trim() && value.trim()) { setSelectedGenre('Все жанры'); setVersionFilter(null); } setSearchQuery(value); }}
                  returnKeyType="search"
                  maxLength={150}
                  style={{ flex: 1, fontSize: 15, color: '#000000', outlineStyle: 'none' as any }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} style={{ padding: 4, outlineStyle: 'none' as any }}>
                    <WebIcon name="close-circle" size={18} color="#8e8e93" />
                  </Pressable>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, paddingVertical: 4 }}>
                {GENRES.map((g) => {
                  const isSelected = selectedGenre === g;
                  return (
                    <Pressable 
                      key={g} 
                      onPress={() => setSelectedGenre(g)} 
                      style={{ 
                        paddingHorizontal: 16, 
                        paddingVertical: 9, 
                        borderRadius: 20, 
                        backgroundColor: isSelected ? '#fa233b' : '#ffffff', 
                        marginRight: 10, 
                        borderWidth: 1, 
                        borderColor: isSelected ? '#fa233b' : 'rgba(0,0,0,0.05)',
                        shadowColor: isSelected ? '#fa233b' : '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isSelected ? 0.3 : 0.05,
                        shadowRadius: 4,
                        elevation: 2,
                        outlineStyle: 'none' as any
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? '#ffffff' : '#1c1c1e' }}>{g}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>✨ Подборки</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
                  {smartPlaylists.filter(sp => sp.tracks.length > 0).map((sp) => (
                    <Pressable 
                      key={sp.id} 
                      onPress={() => setSelectedPlaylistModal({ title: sp.title, tracks: sp.tracks })}
                      style={({ pressed }) => ({ 
                        width: 150, 
                        marginRight: 14, 
                        backgroundColor: 'rgba(255, 255, 255, 0.75)', 
                        backdropFilter: 'blur(20px)' as any,
                        padding: 12, 
                        borderRadius: 18, 
                        borderWidth: 1, 
                        borderColor: 'rgba(255, 255, 255, 0.6)',
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                        outlineStyle: 'none' as any
                      })}
                    >
                      <View style={{ width: '100%', height: 126, borderRadius: 12, backgroundColor: '#e5e5ea', marginBottom: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                        {sp.tracks[0] ? <TrackCoverImage track={sp.tracks[0]} style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: 32 }}>🎵</Text>}
                      </View>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#000000' }}>{sp.title}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{sp.tracks.length} треков</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {searchQuery.trim().length >= 2 && (authorResults.length > 0 || audiusAuthors.length > 0) && <View style={{ gap: 8, marginBottom: 18 }}>
                <Text style={{ fontWeight: '800', color: '#292930' }}>Авторы и исполнители</Text>
                {authorResults.map(author => <PrimaryButton key={author.id} title={author.username + ' · Ритм'} variant="soft" onPress={() => setArtistId(author.id)} />)}
                {audiusAuthors.map(author => <PrimaryButton key={'audius_' + author.id} title={author.name + ' · Audius'} variant="soft" onPress={() => void openAudiusArtist(author)} />)}
              </View>}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>
                {searchQuery.trim().length >= 2 ? 'Можно слушать в Ритме' : 'Рекомендуемые треки'} ({catalogResults.length})
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {([[null, 'Все версии'], ['original', 'Оригиналы'], ['remix', 'Ремиксы'], ['cover', 'Каверы'], ['other', 'Другие версии']] as [TrackVersion | null, string][]).map(([version, label]) =>
                  <Pressable key={version ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: version === versionFilter }}
                    onPress={() => setVersionFilter(version)} style={{ padding: 8, borderRadius: 11, backgroundColor: version === versionFilter ? '#fa233b' : '#fff' }}>
                    <Text style={{ color: version === versionFilter ? '#fff' : '#292930', fontWeight: '700' }}>{label}</Text>
                  </Pressable>)}
              </View>
              {!isSearching && !searchError && catalogResults.length === 0 &&
                <Text style={{ marginVertical: 10, color: '#62626b' }}>Совпадений в каталоге нет. Попробуй изменить запрос или фильтры.</Text>}

              {isSearching && <ActivityIndicator size="small" color="#fa233b" style={{ marginVertical: 12 }} />}

              {searchError && !isSearching && (
                <Pressable
                  onPress={() => void fetchRecommendedMusic(searchQuery, selectedGenre)}
                  style={{ backgroundColor: 'rgba(250, 35, 59, 0.08)', borderRadius: 12, padding: 14, marginBottom: 12 }}
                >
                  <Text style={{ color: '#fa233b', fontWeight: '700', fontSize: 14 }}>Не удалось загрузить музыку</Text>
                  <Text style={{ color: '#8e8e93', fontSize: 12, marginTop: 2 }}>Проверьте соединение и нажмите, чтобы повторить</Text>
                </Pressable>
              )}

              {catalogResults.slice(0, visibleCount).map((item: Track) => {
                const isSelected = m?.currentTrack?.id === item.id;
                return (
                  <View 
                    key={item.id} 
                    style={[trackRow, { backgroundColor: isSelected ? 'rgba(250,35,59,0.10)' : 'rgba(255,255,255,0.55)' }]}
                  >
                    <Pressable onPress={() => void safePlayTrack(item, catalogResults, 'Слушать')} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, outlineStyle: 'none' as any }}>
                      <TrackCoverImage track={item} style={trackArtwork} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: isSelected ? '#fa233b' : '#000000' }}>{item.title}</Text>
                        <TrackByline track={item} extras={[
                          item.version_kind || trackVersion(item.title) !== 'original' ? TRACK_VERSIONS[trackVersion(item.title, item.version_kind)] : '',
                          item.id.startsWith('audius_') ? 'Audius' : '',
                        ]} />
                      </View>
                    </Pressable>
                    <Text style={{ fontSize: 13, color: '#8e8e93', marginRight: 12 }}>{formatTime(item.duration)}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={'Меню трека ' + item.title}
                      onPress={() => { setShowPlaylistSelector(false); setSelectedTrackMenu({ track: item, source: 'network' }); }} 
                      style={{ 
                        padding: 8,
                        zIndex: 10,
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        borderRadius: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 1,
                        outlineStyle: 'none' as any
                      }}
                    >
                      <WebIcon name="ellipsis-vertical" size={18} color="#1c1c1e" />
                    </Pressable>
                  </View>
                );
              })}
              {catalogResults.length > visibleCount && <PrimaryButton title="Показать ещё" variant="soft" onPress={() => setVisibleCount(count => count + 50)} />}
            </RememberedScroll>
          )}

          {/* ВКЛАДКА 2: ЗАГРУЖЕННЫЕ */}
          {activeTab === 'uploads' && (
            <RememberedScroll position={listPositions.current.uploads} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>
                Облачные загрузки Supabase ({cloudUploadedTracks.length})
              </Text>

              {sortedUploads.map((item) => {
                const isSelected = m?.currentTrack?.id === item.id;
                const isChecked = selectedTrackIds.includes(item.id);
                return (
                  <DragRow key={item.id} id={item.id} group="uploads" move={reorderUploads}><View style={[trackRow, { backgroundColor: isSelected ? 'rgba(250,35,59,0.10)' : 'rgba(255,255,255,0.55)' }]}>
                    <Pressable onPress={() => toggleSelectTrack(item.id)} style={{ padding: 6, marginRight: 8, outlineStyle: 'none' as any }}>
                      <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#fa233b', backgroundColor: isChecked ? '#fa233b' : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                        {isChecked && <WebIcon name="checkmark" size={12} color="#ffffff" />}
                      </View>
                    </Pressable>

                    <Pressable onPress={() => void safePlayTrack(item, sortedUploads, 'Загруженные')} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, outlineStyle: 'none' as any }}>
                      <TrackCoverImage track={item} style={trackArtwork} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: isSelected ? '#fa233b' : '#000000' }}>{item.title}</Text>
                        <TrackByline track={item} />
                        <View style={{ backgroundColor: 'rgba(250, 35, 59, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#fa233b' }}>{item.genre || 'Deep'}</Text>
                        </View>
                      </View>
                    </Pressable>
                    <Text style={{ fontSize: 13, color: '#8e8e93', marginRight: 12 }}>{formatTime(item.duration)}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={'Меню трека ' + item.title}
                      onPress={() => { setShowPlaylistSelector(false); setSelectedTrackMenu({ track: item, source: 'uploads' }); }} style={{ padding: 10, zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 8, outlineStyle: 'none' as any }}>
                      <WebIcon name="ellipsis-vertical" size={18} color="#1c1c1e" />
                    </Pressable>
                  </View></DragRow>
                );
              })}
            </RememberedScroll>
          )}

          {/* ВКЛАДКА 3: МОЯ МУЗЫКА */}
          {activeTab === 'my_music' && (
            <RememberedScroll position={listPositions.current.my_music} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {authUser && hasLegacyLibrary(authUser.id) && <PrimaryButton title="Перенести медиатеку из этого браузера" variant="soft" loading={importing} onPress={async () => {
                if (importing) return;
                setImporting(true);
                try { await importLegacyLibrary(authUser.id); await refreshLibrary(); }
                catch { setNotice('Не удалось завершить перенос. Его можно повторить.'); }
                finally { setImporting(false); }
              }} />}
              
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>
                Мои плейлисты ({userPlaylists.length})
              </Text>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24, paddingVertical: 4 }}>
                <Pressable 
                  onPress={() => setShowCreatePlaylistModal(true)}
                  style={({ pressed }) => ({ 
                    width: 140, 
                    height: 170,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
                    borderRadius: 18, 
                    padding: 12, 
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2, 
                    borderColor: '#fa233b',
                    borderStyle: 'dashed',
                    marginRight: 14,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                    outlineStyle: 'none' as any
                  })}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(250, 35, 59, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                    <WebIcon name="add-outline" size={24} color="#fa233b" />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#fa233b', textAlign: 'center' }}>Создать плейлист</Text>
                </Pressable>

                {userPlaylists.map(pl => <DragRow key={pl.id} id={pl.id} group="playlist-cards" move={(from, to) => void reorderCards(from, to)}>
                  <div className="ritm-playlist-card" style={{ width: 182, marginRight: 14 }}>
                    <div style={{ position: 'relative', height: 182, borderRadius: 14, overflow: 'hidden', background: '#e6e8ec', boxShadow: '5px 6px 16px #242b3326' }}>
                      <button aria-label={'Открыть плейлист ' + pl.title} onClick={() => setSelectedPlaylistModal(pl)} style={{ width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
                        {pl.cover ? <img src={pl.cover} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 66, color: '#9da6af' }}>♫</span>}
                      </button>
                      <div className="ritm-playlist-actions">
                        <button aria-label={'Редактировать ' + pl.title} onClick={() => { setPlaylistEdit(pl); void loadCloudTracks(); }}>⚙</button>
                        <button aria-label={'Слушать ' + pl.title} disabled={!pl.tracks.length} onClick={() => { void safePlayTrack(pl.tracks[0], pl.tracks, pl.title); void supabase?.rpc('ritm_playlist_listen', { playlist_key: pl.id }); }}>▶</button>
                        <button aria-label={'Поделиться ' + pl.title} onClick={() => void sharePlaylist(pl.id)}><svg width="27" height="27" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3 12 25 4 18 25 12 17 3 12Z"/><path d="m12 17 8-9"/></svg></button>
                      </div>
                      <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 12, textShadow: '0 1px 4px #000', pointerEvents: 'none' }}>≡ {pl.tracks.length}　♫ {playlistCounts[pl.id] ?? 0}</div>
                    </div>
                    <Pressable onPress={() => setSelectedPlaylistModal(pl)}><Text numberOfLines={1} style={{ fontWeight: '700', marginTop: 9 }}>{pl.title}</Text></Pressable>
                  </div>
                </DragRow>)}
              </ScrollView>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>
                Сохраненные треки ({myMusicTracks.length})
              </Text>

              {myMusicTracks.length === 0 ? (
                <View style={{ padding: 24, backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🤍</Text>
                  <Text style={{ color: '#8e8e93', fontSize: 14 }}>В вашей музыке пока нет сохраненных треков.</Text>
                </View>
              ) : (
                sortedLibrary.map((item) => {
                  const isSelected = m?.currentTrack?.id === item.id;
                  const isChecked = selectedTrackIds.includes(item.id);
                  return (
                    <View key={item.id} style={[trackRow, { backgroundColor: isSelected ? 'rgba(250,35,59,0.10)' : 'rgba(255,255,255,0.55)' }]}>
                      <Pressable onPress={() => toggleSelectTrack(item.id)} style={{ padding: 6, marginRight: 8, outlineStyle: 'none' as any }}>
                        <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#fa233b', backgroundColor: isChecked ? '#fa233b' : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                          {isChecked && <WebIcon name="checkmark" size={12} color="#ffffff" />}
                        </View>
                      </Pressable>

                      <Pressable onPress={() => void safePlayTrack(item, myMusicTracks, 'Моя музыка')} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, outlineStyle: 'none' as any }}>
                        <TrackCoverImage track={item} style={trackArtwork} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: isSelected ? '#fa233b' : '#000000' }}>{item.title}</Text>
                        <TrackByline track={item} />
                        </View>
                      </Pressable>
                      <Text style={{ fontSize: 13, color: '#8e8e93', marginRight: 12 }}>{formatTime(item.duration)}</Text>
                      <Pressable onPress={() => { setShowPlaylistSelector(false); setSelectedTrackMenu({ track: item, source: 'my_music' }); }} style={{ padding: 10, zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 8, outlineStyle: 'none' as any }}>
                        <WebIcon name="ellipsis-vertical" size={18} color="#1c1c1e" />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </RememberedScroll>
          )}
        </View>
      </View>

      {showUploadPanel && authUser && <View nativeID="ritm-upload" accessibilityLabel="Загрузка аудио"
        style={{ position: 'absolute', top: compact ? 10 : 24, right: compact ? 10 : 26, bottom: compact ? 152 : 122,
          width: compact ? 'calc(100% - 20px)' as any : 480, maxHeight: 630, zIndex: 98, borderRadius: 22,
          backgroundColor: '#f6f6f9', borderWidth: 1, borderColor: '#dedee6', boxShadow: '0 12px 36px rgba(0,0,0,0.22)' as any }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 }}>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800' }}>Загрузка аудио</Text>
          <PrimaryButton title="Закрыть" variant="soft" onPress={() => setShowUploadPanel(false)} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 10 }}>
          <UploadForm userId={authUser.id} onPublished={playlistCreated => {
            if (playlistCreated) void refreshLibrary();
            void loadCloudTracks();
            searchCatalog.current = undefined;
            setCatalogRevision(value => value + 1);
          }} />
        </ScrollView>
      </View>}

      <div style={{ position: 'absolute', left: 8, bottom: 2, zIndex: 101, fontSize: 10, color: '#50505a' }}>
        Версия {process.env.EXPO_PUBLIC_RITM_RELEASE || '1.42'} · <a style={{ color: 'inherit' }} href="mailto:the867654gfg@gmail.com">the867654gfg@gmail.com</a>
      </div>
      {/* НИЖНИЙ ПЛЕЕР */}
      <View style={{
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        width: '96%',
        maxWidth: 920,
        height: compact ? 126 : 90,
        backgroundColor: 'rgba(25, 25, 30, 0.45)', 
        backdropFilter: 'blur(35px) saturate(180%)' as any,
        borderRadius: 42,
        borderWidth: 1, 
        borderColor: 'rgba(255, 255, 255, 0.25)', 
        flexDirection: compact ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: compact ? 12 : 24,
        paddingTop: compact ? 18 : 0,
        paddingBottom: compact ? 7 : 0,
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.3)' as any,
        zIndex: 100
      }}>
        <View style={{ position: 'absolute', top: 8, left: 24, right: 24, height: 12, zIndex: 120, justifyContent: 'center' }}>
          <PlaybackClock clock={clock}>{seconds => <input aria-label="Перемотка" type="range" min={0} max={activeDuration || 1}
            step={0.1} value={Math.min(seconds, activeDuration)} disabled={!activeDuration}
            onChange={event => seekTo(Number(event.currentTarget.value))}
            style={{ width: '100%', height: 12, margin: 0, accentColor: '#fa233b', cursor: 'pointer' }} />}</PlaybackClock>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', width: compact ? '100%' : 260, marginTop: compact ? 0 : 8 }}>
          {m?.currentTrack ? (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="Открыть полноэкранный плеер" onPress={() => setShowFullPlayer(true)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                <TrackCoverImage track={m.currentTrack} style={{ width: compact ? 38 : 54, height: compact ? 38 : 54, borderRadius: 14, marginRight: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#ffffff' }}>{m.currentTrack.title}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#fa233b', marginTop: 3 }}>
                    <PlaybackClock clock={clock}>{seconds => formatTime(seconds)}</PlaybackClock> / {formatTime(activeDuration)}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => toggleAddToMyMusic(m.currentTrack)} 
                style={{ 
                  padding: 8,
                  outlineStyle: 'none' as any
                }}
              >
                <WebIcon name={isCurrentTrackFavorite ? "heart" : "heart-outline"} size={20} color="#fa233b" />
              </Pressable>
            </>
          ) : (
            <Text style={{ fontSize: 14, color: '#a1a1a6', fontWeight: '500' }}>Музыка не выбрана</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <Pressable 
            onPress={() => setIsShuffle(!isShuffle)} 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              backgroundColor: isShuffle ? 'rgba(250, 35, 59, 0.28)' : 'transparent', 
              borderWidth: 1, 
              borderColor: isShuffle ? '#fa233b' : 'rgba(255, 255, 255, 0.2)', 
              justifyContent: 'center', 
              alignItems: 'center',
              outlineStyle: 'none' as any
            }}
          >
            <WebIcon name="shuffle" size={16} color={isShuffle ? '#fa233b' : '#ffffff'} />
          </Pressable>

          <Pressable 
            onPress={handlePrevious} 
            style={{ 
              width: 42, 
              height: 42, 
              borderRadius: 21, 
              borderWidth: 1, 
              borderColor: 'rgba(255, 255, 255, 0.2)', 
              justifyContent: 'center', 
              alignItems: 'center',
              outlineStyle: 'none' as any
            }}
          >
            <WebIcon name="play-skip-back" size={18} color="#ffffff" />
          </Pressable>

          <Pressable 
            onPress={handleTogglePlay} 
            style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 26, 
              backgroundColor: '#fa233b', 
              borderWidth: 2, 
              borderColor: 'rgba(255, 255, 255, 0.35)', 
              justifyContent: 'center', 
              alignItems: 'center', 
              boxShadow: '0 4px 15px rgba(250, 35, 59, 0.5)' as any,
              outlineStyle: 'none' as any
            }}
          >
            <WebIcon name={m?.isPlaying ? "pause" : "play"} size={20} color="#ffffff" />
          </Pressable>

          <Pressable 
            onPress={handleNext} 
            style={{ 
              width: 42, 
              height: 42, 
              borderRadius: 21, 
              borderWidth: 1, 
              borderColor: 'rgba(255, 255, 255, 0.2)', 
              justifyContent: 'center', 
              alignItems: 'center',
              outlineStyle: 'none' as any
            }}
          >
            <WebIcon name="play-skip-forward" size={18} color="#ffffff" />
          </Pressable>

          <Pressable 
            onPress={() => setIsRepeat(!isRepeat)} 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              backgroundColor: isRepeat ? 'rgba(250, 35, 59, 0.28)' : 'transparent', 
              borderWidth: 1, 
              borderColor: isRepeat ? '#fa233b' : 'rgba(255, 255, 255, 0.2)', 
              justifyContent: 'center', 
              alignItems: 'center',
              outlineStyle: 'none' as any
            }}
          >
            <WebIcon name="repeat" size={16} color={isRepeat ? '#fa233b' : '#ffffff'} />
          </Pressable>
        </View>

        <View style={{ display: compact ? 'none' : 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, width: 180, marginTop: 8 }}>
          <Pressable onPress={handleMuteToggle} style={{ padding: 4, outlineStyle: 'none' as any }}>
            <WebIcon name={volume === 0 ? "volume-mute" : "volume-low"} size={18} color="#ffffff" />
          </Pressable>
          {Platform.OS === 'web' && <input ref={volumeBarContainerRef} aria-label="Громкость" type="range"
            min={0} max={100} step={1} value={Math.round(volume * 100)} onChange={event => setVolume(Number(event.currentTarget.value) / 100)}
            style={{ width: 80, height: 20, margin: 0, accentColor: '#fa233b', cursor: 'pointer' }} />}

          <Pressable accessibilityRole="button" accessibilityLabel="Открыть эквалайзер"
            onPress={() => setShowEqualizerModal(true)}
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              borderWidth: 1, 
              borderColor: 'rgba(255, 255, 255, 0.2)', 
              justifyContent: 'center', 
              alignItems: 'center',
              outlineStyle: 'none' as any
            }}
          >
            <WebIcon name="options-outline" size={16} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {compact && <Pressable accessibilityRole="button" accessibilityLabel="Открыть эквалайзер" onPress={() => setShowEqualizerModal(true)}
        style={{ position: 'absolute', zIndex: 110, right: 14, bottom: 147, borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 11, paddingVertical: 7 }}>
        <Text style={{ fontWeight: '800', color: '#292930' }}>EQ</Text>
      </Pressable>}
      {/* МОДАЛЬНЫЕ ОКНА */}
      <Modal animationType="fade" transparent visible={showCreatePlaylistModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: '#1c1c1e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>Новый плейлист</Text>
              <Pressable onPress={() => setShowCreatePlaylistModal(false)} style={{ padding: 4, outlineStyle: 'none' as any }}>
                <WebIcon name="close" size={20} color="#d1d1d6" />
              </Pressable>
            </View>
            <TextInput 
              placeholder="Название плейлиста..." 
              placeholderTextColor="#8e8e93"
              value={newPlaylistTitle}
              onChangeText={setNewPlaylistTitle}
              maxLength={80}
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#ffffff', fontSize: 16, marginBottom: 20, outlineStyle: 'none' as any }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setShowCreatePlaylistModal(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', outlineStyle: 'none' as any }}>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Отмена</Text>
              </Pressable>
              <Pressable onPress={handleCreatePlaylist} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#fa233b', alignItems: 'center', outlineStyle: 'none' as any }}>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Создать</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* МОДАЛЬНОЕ ОКНО ПЛЕЙЛИСТА В СТИЛЕ VK МУЗЫКИ */}
      <Modal animationType="fade" transparent visible={!!selectedPlaylistModal}>
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0, 0, 0, 0.65)', 
          backdropFilter: 'blur(20px)' as any,
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: 20 
        }}>
          <View style={{ 
            width: '100%', 
            maxWidth: 680, 
            height: '80%', maxHeight: 760, 
            backgroundColor: 'rgba(226, 228, 232, 0.90)', backdropFilter: 'blur(35px) saturate(180%)',
            borderRadius: 28, 
            padding: compact ? 15 : 28,
            borderWidth: 1, 
            borderColor: 'rgba(255, 255, 255, 0.12)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.5,
            shadowRadius: 24,
            elevation: 10
          }}>
            {/* Кнопка закрытия */}
            <Pressable 
              onPress={() => setSelectedPlaylistModal(null)} 
              style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, padding: 6, outlineStyle: 'none' as any }}
            >
              <WebIcon name="close" size={22} color="#8e8e93" />
            </Pressable>

            {/* Header в стиле VK Музыки: Обложка + Название + Кнопка Слушать */}
            {selectedPlaylistModal && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 20 }}>
                {/* Обложка плейлиста */}
                <View style={{ alignItems: 'center', gap: 7 }}><View style={{
                  width: 132,
                  height: 132,
                  borderRadius: 18, 
                  backgroundColor: '#2c2c34', 
                  boxShadow: '8px 5px 18px rgba(0,0,0,0.32)',
                  justifyContent: 'center', 
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 7, height: 5 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8
                }}>
                  {selectedPlaylistModal.cover || selectedPlaylistModal.tracks[0]?.cover_url ? (
                    <Image source={{ uri: selectedPlaylistModal.cover || selectedPlaylistModal.tracks[0]?.cover_url || undefined }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
                  ) : (
                    <Text style={{ fontSize: 42 }}>🎵</Text>
                  )}
                </View>

                  {selectedPlaylistModal.id && userPlaylists.some(item => item.id === selectedPlaylistModal.id) && <Pressable disabled={savingOrder} onPress={() => {
                    const owned = userPlaylists.find(item => item.id === selectedPlaylistModal.id);
                    if (owned) { setSelectedPlaylistModal(null); setPlaylistEdit(owned); void loadCloudTracks(); }
                  }} style={{ padding: 5 }}><Text style={{ color: '#626973', fontSize: 12, fontWeight: '700' }}>Редактировать</Text></Pressable>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(150,154,160,0.90)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                    Плейлист
                  </Text>
                  <Text numberOfLines={2} style={{ fontSize: 24, fontWeight: '900', color: '#252a30', marginBottom: 6 }}>
                    {selectedPlaylistModal.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#727d89', fontWeight: '500', marginBottom: 14 }}>
                    {selectedPlaylistModal.tracks.length} треков · {playlistCounts[selectedPlaylistModal.id || ""] ?? 0} прослушиваний
                  </Text>


                  <Pressable onPress={() => { const id = selectedPlaylistModal.author_id || authUser?.id; if (id) { setSelectedPlaylistModal(null); setPlaylistAuthorOnly(true); setArtistId(id); } }}><Text style={{ color: '#626973', marginBottom: 12 }}>Автор · {playlistAuthor || 'Открыть профиль'}</Text></Pressable>
                  {!!selectedPlaylistModal.description && <Text style={{ color: '#727d89', marginBottom: 10 }}>{selectedPlaylistModal.description}</Text>}
                  {selectedPlaylistModal.id && userPlaylists.some(item => item.id === selectedPlaylistModal.id) && <Pressable onPress={() => void sharePlaylist(selectedPlaylistModal.id!)}><Text style={{ color: '#626973', marginBottom: 12 }}>↗ Поделиться</Text></Pressable>}
                  {selectedPlaylistModal.tracks.length > 0 && (
                    <Pressable 
                      onPress={() => {
                        if (playingInPlaylist) { handleTogglePlay(); } else {
                          void safePlayTrack(selectedPlaylistModal.tracks[0], selectedPlaylistModal.tracks, selectedPlaylistModal.title);
                          if (selectedPlaylistModal.id) void supabase?.rpc('ritm_playlist_listen', { playlist_key: selectedPlaylistModal.id });

                        }
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(150,154,160,0.90)',
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 22,
                        alignSelf: 'flex-start',
                        gap: 8,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                        shadowColor: 'rgba(150,154,160,0.90)',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.4,
                        shadowRadius: 8,
                        outlineStyle: 'none' as any
                      })}
                    >
                      <WebIcon name={playingInPlaylist && m.isPlaying ? "pause" : "play"} size={16} color="#272b31" />
                      <Text style={{ color: '#272b31', fontWeight: '800', fontSize: 14 }}>{playingInPlaylist ? (m.isPlaying ? 'Пауза' : 'Продолжить') : 'Слушать'}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* Разделитель */}
            <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', marginBottom: 16 }} />

            {/* Список треков VK Style */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {selectedPlaylistModal?.tracks.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>🎶</Text>
                  <Text style={{ color: '#727d89', fontSize: 14, textAlign: 'center' }}>В этом плейлисте пока нет треков</Text>
                </View>
              ) : (
                selectedPlaylistModal?.tracks.map((track, idx) => {
                  const isCurrentPlaying = m?.currentTrack?.id === track.id;
                  const row = <View key={track.id} style={{ padding: 6, marginBottom: 4, borderRadius: 12, backgroundColor: isCurrentPlaying ? 'rgba(160,164,170,0.24)' : 'transparent' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Pressable accessibilityLabel={(isCurrentPlaying && m.isPlaying ? 'Пауза ' : 'Воспроизвести ') + track.title} onPress={() => { if (isCurrentPlaying) handleTogglePlay(); else void safePlayTrack(track, selectedPlaylistModal.tracks, selectedPlaylistModal.title); }}>
                        <TrackCoverImage track={track} override={selectedPlaylistModal.cover} style={{ width: 50, height: 50, borderRadius: 9 }} />
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(30,30,34,0.20)', borderRadius: 9 }}><WebIcon name={isCurrentPlaying && m.isPlaying ? 'pause' : 'play'} size={18} color="#fff" /></View>
                      </Pressable>
                      <Pressable style={{ flex: 1 }} onPress={() => { if (isCurrentPlaying) handleTogglePlay(); else void safePlayTrack(track, selectedPlaylistModal.tracks, selectedPlaylistModal.title); }}>
                        <Text numberOfLines={1} style={{ fontSize: 14, color: '#252a30', fontWeight: '600' }}>{track.title}</Text>
                        <Text numberOfLines={1} style={{ fontSize: 12, color: '#7b8591', marginTop: 3 }}>{track.artist || 'Неизвестный исполнитель'}</Text>
                      </Pressable>
                      <Text style={{ fontSize: 12, color: '#7b8591' }}>{formatTime(track.duration)}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={'Меню трека плейлиста ' + track.title} onPress={() => {
                        setPlaylistMenu(selectedPlaylistModal.id ? { playlistId: selectedPlaylistModal.id, trackId: track.id } : null);
                        setSelectedTrackIds([]); setShowPlaylistSelector(false); setSelectedTrackMenu({ track, source: 'network' });
                      }} style={{ padding: 8 }}><WebIcon name="ellipsis-vertical" size={18} color="#747b85" /></Pressable>
                    </View>
                    {isCurrentPlaying && <div onClick={event => event.stopPropagation()} draggable={false} onDragStart={event => event.stopPropagation()} style={{ display: 'flex', gap: 14, paddingLeft: 60, marginTop: 2 }}>
                      <PlaybackClock clock={clock}>{seconds => <input className="ritm-row-slider" aria-label="Перемотка плейлиста" type="range" min={0} max={activeDuration || 1} step={0.1} value={Math.min(seconds, activeDuration)} disabled={!activeDuration}
                        onChange={event => seekTo(Number(event.currentTarget.value))} style={{ flex: 1, minWidth: 0, '--ritm-fill': (activeDuration ? seconds / activeDuration * 100 : 0) + '%' } as any} />}</PlaybackClock>
                      <input className="ritm-row-slider" aria-label="Громкость плейлиста" type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={event => setVolume(Number(event.currentTarget.value) / 100)} style={{ width: 72, '--ritm-fill': volume * 100 + '%' } as any} />
                    </div>}
                  </View>;
                  return selectedPlaylistModal.id && userPlaylists.some(item => item.id === selectedPlaylistModal.id) ? <DragRow key={track.id} id={track.id} group={selectedPlaylistModal.id} move={reorderPlaylist}>{row}</DragRow> : row;
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showFullPlayer && m.currentTrack && <PlaybackClock clock={clock}>{currentTime => <FullPlayer
        title={m.currentTrack.title} artist={m.currentTrack.artist}
        cover={<TrackCoverImage track={m.currentTrack} style={{ width: '100%', height: '100%' }} />}
        time={currentTime} duration={activeDuration} playing={m.isPlaying} shuffle={isShuffle} repeat={isRepeat}
        seek={seekTo} close={() => setShowFullPlayer(false)} previous={handlePrevious} next={handleNext} togglePlay={handleTogglePlay}
        toggleShuffle={() => setIsShuffle(!isShuffle)} toggleRepeat={() => setIsRepeat(!isRepeat)}
        equalizer={() => playerPanel(() => setShowEqualizerModal(true))}
        icon={(name, size, color) => <WebIcon name={name} size={size} color={color} />} />}</PlaybackClock>}

      {showEqualizerModal && <EqualizerPanel close={() => closePlayerPanel(() => setShowEqualizerModal(false))}
        normalization={normalization} setNormalization={setNormalization} crossfade={crossfade} setCrossfade={setCrossfade} />}

      {/* МЕНЮ ДЕЙСТВИЙ С ТРЕКОМ */}
      <Modal animationType="fade" transparent visible={!!selectedTrackDetails} onRequestClose={() => setSelectedTrackDetails(null)}>
        {selectedTrackDetails && (
          <View style={{ flex: 1, backgroundColor: 'rgba(10, 10, 15, 0.62)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <ScrollView style={{ width: '100%', maxWidth: 430, maxHeight: '94%', backgroundColor: 'rgba(28,28,35,0.78)', backdropFilter: 'blur(24px)' as any, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)' }}>
              <View style={{ height: 190, backgroundColor: '#292930', justifyContent: 'center', alignItems: 'center' }}>
                <TrackCoverImage track={selectedTrackDetails} style={{ width: '100%', height: '100%' }} />
                <Pressable onPress={() => setSelectedTrackDetails(null)} style={{ position: 'absolute', top: 14, right: 14, padding: 8, backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 18 }}>
                  <WebIcon name="close" size={20} color="#fff" />
                </Pressable>
              </View>
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }} numberOfLines={2}>{selectedTrackDetails.title}</Text>
                <Text style={{ fontSize: 14, color: '#c5c5cb', marginTop: 5 }} numberOfLines={1}>{selectedTrackDetails.artist || 'Неизвестный исполнитель'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                  <View style={{ backgroundColor: 'rgba(250,35,59,0.18)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}><Text style={{ color: '#ff7887', fontWeight: '700', fontSize: 12 }}>{selectedTrackDetails.genre || 'Без жанра'}</Text></View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}><Text style={{ color: '#d4d4d8', fontWeight: '700', fontSize: 12 }}>{formatTime(selectedTrackDetails.duration)}</Text></View>
                </View>
                <View style={{ marginTop: 18, gap: 8 }}>
                  <Text style={{ color: '#a1a1aa', fontSize: 13 }}>Исполнитель: <Text style={{ color: '#fff', fontWeight: '700' }}>{selectedTrackDetails.artist || 'Неизвестен'}</Text></Text>
                  <TrackQuality key={selectedTrackDetails.id} track={selectedTrackDetails} measured={trackCards[selectedTrackDetails.id]?.quality} />
                  {selectedTrackDetails.album ? <Text style={{ color: '#a1a1aa', fontSize: 13 }}>Альбом: <Text style={{ color: '#fff', fontWeight: '700' }}>{selectedTrackDetails.album}</Text></Text> : null}
                  {selectedTrackDetails.version_kind ? <Text style={{ color: '#a1a1aa', fontSize: 13 }}>Версия: <Text style={{ color: '#fff', fontWeight: '700' }}>{TRACK_VERSIONS[selectedTrackDetails.version_kind]}</Text></Text> : null}
                  <Text style={{ color: '#a1a1aa', fontSize: 13 }}>Опубликован: <Text style={{ color: '#fff', fontWeight: '700' }}>{formatDate(selectedTrackDetails.published_at || selectedTrackDetails.created_at)}</Text></Text>
                  <Text style={{ color: '#a1a1aa', fontSize: 13 }}>Запусков: {(playCounts[selectedTrackDetails.id]?.starts ?? 0).toLocaleString('ru-RU')}</Text>
                  <Text style={{ color: '#a1a1aa', fontSize: 13 }}>Прослушиваний: {(playCounts[selectedTrackDetails.id]?.listens ?? 0).toLocaleString('ru-RU')}</Text>
                </View>
                <Pressable onPress={() => { void safePlayTrack(selectedTrackDetails); setSelectedTrackDetails(null); }} style={{ marginTop: 20, backgroundColor: '#fa233b', paddingVertical: 13, borderRadius: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>Слушать</Text>
                </Pressable>
                <View style={{ gap: 8, marginTop: 12 }}>
                  {selectedTrackDetails.description ? <Text style={{ color: '#eee' }}>{selectedTrackDetails.description}</Text> : null}
                  <PrimaryButton variant="soft" title="Добавить в плейлист" onPress={() => {
                    setSelectedTrackMenu({ track: selectedTrackDetails, source: 'network' });
                    setSelectedTrackDetails(null);
                    setShowPlaylistSelector(true);
                    setSelectedTrackIds([]);
                  }} />
                  {selectedTrackDetails.user_id && <PrimaryButton variant="soft" title="Страница автора" onPress={() => {
                    setArtistId(selectedTrackDetails.user_id!); setSelectedTrackDetails(null);
                  }} />}
                  {Platform.OS === 'web' && authUser && selectedTrackDetails.url?.includes('/storage/v1/object/public/music-storage/') && <PrimaryButton variant="soft" disabled={downloadIds.includes(selectedTrackDetails.id) || offlineList.some(track => track.id === selectedTrackDetails.id)} title={downloadIds.includes(selectedTrackDetails.id) ? 'Скачивается…' : offlineList.some(track => track.id === selectedTrackDetails.id) ? 'Скачано' : 'Скачать'} onPress={() => {
                    setDownloadIds(ids => [...ids, selectedTrackDetails.id]);
                    void rememberOffline(selectedTrackDetails).then(() => {
                      setOfflineList(offlineTracks()); setSelectedTrackDetails(null); setNotice('Трек сохранён для офлайна.');
                    }).catch(error => { setSelectedTrackDetails(null); setNotice(error.message || 'Не удалось сохранить трек.'); }).finally(() => setDownloadIds(ids => ids.filter(id => id !== selectedTrackDetails.id)));
                  }} />}
                  <PrimaryButton variant="soft" title="Пожаловаться" onPress={() => {
                    setSelectedTrackDetails(null);
                    if (!authUser) { router.push('/sign-in'); return; }
                    setReportTrack(selectedTrackDetails); setReason('');
                  }} />
                  {suggestions.length > 0 && <>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>По темпу и тональности</Text>
                    {suggestions.map(({ track, bpm, key }) => <PrimaryButton key={track.id} variant="soft"
                      title={track.title + ' · ' + Math.round(bpm) + ' BPM · ' + key}
                      onPress={() => { void safePlayTrack(track); setSelectedTrackDetails(null); }} />)}
                  </>}
                  {selectedTrackDetails.genre && globalSearchResults.some(track => track.id !== selectedTrackDetails.id && track.genre === selectedTrackDetails.genre) ? <>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Похожие треки</Text>
                    <TrackList tracks={globalSearchResults.filter(track => track.id !== selectedTrackDetails.id && track.genre === selectedTrackDetails.genre).slice(0, 4)} play={track => {
                      void safePlayTrack(track); setSelectedTrackDetails(null);
                    }} />
                  </> : null}
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal animationType="fade" transparent visible={!!selectedTrackMenu}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10, 10, 15, 0.4)', backdropFilter: 'blur(16px)' as any, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          {selectedTrackMenu && (
            <View style={{ 
              width: '100%', 
              maxWidth: 340, 
              backgroundColor: 'rgba(40, 40, 50, 0.95)', 
              borderRadius: 24, 
              padding: 20, 
              borderWidth: 1, 
              borderColor: 'rgba(255, 255, 255, 0.15)'
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#ffffff', flex: 1 }} numberOfLines={1}>
                  {selectedTrackIds.length > 1 ? `Выбрано треков: ${selectedTrackIds.length}` : selectedTrackMenu.track.title}
                </Text>
                <Pressable onPress={() => { setSelectedTrackMenu(null); setShowPlaylistSelector(false); }} style={{ outlineStyle: 'none' as any }}>
                  <WebIcon name="close" size={20} color="#a1a1a6" />
                </Pressable>
              </View>

              <Pressable
                onPress={() => { setSelectedTrackDetails(selectedTrackMenu.track); setSelectedTrackMenu(null); setShowPlaylistSelector(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Text style={{ color: '#fff', fontSize: 19, width: 20, textAlign: 'center' }}>i</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', marginLeft: 12 }}>О треке</Text>
              </Pressable>
              {selectedTrackMenu.source === 'uploads' && selectedTrackMenu.track.user_id === authUser?.id && selectedTrackIds.length < 2 &&
                <PrimaryButton variant="soft" title="Редактировать трек" onPress={() => { setEditingTrack(selectedTrackMenu.track); setSelectedTrackMenu(null); }} />}

              <Pressable 
                onPress={() => setShowPlaylistSelector(!showPlaylistSelector)} 
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', outlineStyle: 'none' as any }}
              >
                <WebIcon name="add-outline" size={20} color="#ffffff" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff', marginLeft: 12, flex: 1 }}>
                  {selectedTrackIds.length > 1 ? `Добавить выбранные в плейлист` : 'Добавить в плейлист'}
                </Text>
                {userPlaylists.length > 0 && (
                  <Text style={{ fontSize: 11, color: '#a1a1a6' }}>{showPlaylistSelector ? '▲' : '▼'}</Text>
                )}
              </Pressable>

              {showPlaylistSelector && userPlaylists.length > 0 && (
                <View style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)', borderRadius: 12, padding: 8, marginVertical: 6, gap: 4 }}>
                  {userPlaylists.map((pl) => (
                    <Pressable 
                      key={pl.id} 
                      onPress={() => {
                        if (selectedTrackIds.length > 1) {
                          handleBatchAddToPlaylist(pl.id);
                        } else {
                          handleAddTrackToPlaylist(pl.id, selectedTrackMenu.track);
                        }
                      }}
                      style={({ pressed }) => ({
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: pressed ? 'rgba(250, 35, 59, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        outlineStyle: 'none' as any
                      })}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }} numberOfLines={1}>📚 {pl.title}</Text>
                      <Text style={{ fontSize: 11, color: '#a1a1a6' }}>{pl.tracks.length} тр.</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {showPlaylistSelector && userPlaylists.length === 0 && <PrimaryButton variant="soft" title={authUser ? 'Создать плейлист' : 'Войти'} onPress={() => {
                setSelectedTrackMenu(null); setShowPlaylistSelector(false);
                if (authUser) setShowCreatePlaylistModal(true);
                else router.push('/sign-in');
              }} />}

              <Pressable 
                onPress={() => {
                  if (selectedTrackIds.length > 1) {
                    handleBatchAddToMyMusic();
                  } else {
                    void toggleAddToMyMusic(selectedTrackMenu.track);
                    setSelectedTrackMenu(null);
                  }
                }} 
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', outlineStyle: 'none' as any }}
              >
                <WebIcon name="heart-outline" size={20} color="#fa233b" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff', marginLeft: 12 }}>
                  {selectedTrackIds.length > 1 ? 'Добавить выбранные в Мою музыку' : 'Добавить в мою музыку'}
                </Text>
              </Pressable>

              {playlistMenu && selectedPlaylistModal?.id === playlistMenu.playlistId && userPlaylists.some(item => item.id === playlistMenu.playlistId && item.tracks.some(track => track.id === selectedTrackMenu.track.id)) && <PrimaryButton title="Удалить из плейлиста" variant="danger-outline" onPress={async () => {
                const target = playlistMenu;
                if (!supabase || !authUser || savingOrder) return;
                setSavingOrder(true);
                try {
                  const { error } = await supabase.from('user_playlist_tracks').delete().eq('playlist_id', target.playlistId).eq('track_id', target.trackId).eq('user_id', authUser.id);
                  if (error) throw error;
                  const keep = (track: Track) => track.id !== target.trackId;
                  setSelectedPlaylistModal(current => current?.id === target.playlistId ? { ...current, tracks: current.tracks.filter(keep) } : current);
                  setUserPlaylists(items => items.map(item => item.id === target.playlistId ? { ...item, tracks: item.tracks.filter(keep) } : item));
                  setSelectedTrackMenu(null); setPlaylistMenu(null);
                } catch { setNotice('Не удалось удалить трек из плейлиста.'); }
                finally { setSavingOrder(false); }
              }} />}
              {(selectedTrackMenu.source === 'my_music' || selectedTrackMenu.source === 'uploads') && (
                <Pressable 
                  onPress={() => {
                    if (selectedTrackIds.length > 0) {
                      if (selectedTrackMenu.source !== 'network') void handleBatchRemove(selectedTrackMenu.source);
                    } else {
                      if (selectedTrackMenu.source !== 'network') void handleRemoveTrack(selectedTrackMenu.track, selectedTrackMenu.source);
                    }
                  }} 
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, outlineStyle: 'none' as any }}
                >
                  <WebIcon name="trash-outline" size={20} color="#fa233b" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fa233b', marginLeft: 12 }}>
                    {selectedTrackIds.length > 1 ? `Удалить выбранные (${selectedTrackIds.length})` : 'Удалить'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Modal>
      {externalArtist && <CollectionPanel title={externalArtist.name + ' · Audius'} close={() => setExternalArtist(null)}>
        {externalArtist.tracks.length ? <TrackList tracks={externalArtist.tracks} play={track => {
          void safePlayTrack(track, externalArtist.tracks, 'Автор'); setExternalArtist(null);
        }} /> : <Text>Нет доступных треков.</Text>}
      </CollectionPanel>}
      {batchTracks && authUser && <BatchTrackEditor tracks={batchTracks} close={() => setBatchTracks(null)} onSave={updated => {
        applyTrackUpdates(updated);
        setSelectedTrackIds([]);
        setBatchTracks(null);
        setNotice('Сохранено треков: ' + updated.length + '.');
      }} />}
      {editingTrack && authUser && <EditTrack track={editingTrack} userId={authUser.id} close={() => setEditingTrack(null)} onSave={updated => {
        applyTrackUpdates([updated]);
        setEditingTrack(null);
        setSelectedTrackDetails(updated);
        setNotice('Изменения сохранены.');
      }} />}
      {showModeration && canModerate && <ModerationPanel close={() => setShowModeration(false)} onVisibility={(id, hide) => {
        setHiddenTrackIds(previous => hide ? [...new Set([...previous, id])] : previous.filter(item => item !== id));
        if (hide) {
          setUpcoming(queuedNext.current.filter(track => track.id !== id));
          if (m.currentTrack?.id === id) { stopAudio(); m.clearTrack(); }
        }
      }} />}
      {playlistEdit && authUser && <EditPlaylist key={playlistEdit.id} playlist={playlistEdit} choices={[...cloudUploadedTracks, ...myMusicTracks, ...globalSearchResults]} userId={authUser.id}
        close={() => setPlaylistEdit(null)} onSave={() => {
          setPlaylistEdit(null); setSelectedPlaylistModal(null); void refreshLibrary();
        }} onDelete={() => {
          setUserPlaylists(previous => previous.filter(playlist => playlist.id !== playlistEdit.id));
          setPlaylistEdit(null);
          setSelectedPlaylistModal(null);
          setNotice('Плейлист удалён.');
        }} />}
      {artistId && <ArtistPanel id={artistId} viewer={authUser?.id} summaryOnly={playlistAuthorOnly} mapTrack={mapCloudTrack} close={() => { setArtistId(null); setPlaylistAuthorOnly(false); }} signIn={() => {
        setArtistId(null); setPlaylistAuthorOnly(false); router.push('/sign-in');
      }} play={(track, queue) => { setArtistId(null); void safePlayTrack(track, queue, 'Автор'); }} />}
      {shared && <CollectionPanel title={shared.title} close={() => setShared(null)}>
        {shared.cover && <Image source={{ uri: shared.cover }} style={{ width: 100, height: 100, borderRadius: 14 }} />}
        {shared.tracks.length ? <TrackList tracks={shared.tracks} play={track => {
          void safePlayTrack(track, shared.tracks, 'Общий плейлист'); setShared(null);
        }} /> : <Text>В плейлисте пока нет доступных треков.</Text>}
      </CollectionPanel>}
      {reportTrack && <CollectionPanel title={'Жалоба · ' + reportTrack.title} close={() => setReportTrack(null)}>
        <Field label="Причина жалобы" value={reason} onChangeText={setReason} maxLength={500} />
        <PrimaryButton title="Отправить" loading={reportBusy} disabled={reason.trim().length < 5} onPress={async () => {
          if (reportBusy || !supabase || !authUser) return;
          setReportBusy(true);
          const { error } = await supabase.from('ritm_reports').insert({ reporter: authUser.id, track_id: reportTrack.id, reason: reason.trim() });
          setReportBusy(false);
          if (error && error.code !== '23505') { setNotice('Не удалось отправить жалобу. Попробуйте ещё раз.'); return; }
          setReportTrack(null);
          setNotice(error ? 'Вы уже отправляли жалобу на этот трек.' : 'Жалоба отправлена.');
        }} />
      </CollectionPanel>}
    </View>
    </TrackCardsContext.Provider>
  );
}
