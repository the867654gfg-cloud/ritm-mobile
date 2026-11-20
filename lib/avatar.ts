import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

const BUCKET = 'avatars';
const MAX_SOURCE_BYTES = 8 * 1024 * 1024; // исходный файл
const AVATAR_SIZE = 256; // итоговая картинка 256x256

export type PickedAvatar = { blob: Blob; previewUri: string };
export type PickResult = { avatar?: PickedAvatar; error?: string } | null; // null = пользователь отменил выбор

// Обрезает картинку по центру до квадрата и сжимает. Работает в браузере.
async function toSquareJpeg(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.88)
  );
}

export async function pickAvatar(): Promise<PickResult> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['image/*'], copyToCacheDirectory: false, multiple: false });
  if (res.canceled || !res.assets?.length) return null;

  const asset = res.assets[0];
  if (asset.mimeType && !asset.mimeType.startsWith('image/')) return { error: 'Выберите файл изображения (JPG, PNG или WebP).' };
  if (asset.size && asset.size > MAX_SOURCE_BYTES) return { error: 'Файл слишком большой. Максимум 8 МБ.' };

  try {
    let blob: Blob = (asset as any).file ?? (await (await fetch(asset.uri)).blob());
    if (Platform.OS === 'web') blob = await toSquareJpeg(blob);
    if (blob.size > 2 * 1024 * 1024) return { error: 'Фото получилось слишком тяжёлым. Выберите другое.' };
    return { avatar: { blob, previewUri: Platform.OS === 'web' ? URL.createObjectURL(blob) : asset.uri } };
  } catch {
    return { error: 'Не удалось прочитать изображение. Попробуйте JPG или PNG.' };
  }
}

// Загружает аватарку в Storage и возвращает публичную ссылку.
// Файл всегда лежит по одному пути, поэтому к ссылке добавляется версия, иначе браузер покажет старую картинку.
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  if (!supabase) throw new Error('Supabase не настроен');
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removeAvatarFile(userId: string): Promise<void> {
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([`${userId}/avatar.jpg`]);
}

// ---- Аватарка «в ожидании». Если после регистрации нужно подтвердить почту, сессии ещё нет
// и загрузить файл нельзя. Поэтому запоминаем его в браузере и загружаем при первом входе.
const PENDING_KEY = 'ritm_pending_avatar';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function savePendingAvatar(email: string, blob: Blob): Promise<void> {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email: email.trim().toLowerCase(), dataUrl: await blobToDataUrl(blob) }));
  } catch {}
}

// Возвращает ожидающую аватарку, только если она относится к этой почте, и сразу удаляет её из хранилища
export async function takePendingAvatar(email: string | undefined): Promise<Blob | null> {
  if (Platform.OS !== 'web' || !email) return null;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { email: string; dataUrl: string };
    if (saved.email !== email.trim().toLowerCase()) return null;
    localStorage.removeItem(PENDING_KEY);
    return await (await fetch(saved.dataUrl)).blob();
  } catch {
    return null;
  }
}
