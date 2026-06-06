import { describe, it, expect } from 'vitest';
import { fmtTime, splitArtistTitle, clamp } from './format';

// Тест 1: fmtTime — форматирование времени трека (секунды -> "m:ss")
describe('fmtTime', () => {
  it('форматирует секунды в вид m:ss', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(5)).toBe('0:05');
    expect(fmtTime(65)).toBe('1:05');
    expect(fmtTime(125)).toBe('2:05');
  });

  it('возвращает 0:00 для некорректных значений', () => {
    expect(fmtTime(-10)).toBe('0:00');
    expect(fmtTime(NaN)).toBe('0:00');
    expect(fmtTime(Infinity)).toBe('0:00');
  });
});

// Тест 2: splitArtistTitle — разбор имени файла на исполнителя и название
describe('splitArtistTitle', () => {
  it('разбивает "Artist - Title.mp3" корректно', () => {
    expect(splitArtistTitle('Queen - Bohemian Rhapsody.mp3')).toEqual({
      artist: 'Queen',
      title: 'Bohemian Rhapsody',
    });
  });

  it('сохраняет дефисы внутри названия', () => {
    expect(splitArtistTitle('AC/DC - Rock - n - Roll.mp3')).toEqual({
      artist: 'AC/DC',
      title: 'Rock - n - Roll',
    });
  });

  it('подставляет Unknown, если нет разделителя', () => {
    expect(splitArtistTitle('justtitle.mp3')).toEqual({
      artist: 'Unknown',
      title: 'justtitle',
    });
  });
});

// Тест 3: clamp — ограничение числа диапазоном
describe('clamp', () => {
  it('возвращает значение внутри диапазона без изменений', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('обрезает значения за пределами диапазона', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});
