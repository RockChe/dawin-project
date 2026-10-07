import { describe, it, expect } from 'vitest';
import { matchesSearch, filterBySearch } from '@/lib/v2Search';

// 規則沿用舊 Dashboard 的 searchQ：任務名／專案名／負責人／備註，不分大小寫的子字串。
const rows = [
  { id: 'a', task: 'Yaya Band 簽約', project: '虎姑婆', owner: 'Rock,Karen', notes: '' },
  { id: 'b', task: '場地勘查', project: '衛武營', owner: 'Oliver', notes: '要帶 KARAOKE 設備' },
  { id: 'c', task: '剪輯', project: 'YouTube', owner: null, notes: null },
];

describe('v2Search', () => {
  it('空字串＝不篩（回傳同一個陣列）', () => {
    expect(filterBySearch(rows, '')).toBe(rows);
    expect(filterBySearch(rows, undefined)).toBe(rows);
  });
  it('比對任務名、專案名、負責人、備註，不分大小寫', () => {
    expect(filterBySearch(rows, 'yaya').map((r) => r.id)).toEqual(['a']);
    expect(filterBySearch(rows, '衛武').map((r) => r.id)).toEqual(['b']);
    expect(filterBySearch(rows, 'karen').map((r) => r.id)).toEqual(['a']);
    expect(filterBySearch(rows, 'karaoke').map((r) => r.id)).toEqual(['b']);
    expect(filterBySearch(rows, 'youtube').map((r) => r.id)).toEqual(['c']);
  });
  it('欄位是 null／缺少不會炸；沒有符合回空陣列', () => {
    expect(matchesSearch({ task: 'x' }, 'x')).toBe(true);
    expect(filterBySearch(rows, '不存在')).toEqual([]);
  });
});
