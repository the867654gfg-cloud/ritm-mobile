export function playbackFailure(code?: number) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Нет подключения к интернету. Проверьте сеть и повторите.';
  if (code === 2) return 'Не удалось получить аудио по сети. Нажмите Play, чтобы повторить.';
  if (code === 3 || code === 4) return 'Аудиофайл повреждён, удалён или имеет неподдерживаемый формат.';
  return 'Не удалось запустить трек. Нажмите Play, чтобы повторить.';
}

export function catalogueFailure(status: number, message?: string) {
  if (status === 402) return 'Музыкальный каталог временно недоступен. Попробуйте позже.';
  if (status === 0) return 'Нет связи с музыкальным каталогом. Проверьте подключение.';
  return message || 'Не удалось проверить доступность трека. Повторите попытку.';
}
