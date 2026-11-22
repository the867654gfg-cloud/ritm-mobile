const limit = 32 * 1024 * 1024;

function openKeys() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ritm-offline-keys', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('keys');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let pendingKey: Promise<CryptoKey> | undefined;
function offlineKey() {
  return pendingKey ??= (async () => {
    const db = await openKeys();
    try {
      const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      return await new Promise<CryptoKey>((resolve, reject) => {
        const transaction = db.transaction('keys', 'readwrite');
        const keys = transaction.objectStore('keys');
        const request = keys.get('audio');
        let key: CryptoKey;
        request.onsuccess = () => {
          key = request.result ?? candidate;
          if (!request.result) keys.add(key, 'audio');
        };
        transaction.oncomplete = () => resolve(key);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  })().catch(error => { pendingKey = undefined; throw error; });
}

export async function requireEncryptedOfflineWorker(worker: ServiceWorker) {
  const channel = new MessageChannel();
  try {
    const supported = await new Promise<boolean>(resolve => {
      const timer = setTimeout(() => resolve(false), 750);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        resolve(event.data === true);
      };
      worker.postMessage('ritm:encrypted-offline', [channel.port2]);
    });
    if (!supported) throw new Error('Обновите страницу, чтобы включить зашифрованные скачивания.');
  } finally { channel.port1.close(); }
}

export async function cacheEncryptedAudio(cache: Cache, key: string, url: string, typeOverride?: string) {
  const source = new URL(url);
  if (key === url) source.searchParams.set('ritm-download', '1');
  const response = await fetch(source);
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || !response.body ||
      !/^(audio\/|video\/mp4|application\/octet-stream)/i.test(type)) {
    throw new Error('Файл в этом качестве недоступен.');
  }
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const reader = response.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error('Для скачивания выберите файл размером до 32 МБ.');
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new Error('Сервер вернул пустой аудиофайл.');
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode(key) },
    await offlineKey(), await new Blob(parts).arrayBuffer(),
  );
  await cache.put(key, new Response(new Blob([nonce, ciphertext]), {
    headers: { 'Content-Type': typeOverride || type, 'X-Ritm-Encrypted': '1', 'X-Ritm-Download': crypto.randomUUID() },
  }));
}
