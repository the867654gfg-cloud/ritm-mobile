import Constants from 'expo-constants';
import type { Track } from './music-data';
import { packagedMedia, type DownloadQuality } from './stream-media';
import { cacheEncryptedAudio, requireEncryptedOfflineWorker } from './web-offline-crypto';

const MUSIC = 'ritm-music-v1';
const listKey = 'ritm_offline_tracks_v1';

export function registerOfflineShell() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('ritm-motion')) {
    const style = document.createElement('style');
    style.id = 'ritm-motion';
    style.textContent = `
      .ritm-row-slider { appearance:none; height:3px; border-radius:3px; margin:4px 0; cursor:pointer; background:linear-gradient(to right,#fa233b var(--ritm-fill),#c7cbd1 var(--ritm-fill)); }
      .ritm-row-slider::-webkit-slider-thumb { appearance:none; width:9px; height:9px; border-radius:50%; background:#fa233b; opacity:0; }
      .ritm-row-slider:hover::-webkit-slider-thumb,.ritm-row-slider:focus::-webkit-slider-thumb {opacity:1;}
      .ritm-row-slider::-moz-range-thumb {width:7px; height:7px; border:0; background:#fa233b;}
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
export async function rememberOffline(track: Track, quality?: DownloadQuality) {
  const url = new URL(track.url || '');
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.search ||
      !url.pathname.startsWith('/storage/v1/object/public/music-storage/')) {
    throw new Error('Офлайн доступны опубликованные треки «Ритма».');
  }
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    throw new Error('Обновите страницу после установки офлайн-режима.');
  }
  const source = quality ? packagedMedia(track)?.offline(quality) : url.href;
  if (!source) throw new Error('Это качество недоступно для трека.');
  await requireEncryptedOfflineWorker(navigator.serviceWorker.controller);
  const cache = await caches.open(MUSIC);
  let transfer = downloads.get(url.href);
  if (!transfer) {
    transfer = cacheEncryptedAudio(cache, url.href, source, quality === 'lossless' ? 'audio/flac' : quality ? 'audio/mp4' : undefined).finally(() => downloads.delete(url.href));
    downloads.set(url.href, transfer);
  }
  await transfer;
  const previous = offlineTracks().filter(item => item.id !== track.id);
  localStorage.setItem(listKey, JSON.stringify([track, ...previous]));
}

export async function clearOffline() {
  await Promise.allSettled(downloads.values());
  await caches.delete(MUSIC);
  localStorage.removeItem(listKey);
}
