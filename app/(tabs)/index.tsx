import { useState, useRef, useEffect } from 'react';
import { Text, View, Pressable, Image, Modal, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { useMusic } from '../../lib/music';
import { Track } from '../../lib/music-data';
import { supabase } from '../../lib/supabase';

function WebIcon({ name, size = 18, color = '#ffffff' }: { name: string; size?: number; color?: string }) {
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
    'eye-off-outline': 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.17c0-1.66-1.34-3-3-3l-.17.02z',
    'trash-outline': 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    'play-circle': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
    'camera': 'M12 15c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm9-9h-3.17l-1.86-2H8.03L6.17 6H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-9 14c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5 z',
    'logout': 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z'
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
  'Electronic', 'Lofi', 'Jazz', 'Rap', 'Trap', 'Techno', 'Rock'
];

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop';

const AUDIUS_HOSTS = [
  'https://discoveryprovider.audius.co',
  'https://audius-dp.culper.io',
  'https://audius-metadata-5.figment.io'
];

function formatTime(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function TrackCoverImage({ track, style }: { track: Track | null; style: any }) {
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    if (track && track.cover_url && typeof track.cover_url === 'string' && track.cover_url.trim().startsWith('http')) {
      setCoverUri(track.cover_url.trim());
    } else {
      setCoverUri(null);
    }
  }, [track?.id, track?.cover_url]);

  if (!coverUri || hasError) {
    return (
      <View style={[style, { backgroundColor: '#2c2c2e', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 22, color: '#8e8e93' }}>🎵</Text>
      </View>
    );
  }
  return (
    <Image 
      source={{ uri: coverUri }} 
      style={style} 
      resizeMode="cover" 
      onError={() => setHasError(true)} 
    />
  );
}

export default function CatalogScreen() {
  let m: any = {};
  try {
    m = useMusic() || {};
  } catch (e) {
    m = {};
  }

  const [userProfile, setUserProfile] = useState<{
    isLoggedIn: boolean;
    name: string;
    phoneOrEmail: string;
    avatarUrl: string;
  }>({
    isLoggedIn: false,
    name: 'Гость',
    phoneOrEmail: '',
    avatarUrl: DEFAULT_AVATAR,
  });

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEqualizerModal, setShowEqualizerModal] = useState(false);
  const [selectedTrackMenu, setSelectedTrackMenu] = useState<{ track: Track; source: 'network' | 'my_music' | 'uploads' } | null>(null);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [selectedPlaylistModal, setSelectedPlaylistModal] = useState<{ title: string; tracks: Track[] } | null>(null);
  
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  
  const [userPlaylists, setUserPlaylists] = useState<{ id: string; title: string; tracks: Track[]; cover?: string }[]>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ritm_user_playlists');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [myMusicTracks, setMyMusicTracks] = useState<Track[]>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ritm_my_music');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ritm_recently_played');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('ritm_user_playlists', JSON.stringify(userPlaylists));
      } catch (e) {}
    }
  }, [userPlaylists]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('ritm_my_music', JSON.stringify(myMusicTracks));
      } catch (e) {}
    }
  }, [myMusicTracks]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('ritm_recently_played', JSON.stringify(recentlyPlayed));
      } catch (e) {}
    }
  }, [recentlyPlayed]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('Все жанры');

  const [cloudUploadedTracks, setCloudUploadedTracks] = useState<Track[]>([]);
  const [globalSearchResults, setGlobalSearchResults] = useState<Track[]>([]);
  const [hiddenTrackIds, setHiddenTrackIds] = useState<string[]>([]);
  const [currentQueue, setCurrentQueue] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [activeTab, setActiveTab] = useState<'main' | 'uploads' | 'my_music'>('main');
  
  const [volume, setVolume] = useState(0.7);
  const [prevVolume, setPrevVolume] = useState(0.7);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const seekBarContainerRef = useRef<any>(null);
  const volumeBarContainerRef = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserProfile({
          isLoggedIn: true,
          name: session.user.user_metadata?.full_name || 'Пользователь',
          phoneOrEmail: session.user.email || '',
          avatarUrl: session.user.user_metadata?.avatar_url || DEFAULT_AVATAR
        });
      } else {
        setUserProfile({
          isLoggedIn: false,
          name: 'Гость',
          phoneOrEmail: '',
          avatarUrl: DEFAULT_AVATAR,
        });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserProfile({
          isLoggedIn: true,
          name: session.user.user_metadata?.full_name || 'Пользователь',
          phoneOrEmail: session.user.email || '',
          avatarUrl: session.user.user_metadata?.avatar_url || DEFAULT_AVATAR
        });
      } else {
        setUserProfile({
          isLoggedIn: false,
          name: 'Гость',
          phoneOrEmail: '',
          avatarUrl: DEFAULT_AVATAR,
        });
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const loadCloudTracks = async () => {
    try {
      const { data } = await supabase
        .from('tracks')
        .select('*')
        .not('audio_url', 'is', null)
        .neq('audio_url', '')
        .order('id', { ascending: false });

      if (data) {
        const mapped: Track[] = data.map((item: any) => ({
          id: String(item.id),
          title: item.title || 'Без названия',
          artist: item.artist || '',
          genre: item.genre || 'Deep House',
          duration: item.duration || 180,
          url: item.audio_url || item.url || '',
          cover_url: (item.cover_key && item.cover_key.startsWith('http')) ? item.cover_key : (item.cover_url || ''),
        }));
        setCloudUploadedTracks(mapped);
      }
    } catch (e) {}
  };

  useEffect(() => { loadCloudTracks(); }, [activeTab]);

  const fetchRecommendedMusic = async (query: string, genre: string) => {
    setIsSearching(true);
    let aggregated: Track[] = [];

    try {
      let dbQuery = supabase.from('tracks').select('*').not('audio_url', 'is', null).neq('audio_url', '');
      if (query.trim().length >= 2) dbQuery = dbQuery.ilike('title', `%${query.trim()}%`);
      if (genre !== 'Все жанры') dbQuery = dbQuery.ilike('genre', `%${genre}%`);
      
      const { data: cloudData } = await dbQuery.limit(50);
      if (cloudData) {
        aggregated.push(...cloudData.map((item: any) => ({
          id: String(item.id),
          title: item.title,
          artist: item.artist || '',
          genre: item.genre || 'Cloud',
          duration: item.duration || 180,
          url: item.audio_url || item.url || '',
          cover_url: (item.cover_key && item.cover_key.startsWith('http')) ? item.cover_key : (item.cover_url || ''),
        })));
      }

      const host = AUDIUS_HOSTS[0];
      const searchTerm = query.trim().length >= 2 ? query.trim() : (genre !== 'Все жанры' ? genre : '');

      let urlsToFetch: string[] = [];
      if (searchTerm) {
        urlsToFetch = [`${host}/v1/tracks/search?query=${encodeURIComponent(searchTerm)}&app_name=RITM_APP&limit=100`];
      } else {
        urlsToFetch = [
          `${host}/v1/tracks/trending?app_name=RITM_APP&limit=100`,
          `${host}/v1/tracks/search?query=Deep%20House&app_name=RITM_APP&limit=100`,
        ];
      }

      const responses = await Promise.all(urlsToFetch.map(u => fetch(u).then(r => r.json()).catch(() => null)));
      
      responses.forEach((res) => {
        if (res && res.data && Array.isArray(res.data)) {
          const items = res.data.map((item: any) => ({
            id: `audius_${item.id}`,
            title: item.title,
            artist: item.user?.name || '',
            genre: item.genre || 'Deep House',
            duration: item.duration || 180,
            url: `${host}/v1/tracks/${item.id}/stream?app_name=RITM_APP`,
            raw_id: item.id,
            cover_url: item.artwork?.['480x480'] || item.artwork?.['150x150'] || '',
          }));
          aggregated.push(...items);
        }
      });

      const filtered = aggregated.filter(t => !hiddenTrackIds.includes(t.id));
      setGlobalSearchResults(filtered);
    } catch (err) {
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { void fetchRecommendedMusic(searchQuery, selectedGenre); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedGenre, hiddenTrackIds]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!webAudioRef.current) webAudioRef.current = new Audio();
      webAudioRef.current.volume = volume;
      const audio = webAudioRef.current;
      
      const updateTime = () => { 
        if (!isDraggingSeek) {
          const dur = audio.duration || trackDuration || 0;
          if (dur > 0) {
            setCurrentTime(Math.min(audio.currentTime, dur));
          } else {
            setCurrentTime(audio.currentTime);
          }
        } 
      };
      const updateDuration = () => { 
        if (audio.duration && !isNaN(audio.duration)) setTrackDuration(audio.duration); 
      };

      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('ended', handleNext);
      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleNext);
      };
    }
  }, [isDraggingSeek, currentQueue, isShuffle, trackDuration]);

  const updateSeekPosition = (clientX: number) => {
    const activeDuration = m?.currentTrack?.duration || trackDuration || 0;
    if (!activeDuration || !seekBarContainerRef.current) return;
    let rect: any = null;
    if (seekBarContainerRef.current.getBoundingClientRect) rect = seekBarContainerRef.current.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newTime = (offsetX / rect.width) * activeDuration;
    setCurrentTime(newTime);
    if (Platform.OS === 'web' && webAudioRef.current) webAudioRef.current.currentTime = newTime;
  };

  const updateVolumePosition = (clientX: number) => {
    if (!volumeBarContainerRef.current) return;
    let rect: any = null;
    if (volumeBarContainerRef.current.getBoundingClientRect) rect = volumeBarContainerRef.current.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newVol = Math.max(0, Math.min(1, offsetX / rect.width));
    setVolume(newVol);
    if (Platform.OS === 'web' && webAudioRef.current) webAudioRef.current.volume = newVol;
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleMove = (e: MouseEvent) => {
      if (isDraggingSeek) updateSeekPosition(e.clientX);
      if (isDraggingVolume) updateVolumePosition(e.clientX);
    };
    const handleUp = () => {
      if (isDraggingSeek) setIsDraggingSeek(false);
      if (isDraggingVolume) setIsDraggingVolume(false);
    };
    if (isDraggingSeek || isDraggingVolume) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingSeek, isDraggingVolume, trackDuration, m?.currentTrack?.duration]);

  const stopAudio = () => {
    if (Platform.OS === 'web' && webAudioRef.current) {
      webAudioRef.current.pause();
      webAudioRef.current.currentTime = 0;
      webAudioRef.current.src = '';
      setCurrentTime(0);
    }
    try { if (typeof m?.pauseTrack === 'function') m.pauseTrack(); } catch (e) {}
  };

  const safePlayTrack = async (track: Track, queueList?: Track[], context?: string) => {
    stopAudio();
    if (queueList && queueList.length > 0) setCurrentQueue(queueList);
    else setCurrentQueue(globalSearchResults);

    // Добавляем в недавно прослушиваемые
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      return [track, ...filtered].slice(0, 30);
    });

    let playableTrack = track;
    try {
      if (typeof m?.playTrack === 'function') {
        const res = await m.playTrack(track, queueList ? queueList.map(t => t.id) : undefined, context);
        if (res) playableTrack = res;
      }
    } catch (e) {}

    let rawUrl = track.url || (track as any).audio_url || (track as any).audioUrl || playableTrack?.url || '';

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:')) {
    } else if (rawUrl.trim().length > 0) {
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ewrbxlrenzorutlvdgil.supabase.co';
      const cleanPath = rawUrl.replace(/^\/+/, '');
      if (cleanPath.startsWith('storage/v1/object/public/')) {
        rawUrl = `${SUPABASE_URL}/${cleanPath}`;
      } else {
        rawUrl = `${SUPABASE_URL}/storage/v1/object/public/music-storage/${cleanPath}`;
      }
    }

    setTrackDuration(track.duration || playableTrack?.duration || 180);
    setCurrentTime(0);

    if (Platform.OS === 'web' && webAudioRef.current) {
      if (!rawUrl || rawUrl.trim().length === 0) return;

      try {
        webAudioRef.current.src = rawUrl;
        webAudioRef.current.volume = volume;
        const playPromise = webAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            if (track.raw_id) {
              const fallbackUrl = `${AUDIUS_HOSTS[1]}/v1/tracks/${track.raw_id}/stream?app_name=RITM_APP`;
              webAudioRef.current!.src = fallbackUrl;
              webAudioRef.current!.play().catch(() => {});
            }
          });
        }
      } catch (err) {}
    }
  };

  const playTrackAtIndex = (index: number, currentList: Track[], contextTitle: string) => {
    if (currentList.length === 0) return;
    const nextIndex = (index + currentList.length) % currentList.length;
    const targetTrack = currentList[nextIndex];
    if (targetTrack) void safePlayTrack(targetTrack, currentList, contextTitle);
  };

  const handleNext = () => {
    const activeList = currentQueue.length > 0 ? currentQueue : globalSearchResults;
    if (activeList.length === 0) return;
    if (isShuffle) {
      playTrackAtIndex(Math.floor(Math.random() * activeList.length), activeList, 'Перемешано');
      return;
    }
    const currentIndex = activeList.findIndex(t => t.id === m?.currentTrack?.id);
    playTrackAtIndex(currentIndex !== -1 ? currentIndex + 1 : 0, activeList, 'Плеер');
  };

  const handlePrevious = () => {
    const activeList = currentQueue.length > 0 ? currentQueue : globalSearchResults;
    if (activeList.length === 0) return;
    const currentIndex = activeList.findIndex(t => t.id === m?.currentTrack?.id);
    playTrackAtIndex(currentIndex !== -1 ? currentIndex - 1 : activeList.length - 1, activeList, 'Плеер');
  };

  const handleTogglePlay = async () => {
    if (Platform.OS === 'web' && webAudioRef.current && webAudioRef.current.src) {
      if (webAudioRef.current.paused) await webAudioRef.current.play().catch(() => {});
      else webAudioRef.current.pause();
    }
    try {
      if (m?.isPlaying) { if (typeof m?.pauseTrack === 'function') await m.pauseTrack(); }
      else { if (typeof m?.resumeTrack === 'function') await m.resumeTrack(); }
    } catch (e) {}
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
      if (webAudioRef.current) webAudioRef.current.volume = 0;
    } else {
      const restored = prevVolume > 0 ? prevVolume : 0.7;
      setVolume(restored);
      if (webAudioRef.current) webAudioRef.current.volume = restored;
    }
  };

  const toggleAddToMyMusic = (track: Track) => {
    const exists = myMusicTracks.some(t => t.id === track.id);
    if (exists) {
      setMyMusicTracks(prev => prev.filter(t => t.id !== track.id));
    } else {
      setMyMusicTracks(prev => [track, ...prev]);
    }
  };

  const handleRemoveTrack = (track: Track, source: 'my_music' | 'uploads') => {
    if (source === 'my_music') {
      setMyMusicTracks(prev => prev.filter(t => t.id !== track.id));
    } else if (source === 'uploads') {
      setCloudUploadedTracks(prev => prev.filter(t => t.id !== track.id));
    }
    setSelectedTrackMenu(null);
  };

  const handleAddTrackToPlaylist = (playlistId: string, track: Track) => {
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

  const handleCreatePlaylist = () => {
    if (!newPlaylistTitle.trim()) return;
    const newPl = {
      id: `pl_${Date.now()}`,
      title: newPlaylistTitle.trim(),
      tracks: [],
    };
    setUserPlaylists(prev => [newPl, ...prev]);
    setNewPlaylistTitle('');
    setShowCreatePlaylistModal(false);
  };

  const isCurrentTrackFavorite = m?.currentTrack 
    ? myMusicTracks.some(t => t.id === m.currentTrack.id) 
    : false;

  const smartPlaylists = [
    { id: 'smart_trending', title: '🔥 Популярное', tracks: globalSearchResults.slice(0, 50), cover_url: globalSearchResults[0]?.cover_url || '' },
    { id: 'smart_recent', title: '🕒 Недавно прослушиваемые', tracks: recentlyPlayed, cover_url: recentlyPlayed[0]?.cover_url || '' },
  ];

  const activeDuration = m?.currentTrack?.duration || trackDuration || 180;
  const progressPercent = activeDuration > 0 ? Math.min(100, Math.max(0, (currentTime / activeDuration) * 100)) : 0;

  return (
    <View style={{ flex: 1, flexDirection: 'column', backgroundColor: '#f2f2f7' }}>
      <View style={{ flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
        
        {/* ЛЕВОЕ МЕНЮ */}
        <View style={{ 
          width: 250, 
          backgroundColor: '#fafafa', 
          borderRightWidth: 1, 
          borderColor: 'rgba(0, 0, 0, 0.08)', 
          paddingVertical: 24, 
          paddingHorizontal: 16,
          zIndex: 50
        }}>
          <View style={{ marginBottom: 28, zIndex: 60 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#000000', letterSpacing: -0.5 }}>Ритм<Text style={{ color: '#fa233b' }}>.</Text></Text>
            </View>

            {!userProfile?.isLoggedIn ? (
              <View style={{ flexDirection: 'row', gap: 6, width: '100%' }}>
                <Pressable onPress={() => {}} style={{ flex: 1, backgroundColor: 'rgba(250, 35, 59, 0.1)', paddingVertical: 7, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#fa233b' }}>Вход</Text>
                </Pressable>
                <Pressable onPress={() => {}} style={{ flex: 1, backgroundColor: '#fa233b', paddingVertical: 7, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#ffffff' }}>Регистрация</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setShowProfileMenu(!showProfileMenu)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                <Image source={{ uri: userProfile.avatarUrl }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#fa233b' }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: '#000000' }}>{userProfile.name}</Text>
                  <Text style={{ fontSize: 10, color: '#8e8e93' }}>Профиль ▼</Text>
                </View>
              </Pressable>
            )}
          </View>

          <Text style={{ fontSize: 10, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 4 }}>Медиатека</Text>
          <View style={{ gap: 6 }}>
            {[
              { id: 'main', label: 'Слушать' },
              { id: 'uploads', label: 'Загруженные' },
              { id: 'my_music', label: 'Моя музыка' },
            ].map((tab: any) => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable 
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)} 
                  style={{ 
                    paddingVertical: 11, 
                    paddingHorizontal: 14, 
                    borderRadius: 12, 
                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                    shadowColor: isActive ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: isActive ? 2 : 0
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: isActive ? '700' : '500', color: isActive ? '#fa233b' : '#1c1c1e' }}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <View style={{ flex: 1, paddingTop: 32, paddingHorizontal: 28, paddingBottom: 120 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#000000' }}>
              {activeTab === 'main' ? 'Слушать' : activeTab === 'uploads' ? 'Загруженные треки' : 'Моя музыка'}
            </Text>

            {activeTab === 'uploads' && (
              <Pressable 
                onPress={() => router.push('/upload')} 
                style={{ 
                  backgroundColor: '#fa233b', 
                  paddingHorizontal: 18, 
                  paddingVertical: 10, 
                  borderRadius: 8,
                  shadowColor: '#fa233b',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 3
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>+ Загрузить</Text>
              </Pressable>
            )}
          </View>

          {/* ВКЛАДКА 1: СЛУШАТЬ */}
          {activeTab === 'main' && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
                <TextInput 
                  placeholder="Поиск музыки..." 
                  placeholderTextColor="#8e8e93"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{ flex: 1, fontSize: 15, color: '#000000', outlineStyle: 'none' as any }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
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
                        elevation: 2
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
                  {smartPlaylists.map((sp) => (
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
                        elevation: 3
                      })}
                    >
                      <View style={{ width: '100%', height: 126, borderRadius: 12, backgroundColor: '#e5e5ea', marginBottom: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                        {sp.cover_url ? <Image source={{ uri: sp.cover_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: 32 }}>🎵</Text>}
                      </View>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#000000' }}>{sp.title}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{sp.tracks.length} треков</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>
                Рекомендуемые треки ({globalSearchResults.length})
              </Text>

              {isSearching && <ActivityIndicator size="small" color="#fa233b" style={{ marginVertical: 12 }} />}

              {globalSearchResults.map((item: Track) => {
                const isSelected = m?.currentTrack?.id === item.id;
                return (
                  <View 
                    key={item.id} 
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      backgroundColor: isSelected ? 'rgba(250, 35, 59, 0.08)' : 'rgba(255, 255, 255, 0.8)', 
                      backdropFilter: 'blur(16px)' as any,
                      padding: 10, 
                      borderRadius: 14, 
                      marginBottom: 8, 
                      borderWidth: 1, 
                      borderColor: isSelected ? 'rgba(250, 35, 59, 0.4)' : 'rgba(255, 255, 255, 0.7)',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.03,
                      shadowRadius: 4,
                      elevation: 1
                    }}
                  >
                    <Pressable onPress={() => void safePlayTrack(item, globalSearchResults, 'Слушать')} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <TrackCoverImage track={item} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 14 }} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: isSelected ? '#fa233b' : '#000000' }}>{item.title}</Text>
                        {item.artist ? <Text numberOfLines={1} style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>{item.artist}</Text> : null}
                      </View>
                    </Pressable>
                    <Text style={{ fontSize: 13, color: '#8e8e93', marginRight: 12 }}>{formatTime(item.duration)}</Text>
                    <Pressable 
                      onPress={() => { setShowPlaylistSelector(false); setSelectedTrackMenu({ track: item, source: 'network' }); }} 
                      style={{ 
                        padding: 10, 
                        zIndex: 10,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 1
                      }}
                    >
                      <WebIcon name="ellipsis-vertical" size={18} color="#1c1c1e" />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* ВКЛАДКА 2: ЗАГРУЖЕННЫЕ */}
          {activeTab === 'uploads' && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>
                Облачные загрузки Supabase ({cloudUploadedTracks.length})
              </Text>

              {cloudUploadedTracks.map((item) => {
                const isSelected = m?.currentTrack?.id === item.id;
                return (
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? 'rgba(250, 35, 59, 0.08)' : 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(16px)' as any, padding: 10, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: isSelected ? '#fa233b' : 'rgba(255, 255, 255, 0.7)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
                    <Pressable onPress={() => void safePlayTrack(item, cloudUploadedTracks, 'Загруженные')} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <TrackCoverImage track={item} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 14 }} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: isSelected ? '#fa233b' : '#000000' }}>{item.title}</Text>
                        <View style={{ backgroundColor: 'rgba(250, 35, 59, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#fa233b' }}>{item.genre || 'Deep'}</Text>
                        </View>
                      </View>
                    </Pressable>
                    <Text style={{ fontSize: 13, color: '#8e8e93', marginRight: 12 }}>{formatTime(item.duration)}</Text>
                    <Pressable onPress={() => { setShowPlaylistSelector(false); setSelectedTrackMenu({ track: item, source: 'uploads' }); }} style={{ padding: 10, zIndex: 10 }}>
                      <WebIcon name="ellipsis-vertical" size={18} color="#1c1c1e" />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* ВКЛАДКА 3: МОЯ МУЗЫКА */}
          {activeTab === 'my_music' && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              
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
                    elevation: 2
                  })}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(250, 35, 59, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                    <WebIcon name="add-outline" size={24} color="#fa233b" />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#fa233b', textAlign: 'center' }}>Создать плейлист</Text>
                </Pressable>

                {userPlaylists.map((pl) => (
                  <Pressable 
                    key={pl.id}
                    onPress={() => setSelectedPlaylistModal({ title: pl.title, tracks: pl.tracks })}
                    style={({ pressed }) => ({ 
                      width: 140, 
                      height: 170,
                      backgroundColor: 'rgba(255, 255, 255, 0.8)', 
                      borderRadius: 18, 
                      padding: 12, 
                      marginRight: 14,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                      elevation: 3
                    })}
                  >
                    <View style={{ width: '100%', height: 100, borderRadius: 12, backgroundColor: '#e5e5ea', marginBottom: 8, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 32 }}>📚</Text>
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#000000' }}>{pl.title}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{pl.tracks.length} треков</Text>
                  </Pressable>
                ))}
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
                myMusicTracks.map((item) => {
                  const isSelected = m?.currentTrack?.id === item.id;
                  return (
                    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? 'rgba(250, 35, 59, 0.08)' : 'rgba(255, 255, 255, 0.8)', padding: 10, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: isSelected ? '#fa233b' : 'rgba(255, 255, 255, 0.7)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
                      <Pressable onPress={() => void safePlayTrack(item, myMusicTracks, 'Моя музыка')} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <TrackCoverImage track={item} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 14 }} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: isSelected ? '#fa233b' : '#000000' }}>{item.title}</Text>
                        </View>
                      </Pressable>
                      <Text style={{ fontSize: 13, color: '#8e8e93', marginRight: 12 }}>{formatTime(item.duration)}</Text>
                      <Pressable onPress={() => { setShowPlaylistSelector(false); setSelectedTrackMenu({ track: item, source: 'my_music' }); }} style={{ padding: 10, zIndex: 10 }}>
                        <WebIcon name="ellipsis-vertical" size={18} color="#1c1c1e" />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* НИЖНИЙ ПЛЕЕР (скругление по бокам borderRadius: 42, тени под всеми кнопками) */}
      <View style={{
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        width: '78%',
        maxWidth: 920,
        height: 90, 
        backgroundColor: 'rgba(25, 25, 30, 0.45)', 
        backdropFilter: 'blur(35px) saturate(180%)' as any,
        borderRadius: 42,
        borderWidth: 1, 
        borderColor: 'rgba(255, 255, 255, 0.25)', 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 24, 
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.3)' as any,
        zIndex: 100
      }}>
        <View style={{ position: 'absolute', top: 8, left: 24, right: 24, height: 12, zIndex: 120, justifyContent: 'center' }}>
          <Pressable 
            ref={seekBarContainerRef} 
            onPressIn={(e) => { setIsDraggingSeek(true); updateSeekPosition(e.nativeEvent.pageX || e.nativeEvent.clientX); }} 
            style={{ height: '100%', width: '100%', justifyContent: 'center', cursor: 'pointer' }}
          >
            {/* @ts-ignore */}
            <View pointerEvents="none" style={{ width: '100%', height: 4, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 2, position: 'relative' }}>
              <View style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#fa233b', borderRadius: 2, boxShadow: '0 0 8px rgba(250, 35, 59, 0.9)' as any }} />
              <View style={{
                position: 'absolute',
                left: `${Math.min(99, Math.max(0.5, progressPercent))}%`,
                top: -4,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: '#ffffff',
                borderWidth: 2.5,
                borderColor: '#fa233b',
                transform: [{ translateX: -6 }],
                boxShadow: '0 0 10px #fa233b, 0 2px 6px rgba(0,0,0,0.5)' as any
              }} />
            </View>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', width: 280, marginTop: 8 }}>
          {m?.currentTrack ? (
            <>
              <TrackCoverImage track={m.currentTrack} style={{ width: 54, height: 54, borderRadius: 14, marginRight: 14 }} />
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#ffffff' }}>{m.currentTrack.title}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#fa233b', marginTop: 3 }}>
                  {formatTime(currentTime)} / {formatTime(activeDuration)}
                </Text>
              </View>
              <Pressable 
                onPress={() => toggleAddToMyMusic(m.currentTrack)} 
                style={{ 
                  padding: 8,
                  shadowColor: '#fa233b',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.4,
                  shadowRadius: 4,
                  elevation: 2
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
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 2
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
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 2
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
              shadowColor: '#fa233b',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
              elevation: 4
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
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 2
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
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 2
            }}
          >
            <WebIcon name="repeat" size={16} color={isRepeat ? '#fa233b' : '#ffffff'} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, width: 240, marginTop: 8 }}>
          <Pressable onPress={handleMuteToggle} style={{ padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 1 }}>
            <WebIcon name={volume === 0 ? "volume-mute" : "volume-low"} size={18} color="#ffffff" />
          </Pressable>
          <Pressable ref={volumeBarContainerRef} onPressIn={(e) => { setIsDraggingVolume(true); updateVolumePosition(e.nativeEvent.pageX || e.nativeEvent.clientX); }} style={{ width: 80, height: 20, justifyContent: 'center', cursor: 'pointer' }}>
            {/* @ts-ignore */}
            <View pointerEvents="none" style={{ width: '100%', height: 4, backgroundColor: 'rgba(255, 255, 255, 0.22)', borderRadius: 2 }}>
              <View style={{ width: `${volume * 100}%`, height: '100%', backgroundColor: '#fa233b', borderRadius: 2 }} />
            </View>
          </Pressable>
          <Pressable 
            onPress={() => setShowEqualizerModal(true)} 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              borderWidth: 1, 
              borderColor: 'rgba(255, 255, 255, 0.2)', 
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 2
            }}
          >
            <WebIcon name="options-outline" size={16} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* МОДАЛЬНЫЕ ОКНА */}
      <Modal animationType="fade" transparent visible={showCreatePlaylistModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: '#1c1c1e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>Новый плейлист</Text>
              <Pressable onPress={() => setShowCreatePlaylistModal(false)} style={{ padding: 4 }}>
                <WebIcon name="close" size={20} color="#d1d1d6" />
              </Pressable>
            </View>
            <TextInput 
              placeholder="Название плейлиста..." 
              placeholderTextColor="#8e8e93"
              value={newPlaylistTitle}
              onChangeText={setNewPlaylistTitle}
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#ffffff', fontSize: 16, marginBottom: 20 }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setShowCreatePlaylistModal(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Отмена</Text>
              </Pressable>
              <Pressable onPress={handleCreatePlaylist} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#fa233b', alignItems: 'center' }}>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Создать</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ОКНО СПИСКА ТРЕКОВ ПЛЕЙЛИСТА (Темно-серый цвет + стеклянная прозрачность как у плеера) */}
      <Modal animationType="fade" transparent visible={!!selectedPlaylistModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10, 10, 15, 0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ 
            width: '100%', 
            maxWidth: 560, 
            maxHeight: '80%', 
            backgroundColor: 'rgba(35, 35, 42, 0.85)', 
            backdropFilter: 'blur(35px) saturate(180%)' as any,
            borderRadius: 32, 
            padding: 24, 
            borderWidth: 1, 
            borderColor: 'rgba(255, 255, 255, 0.2)',
            boxShadow: '0 15px 40px rgba(0, 0, 0, 0.4)' as any
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff' }}>{selectedPlaylistModal?.title}</Text>
              <Pressable onPress={() => setSelectedPlaylistModal(null)} style={{ padding: 4 }}>
                <WebIcon name="close" size={24} color="#d1d1d6" />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {selectedPlaylistModal?.tracks.length === 0 ? (
                <Text style={{ color: '#8e8e93', fontSize: 14, textAlign: 'center', marginVertical: 20 }}>В этом списке пока нет треков.</Text>
              ) : (
                selectedPlaylistModal?.tracks.map((track) => (
                  <Pressable 
                    key={track.id} 
                    onPress={() => {
                      void safePlayTrack(track, selectedPlaylistModal.tracks, selectedPlaylistModal.title);
                      setSelectedPlaylistModal(null);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', padding: 10, borderRadius: 12, marginBottom: 8 }}
                  >
                    <TrackCoverImage track={track} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>{track.title}</Text>
                    </View>
                    <WebIcon name="play-circle" size={24} color="#fa233b" />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={!!selectedTrackMenu}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10, 10, 15, 0.4)', backdropFilter: 'blur(16px)' as any, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          {selectedTrackMenu && (
            <View style={{ 
              width: '100%', 
              maxWidth: 340, 
              backgroundColor: 'rgba(60, 60, 70, 0.85)', 
              backdropFilter: 'blur(30px) saturate(180%)' as any, 
              borderRadius: 24, 
              padding: 20, 
              borderWidth: 1, 
              borderColor: 'rgba(255, 255, 255, 0.25)',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.3)' as any
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#ffffff', flex: 1 }} numberOfLines={1}>
                  {selectedTrackMenu.track.title}
                </Text>
                <Pressable onPress={() => { setSelectedTrackMenu(null); setShowPlaylistSelector(false); }}>
                  <WebIcon name="close" size={20} color="#a1a1a6" />
                </Pressable>
              </View>

              <Pressable 
                onPress={() => setShowPlaylistSelector(!showPlaylistSelector)} 
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <WebIcon name="add-outline" size={20} color="#ffffff" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff', marginLeft: 12, flex: 1 }}>Добавить в плейлист</Text>
                {userPlaylists.length > 0 && (
                  <Text style={{ fontSize: 11, color: '#a1a1a6' }}>{showPlaylistSelector ? '▲' : '▼'}</Text>
                )}
              </Pressable>

              {showPlaylistSelector && userPlaylists.length > 0 && (
                <View style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)', borderRadius: 12, padding: 8, marginVertical: 6, gap: 4 }}>
                  {userPlaylists.map((pl) => (
                    <Pressable 
                      key={pl.id} 
                      onPress={() => handleAddTrackToPlaylist(pl.id, selectedTrackMenu.track)}
                      style={({ pressed }) => ({
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: pressed ? 'rgba(250, 35, 59, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      })}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }} numberOfLines={1}>📚 {pl.title}</Text>
                      <Text style={{ fontSize: 11, color: '#a1a1a6' }}>{pl.tracks.length} тр.</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Pressable 
                onPress={() => {
                  toggleAddToMyMusic(selectedTrackMenu.track);
                  setSelectedTrackMenu(null);
                }} 
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <WebIcon name="heart-outline" size={20} color="#fa233b" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff', marginLeft: 12 }}>Добавить в мою музыку</Text>
              </Pressable>

              {(selectedTrackMenu.source === 'my_music' || selectedTrackMenu.source === 'uploads') && (
                <Pressable 
                  onPress={() => handleRemoveTrack(selectedTrackMenu.track, selectedTrackMenu.source)} 
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  <WebIcon name="trash-outline" size={20} color="#fa233b" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fa233b', marginLeft: 12 }}>Удалить</Text>
                </Pressable>
              )}

              <Pressable 
                onPress={() => {
                  setHiddenTrackIds(prev => [...prev, selectedTrackMenu.track.id]);
                  setSelectedTrackMenu(null);
                }} 
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
              >
                <WebIcon name="eye-off-outline" size={20} color="#a1a1a6" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#a1a1a6', marginLeft: 12 }}>Удалить из рекомендуемого</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}