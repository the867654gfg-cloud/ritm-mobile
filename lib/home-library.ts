import md5 from 'md5';
import type { Track } from './music-data';

export function connectHomeLibrary(address: string, username: string, password: string) {
  const base = new URL(address.trim());
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('Укажи HTTPS-адрес сервера без логина и параметров.');
  }
  if (!username.trim() || !password) throw new Error('Введи логин и пароль домашнего сервера.');
  base.pathname = base.pathname.replace(/\/+$/, '') + '/';
  const namespace = crypto.randomUUID();
  const token = () => {
    const salt = crypto.randomUUID().replaceAll('-', '');
    return { u: username.trim(), t: md5(password + salt), s: salt, v: '1.16.1', c: 'Ritm', f: 'json' };
  };
  function endpoint(method: string, parameters: Record<string, string> = {}) {
    const url = new URL('rest/' + method + '.view', base);
    url.search = new URLSearchParams({ ...token(), ...parameters }).toString();
    return url.href;
  }
  async function query(method: string, params?: Record<string, string>) {
    try {
      const response = await fetch(endpoint(method, params), {
        cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error();
      const result = (await response.json())['subsonic-response'];
      if (result?.status === 'ok') return result;
      if (result?.error?.code === 40 || result?.error?.code === 41) return null;
      throw new Error();
    } catch { throw new Error('Сервер не ответил. Проверь адрес, доступ к серверу и CORS.'); }
  }
  return {
    async ping() {
      if (!await query('ping')) throw new Error('Сервер отклонил логин или пароль.');
    },
    async songs(term: string, offset: number): Promise<Track[]> {
      const result = await query('search3', { query: term || '""', artistCount: '0', albumCount: '0', songCount: '40', songOffset: String(offset) });
      if (!result) throw new Error('Сервер отклонил подключение.');
      const songs = result.searchResult3?.song;
      return Array.isArray(songs) ? songs.map(item => ({
        id: 'home:' + namespace + ':' + String(item.id), raw_id: String(item.id), title: item.title || 'Без названия',
        artist: item.artist, album: item.album, duration: Number(item.duration) || 0, genre: item.genre || '',
      })) : [];
    },
    stream(track: Track) {
      return track.id.startsWith('home:' + namespace + ':') ? endpoint('stream', { id: String(track.raw_id) }) : '';
    },
    host: base.host,
  };
}

export type HomeLibrary = ReturnType<typeof connectHomeLibrary>;
