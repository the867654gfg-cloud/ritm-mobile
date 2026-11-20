import { useSyncExternalStore, type ReactNode } from 'react';

export function createPlaybackClock() {
  let seconds = 0;
  const listeners = new Set<() => void>();
  return {
    read: () => seconds,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    write(value: number) {
      if (value === seconds) return;
      seconds = value;
      listeners.forEach(listener => listener());
    },
  };
}

export function PlaybackClock({ clock, children }: {
  clock: ReturnType<typeof createPlaybackClock>;
  children: (seconds: number) => ReactNode;
}) {
  return <>{children(useSyncExternalStore(clock.subscribe, clock.read, clock.read))}</>;
}
