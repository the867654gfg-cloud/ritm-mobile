import { useState, useEffect, createContext, useContext } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export interface Track {
  id: string;
  title: string;
  url: string;
  genre?: string;
  duration?: number;
  cover_url?: string;
  artist?: string;
}

export interface Playlist {
  id: string;
  title: string;
  track_ids: string[];
}

interface MusicContextType {
  tracks: Track[];
  playlists: Playlist[];
  currentTrack: Track | null;
  isPlaying: boolean;
  loading: boolean;
  playTrack: (track: Track, queue?: string[], context?: string) => Promise<Track>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  addTrack: (track: Track, rawBlob?: Blob) => Promise<Track>;
  deleteTrack: (track: Track) => Promise<void>;
  createPlaylist: (title: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  setVolume: (vol: number) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

const STORAGE_TRACKS_KEY = 'ritm_tracks_meta_v10';
const DB_NAME = 'RitmMusicDB_v4';
const DB_VERSION = 2;
const AUDIO_STORE = 'audioBlobs';
const COVER_STORE = 'coverBlobs';

const activeObjectUrls = new Set<string>();

function registerObjectUrl(url: string | null) {
  if (url && url.startsWith('blob:')) {
    activeObjectUrls.add(url);
  }
}

function revokeOldObjectUrls() {
  activeObjectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
  });
  activeObjectUrls.clear();
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          db.createObjectStore(AUDIO_STORE);
        }
        if (!db.objectStoreNames.contains(COVER_STORE)) {
          db.createObjectStore(COVER_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function getAudioFromIDB(id: string): Promise<string | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE, 'readonly');
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        const val = req.result;
        if (val instanceof Blob) {
          const objUrl = URL.createObjectURL(val);
          registerObjectUrl(objUrl);
          resolve(objUrl);
        } else if (typeof val === 'string') {
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function getCoverFromIDB(id: string): Promise<string | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(COVER_STORE, 'readonly');
      const store = tx.objectStore(COVER_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        const val = req.result;
        if (typeof val === 'string') {
          resolve(val);
        } else if (val instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function saveToIDB(storeName: string, id: string, data: any): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(data, id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

async function deleteFromIDB(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  // Загрузка данных (локально + из Supabase)
  useEffect(() => {
    async function loadData() {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const savedMeta = localStorage.getItem(STORAGE_TRACKS_KEY);
          if (savedMeta) {
            const parsedTracks: Track[] = JSON.parse(savedMeta);
            const restoredTracks = await Promise.all(
              parsedTracks.map(async (t) => {
                const coverUrl = await getCoverFromIDB(t.id);
                return {
                  ...t,
                  cover_url: coverUrl || t.cover_url || '',
                };
              })
            );
            setTracks(restoredTracks);
          }
        }

        // Синхронизация плейлистов из Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: cloudPlaylists, error } = await supabase
            .from('playlists')
            .select('*')
            .eq('user_id', user.id);

          if (!error && cloudPlaylists) {
            setPlaylists(
              cloudPlaylists.map((cp: any) => ({
                id: cp.id,
                title: cp.title,
                track_ids: cp.track_ids || [],
              }))
            );
          }
        }
      } catch (e) {
        console.error('Ошибка загрузки данных:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    return () => {
      revokeOldObjectUrls();
    };
  }, []);

  const persistMetadata = (updatedTracks: Track[]) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const lightMeta = updatedTracks.map(t => ({
          id: t.id,
          title: t.title,
          genre: t.genre,
          duration: t.duration,
          artist: t.artist,
          url: t.url.startsWith('http') ? t.url : '',
          cover_url: '',
        }));
        localStorage.setItem(STORAGE_TRACKS_KEY, JSON.stringify(lightMeta));
      } catch (e) {
        console.error('Ошибка сохранения метаданных:', e);
      }
    }
  };

  const playTrack = async (track: Track, queue?: string[]): Promise<Track> => {
    if (activeObjectUrls.size > 15) {
      revokeOldObjectUrls();
    }

    let playableTrack = { ...track };

    if (Platform.OS === 'web') {
      if (!playableTrack.url || (!playableTrack.url.startsWith('blob:') && !playableTrack.url.startsWith('http'))) {
        const cachedUrl = await getAudioFromIDB(track.id);
        if (cachedUrl) playableTrack.url = cachedUrl;
      }
      if (!playableTrack.cover_url || playableTrack.cover_url.trim().length === 0) {
        const cachedCover = await getCoverFromIDB(track.id);
        if (cachedCover) playableTrack.cover_url = cachedCover;
      }
    }

    setCurrentTrack(playableTrack);
    setIsPlaying(true);
    if (queue) {
      setQueueIds(queue);
    } else {
      setTracks(currentTracks => {
        setQueueIds(currentTracks.map(t => t.id));
        return currentTracks;
      });
    }
    return playableTrack;
  };

  const pauseTrack = async () => {
    setIsPlaying(false);
  };

  const resumeTrack = async () => {
    if (currentTrack) {
      setIsPlaying(true);
    }
  };

  const playNext = async () => {
    setTracks(currentTracks => {
      if (!currentTrack || queueIds.length === 0) return currentTracks;
      const currentIndex = queueIds.indexOf(currentTrack.id);
      const nextIndex = (currentIndex + 1) % queueIds.length;
      const nextTrackId = queueIds[nextIndex];
      const nextTrack = currentTracks.find(t => t.id === nextTrackId);
      if (nextTrack) {
        void playTrack(nextTrack);
      }
      return currentTracks;
    });
  };

  const playPrevious = async () => {
    setTracks(currentTracks => {
      if (!currentTrack || queueIds.length === 0) return currentTracks;
      const currentIndex = queueIds.indexOf(currentTrack.id);
      const prevIndex = (currentIndex - 1 + queueIds.length) % queueIds.length;
      const prevTrackId = queueIds[prevIndex];
      const prevTrack = currentTracks.find(t => t.id === prevTrackId);
      if (prevTrack) {
        void playTrack(prevTrack);
      }
      return currentTracks;
    });
  };

  // Загрузка треков и отправка в Supabase Storage
  const addTrack = async (track: Track, rawBlob?: Blob): Promise<Track> => {
    let finalTrack = { ...track };

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (rawBlob && user) {
        const fileName = `${user.id}/${Date.now()}_${track.id}.mp3`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('music-storage')
          .upload(fileName, rawBlob);

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('music-storage')
            .getPublicUrl(fileName);
          finalTrack.url = publicUrlData.publicUrl;
        }
      }

      if (Platform.OS === 'web') {
        if (rawBlob) {
          await saveToIDB(AUDIO_STORE, finalTrack.id, rawBlob);
        }
        if (finalTrack.cover_url) {
          await saveToIDB(COVER_STORE, finalTrack.id, finalTrack.cover_url);
        }
      }
    } catch (e) {
      console.warn('Ошибка загрузки в облако Supabase Storage:', e);
    }

    setTracks(prevTracks => {
      const updated = [finalTrack, ...prevTracks];
      persistMetadata(updated);
      return updated;
    });
    return finalTrack;
  };

  const deleteTrack = async (track: Track) => {
    if (Platform.OS === 'web') {
      await deleteFromIDB(AUDIO_STORE, track.id);
      await deleteFromIDB(COVER_STORE, track.id);
    }
    setTracks(prevTracks => {
      const updatedTracks = prevTracks.filter(t => t.id !== track.id);
      persistMetadata(updatedTracks);
      return updatedTracks;
    });
    
    setPlaylists(prevPlaylists => {
      const updatedPlaylists = prevPlaylists.map(pl => ({
        ...pl,
        track_ids: pl.track_ids.filter(id => id !== track.id)
      }));
      return updatedPlaylists;
    });

    setCurrentTrack(curr => {
      if (curr?.id === track.id) {
        setIsPlaying(false);
        return null;
      }
      return curr;
    });
  };

  // Создание плейлиста в Supabase
  const createPlaylist = async (title: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('playlists')
        .insert([{ title, user_id: user.id, track_ids: [] }])
        .select()
        .single();

      if (!error && data) {
        setPlaylists(prev => [...prev, { id: data.id, title: data.title, track_ids: data.track_ids || [] }]);
      }
    } catch (e) {
      console.warn('Ошибка создания плейлиста в базе:', e);
    }
  };

  // Удаление плейлиста из Supabase
  const deletePlaylist = async (id: string) => {
    try {
      await supabase.from('playlists').delete().eq('id', id);
      setPlaylists(prev => prev.filter(pl => pl.id !== id));
    } catch (e) {
      console.warn('Ошибка удаления плейлиста:', e);
    }
  };

  // Добавление трека в плейлист (с обновлением Supabase)
  const addToPlaylist = async (playlistId: string, trackId: string) => {
    const targetPl = playlists.find(p => p.id === playlistId);
    if (!targetPl || targetPl.track_ids.includes(trackId)) return;

    const newTrackIds = [...targetPl.track_ids, trackId];

    setPlaylists(prev =>
      prev.map(pl => (pl.id === playlistId ? { ...pl, track_ids: newTrackIds } : pl))
    );

    try {
      await supabase
        .from('playlists')
        .update({ track_ids: newTrackIds })
        .eq('id', playlistId);
    } catch (e) {
      console.warn('Ошибка обновления плейлиста в базе:', e);
    }
  };

  // Удаление трека из плейлиста (с обновлением Supabase)
  const removeFromPlaylist = async (playlistId: string, trackId: string) => {
    const targetPl = playlists.find(p => p.id === playlistId);
    if (!targetPl) return;

    const newTrackIds = targetPl.track_ids.filter(id => id !== trackId);

    setPlaylists(prev =>
      prev.map(pl => (pl.id === playlistId ? { ...pl, track_ids: newTrackIds } : pl))
    );

    try {
      await supabase
        .from('playlists')
        .update({ track_ids: newTrackIds })
        .eq('id', playlistId);
    } catch (e) {
      console.warn('Ошибка удаления трека из плейлиста в базе:', e);
    }
  };

  const setVolume = (_vol: number) => {};

  return (
    <MusicContext.Provider
      value={{
        tracks,
        playlists,
        currentTrack,
        isPlaying,
        loading,
        playTrack,
        pauseTrack,
        resumeTrack,
        playNext,
        playPrevious,
        addTrack,
        deleteTrack,
        createPlaylist,
        deletePlaylist,
        addToPlaylist,
        removeFromPlaylist,
        setVolume,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}