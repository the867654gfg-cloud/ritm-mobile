import { useState, useRef, useEffect } from 'react';
import { Text, View, Pressable, Image, Modal, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMusic } from '../../lib/music';
import { Track } from '../../lib/music-data';
import { supabase } from '../../lib/supabase';

const GENRES = [
  'Все жанры', 'Deep House', 'Chillout', 'Minimal House', 'Pop', 
  'Electronic', 'Lofi', 'Jazz', 'Rap', 'Trap', 'Techno', 'Rock'
];

const EQUALIZER_BANDS = [
  '32 Hz', '64 Hz', '125 Hz', '250 Hz', '500 Hz', '1 kHz', 
  '2 kHz', '4 kHz', '8 kHz', '12 kHz', '14 kHz', '16 kHz'
];

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
        <Ionicons name="musical-notes-outline" size={24} color="#fa233b" />
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

  const [showEqualizerModal, setShowEqualizerModal] = useState(false);
  const [selectedTrackMenu, setSelectedTrackMenu] = useState<{ track: Track; source: 'network' | 'my_music' | 'uploads' } | null>(null);
  const [selectedPlaylistModal, setSelectedPlaylistModal] = useState<{ title: string; tracks: Track[] } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('Все жанры');
  
  const [eqGains, setEqGains] = useState<{ [key: number]: number }>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0
  });

  const [cloudUploadedTracks, setCloudUploadedTracks] = useState<Track[]>([]);
  const [myMusicTracks, setMyMusicTracks] = useState<Track[]>([]);
  const [globalSearchResults, setGlobalSearchResults] = useState<Track[]>([]);
  const [hiddenTrackIds, setHiddenTrackIds] = useState<string[]>([]);
  const [currentQueue, setCurrentQueue] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [activeTab, setActiveTab] = useState<'main' | 'uploads' | 'my_music' | 'my_playlists'>('main');
  
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

  // Пользовательские плейлисты
  const customPlaylists = [
    { id: 'p1', title: 'Избранный вечерний микс', tracks: myMusicTracks.slice(0, 10), cover: myMusicTracks[0]?.cover_url },
    { id: 'p2', title: 'Мой драйв & Энергия', tracks: globalSearchResults.slice(0, 15), cover: globalSearchResults[2]?.cover_url },
    { id: 'p3', title: 'Deep House Коллекция', tracks: cloudUploadedTracks, cover: cloudUploadedTracks[0]?.cover_url },
  ];

  // Загрузка треков из Supabase
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

  // Загрузка рекомендованных треков из сети
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
      const updateTime = () => { if (!isDraggingSeek) setCurrentTime(audio.currentTime); };
      const updateDuration = () => { if (audio.duration && !isNaN(audio.duration)) setTrackDuration(audio.duration); };
      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('ended', handleNext);
      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleNext);
      };
    }
  }, [isDraggingSeek, currentQueue, isShuffle]);

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

    let playableTrack = track;
    try {
      if (typeof m?.playTrack === 'function') {
        const res = await m.playTrack(track, queueList ? queueList.map(t => t.id) : undefined, context);
        if (res) playableTrack = res;
      }
    } catch (e) {}

    let rawUrl = track.url || (track as any).audio_url || (track as any).audioUrl || playableTrack?.url || '';

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:')) {
      // Готовая ссылка
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

  const isCurrentTrackFavorite = m?.currentTrack 
    ? myMusicTracks.some(t => t.id === m.currentTrack.id) 
    : false;

  const smartPlaylists = [
    { id: 'smart_trending', title: '🔥 Популярное', tracks: globalSearchResults.slice(0, 50), cover_url: globalSearchResults[0]?.cover_url || '' },
    { id: 'smart_chill', title: '🌙 Ночной чилл', tracks: globalSearchResults.filter(t => t.genre && /chill|lofi|ambient|deep/i.test(t.genre)), cover_url: globalSearchResults[1]?.cover_url || '' },
  ];

  const activeDuration = m?.currentTrack?.duration || trackDuration || 180;
  const progressPercent = activeDuration > 0 ? Math.min(100, Math.max(0, (currentTime / activeDuration) * 100)) : 0;

  return (
    <View style={{ flex: 1, flexDirection: 'column', backgroundColor: '#f2f2f7' }}>
      <View style={{ flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
        
        {/* ЛЕВОЕ МЕНЮ С ТЕНЯМИ И 90% ПРОЗРАЧНОСТЬЮ */}
        <View style={{ 
          width: 250, 
          backgroundColor: 'rgba(250, 250, 252, 0.9)', 
          borderRightWidth: 1, 
          borderColor: 'rgba(0, 0, 0, 0.05)', 
          paddingVertical: 28, 
          paddingHorizontal: 18,
          boxShadow: '4px 0px 24px rgba(0, 0, 0, 0.06)'
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, paddingLeft: 8 }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#000000', letterSpacing: -0.5 }}>Ритм<Text style={{ color: '#fa233b' }}>.</Text></Text>
            <Pressable onPress={() => router.push('/sign-in')} style={{ backgroundColor: 'rgba(250, 35, 59, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="person-circle-outline" size={18} color="#fa233b" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fa233b' }}>Вход</Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 10, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 8 }}>Медиатека</Text>
          <View style={{ gap: 8 }}>
            {[
              { id: 'main', icon: 'disc-outline', label: 'Слушать' },
              { id: 'uploads', icon: 'cloud-upload-outline', label: 'Загруженные' },
              { id: 'my_music', icon: 'musical-notes-outline', label: 'Моя музыка' },
              { id: 'my_playlists', icon: 'library-outline', label: 'Мои плейлисты' },
            ].map((tab: any) => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable 
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)} 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    paddingVertical: 11, 
                    paddingHorizontal: 14, 
                    borderRadius: 12, 
                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                    boxShadow: isActive ? '0px 4px 12px rgba(0, 0, 0, 0.08)' : 'none'
                  }}
                >
                  <Ionicons name={tab.icon} size={18} color={isActive ? '#fa233b' : '#1c1c1e'} style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 15, fontWeight: isActive ? '700' : '500', color: isActive ? '#fa233b' : '#1c1c1e' }}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <View style={{ flex: 1, paddingTop: 32, paddingHorizontal: 28, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#000000' }}>
              {activeTab === 'main' ? 'Слушать' : activeTab === 'uploads' ? 'Загруженные треки' : activeTab === 'my_music' ? 'Моя музыка' : 'Мои плейлисты'}
            </Text>
            <Pressable onPress={() => router.push('/upload')} style={{ backgroundColor: '#fa233b', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>+ Загрузить</Text>
            </Pressable>
          </View>

          {/* ВКЛАДКА 1: СЛУШАТЬ */}
          {activeTab === 'main' && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', marginBottom: 16 }}>
                <Ionicons name="search" size={20} color="#8e8e93" style={{ marginRight: 10 }} />
                <TextInput 
                  placeholder="Поиск музыки..." 
                  placeholderTextColor="#8e8e93"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{ flex: 1, fontSize: 15, color: '#000000', outlineStyle: 'none' as any }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color="#8e8e93" />
                  </Pressable>
                )}
              </View>

              {/* ИКОНКИ ЖАНРОВ С КРАСИВЫМИ ТЕНЯМИ */}
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
                        boxShadow: isSelected ? '0px 6px 14px rgba(250, 35, 59, 0.3)' : '0px 3px 8px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? '#ffffff' : '#1c1c1e' }}>{g}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* ПОДБОРКИ С ТЕНЯМИ И ПРОЗРАЧНОСТЬЮ */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>✨ Подборки</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
                  {smartPlaylists.map((sp) => (
                    <Pressable 
                      key={sp.id} 
                      onPress={() => setSelectedPlaylistModal({ title: sp.title, tracks: sp.tracks })}
                      style={{ 
                        width: 150, 
                        marginRight: 14, 
                        backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                        padding: 12, 
                        borderRadius: 16, 
                        borderWidth: 1, 
                        borderColor: 'rgba(255, 255, 255, 0.6)',
                        boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.06)'
                      }}
                    >
                      <View style={{ width: '100%', height: 126, borderRadius: 12, backgroundColor: '#e5e5ea', marginBottom: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                        {sp.cover_url ? <Image source={{ uri: sp.cover_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="musical-notes" size={32} color="#fa233b" />}
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
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? 'rgba(250, 35, 59, 0.06)' : '#ffffff', padding: 10, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: isSelected ? '#fa233b' : 'rgba(0,0,0,0.06)' }}>
                    <Pressable onPress={() => void safePlayTrack(item, globalSearchResults, 'Слушать')} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <TrackCoverImage track={item} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 14 }} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: isSelected ? '#fa233b' : '#000000' }}>{item.title}</Text>
                        {item.artist ? <Text numberOfLines={1} style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>{item.artist}</Text> : null}
                      </View>
                    </Pressable>
                    <Text style={{ fontSize: 13, color: '#8e8e93', marginRight: 12 }}>{formatTime(item.duration)}</Text>
                    <Pressable onPress={() => setSelectedTrackMenu({ track: item, source: 'network' })} style={{ padding: 6 }}>
                      <Ionicons name="ellipsis-vertical" size={18} color="#1c1c1e" />
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
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? 'rgba(250, 35, 59, 0.06)' : '#ffffff', padding: 10, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: isSelected ? '#fa233b' : 'rgba(0,0,0,0.06)' }}>
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
                    <Pressable onPress={() => setSelectedTrackMenu({ track: item, source: 'uploads' })} style={{ padding: 6 }}>
                      <Ionicons name="ellipsis-vertical" size={18} color="#1c1c1e" />
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
                Сохраненные треки ({myMusicTracks.length})
              </Text>

              {myMusicTracks.length === 0 ? (
                <View style={{ padding: 24, backgroundColor: '#ffffff', borderRadius: 16, alignItems: 'center' }}>
                  <Ionicons name="heart-dislike-outline" size={36} color="#8e8e93" />
                  <Text style={{ color: '#8e8e93', fontSize: 14, marginTop: 8 }}>В вашей музыке пока нет сохраненных треков.</Text>
                </View>
              ) : (
                myMusicTracks.map((item) => {
                  const isSelected = m?.currentTrack?.id === item.id;
                  return (
                    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? 'rgba(250, 35, 59, 0.06)' : '#ffffff', padding: 10, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: isSelected ? '#fa233b' : 'rgba(0,0,0,0.06)' }}>
                      <Pressable onPress={() => void safePlayTrack(item, myMusicTracks, 'Моя музыка')} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <TrackCoverImage track={item} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 14 }} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: isSelected ? '#fa233b' : '#000000' }}>{item.title}</Text>
                        </View>
                      </Pressable>
                      <Text style={{ fontSize: 13, color: '#8e8e93', marginRight: 12 }}>{formatTime(item.duration)}</Text>
                      <Pressable onPress={() => setSelectedTrackMenu({ track: item, source: 'my_music' })} style={{ padding: 6 }}>
                        <Ionicons name="ellipsis-vertical" size={18} color="#1c1c1e" />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* ВКЛАДКА 4: МОИ ПЛЕЙЛИСТЫ */}
          {activeTab === 'my_playlists' && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 12 }}>
                Созданные плейлисты ({customPlaylists.length})
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {customPlaylists.map((pl) => (
                  <Pressable 
                    key={pl.id}
                    onPress={() => setSelectedPlaylistModal({ title: pl.title, tracks: pl.tracks })}
                    style={{ 
                      width: 180, 
                      backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                      padding: 14, 
                      borderRadius: 18, 
                      borderWidth: 1, 
                      borderColor: 'rgba(255, 255, 255, 0.6)',
                      boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <View style={{ width: '100%', height: 150, borderRadius: 12, backgroundColor: '#e5e5ea', marginBottom: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                      {pl.cover ? <Image source={{ uri: pl.cover }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="library" size={38} color="#fa233b" />}
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: '#000000' }}>{pl.title}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>{pl.tracks.length} треков</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* НИЖНИЙ ПЛЕЕР С УВЕЛИЧЕННОЙ ОБЛОЖКОЙ И 90% ПРОЗРАЧНОСТЬЮ */}
      <View style={{ 
        height: 102, 
        backgroundColor: 'rgba(20, 20, 20, 0.9)', 
        borderTopWidth: 1, 
        borderColor: 'rgba(255, 255, 255, 0.12)', 
        flexDirection: 'row', 
        justify: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 24, 
        width: '100%', 
        position: 'relative',
        backdropFilter: 'blur(12px)' as any
      }}>
        
        {/* ПЛАВНЫЙ ПОЛЗУНОК ПЕРЕМОТКИ */}
        <Pressable 
          ref={seekBarContainerRef} 
          onPressIn={(e) => { setIsDraggingSeek(true); updateSeekPosition(e.nativeEvent.pageX || e.nativeEvent.clientX); }} 
          style={{ height: 18, width: '100%', position: 'absolute', top: -9, left: 0, right: 0, zIndex: 30, justifyContent: 'center', cursor: 'pointer' }}
        >
          {/* @ts-ignore */}
          <View pointerEvents="none" style={{ width: '100%', height: 4, backgroundColor: 'rgba(255, 255, 255, 0.25)', position: 'relative' }}>
            <View style={{ 
              width: `${progressPercent}%`, 
              height: '100%', 
              backgroundColor: '#fa233b',
              transition: isDraggingSeek ? 'none' : 'width 0.15s linear' as any
            }} />
            <View style={{
              position: 'absolute',
              left: `${Math.min(99.5, Math.max(0.5, progressPercent))}%`,
              top: -4,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: '#ffffff',
              borderWidth: 2,
              borderColor: '#fa233b',
              transform: [{ translateX: -6 }],
              transition: isDraggingSeek ? 'none' : 'left 0.15s linear' as any
            }} />
          </View>
        </Pressable>

        {/* Левая часть: УВЕЛИЧЕННАЯ ОБЛОЖКА В 1.5 РАЗА (78px вместо 52px) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', width: 340 }}>
          {m?.currentTrack ? (
            <>
              <TrackCoverImage track={m.currentTrack} style={{ width: 78, height: 78, borderRadius: 12, marginRight: 14 }} />
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{m.currentTrack.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fa233b' }}>
                    {formatTime(currentTime)} / {formatTime(activeDuration)}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => toggleAddToMyMusic(m.currentTrack)} style={{ padding: 6 }}>
                <Ionicons name={isCurrentTrackFavorite ? "heart" : "heart-outline"} size={22} color="#fa233b" />
              </Pressable>
            </>
          ) : (
            <Text style={{ fontSize: 15, color: '#ffffff' }}>Музыка не выбрана</Text>
          )}
        </View>

        {/* Кнопки управления */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable onPress={() => setIsShuffle(!isShuffle)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isShuffle ? '#fa233b' : 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="shuffle" size={16} color="#ffffff" />
          </Pressable>
          <Pressable onPress={handlePrevious} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="play-skip-back" size={16} color="#ffffff" />
          </Pressable>
          <Pressable onPress={handleTogglePlay} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fa233b', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name={m?.isPlaying ? "pause" : "play"} size={20} color="#ffffff" style={{ marginLeft: m?.isPlaying ? 0 : 2 }} />
          </Pressable>
          <Pressable onPress={handleNext} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="play-skip-forward" size={16} color="#ffffff" />
          </Pressable>
          <Pressable onPress={() => setIsRepeat(!isRepeat)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isRepeat ? '#fa233b' : 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="repeat" size={16} color="#ffffff" />
          </Pressable>
        </View>

        {/* Громкость и Эквалайзер */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, width: 280 }}>
          <Pressable onPress={handleMuteToggle} style={{ padding: 4 }}>
            <Ionicons name={volume === 0 ? "volume-mute" : "volume-low"} size={18} color="#ffffff" />
          </Pressable>

          <Pressable 
            ref={volumeBarContainerRef}
            onPressIn={(e) => { setIsDraggingVolume(true); updateVolumePosition(e.nativeEvent.pageX || e.nativeEvent.clientX); }}
            style={{ width: 80, height: 20, justifyContent: 'center', cursor: 'pointer' }}
          >
            {/* @ts-ignore */}
            <View pointerEvents="none" style={{ width: '100%', height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1.5 }}>
              <View style={{ width: `${volume * 100}%`, height: '100%', backgroundColor: '#fa233b', borderRadius: 1.5 }} />
            </View>
          </Pressable>

          <Pressable onPress={() => setShowEqualizerModal(true)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="options-outline" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* МОДАЛЬНОЕ ОКНО ДЛЯ ПРОСМОТРА ПОДБОРКИ / ПЛЕЙЛИСТА */}
      <Modal animationType="fade" transparent visible={!!selectedPlaylistModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ 
            width: '100%', 
            maxWidth: 560, 
            maxHeight: '80%',
            backgroundColor: 'rgba(28, 28, 30, 0.92)', 
            borderRadius: 24, 
            padding: 24, 
            borderWidth: 1, 
            borderColor: 'rgba(255, 255, 255, 0.15)',
            boxShadow: '0px 16px 32px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(16px)' as any
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff' }}>{selectedPlaylistModal?.title}</Text>
              <Pressable onPress={() => setSelectedPlaylistModal(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#d1d1d6" />
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {selectedPlaylistModal?.tracks.length === 0 ? (
                <Text style={{ color: '#8e8e93', fontSize: 14, textAlign: 'center', marginVertical: 20 }}>В этом плейлисте пока нет треков.</Text>
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
                    <Ionicons name="play-circle" size={24} color="#fa233b" />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ЭКВАЛАЙЗЕР И МЕНЮ ТРЕКА */}
      <Modal animationType="fade" transparent visible={showEqualizerModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 540, backgroundColor: '#1c1c1e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>🎛️ 12-полосный эквалайзер</Text>
              <Pressable onPress={() => setShowEqualizerModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#d1d1d6" />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', height: 180, paddingVertical: 10, marginBottom: 16 }}>
              {EQUALIZER_BANDS.map((band, index) => {
                const currentGain = eqGains[index] || 0;
                return (
                  <View key={band} style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 10, color: '#8e8e93', marginBottom: 6 }}>{currentGain > 0 ? `+${currentGain}` : currentGain} dB</Text>
                    <View style={{ width: 6, height: 120, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, justifyContent: 'center', alignItems: 'center' }}>
                      <TextInput 
                        value={String(currentGain)}
                        onChangeText={(val) => {
                          const num = parseInt(val, 10);
                          if (!isNaN(num)) {
                            setEqGains(prev => ({ ...prev, [index]: Math.max(-10, Math.min(10, num)) }));
                          }
                        }}
                        keyboardType="numeric"
                        style={{ width: 28, height: 28, backgroundColor: '#fa233b', borderRadius: 14, textAlign: 'center', fontSize: 10, color: '#ffffff', fontWeight: '700' }}
                      />
                    </View>
                    <Text style={{ fontSize: 10, color: '#ffffff', marginTop: 8 }}>{band}</Text>
                  </View>
                );
              })}
            </View>

            <Pressable onPress={() => setEqGains({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 })} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Сбросить настройки</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="none" transparent visible={!!selectedTrackMenu}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          {selectedTrackMenu && (
            <View style={{ width: '100%', maxWidth: 320, backgroundColor: '#1c1c1e', borderRadius: 20, padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#ffffff', flex: 1 }} numberOfLines={1}>
                  {selectedTrackMenu.track.title}
                </Text>
                <Pressable onPress={() => setSelectedTrackMenu(null)}><Ionicons name="close" size={20} color="#a1a1a6" /></Pressable>
              </View>

              {selectedTrackMenu.source === 'network' && (
                <>
                  <Pressable 
                    onPress={() => {
                      toggleAddToMyMusic(selectedTrackMenu.track);
                      setSelectedTrackMenu(null);
                    }} 
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <Ionicons name="heart-outline" size={20} color="#fa233b" style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>Добавить в мою музыку</Text>
                  </Pressable>

                  <Pressable 
                    onPress={() => {
                      setHiddenTrackIds(prev => [...prev, selectedTrackMenu.track.id]);
                      setSelectedTrackMenu(null);
                    }} 
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                  >
                    <Ionicons name="eye-off-outline" size={20} color="#8e8e93" style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#8e8e93' }}>Удалить из рекомендуемого</Text>
                  </Pressable>
                </>
              )}

              {selectedTrackMenu.source === 'my_music' && (
                <Pressable 
                  onPress={() => {
                    setMyMusicTracks(prev => prev.filter(t => t.id !== selectedTrackMenu.track.id));
                    setSelectedTrackMenu(null);
                  }} 
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                >
                  <Ionicons name="trash-outline" size={20} color="#fa233b" style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fa233b' }}>Удалить из музыки</Text>
                </Pressable>
              )}

              {selectedTrackMenu.source === 'uploads' && (
                <Pressable 
                  onPress={async () => {
                    const tr = selectedTrackMenu.track;
                    setSelectedTrackMenu(null);
                    try {
                      await supabase.from('tracks').delete().eq('id', tr.id);
                      loadCloudTracks();
                    } catch(e) {}
                  }} 
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                >
                  <Ionicons name="trash-outline" size={20} color="#fa233b" style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fa233b' }}>Удалить из облака</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}