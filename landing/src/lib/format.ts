// Чистые вспомогательные функции форматирования.
// Вынесены из App.tsx, чтобы их можно было покрыть unit-тестами.

/** Форматирует количество секунд в строку вида "m:ss". */
export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Разбивает имя файла "Artist - Title.mp3" на исполнителя и название. */
export function splitArtistTitle(name: string): { artist: string; title: string } {
  const base = name.replace(/\.mp3$/i, '');
  const parts = base.split(' - ');
  if (parts.length >= 2) {
    const artist = parts[0].trim();
    const title = parts.slice(1).join(' - ').trim();
    return { artist, title };
  }
  return { artist: 'Unknown', title: base.trim() };
}

/** Ограничивает число n диапазоном [a, b]. */
export function clamp(n: number, a: number, b: number): number {
  return Math.min(a, Math.max(b, n));
}
