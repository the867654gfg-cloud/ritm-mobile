import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import { Track } from './music-data';
import { BrowserAudio } from './browser-audio';

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackSpeed: number;
  eqEnabled: boolean;
  setEqEnabled: (enabled: boolean) => void;
  eqGains: number[]; // 12 полос
  playTrack: (track: Track, queueIds?: string[], context?: string) => Promise<Track | void>;
  pauseTrack: () => Promise<void>;
  clearTrack: () => void;
  resumeTrack: () => Promise<void>;
  setPlaybackSpeed: (speed: number) => void;
  setEqGain: (bandIndex: number, value: number) => void;
  applyPreset: (presetGains: number[]) => void;
  resetEq: () => void;
  /**
   * Подключает <audio> к цепочке эквалайзера (Web Audio API) и «будит» AudioContext.
   * Безопасно вызывать много раз: элемент подключается только один раз.
   * Вызов из обработчика нажатия нужен, потому что браузер не запускает звук без жеста пользователя.
   */
  attachAudioElement: (element: HTMLAudioElement, volume: number, wake?: boolean) => BrowserAudio | undefined;
  releaseAudioElement: (element: HTMLAudioElement) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

// 12 частотных полос (от глубокого баса до высоких частот)
export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 12000, 16000, 20000];
export const EQ_MAX_GAIN = 12;
const clampGain = (value: number) => Number.isFinite(value) ? Math.round(Math.max(-EQ_MAX_GAIN, Math.min(EQ_MAX_GAIN, value))) : 0;
const eqKey = 'ritm_equalizer_v1';
function savedGains() {
  try {
    const values = JSON.parse(localStorage.getItem(eqKey) || 'null');
    if (Array.isArray(values) && values.length === EQ_FREQUENCIES.length) return values.map(clampGain);
  } catch {}
  return EQ_FREQUENCIES.map(() => 0);
}

export const EQ_PRESETS: { [key: string]: number[] } = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [6, 6, 5, 3, 1, 0, 0, 0, 0, 0, 0, 0],
  'Acoustic': [4, 3, 2, 1, 2, 3, 3, 4, 3, 2, 1, 0],
  'Pop': [-1, 2, 4, 5, 4, 1, -1, -2, -1, 1, 3, 4],
  'Rock': [5, 4, 3, 1, -1, -1, 1, 3, 4, 5, 5, 4],
  'Electronic': [5, 5, 3, 0, -2, 2, 1, 2, 4, 5, 5, 4],
  'Treble': [0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 4, 3],
  'Presence': [-2, -2, -1, 0, 1, 2, 3, 4, 4, 3, 2, 1],
  'Vocals': [-3, -2, -1, 0, 2, 4, 5, 3, 1, 0, -1, -1],
  'Soft': [1, 2, 2, 1, 0, 0, -1, -2, -3, -4, -4, -4],
};

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);
  const [eqEnabled, setEqEnabled] = useState(true);
  const [eqGains, setEqGains] = useState<number[]>(savedGains);

  const graph = useRef<BrowserAudio>();
  const activeEqGains = eqEnabled ? eqGains : EQ_PRESETS.Flat;
  useEffect(() => {
    graph.current?.setEqualizer(activeEqGains);
    if (Platform.OS === 'web') {
      try { localStorage.setItem(eqKey, JSON.stringify(eqGains)); } catch {}
    }
  }, [eqGains, activeEqGains]);

  const attachAudioElement = (element: HTMLAudioElement, volume: number, wake = true) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !element) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const mixer = graph.current ??= new BrowserAudio(new AudioContextClass(), EQ_FREQUENCIES);
      mixer.attach(element);
      mixer.setVolume(volume);
      mixer.setEqualizer(activeEqGains);
      element.volume = 1;
      if (wake) mixer.wake();
      return mixer;
    } catch (e) {
      console.warn('Эквалайзер: не удалось подключить Web Audio', e);
    }
  };

  const setEqGain = (bandIndex: number, value: number) => {
    if (!Number.isInteger(bandIndex) || bandIndex < 0 || bandIndex >= EQ_FREQUENCIES.length) return;
    setEqGains((prev) => {
      const next = [...prev];
      next[bandIndex] = clampGain(value);
      return next;
    });
  };

  const applyPreset = (presetGains: number[]) => {
    setEqGains(EQ_FREQUENCIES.map((_, index) => clampGain(presetGains[index])));
  };

  const resetEq = () => {
    applyPreset(new Array(12).fill(0));
  };

  const setPlaybackSpeed = (speed: number) => {
    setPlaybackSpeedState(speed);
  };

  const playTrack = async (track: Track): Promise<Track | void> => {
    setCurrentTrack(track);
    setIsPlaying(true);
    return track;
  };

  const pauseTrack = async () => {
    setIsPlaying(false);
  };

  const resumeTrack = async () => {
    setIsPlaying(true);
  };

  return (
    <MusicContext.Provider value={{
      currentTrack,
      isPlaying,
      playbackSpeed,
      eqEnabled,
      setEqEnabled,
      eqGains,
      playTrack,
      pauseTrack,
      clearTrack: () => { setCurrentTrack(null); setIsPlaying(false); },
      resumeTrack,
      setPlaybackSpeed,
      setEqGain,
      applyPreset,
      resetEq,
      attachAudioElement,
      releaseAudioElement: element => graph.current?.detach(element),
    }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    return {
      currentTrack: null,
      isPlaying: false,
      playbackSpeed: 1.0,
      eqEnabled: false,
      setEqEnabled: () => {},
      eqGains: new Array(12).fill(0),
      playTrack: async () => {},
      pauseTrack: async () => {},
      clearTrack: () => {},
      resumeTrack: async () => {},
      setPlaybackSpeed: () => {},
      setEqGain: () => {},
      applyPreset: () => {},
      resetEq: () => {},
      attachAudioElement: () => {},
      releaseAudioElement: () => {},
    };
  }
  return context;
};
