import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Track } from './music-data';
import { supabase } from './supabase';

type Point = { track_data: Track; seconds: number; playlist_id: string | null };
const missingSchema = new Set(['PGRST205', '42P01']);

export function usePlaybackHandoff(user: string | undefined, track: Track | null, seconds: number | (() => number), playing: boolean, playlist: string | null) {
  const [remote, setRemote] = useState<{ owner: string; point: Point } | null>(null);
  const screen = useRef({ track, seconds, playing, playlist });
  screen.current = { track, seconds, playing, playlist };
  const disabled = useRef(false);
  useEffect(() => {
    const client = supabase;
    disabled.current = false;
    if (!user || !client) return;
    const controller = new AbortController();
    const load = () => {
      if (screen.current.playing || disabled.current) return;
      void client.from('ritm_resume').select('track_data, seconds, playlist_id').eq('user_id', user)
        .abortSignal(controller.signal).maybeSingle().then(({ data, error }) => {
          if (controller.signal.aborted) return;
          if (error && missingSchema.has(error.code)) disabled.current = true;
          if (data?.track_data?.id && Number.isFinite(data.seconds)) setRemote({ owner: user, point: data as Point });
          else if (!error) setRemote(null);
        });
    };
    load();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') load(); });
    if (Platform.OS === 'web') window.addEventListener('focus', load);
    return () => {
      controller.abort();
      foreground.remove();
      if (Platform.OS === 'web') window.removeEventListener('focus', load);
    };
  }, [user]);

  useEffect(() => {
    const client = supabase;
    if (!user || !client || !track?.id || !playing || disabled.current) return;
    const controller = new AbortController();
    let lastPosition = -1;
    const save = () => {
      const current = screen.current;
      const seconds = typeof current.seconds === 'function' ? current.seconds() : current.seconds;
      if (disabled.current || current.track?.id !== track.id || !Number.isFinite(seconds) || seconds < 3) return;
      const position = Math.min(86400, Math.floor(seconds));
      if (position === lastPosition) return;
      lastPosition = position;
      void client.from('ritm_resume').upsert({
        user_id: user, track_data: current.track, seconds: position,
        playlist_id: current.playlist, updated_at: new Date().toISOString(),
      }).abortSignal(controller.signal).then(({ error }) => {
        if (controller.signal.aborted) return;
        if (error && missingSchema.has(error.code)) disabled.current = true;
        if (error) lastPosition = -1;
      });
    };
    const timer = setInterval(save, 10_000);
    const app = AppState.addEventListener('change', state => { if (state !== 'active') save(); });
    if (Platform.OS === 'web') window.addEventListener('pagehide', save);
    return () => {
      clearInterval(timer);
      app.remove();
      if (Platform.OS === 'web') window.removeEventListener('pagehide', save);
      controller.abort();
    };
  }, [user, track?.id, playing]);

  return remote?.owner === user ? remote?.point : null;
}
