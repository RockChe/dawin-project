import { describe, it, expect } from 'vitest';
import { segCells, tickPos } from '@/lib/segBar';

describe('segCells', () => {
  it('長度 10', () => expect(segCells(37)).toHaveLength(10));
  it('0% → 全 0', () => expect(segCells(0)).toEqual(Array(10).fill(0)));
  it('100% → 全 1', () => expect(segCells(100)).toEqual(Array(10).fill(1)));
  it('54% → 前 5 格 1、第 6 格 0.4、其餘 0', () => {
    const c = segCells(54);
    expect(c.slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(c[5]).toBeCloseTo(0.4, 10);
    expect(c.slice(6)).toEqual([0, 0, 0, 0]);
  });
  it('10% 剛好填滿第一格', () => expect(segCells(10)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
  it('負值夾到 0', () => expect(segCells(-20)).toEqual(Array(10).fill(0)));
  it('超過 100 夾到 1', () => expect(segCells(150)).toEqual(Array(10).fill(1)));
  it('每格都在 0–1', () => segCells(73).forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }));
  it('非數字 → 全 0', () => expect(segCells(NaN)).toEqual(Array(10).fill(0)));
});

describe('tickPos', () => {
  it('中間值原樣', () => expect(tickPos(54)).toBe(54));
  it('負值夾到 0', () => expect(tickPos(-5)).toBe(0));
  it('超過夾到 100', () => expect(tickPos(130)).toBe(100));
  it('邊界 0 / 100', () => { expect(tickPos(0)).toBe(0); expect(tickPos(100)).toBe(100); });
  it('非數字 → 0', () => expect(tickPos(undefined)).toBe(0));
});
