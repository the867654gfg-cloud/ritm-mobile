import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { parseBuffer } from 'music-metadata';

const service = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL);
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const base = (await import('../app.json', { with: { type: 'json' } })).default.expo.experiments?.baseUrl ?? '';
const site = new URL(base + '/', 'https://the867654gfg-cloud.github.io');
const originalHtml = await readFile('dist/index.html', 'utf8');
const version = process.env.GITHUB_SHA || createHash('sha256').update(originalHtml).digest('hex');
const template = originalHtml.replace('</head>', '<meta name="ritm-version" content="' + version + '"></head>');
await writeFile('dist/index.html', template);
const storage = '/storage/v1/object/public/music-storage/';
const safeId = /^[a-zA-Z0-9_-]{1,150}$/;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

async function readPrefix(url, maxBytes) {
  const response = await fetch(url, { headers: { Range: 'bytes=0-' + (maxBytes - 1) }, signal: AbortSignal.timeout(12000) });
  if (!response.ok || !response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const next = value.subarray(0, maxBytes - size);
      chunks.push(next);
      size += next.length;
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks, size);
}

function imageFormat(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes.readUInt16BE(0) === 0xffd8 && bytes.readUInt16BE(bytes.length - 2) === 0xffd9) return 'jpg';
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.subarray(-8, -4).toString() === 'IEND') return 'png';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
      && bytes.readUInt32LE(4) + 8 === bytes.length) return 'webp';
  return null;
}

const synchsafe = (bytes, offset) => bytes[offset] * 2 ** 21 + bytes[offset + 1] * 2 ** 14 + bytes[offset + 2] * 128 + bytes[offset + 3];

function id3Picture(bytes) {
  if (!bytes || bytes.length < 10 || bytes.toString('ascii', 0, 3) !== 'ID3') return null;
  const version = bytes[3];
  if (![3, 4].includes(version) || bytes[5] & 128) return null;
  const end = Math.min(bytes.length, 10 + synchsafe(bytes, 6));
  let start = 10;
  if (bytes[5] & 64 && end >= 14) start += version === 4 ? synchsafe(bytes, 10) : 4 + bytes.readUInt32BE(10);
  let fallback = null;
  while (start + 10 <= end) {
    const name = bytes.toString('ascii', start, start + 4);
    const length = version === 4 ? synchsafe(bytes, start + 4) : bytes.readUInt32BE(start + 4);
    const next = start + 10 + length;
    if (!length || next > end) break;
    if (name === 'APIC' && bytes[start + 9] === 0) {
      const frame = bytes.subarray(start + 10, next);
      const mimeEnd = frame.indexOf(0, 1);
      if (mimeEnd > 1 && mimeEnd + 3 < frame.length) {
        const wide = frame[0] === 1 || frame[0] === 2;
        const step = wide ? 2 : 1;
        let offset = mimeEnd + 2;
        for (; offset + step <= frame.length; offset += step) {
          if (frame[offset] === 0 && (!wide || frame[offset + 1] === 0)) break;
        }
        const picture = frame.subarray(offset + step);
        const extension = imageFormat(picture);
        if (extension && picture.length <= 5 * 1024 * 1024) {
          if (frame[mimeEnd + 1] === 3) return { picture, extension };
          fallback ??= { picture, extension };
        }
      }
    }
    start = next;
  }
  return fallback;
}

function coverUrl(track) {
  const value = track.cover_url || track.cover_key;
  if (!value) return null;
  try {
    const url = new URL(value.startsWith('https://') ? value : storage + value.replace(/^\/+/, ''), service);
    return url.protocol === 'https:' ? url : null;
  } catch { return null; }
}

function ownStorage(url) {
  return url?.origin === service.origin && url.pathname.startsWith(storage);
}

const cards = Object.create(null);
const headers = { apikey: key, Authorization: 'Bearer ' + key };
const endpoint = new URL('/rest/v1/tracks?select=id,title,artist,description,cover_url,cover_key,audio_url&order=id', service);
const tracks = [];
for (let offset = 0; ; offset += 500) {
  endpoint.searchParams.set('limit', '500');
  endpoint.searchParams.set('offset', String(offset));
  const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Catalogue request returned HTTP ' + response.status);
  const batch = await response.json();
  tracks.push(...batch.filter(track => safeId.test(track.id)));
  if (batch.length < 500) break;
}
await mkdir('dist/track-covers', { recursive: true });
let repaired = 0;
async function prepare(track) {
  const cover = coverUrl(track);
  let repairedCover = '';
  let thumbnail;
  let artwork;
  let quality;
  let music;
  let audioPrefix;
  let artist;
  let album;
  let validCover = Boolean(cover && !ownStorage(cover));
  try {
    if (ownStorage(cover)) {
      artwork = await readPrefix(cover, 5 * 1024 * 1024);
      validCover = Boolean(imageFormat(artwork));
      if (!validCover) artwork = undefined;
    }
    if (!validCover && track.audio_url && productAudio(track.audio_url)) {
      audioPrefix = await readPrefix(track.audio_url, 6 * 1024 * 1024);
      const picture = id3Picture(audioPrefix);
      if (picture) {
        artwork = picture.picture;
        const filename = track.id + '.' + picture.extension;
        await writeFile(resolve('dist/track-covers', filename), picture.picture);
        repairedCover = new URL('track-covers/' + filename, site).pathname;
        repaired++;
      }
    }
    if (artwork) {
      const filename = track.id + '-small.webp';
      await sharp(artwork).rotate().resize(150, 150, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 66 }).toFile(resolve('dist/track-covers', filename));
      thumbnail = new URL('track-covers/' + filename, site).pathname;
    }
  } catch {
    // Keep the page available when an individual audio or artwork object is unavailable.
  }
  if (track.audio_url && productAudio(track.audio_url)) {
    try {
      audioPrefix ??= await readPrefix(track.audio_url, 2 * 1024 * 1024);
      if (audioPrefix) {
        const { format, common } = await parseBuffer(audioPrefix, undefined, { skipCovers: Boolean(validCover || repairedCover) });
        artist = common.artist?.trim().slice(0, 100) || undefined;
        album = common.album?.trim().slice(0, 150) || undefined;
        if (common.bpm || common.key) music = { bpm: common.bpm, key: common.key };
        if (format.container === 'MPEG' && format.codec?.includes('Layer 3') && format.codecProfile === 'CBR' && format.bitrate > 0) {
          quality = { format: 'MP3', kbps: Math.round(format.bitrate / 1000) };
        }
        if (!validCover && !repairedCover) {
          const pictures = common.picture ?? [];
          const picture = pictures.find(item => /front/i.test(item.type || '')) ?? pictures[0];
          if (picture && picture.data.length <= 5 * 1024 * 1024) {
            const filename = track.id + '-embedded.webp';
            await sharp(picture.data).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 85 }).toFile(resolve('dist/track-covers', filename));
            repairedCover = new URL('track-covers/' + filename, site).pathname;
            repaired++;
          }
        }
      }
    } catch { /* Some containers keep their metadata at the end of the file. */ }
  }
  const share = new URL('t/' + track.id + '/', site);
  const image = new URL(repairedCover || (validCover && cover ? cover.href : 'ritm-icon.png'), site);
  cards[track.id] = { path: share.pathname, thumbnail, quality, music, artist, album, ...(repairedCover || !validCover ? { cover: repairedCover || null } : {}) };
  const redirect = new URL('?track=' + encodeURIComponent(track.id), site);
  const title = track.title + ' · Ритм';
  const description = [track.artist, track.description].filter(Boolean).join(' · ').slice(0, 200) || 'Слушать в Ритме';
  const tags = [
    ['og:type', 'music.song'], ['og:title', title], ['og:description', description], ['og:image', image.href], ['og:url', share.href],
  ].map(([property, content]) => `<meta property="${property}" content="${escape(content)}" />`).join('\n');
  const redirectScript = `<script>history.replaceState(null,'',${JSON.stringify(redirect.pathname + redirect.search)});</script>`;
  const html = template.replace(/<title>[^<]*<\/title>/, () => `<title>${escape(title)}</title>`)
    .replace('</head>', () => tags + '\n' + redirectScript + '\n</head>');
  const folder = resolve('dist/t', track.id);
  await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, 'index.html'), html);
}

function productAudio(value) {
  try { return ownStorage(new URL(value)); } catch { return false; }
}
for (let offset = 0; offset < tracks.length; offset += 6) await Promise.all(tracks.slice(offset, offset + 6).map(prepare));
await writeFile('dist/track-cards.json', JSON.stringify(cards));
await writeFile('dist/version.json', JSON.stringify({ version, release: process.env.EXPO_PUBLIC_RITM_RELEASE || '1.42' }));
console.log('Track pages: ' + tracks.length + ', recovered artwork: ' + repaired);
