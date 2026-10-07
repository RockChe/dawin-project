import { describe, it, expect } from 'vitest';
import { dayIndex } from '@/lib/dayIndex';

describe('dayIndex', () => {
  it('斜線格式', () => expect(dayIndex('1970/01/02')).toBe(1));
  it('ISO 格式', () => expect(dayIndex('1970-01-02')).toBe(1));
  it('ISO 與斜線同日相等', () => expect(dayIndex('2026-10-07')).toBe(dayIndex('2026/10/07')));
  it('相鄰日差 1', () => expect(dayIndex('2026/10/08') - dayIndex('2026/10/07')).toBe(1));
  it('跨年相差 1', () => expect(dayIndex('2027/01/01') - dayIndex('2026/12/31')).toBe(1));
  it('閏年 2/29 存在', () => expect(dayIndex('2028/03/01') - dayIndex('2028/02/28')).toBe(2));
  it('DST 邊界 03/07→03/09 恰差 2', () => expect(dayIndex('2026/03/09') - dayIndex('2026/03/07')).toBe(2));
  it('回傳整數', () => expect(Number.isInteger(dayIndex('2026/10/07'))).toBe(true));
  it('null → null', () => expect(dayIndex(null)).toBeNull());
  it('undefined → null', () => expect(dayIndex(undefined)).toBeNull());
  it('空字串 → null', () => expect(dayIndex('')).toBeNull());
  it('格式錯 → null', () => expect(dayIndex('abc')).toBeNull());
  it('非字串 → null', () => expect(dayIndex(20261007)).toBeNull());
  it('月份超界 → null', () => expect(dayIndex('2026/13/01')).toBeNull());
  it('不存在的日期 → null', () => expect(dayIndex('2026/02/30')).toBeNull());
});
