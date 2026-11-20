import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import type { Track } from '../lib/music-data';

const formats: Record<string, string> = {
  'audio/mpeg': 'MP3', 'audio/mp3': 'MP3', 'audio/flac': 'FLAC', 'audio/x-flac': 'FLAC',
  'audio/wav': 'WAV', 'audio/wave': 'WAV', 'audio/x-wav': 'WAV', 'audio/vnd.wave': 'WAV',
  'audio/mp4': 'MPEG-4', 'audio/x-m4a': 'M4A', 'audio/aac': 'AAC', 'audio/aacp': 'AAC',
  'audio/ogg': 'Ogg', 'audio/opus': 'Opus', 'audio/webm': 'WebM',
};

type FileInfo = { format?: string; bytes?: number };
const cache = new Map<string, FileInfo>();

export function TrackQuality({ track, measured }: { track: Track; measured?: { format: string; kbps: number } }) {
  const url = track.url || track.audio_url || '';
  const [info, setInfo] = useState<FileInfo>(() => cache.get(url) || {});
  const extension = url.split(/[?#]/)[0].match(/\.(mp3|m4a|wav|flac|ogg|opus|aac|webm)$/i)?.[1].toUpperCase();
  useEffect(() => {
    if (measured || !/^https?:\/\//i.test(url) || cache.has(url)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    void fetch(url, { method: 'HEAD', signal: controller.signal }).then(response => {
      if (!response.ok || controller.signal.aborted) return;
      const type = response.headers.get('content-type')?.split(';')[0].toLowerCase() || '';
      const format = formats[type];
      if (!format && type !== 'application/octet-stream') return;
      const bytes = response.status === 200 ? Number(response.headers.get('content-length')) : 0;
      const value = { format, bytes };
      cache.set(url, value);
      setInfo(value);
    }).catch(() => {}).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url, measured]);
  const seconds = track.fileDuration;
  const rate = info.bytes && seconds && seconds > 0 ? Math.round(info.bytes * 8 / seconds / 1000) : 0;
  const label = measured ? measured.format + ' · ' + measured.kbps + ' кбит/с' :
    [info.format || extension, rate > 0 ? '≈ ' + rate + ' кбит/с по размеру файла' : ''].filter(Boolean).join(' · ');
  return <Text style={{ color: '#d4d4d8', fontSize: 13 }}>Качество аудио: {label || 'Нет данных'}</Text>;
}
