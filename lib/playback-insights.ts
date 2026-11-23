import { useCallback, useRef, useState } from 'react';

export function usePlaybackInsights() {
  const active = useRef<{ id: string; at: number; started: boolean; buffering: boolean; heard: number; last: number } | null>(null);
  const [stats, setStats] = useState({ attempts: 0, starts: 0, failures: 0, interruptions: 0, totalMs: 0 });
  const [lastFailure, setLastFailure] = useState('');
  const [engagement, setEngagement] = useState<Record<string, number>>({});

  const finish = useCallback(() => {
    const item = active.current;
    active.current = null;
    if (!item?.started) return;
    const weight = item.heard >= 30 ? 3 : item.heard >= 10 ? 1 : -1;
    setEngagement(previous => ({ ...previous, [item.id]: Math.max(-6, Math.min(12, (previous[item.id] ?? 0) + weight)) }));
  }, []);
  const begin = useCallback((id: string) => {
    finish();
    active.current = { id, at: performance.now(), started: false, buffering: false, heard: 0, last: 0 };
    setStats(previous => ({ ...previous, attempts: previous.attempts + 1 }));
  }, [finish]);
  const playing = useCallback(() => {
    const item = active.current;
    if (!item) return;
    item.buffering = false;
    if (item.started) return;
    item.started = true;
    const elapsed = performance.now() - item.at;
    setStats(previous => ({ ...previous, starts: previous.starts + 1, totalMs: previous.totalMs + elapsed }));
  }, []);
  const position = useCallback((seconds: number) => {
    const item = active.current;
    if (!item || !Number.isFinite(seconds)) return;
    const delta = seconds - item.last;
    item.last = seconds;
    if (item.started && delta > 0 && delta <= 3) item.heard += delta;
  }, []);
  const buffering = useCallback(() => {
    const item = active.current;
    if (!item?.started || item.buffering) return;
    item.buffering = true;
    setStats(previous => ({ ...previous, interruptions: previous.interruptions + 1 }));
  }, []);
  const fail = useCallback((reason = 'Ошибка декодирования или источника') => {
    if (!active.current) return;
    finish();
    setLastFailure(reason);
    setStats(previous => ({ ...previous, failures: previous.failures + 1 }));
  }, [finish]);
  const summary = [
    'Попытки · ' + stats.attempts,
    'Успешные старты · ' + stats.starts,
    'Ошибки · ' + stats.failures,
    ...(lastFailure ? ['Последний сбой · ' + lastFailure] : []),
    'Повторная буферизация · ' + stats.interruptions,
    ...(stats.starts ? ['Среднее время старта · ' + Math.round(stats.totalMs / stats.starts) + ' мс'] : []),
  ];
  return { begin, playing, position, buffering, fail, summary, engagement };
}
