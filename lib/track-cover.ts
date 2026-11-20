export async function getWebFileContentType(file: Blob): Promise<'jpg' | 'png' | 'webp'> {
  const extensions: Record<string, 'jpg' | 'png' | 'webp'> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const extension = extensions[file.type];
  if (!extension || !file.size || file.size > 5 * 1024 * 1024) throw new Error('Выберите JPG, PNG или WebP до 5 МБ.');
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const tail = new Uint8Array(await file.slice(-12).arrayBuffer());
  const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);
  const complete = extension === 'jpg'
    ? head[0] === 255 && head[1] === 216 && tail.at(-2) === 255 && tail.at(-1) === 217
    : extension === 'png'
      ? head[0] === 137 && text(head.slice(1, 4)) === 'PNG' && text(tail.slice(4, 8)) === 'IEND'
      : head.length === 12 && text(head.slice(0, 4)) === 'RIFF' && text(head.slice(8)) === 'WEBP' &&
        new DataView(head.buffer).getUint32(4, true) + 8 === file.size;
  if (!complete) throw new Error('Файл обложки повреждён или не соответствует формату.');
  return extension;
}
