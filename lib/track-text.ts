export function readableTrackText(raw: string) {
  const value = raw.trim();
  if (!value || /[A-Za-zА-Яа-яЁё]/.test(value)) return value;
  const swapped = Array.from(value, char => {
    const code = char.charCodeAt(0);
    return String.fromCharCode(((code & 255) << 8) | (code >> 8));
  }).join('').trim();
  return /^[A-Za-zА-Яа-яЁё0-9\x20-\x7E«»—–’…№]+$/.test(swapped)
    && /[A-Za-zА-Яа-яЁё]{2}/.test(swapped) ? swapped : value;
}
