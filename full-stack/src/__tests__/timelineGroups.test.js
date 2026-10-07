/**
 * Task 8：卡片視圖分組（R6）。有逾期 → 已逾期；否則看下一個未完成里程碑日 days：
 * ≤7 這週、同月 本月、下月 下月、其餘／無里程碑 之後。全程走 dayIndex，今天由呼叫端傳入。
 */
import { describe, it, expect } from 'vitest';
import { groupProjects } from '@/lib/timelineGroups';

const T = (id, status, end, start = '2026/01/01') => ({ id, task: `任務${id}`, status, start, end });
const P = (id, tasks) => ({ projectId: id, name: id, tasks });
const where = (groups, id) => groups.find(g => g.items.some(i => i.projectId === id))?.key;

describe('groupProjects', () => {
  it('固定五組、順序：已逾期／這週／本月／下月／之後；沒專案也都在', () => {
    const g = groupProjects([], '2026-10-07');
    expect(g.map(x => x.key)).toEqual(['over', 'wk', 'mo', 'nx', 'lt']);
    expect(g.map(x => x.label)).toEqual(['已逾期', '這週', '本月', '下月', '之後']);
    expect(g.every(x => x.items.length === 0)).toBe(true);
  });

  it('有逾期任務 → 已逾期，且優先於里程碑（即使另有 3 天後到期的任務）', () => {
    const g = groupProjects([P('a', [T(1, '進行中', '2026/10/01'), T(2, '進行中', '2026/10/10')])], '2026-10-07');
    expect(where(g, 'a')).toBe('over');
    const it = g[0].items[0];
    expect(it.odCount).toBe(1);
    expect(it.odDays).toBe(6);
    expect(it.odName).toBe('任務1');
  });

  it('已完成的過期任務不算逾期', () => {
    const g = groupProjects([P('a', [T(1, '已完成', '2026/10/01'), T(2, '進行中', '2026/10/10')])], '2026-10-07');
    expect(where(g, 'a')).toBe('wk');
  });

  it('今天+7 邊界：7 天後＝這週、8 天後不是（同月＝本月）', () => {
    const g = groupProjects([P('d7', [T(1, '進行中', '2026-10-14')]), P('d8', [T(2, '進行中', '2026-10-15')])], '2026-10-07');
    expect(where(g, 'd7')).toBe('wk');
    expect(where(g, 'd8')).toBe('mo');
  });

  it('今天到期（days=0）＝這週，不是逾期', () => {
    expect(where(groupProjects([P('a', [T(1, '進行中', '2026/10/07')])], '2026-10-07'), 'a')).toBe('wk');
  });

  it('跨月：同月＝本月、下月＝下月、再下個月＝之後', () => {
    const g = groupProjects([
      P('mo', [T(1, '進行中', '2026/10/31')]),
      P('nx', [T(2, '進行中', '2026/11/30')]),
      P('lt', [T(3, '進行中', '2026/12/01')]),
    ], '2026-10-07');
    expect([where(g, 'mo'), where(g, 'nx'), where(g, 'lt')]).toEqual(['mo', 'nx', 'lt']);
  });

  it('跨年：12 月看隔年 1 月＝下月；2 日後跨年仍是這週；隔年 2 月＝之後', () => {
    const g = groupProjects([
      P('nx', [T(1, '進行中', '2027/01/20')]),
      P('wk', [T(2, '進行中', '2027/01/02')]),
      P('lt', [T(3, '進行中', '2027/02/01')]),
    ], '2026-12-31');
    expect([where(g, 'nx'), where(g, 'wk'), where(g, 'lt')]).toEqual(['nx', 'wk', 'lt']);
  });

  it('去年的同月不算本月（年份要一起比）', () => {
    // 今天 2026-10-07、里程碑 2027-10-20：月份同為 10 但差一年 → 之後
    expect(where(groupProjects([P('a', [T(1, '進行中', '2027/10/20')])], '2026-10-07'), 'a')).toBe('lt');
  });

  it('無里程碑（全部已完成／沒有日期）→ 之後', () => {
    const g = groupProjects([
      P('done', [T(1, '已完成', '2026/12/01')]),
      P('nodate', [{ id: 9, status: '進行中', start: '', end: '' }]),
    ], '2026-10-07');
    expect(where(g, 'done')).toBe('lt');
    expect(where(g, 'nodate')).toBe('lt');
    expect(g[4].items.every(i => i.ms === null)).toBe(true);
  });

  it('里程碑＝最近一個未完成任務的到期日，附任務名與 days', () => {
    const g = groupProjects([P('a', [T(1, '進行中', '2026/10/20'), T(2, '待辦', '2026/10/09'), T(3, '已完成', '2026/10/08')])], '2026-10-07');
    const it = g[1].items[0];
    expect(it.ms).toEqual({ name: '任務2', end: '2026/10/09', days: 2 });
  });

  it('組內依里程碑日由近到遠，沒有里程碑的排最後', () => {
    const g = groupProjects([
      P('late', [T(1, '進行中', '2026/10/30')]),
      P('early', [T(2, '進行中', '2026/10/15')]),
    ], '2026-10-07');
    expect(g[2].items.map(i => i.projectId)).toEqual(['early', 'late']);
  });

  it('ISO 與斜線日期混用結果一致', () => {
    const a = groupProjects([P('a', [T(1, '進行中', '2026-10-14')])], '2026/10/07');
    expect(where(a, 'a')).toBe('wk');
  });
});
