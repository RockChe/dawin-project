import { describe, it, expect } from 'vitest';
import { timeAxis, barGeometry } from '@/lib/v2Axis';
import { dayIndex } from '@/lib/dayIndex';

const T = '2026-10-07';

describe('timeAxis（日／週／月／季，範圍都以 today 為基準，與設計稿一致）', () => {
  it('月：06/01 → 隔年 02/01，月份刻度與年份標籤', () => {
    const ax = timeAxis('月', T);
    expect(ax.a).toBe(dayIndex('2026/06/01'));
    expect(ax.b).toBe(dayIndex('2027/02/01'));
    expect(ax.ticks.map((t) => t.l)).toEqual(['6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月']);
    expect(ax.ticks.find((t) => t.l === '1月').strong).toBe(true);
    expect(ax.groups.map((g) => g.l)).toEqual(['2026', '2027']);
    expect(ax.groups.every((g) => g.y)).toBe(true);
    expect(ax.groups[0].p).toBe(0);
  });

  it('季：04/01 → 隔年 04/01，Q 刻度', () => {
    const ax = timeAxis('季', T);
    expect(ax.a).toBe(dayIndex('2026/04/01'));
    expect(ax.b).toBe(dayIndex('2027/04/01'));
    expect(ax.ticks.map((t) => t.l)).toEqual(['Q2', 'Q3', 'Q4', 'Q1']);
  });

  it('週：today-23 → today+68，每 7 天一格 M/D，月份群組', () => {
    const ax = timeAxis('週', T);
    expect(ax.a).toBe(dayIndex('2026/09/14'));
    expect(ax.b).toBe(dayIndex('2026/12/14'));
    expect(ax.ticks[0].l).toBe('9/14');
    expect(ax.ticks[1].l).toBe('9/21');
    expect(ax.groups.map((g) => g.l)).toEqual(['2026 · 9月', '10月', '11月', '12月']);
  });

  it('日：today-9 → today+19，每天一格（日期數字）', () => {
    const ax = timeAxis('日', T);
    expect(ax.a).toBe(dayIndex('2026/09/28'));
    expect(ax.b).toBe(dayIndex('2026/10/26'));
    expect(ax.ticks).toHaveLength(28);
    expect(ax.ticks[0].l).toBe('28');
  });

  it('今天位置 todayP 落在 0–100；不認得的尺度退回月', () => {
    const ax = timeAxis('月', T);
    expect(ax.todayP).toBeGreaterThan(0);
    expect(ax.todayP).toBeLessThan(100);
    expect(ax.todayP).toBeCloseTo(((dayIndex('2026/10/07') - ax.a) / (ax.b - ax.a)) * 100, 6);
    expect(timeAxis('???', T).a).toBe(ax.a);
  });

  it('跨年：today 在 1 月時，月尺度起點在前一年', () => {
    const ax = timeAxis('月', '2027-01-15');
    expect(ax.a).toBe(dayIndex('2026/09/01'));
    expect(ax.groups.map((g) => g.l)).toEqual(['2026', '2027']);
  });
});

const row = (o) => ({ s: '2026/08/15', e: '2026/11/30', prog: 54, el: 54, state: 'ok', done: false, gapKind: 'sync', ...o });

describe('barGeometry（10 格分段條＋今天刻度＋斜線）', () => {
  const ax = timeAxis('月', T);

  it('條位置在軌道內；10 格；進度 54% → 前 5 格滿、第 6 格 0.4', () => {
    const g = barGeometry(row(), ax, T);
    expect(g.none).toBe(false);
    expect(g.l).toBeGreaterThan(0);
    expect(g.r).toBeLessThan(100);
    expect(g.l).toBeLessThan(g.r);
    expect(g.cells.map((c) => c.p)).toEqual([1, 1, 1, 1, 1, 0.4, 0, 0, 0, 0].map((x) => expect.closeTo(x, 5)));
    expect(g.cells.map((c) => c.kind)).toEqual(['fl', 'fl', 'fl', 'fl', 'fl', 'pt', 'em', 'em', 'em', 'em']);
    expect(g.cl0).toBe(false);
    expect(g.cr0).toBe(false);
  });

  it('今天刻度：在期間內才有；位置 = el，並校正格間縫', () => {
    const g = barGeometry(row({ el: 50 }), ax, T);
    expect(g.tick).toEqual({ el: 50, gapK: -0.5 }); // 50% 落在第 6 格(i=5)：校正 = 9×0.5−5 = −0.5（× 格間縫）
    const none = barGeometry(row({ s: '2026/10/10', e: '2026/10/30' }), ax, T); // 今天在條之前
    expect(none.tick).toBeNull();
    expect(barGeometry(row({ done: true }), ax, T).tick).toBeNull();
    expect(barGeometry(row({ state: 'hold' }), ax, T).tick).toBeNull();
    expect(barGeometry(row({ state: 'prop' }), ax, T).tick).toBeNull();
  });

  it('落後：斜線只畫在「進度 → 今天應有」之間的格子', () => {
    const g = barGeometry(row({ prog: 27, el: 60, state: 'behind', gapKind: 'behind' }), ax, T);
    expect(g.hat).toBe(true);
    const hz = g.cells.map((c) => c.hz);
    expect(hz[0]).toBeNull();                       // 滿格
    expect(hz[2]).toMatchObject({ left: expect.closeTo(0.7, 5), width: expect.closeTo(0.3, 5) }); // 27%：第 3 格 70% 起
    expect(hz[3]).toMatchObject({ left: 0, width: 1 });
    expect(hz[5]).toMatchObject({ left: 0, width: 1 });
    expect(hz[6]).toBeNull();                       // 超過 el 的格不畫
    expect(barGeometry(row({ prog: 27, el: 60, gapKind: 'sync' }), ax, T).hat).toBe(false);
  });

  it('日尺度裁切：條超出軌道 → cl0／cr0 虛線端，k／off 校正', () => {
    const day = timeAxis('日', T);
    const g = barGeometry(row(), day, T); // 08/15–11/30 蓋過整個 9/28–10/26
    expect(g.none).toBe(false);
    expect(g.cl0).toBe(true);
    expect(g.cr0).toBe(true);
    expect(g.l).toBe(0);
    expect(g.r).toBe(100);
    expect(g.k).toBeGreaterThan(1);
  });

  it('完全在範圍外 → none', () => {
    const day = timeAxis('日', T);
    expect(barGeometry(row({ s: '2027/01/01', e: '2027/02/01' }), day, T).none).toBe(true);
  });

  it('極短的條至少 0.6% 寬', () => {
    const g = barGeometry(row({ s: '2026/10/01', e: '2026/10/01' }), ax, T);
    expect(g.r - g.l).toBeGreaterThanOrEqual(0.6);
  });
});
