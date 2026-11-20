import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import { Track } from './music-data';

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackSpeed: number;
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
  attachAudioElement: (element: HTMLAudioElement) => void;
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
};

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);
  const [eqGains, setEqGains] = useState<number[]>(savedGains);

  // Web Audio API для эквалайзера в браузере
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const inputLevelRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceElementRef = useRef<HTMLAudioElement | null>(null);

  // Актуальные значения полос, чтобы фильтры при создании сразу получили текущие настройки
  const eqGainsRef = useRef<number[]>(eqGains);
  eqGainsRef.current = eqGains;

  function updateFilters(values: number[]) {
    const ctx = audioCtxRef.current;
    if (!ctx || !inputLevelRef.current) return;
    filtersRef.current.forEach((filter, i) => filter.gain.setTargetAtTime(values[i], ctx.currentTime, 0.03));
    const boost = Math.max(0, ...values);
    inputLevelRef.current.gain.setTargetAtTime(10 ** (-(boost ? boost + 2 : 0) / 20), ctx.currentTime, 0.04);
  }
  useEffect(() => {
    updateFilters(eqGains);
    if (Platform.OS === 'web') {
      try { localStorage.setItem(eqKey, JSON.stringify(eqGains)); } catch {}
    }
  }, [eqGains]);

  const attachAudioElement = (element: HTMLAudioElement) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !element) return;
    try {
      // createMediaElementSource можно вызвать для одного элемента только один раз
      if (sourceElementRef.current !== element) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx: AudioContext = audioCtxRef.current ?? new AudioContextClass();
        audioCtxRef.current = ctx;

        sourceRef.current?.disconnect();
        inputLevelRef.current?.disconnect();
        filtersRef.current.forEach(filter => filter.disconnect());
        const source = ctx.createMediaElementSource(element);
        const inputLevel = ctx.createGain();

        // 12 BiquadFilterNode, по одному на полосу
        const filters = EQ_FREQUENCIES.map((freq, i) => {
          const filter = ctx.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = Math.min(freq, ctx.sampleRate * 0.49);
          filter.Q.value = 1.4;
          filter.gain.value = eqGainsRef.current[i] ?? 0;
          return filter;
        });

        // source -> f0 -> f1 -> ... -> f11 -> выход
        source.connect(inputLevel);
        inputLevel.connect(filters[0]);
        for (let i = 0; i < filters.length - 1; i++) {
          filters[i].connect(filters[i + 1]);
        }
        filters[filters.length - 1].connect(ctx.destination);

        filtersRef.current = filters;
        sourceRef.current = source;
        inputLevelRef.current = inputLevel;
        sourceElementRef.current = element;
        updateFilters(eqGainsRef.current);
      }

      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume();
      }
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
      clearTrack: () => {},
      resumeTrack: async () => {},
      setPlaybackSpeed: () => {},
      setEqGain: () => {},
      applyPreset: () => {},
      resetEq: () => {},
      attachAudioElement: () => {},
    };
  }
  return context;
};
