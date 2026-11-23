import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const { RITM_SUPABASE_URL: base, RITM_SUPABASE_SERVICE_KEY: serviceKey } = process.env;
if (!base || !serviceKey) throw new Error('Set RITM_SUPABASE_URL and RITM_SUPABASE_SERVICE_KEY on the worker.');
const allowedOrigin = new URL(base).origin;
const db = createClient(base, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const watch = process.argv.includes('--watch');
const bucket = db.storage.from('music-storage');
const types = { '.json': 'application/json', '.mp4': 'audio/mp4', '.m4s': 'audio/mp4', '.m4a': 'audio/mp4', '.m3u8': 'application/vnd.apple.mpegurl' };

async function packageAudio(job, directory) {
  const source = new URL(job.source_url);
  if (source.origin !== allowedOrigin || source.search ||
      !source.pathname.startsWith('/storage/v1/object/public/music-storage/') ||
      !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(job.track_id)) throw new Error('Unsupported track source');
  const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(180_000) });
  if (!response.ok || !response.body) throw new Error('Source storage returned ' + response.status);
  const original = join(directory, 'original');
  let bytes = 0;
  await pipeline(Readable.fromWeb(response.body), async function* (chunks) {
    for await (const chunk of chunks) {
      bytes += chunk.length;
      if (bytes > 256 * 1024 * 1024) throw new Error('Source file exceeds 256 MiB');
      yield chunk;
    }
  }, createWriteStream(original));
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/package-audio.mjs', job.track_id, original, directory], {
      stdio: 'ignore', timeout: 20 * 60 * 1000,
    });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('FFmpeg could not encode the source')));
  });
  const root = join(directory, job.track_id);
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const paths = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name));
  const master = join(root, 'index.m3u8');
  const put = async (path) => {
    const key = 'ritm-streams/' + job.track_id + '/' + relative(root, path).replaceAll('\\', '/');
    const { error } = await bucket.upload(key, await readFile(path), {
      contentType: types[extname(path)], cacheControl: '60', upsert: true,
    });
    if (error) throw new Error('Could not store prepared audio');
  };
  for (const path of paths) if (path !== master) await put(path);
  const { data: claimed, error } = await db.from('ritm_media_jobs').select('track_id')
    .eq('track_id', job.track_id).eq('lease', job.lease).maybeSingle();
  if (error || !claimed) throw new Error('Processing lease expired');
  await put(master);
}

async function runOne() {
  const { data, error } = await db.rpc('ritm_claim_media_job');
  if (error) throw new Error('Media queue unavailable: ' + error.code);
  const job = data?.[0];
  if (!job) return false;
  const directory = await mkdtemp(join(tmpdir(), 'ritm-encode-'));
  let failure = null;
  try { await packageAudio(job, directory); }
  catch (error) { failure = error instanceof Error ? error.message.slice(0, 150) : 'Encoding failed'; }
  finally { await rm(directory, { recursive: true, force: true }); }
  const result = await db.from('ritm_media_jobs').update({
    status: failure ? 'error' : 'ready', error_message: failure, updated_at: new Date().toISOString(), lease: null,
  }).eq('track_id', job.track_id).eq('lease', job.lease);
  if (result.error) throw new Error('Could not update processing status');
  console.log(job.track_id, failure || 'ready');
  return true;
}

do {
  try {
    if (await runOne()) continue;
    if (!watch) break;
  } catch (error) {
    console.error(error.message);
    if (!watch) { process.exitCode = 1; break; }
  }
  await new Promise(resolve => setTimeout(resolve, 15_000));
} while (watch);
