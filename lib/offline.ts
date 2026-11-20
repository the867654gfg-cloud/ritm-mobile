import Constants from 'expo-constants';
import type { Track } from './music-data';

const MUSIC = 'ritm-music-v1';
const listKey = 'ritm_offline_tracks_v1';

export function registerOfflineShell() {
  if (typeof document === 'undefined') return;
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
  if (!await cache.match(url.href)) await cache.add(url.href);
  const previous = offlineTracks().filter(item => item.id !== track.id);
  localStorage.setItem(listKey, JSON.stringify([track, ...previous]));
}

export async function clearOffline() {
  await caches.delete(MUSIC);
  localStorage.removeItem(listKey);
}
