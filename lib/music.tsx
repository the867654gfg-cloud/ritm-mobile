import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Track } from './music-data';

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackSpeed: number;
  eqGains: number[]; // 12 полос
  playTrack: (track: Track, queueIds?: string[], context?: string) => Promise<Track | void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  setPlaybackSpeed: (speed: number) => void;
  setEqGain: (bandIndex: number, value: number) => void;
  applyPreset: (presetGains: number[]) => void;
  resetEq: () => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

// 12 частотных полос (от глубокого баса до высоких частот)
export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 12000, 16000, 20000];

export const EQ_PRESETS: { [key: string]: number[] } = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [6, 6, 5, 3, 1, 0, 0, 0, 0, 0, 0, 0],
  'Acoustic': [4, 3, 2, 1, 2, 3, 3, 4, 3, 2, 1, 0],
  'Pop': [-1, 2, 4, 5, 4, 1, -1, -2, -1, 1, 3, 4],
  'Rock': [5, 4, 3, 1, -1, -1, 1, 3, 4, 5, 5, 4],
  'Electronic': [5, 5, 3, 0, -2, 2, 1, 2, 4, 5, 5, 4],
};

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);
  const [eqGains, setEqGains] = useState<number[]>(new Array(12).fill(0));

  // Web Audio API контекст для эквалайзера в браузере
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);

  // Инициализация Web Audio API фильтров для 12 полос
  const initWebAudioEq = (element: HTMLAudioElement) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtxRef.current = new AudioContextClass();
        const source = audioCtxRef.current.createMediaElementSource(element);

        // Создаем 12 BiquadFilterNode для каждой полосы
        const filters = EQ_FREQUENCIES.map((freq) => {
          const filter = audioCtxRef.current!.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = freq;
          filter.Q.value = 1.4;
          filter.gain.value = 0;
          return filter;
        });

        // Соединяем фильтры в цепочку
        source.connect(filters[0]);
        for (let i = 0; i < filters.length - 1; i++) {
          filters[i].connect(filters[i + 1]);
        }
        filters[filters.length - 1].connect(audioCtxRef.current.destination);

        filtersRef.current = filters;
      }
    } catch (e) {
      // Игнорируем повторное подключение media element source
    }
  };

  const setEqGain = (bandIndex: number, value: number) => {
    const newGains = [...eqGains];
    newGains[bandIndex] = value;
    setEqGains(newGains);

    if (filtersRef.current[bandIndex]) {
      filtersRef.current[bandIndex].gain.value = value;
    }
  };

  const applyPreset = (presetGains: number[]) => {
    setEqGains(presetGains);
    presetGains.forEach((gain, idx) => {
      if (filtersRef.current[idx]) {
        filtersRef.current[idx].gain.value = gain;
      }
    });
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
      eqGains,
      playTrack,
      pauseTrack,
      resumeTrack,
      setPlaybackSpeed,
      setEqGain,
      applyPreset,
      resetEq
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
      eqGains: new Array(12).fill(0),
      playTrack: async () => {},
      pauseTrack: async () => {},
      resumeTrack: async () => {},
      setPlaybackSpeed: () => {},
      setEqGain: () => {},
      applyPreset: () => {},
      resetEq: () => {},
    };
  }
  return context;
};