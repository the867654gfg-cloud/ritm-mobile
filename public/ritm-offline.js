const SHELL = 'ritm-shell-v1';
const MUSIC = 'ritm-music-v1';
let lastFile;
const root = new URL(self.registration.scope);
const isMusic = url => url.protocol === 'https:' && url.hostname.endsWith('.supabase.co')
  && url.pathname.startsWith('/storage/v1/object/public/music-storage/')
  && !url.search;

self.addEventListener('install', event => event.waitUntil((async () => {
  const response = await fetch(root, { cache: 'reload' });
  if (!response.ok) throw new Error('Missing application shell');
  const html = await response.clone().text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map(match => new URL(match[1], root))
    .filter(url => url.origin === root.origin && url.pathname.startsWith(root.pathname));
  const cache = await caches.open(SHELL);
  await cache.addAll([new URL('manifest.webmanifest', root), new URL('ritm-icon.png', root), ...scripts]);
  await cache.put(root, response);
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('message', event => {
  if (event.data === 'ritm:encrypted-offline') event.ports[0]?.postMessage(true);
});

function readAudioKey() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ritm-offline-keys', 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => request.result.createObjectStore('keys');
    request.onsuccess = () => {
      const db = request.result;
      const lookup = db.transaction('keys').objectStore('keys').get('audio');
      lookup.onsuccess = () => { db.close(); lookup.result ? resolve(lookup.result) : reject(new Error('Missing key')); };
      lookup.onerror = () => { db.close(); reject(lookup.error); };
    };
  });
}

async function readAudio(response, url) {
  if (response.headers.get('X-Ritm-Encrypted') !== '1') return response.blob();
  const bytes = new Uint8Array(await response.arrayBuffer());
  const audio = await crypto.subtle.decrypt({
    name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: new TextEncoder().encode(url),
  }, await readAudioKey(), bytes.subarray(12));
  return new Blob([audio], { type: response.headers.get('Content-Type') || 'audio/mpeg' });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin === root.origin && url.pathname.startsWith(root.pathname)) {
    if (event.request.mode === 'navigate') {
      event.respondWith((async () => {
        const cache = await caches.open(SHELL);
        try {
          const response = await fetch(event.request);
          if (response.ok && url.pathname === root.pathname) await cache.put(root, response.clone());
          return response;
        } catch {
          return await cache.match(root) || Response.error();
        }
      })());
    } else if (url.pathname.includes('/_expo/') || url.pathname.includes('/assets/')) {
      event.respondWith((async () => {
        const cache = await caches.open(SHELL);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      })());
    }
  } else if (isMusic(url)) {
    event.respondWith((async () => {
      const cached = await (await caches.open(MUSIC)).match(url.href);
      if (!cached) return fetch(event.request);
      const range = event.request.headers.get('Range');
      if (!range && cached.headers.get('X-Ritm-Encrypted') !== '1') return cached;
      const match = range && /^bytes=(\d+)-(\d*)$/.exec(range);
      if (range && !match) return fetch(event.request);
      const fingerprint = cached.headers.get('etag') || cached.headers.get('last-modified') || cached.headers.get('X-Ritm-Download');
      if (!lastFile || lastFile.url !== url.href || lastFile.fingerprint !== fingerprint) {
        lastFile = { url: url.href, fingerprint, blob: readAudio(cached, url.href) };
      }
      let file;
      try { file = await lastFile.blob; }
      catch { lastFile = undefined; return fetch(event.request); }
      if (!match) return new Response(file, { headers: { 'Content-Type': file.type, 'Content-Length': String(file.size), 'Accept-Ranges': 'bytes' } });
      const start = Number(match[1]);
      const end = Math.min(file.size - 1, match[2] ? Number(match[2]) : file.size - 1);
      if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + file.size } });
      return new Response(file.slice(start, end + 1), { status: 206, headers: {
        'Content-Range': 'bytes ' + start + '-' + end + '/' + file.size,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
        'Content-Type': file.type || 'audio/mpeg',
      } });
    })());
  }
});
