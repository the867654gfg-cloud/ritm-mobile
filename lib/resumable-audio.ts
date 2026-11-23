import type { DownloadProgress } from './download-status';

export async function readAudioWithResume(url: string, limit: number, signal?: AbortSignal,
  progress?: DownloadProgress, request: typeof fetch = fetch) {
  let parts: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  let total: number | undefined;
  let etag: string | null = null;
  let type = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 350 * attempt));
    signal?.throwIfAborted();
    const offset = etag ? received : 0;
    let response: Response;
    try {
      response = await request(url, {
        signal,
        headers: offset ? { Range: 'bytes=' + offset + '-', 'If-Range': etag! } : undefined,
      });
    } catch (error) {
      signal?.throwIfAborted();
      if (attempt === 2) throw error;
      continue;
    }
    if ((response.status === 412 || response.status === 416) && offset) {
      await response.body?.cancel();
      etag = null;
      continue;
    }
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
      await response.body?.cancel();
      continue;
    }
    const responseType = response.headers.get('content-type') ?? '';
    const responseEtag = response.headers.get('etag');
    if (response.status === 200 && /^(audio\/|video\/mp4|application\/octet-stream)/i.test(responseType)) {
      received = 0;
      parts = [];
      const declared = Number(response.headers.get('content-length'));
      total = declared > 0 && !response.headers.get('content-encoding') ? declared : undefined;
      etag = responseEtag?.startsWith('"') ? responseEtag : null;
      type = responseType;
    } else if (response.status === 206 && offset) {
      const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
      if (!range || Number(range[1]) !== offset || Number(range[2]) !== Number(range[3]) - 1 ||
          (total && total !== Number(range[3])) || responseEtag !== etag) {
        await response.body?.cancel();
        etag = null;
        continue;
      }
      total = Number(range[3]);
    } else {
      await response.body?.cancel();
      throw new Error('Файл в этом качестве недоступен.');
    }

    if (!response.body || (total && total > limit)) {
      await response.body?.cancel();
      throw new Error('Для скачивания выберите файл размером до 32 МБ.');
    }
    const reader = response.body.getReader();
    try {
      for (;;) {
        signal?.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        received += chunk.value.byteLength;
        if (received > limit || (total && received > total)) {
          await reader.cancel();
          throw new RangeError('Сервер превысил допустимый размер загрузки.');
        }
        parts.push(chunk.value);
        progress?.(received, total);
      }
      if (received && (!total || received === total)) {
        const bytes = new Uint8Array(received);
        let index = 0;
        for (const part of parts) { bytes.set(part, index); index += part.byteLength; }
        return { bytes, type };
      }
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof RangeError || attempt === 2) throw error;
    } finally {
      reader.releaseLock();
    }
  }
  throw new Error('Загрузка прервалась. Проверьте связь и повторите.');
}
