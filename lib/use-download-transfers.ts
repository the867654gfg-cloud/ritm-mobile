import { useEffect, useRef, useState } from 'react';
import type { Track } from './music-data';
import type { DownloadQuality } from './stream-media';
import type { DownloadProgress, Transfer } from './download-status';

export function useDownloadTransfers(
  save: (track: Track, quality: DownloadQuality | undefined, signal: AbortSignal, progress: DownloadProgress) => Promise<void>,
  onSaved: () => void | Promise<void>,
) {
  const [entries, setEntries] = useState<Transfer[]>([]);
  const active = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const controller of active.current.values()) controller.abort();
      active.current.clear();
    };
  }, []);
  const run = (track: Track, quality?: DownloadQuality) => {
    if (active.current.has(track.id)) return;
    const controller = new AbortController();
    active.current.set(track.id, controller);
    setEntries(previous => [...previous.filter(item => item.track.id !== track.id), { track, quality, received: 0 }]);
    void save(track, quality, controller.signal, (received, total) => {
      if (!controller.signal.aborted && mounted.current) setEntries(previous =>
        previous.map(item => item.track.id === track.id ? { ...item, received, total } : item));
    }).then(async () => {
      if (mounted.current) await onSaved();
    }).then(() => {
      if (mounted.current) setEntries(previous => previous.filter(item => item.track.id !== track.id));
    }).catch(error => {
      if (!mounted.current) return;
      setEntries(previous => controller.signal.aborted ? previous.filter(item => item.track.id !== track.id) :
        previous.map(item => item.track.id === track.id ? { ...item, error: error?.message || 'Скачивание не удалось.' } : item));
    }).finally(() => {
      if (active.current.get(track.id) === controller) active.current.delete(track.id);
    });
  };
  return { entries, run, cancel: (id: string) => active.current.get(id)?.abort() };
}
