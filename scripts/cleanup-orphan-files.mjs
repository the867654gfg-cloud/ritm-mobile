#!/usr/bin/env node
// Одноразовая очистка хранилища: удаляет файлы из бакета music-storage, на которые не ссылается ни один трек.
//
// Запуск (PowerShell, из папки проекта):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "ключ"
//   node scripts/cleanup-orphan-files.mjs            # только показать, что будет удалено (ничего не удаляет)
//   node scripts/cleanup-orphan-files.mjs --delete   # реально удалить
//
// Ключ берите в Supabase: Project Settings -> API Keys -> service_role (secret). Это админский ключ:
// не коммитьте его в git, не кладите в .env приложения и не вставляйте в код сайта.

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { findOrphans, formatMB } from './orphans-core.mjs';

const BUCKET = 'music-storage';
const doDelete = process.argv.includes('--delete');
const allowEmpty = process.argv.includes('--allow-empty');

function urlFromEnvFile() {
  if (!existsSync('.env')) return undefined;
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('EXPO_PUBLIC_SUPABASE_URL='));
  return line?.split('=')[1]?.trim();
}

const url = process.env.SUPABASE_URL || urlFromEnvFile();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Нужны адрес проекта и ключ администратора.\n' +
    '  Адрес берётся из .env (EXPO_PUBLIC_SUPABASE_URL) или из переменной SUPABASE_URL.\n' +
    '  Ключ: переменная SUPABASE_SERVICE_ROLE_KEY (Project Settings -> API Keys -> service_role).');
  process.exit(1);
}

// Защита от случайно подставленного публичного ключа: с ним скрипт всё равно ничего не удалит
function isServiceKey(k) {
  if (k.startsWith('sb_secret_')) return true;
  try {
    return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role === 'service_role';
  } catch {
    return false;
  }
}
if (!isServiceKey(key)) {
  console.error('Это не ключ service_role. Публичный (anon / publishable) ключ не подходит для очистки.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Рекурсивно обходит все папки бакета
async function listAllFiles(prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`Не удалось получить список файлов (${prefix || 'корень'}): ${error.message}`);
    for (const item of data) {
      if (item.id === null) files.push(...(await listAllFiles(`${prefix}${item.name}/`)));
      else files.push({ name: `${prefix}${item.name}`, size: item.metadata?.size ?? 0, created_at: item.created_at, updated_at: item.updated_at });
    }
    if (data.length < 1000) break;
  }
  return files;
}

async function loadAllTracks() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tracks').select('audio_url, cover_url').range(from, from + 999);
    if (error) throw new Error(`Не удалось прочитать таблицу tracks: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const files = await listAllFiles();
const tracks = await loadAllTracks();
const playlistCovers = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('user_playlists').select('cover_url').not('cover_url', 'is', null).order('id').range(from, from + 999);
  if (error) throw new Error(`Не удалось проверить обложки плейлистов: ${error.message}`);
  playlistCovers.push(...data);
  if (data.length < 1000) break;
}

// Если треков нет вообще, то «лишними» окажутся все файлы. Скорее всего, это сбой, а не так и задумано.
if (tracks.length === 0 && files.length > 0 && !allowEmpty) {
  console.error(`В таблице tracks 0 записей, а в хранилище ${files.length} файлов. Удалять нечего: так все файлы стали бы «лишними».\n` +
    'Если это действительно так, запустите с флагом --allow-empty.');
  process.exit(1);
}

const { orphans, skippedRecent, usedCount } = findOrphans(files, [...tracks, ...playlistCovers], { minAgeHours: 24, bucket: BUCKET });
const total = (list) => list.reduce((s, f) => s + (f.size || 0), 0);

console.log(`Файлов в бакете ${BUCKET}: ${files.length} (${formatMB(total(files))})`);
console.log(`  привязаны к трекам:        ${usedCount}`);
console.log(`  без трека, можно удалить:  ${orphans.length} (${formatMB(total(orphans))})`);
console.log(`  пропущены (моложе 24 ч):   ${skippedRecent.length}`);
orphans.slice(0, 10).forEach((f) => console.log(`    - ${f.name}  ${formatMB(f.size || 0)}`));
if (orphans.length > 10) console.log(`    … и ещё ${orphans.length - 10}`);

if (orphans.length === 0) process.exit(0);
if (!doDelete) {
  console.log('\nЭто только просмотр, ничего не удалено. Для удаления добавьте флаг --delete.');
  process.exit(0);
}

let removed = 0;
for (let i = 0; i < orphans.length; i += 100) {
  const batch = orphans.slice(i, i + 100).map((f) => f.name);
  const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) { console.error(`Ошибка при удалении: ${error.message}`); process.exit(1); }
  removed += data?.length ?? 0;
}
console.log(`\nУдалено файлов: ${removed} из ${orphans.length}`);
if (removed < orphans.length) console.log('Часть файлов не удалилась, запустите скрипт ещё раз.');
