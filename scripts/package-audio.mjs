import { execFile, spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const [id, input, output, losslessFlag] = process.argv.slice(2);
if (!id || !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(id) || !input || !output || (losslessFlag && losslessFlag !== '--lossless')) {
  throw new Error('Usage: node scripts/package-audio.mjs TRACK_ID INPUT_FILE OUTPUT_ROOT [--lossless]');
}
const root = resolve(output);
const source = resolve(input);
const destination = join(root, id);
const rates = [96, 160, 320];
const lossless = losslessFlag === '--lossless';
const profiles = [...rates.map(String), ...(lossless ? ['lossless'] : [])];
await access(source);
await mkdir(root, { recursive: true });
const exists = await access(destination).then(() => true, error => {
  if (error.code !== 'ENOENT') throw error;
  return false;
});
if (exists) throw new Error('Output for this track already exists.');

function ffmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.RITM_FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], {
      cwd, stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('FFmpeg exited with code ' + code)));
  });
}

async function measureLoudness() {
  return new Promise(resolve => {
    execFile(process.env.RITM_FFMPEG || 'ffmpeg', [
      '-hide_banner', '-nostdin', '-i', source, '-map', '0:a:0',
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-',
    ], { timeout: 120_000, maxBuffer: 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) return resolve(undefined);
      try {
        const json = JSON.parse(stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1));
        const integrated = Number(json.input_i);
        const truePeak = Number(json.input_tp);
        resolve(Number.isFinite(integrated) && Number.isFinite(truePeak) ? { integrated, truePeak } : undefined);
      } catch { resolve(undefined); }
    });
  });
}

const staging = await mkdtemp(join(root, '.packaging-'));
try {
  for (const profile of profiles) await mkdir(join(staging, profile));
  await ffmpeg([
    '-i', source, '-vn',
    ...rates.flatMap((rate, index) => ['-map', '0:a:0', '-c:a:' + index, 'aac', '-b:a:' + index, rate + 'k', '-ar:a:' + index, '48000', '-ac:a:' + index, '2']),
    ...(lossless ? ['-map', '0:a:0', '-c:a:3', 'flac', '-strict', 'experimental'] : []),
    '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4',
    '-master_pl_name', 'index.m3u8', '-hls_fmp4_init_filename', 'init.mp4',
    '-var_stream_map', profiles.map((profile, index) => 'a:' + index + ',name:' + profile).join(' '),
    '-hls_segment_filename', '%v/segment_%05d.m4s', '%v/index.m3u8',
  ], staging);
  for (const rate of rates) {
    await ffmpeg(['-i', rate + '/index.m3u8', '-map', '0:a:0', '-c', 'copy', '-movflags', '+faststart', rate + '.m4a'], staging);
  }
  if (lossless) {
    const master = join(staging, 'index.m3u8');
    const playlist = await readFile(master, 'utf8');
    await writeFile(master, playlist.replace('CODECS="flac"', 'CODECS="fLaC"'));
    await ffmpeg(['-i', source, '-map', '0:a:0', '-c:a', 'flac', 'lossless.flac'], staging);
  }
  const loudness = await measureLoudness();
  if (loudness) await writeFile(join(staging, 'loudness.json'), JSON.stringify(loudness));
  await rename(staging, destination);
} finally {
  await rm(staging, { recursive: true, force: true });
}
