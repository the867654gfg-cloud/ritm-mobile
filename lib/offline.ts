import Constants from 'expo-constants';
import type { Track } from './music-data';

const MUSIC = 'ritm-music-v1';
const listKey = 'ritm_offline_tracks_v1';

export function registerOfflineShell() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('ritm-motion')) {
    const style = document.createElement('style');
    style.id = 'ritm-motion';
    style.textContent = `
      .ritm-playlist-actions { position:absolute; inset:0; display:flex; align-items:center; justify-content:space-around; background:#27292c99; opacity:0; transition:opacity 180ms ease; pointer-events:none; }
      .ritm-playlist-card:hover .ritm-playlist-actions, .ritm-playlist-card:focus-within .ritm-playlist-actions { opacity:1; }
      .ritm-playlist-actions button { border:0; color:white; background:transparent; font-size:28px; cursor:pointer; padding:8px; pointer-events:auto; }
      .ritm-playlist-actions button:disabled { opacity:0.3; }
      @media (hover:none) { .ritm-playlist-actions {opacity:1;} }
      [data-ritm-row], [data-ritm-row] * { user-select: none !important; }
      [data-ritm-row][data-over=yes] { box-shadow: inset 0 2px #66cdbb; }
      @media (prefers-reduced-motion: no-preference) {
        @keyframes ritm-enter { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
        #ritm-tab, #ritm-upload, #ritm-profile, #ritm-profile-menu { animation: ritm-enter 220ms ease-out; }
        [data-ritm-row] { transition: box-shadow 120ms ease; }
      }`;
    document.head.appendChild(style);
  }
  document.title = 'Ритм.';
  const base = (Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/$/, '');
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = base + '/manifest.webmanifest';
  document.head.appendChild(manifest);
  if ('serviceWorker' in navigator) void navigator.serviceWorker.register(base + '/ritm-offline.js').catch(console.warn);
}

export function offlineTracks(): Track[] {
  try {
    const items = JSON.parse(localStorage.getItem(listKey) || '[]');
    return Array.isArray(items) ? items.filter(item => item && typeof item.url === 'string' && item.id) : [];
  } catch { return []; }
}

const downloads = new Map<string, Promise<void>>();
const chunkSize = 4 * 1024 * 1024;

async function cacheAudio(cache: Cache, url: string, duration: number) {
  if (await cache.match(url)) return;
  const full = async () => {
    const response = await fetch(url, { cache: 'force-cache' });
    if (response.status !== 200) throw new Error('Не удалось скачать трек полностью.');
    await cache.put(url, response);
  };
  if (duration < 180) return full();
  const controller = new AbortController();
  try {
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3500) });
    const size = Number(head.headers.get('content-length'));
    const modified = head.headers.get('last-modified');
    if (head.ok && modified && Number.isSafeInteger(size) && size >= 2 * chunkSize && size <= 128 * 1024 * 1024) {
      const parts: Blob[] = [];
      const count = Math.ceil(size / chunkSize);
      let next = 0;
      async function worker() {
        while (next < count) {
          const index = next++;
          const start = index * chunkSize;
          const end = Math.min(size, start + chunkSize) - 1;
          const response = await fetch(url, { headers: { Range: 'bytes=' + start + '-' + end }, signal: controller.signal });
          if (response.status !== 206 || response.headers.get('last-modified') !== modified) throw new Error();
          parts[index] = await response.blob();
          if (parts[index].size !== end - start + 1) throw new Error();
        }
      }
      await Promise.all([worker(), worker(), worker()]);
      const type = head.headers.get('content-type') || 'audio/mpeg';
      await cache.put(url, new Response(new Blob(parts, { type }), { headers: {
        'Content-Type': type, 'Content-Length': String(size), 'Last-Modified': modified,
      } }));
      return;
    }
  } catch { controller.abort(); }
  await full();
}

export async function rememberOffline(track: Track) {
  const url = new URL(track.url || '');
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.search ||
      !url.pathname.startsWith('/storage/v1/object/public/music-storage/')) {
    throw new Error('Офлайн доступны опубликованные треки «Ритма».');
  }
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    throw new Error('Обновите страницу после установки офлайн-режима.');
  }
  const cache = await caches.open(MUSIC);
  let transfer = downloads.get(url.href);
  if (!transfer) {
    transfer = cacheAudio(cache, url.href, track.duration).finally(() => downloads.delete(url.href));
    downloads.set(url.href, transfer);
  }
  await transfer;
  const previous = offlineTracks().filter(item => item.id !== track.id);
  localStorage.setItem(listKey, JSON.stringify([track, ...previous]));
}

export async function clearOffline() {
  await caches.delete(MUSIC);
  localStorage.removeItem(listKey);
}
