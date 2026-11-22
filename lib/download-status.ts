import type { Track } from './music-data';
import type { DownloadQuality } from './stream-media';

export type DownloadProgress = (received: number, total?: number) => void;
export type SavedTrack = Track & { downloadedBytes?: number; downloadedQuality?: DownloadQuality };
export type Transfer = { track: Track; quality?: DownloadQuality; received: number; total?: number; error?: string };

export function bytesLabel(bytes?: number) {
  return bytes === undefined ? '' : (bytes / (1024 * 1024)).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' МБ';
}

export function qualityLabel(quality?: DownloadQuality) {
  return quality === 'lossless' ? 'FLAC' : quality ? quality + ' кбит/с' : 'Исходный файл';
}
