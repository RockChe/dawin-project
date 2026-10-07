import { describe, it, expect } from 'vitest';
import { formatShortDate } from '@/lib/formatShortDate';

describe('formatShortDate', () => {
  it('同年：MM/DD（不補年份）', () => {
    expect(formatShortDate('2026/09/01', '2026-10-07')).toBe('09/01');
    expect(formatShortDate('2026-12-31', '2026-10-07')).toBe('12/31');
    expect(formatShortDate('2026/9/1', '2026/10/07')).toBe('09/01');
  });
  it('跨年：YYYY/MM/DD（不用容易誤讀的 YY 短寫）', () => {
    expect(formatShortDate('2027/01/31', '2026-10-07')).toBe('2027/01/31');
    expect(formatShortDate('2025-11-10', '2026-10-07')).toBe('2025/11/10');
  });
  it('帶時間的字串只取日期', () => {
    expect(formatShortDate('2026-09-01 08:00', '2026-10-07')).toBe('09/01');
  });
  it('缺值：空字串；格式錯原樣回傳', () => {
    expect(formatShortDate('', '2026-10-07')).toBe('');
    expect(formatShortDate(null, '2026-10-07')).toBe('');
    expect(formatShortDate(undefined, '2026-10-07')).toBe('');
    expect(formatShortDate('abc', '2026-10-07')).toBe('abc');
  });
  it('沒給 today：一律帶完整年份', () => {
    expect(formatShortDate('2026/09/01')).toBe('2026/09/01');
  });
});
