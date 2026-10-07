import { describe, it, expect } from 'vitest';
import { elapsedPct, gapDays, stateOf, gapInfo } from '@/lib/timelineGap';

describe('elapsedPct', () => {
  it('中點 50', () => expect(elapsedPct('2026/10/01', '2026/10/11', '2026/10/06')).toBe(50));
  it('今天在開始前 → 0', () => expect(elapsedPct('2026/10/10', '2026/10/20', '2026/10/01')).toBe(0));
  it('今天在結束後 → 100', () => expect(elapsedPct('2026/10/01', '2026/10/10', '2026/12/01')).toBe(100));
  it('總長 0 → 0', () => expect(elapsedPct('2026/10/01', '2026/10/01', '2026/10/01')).toBe(0));
  it('跨年', () => expect(elapsedPct('2026/12/22', '2027/01/11', '2027/01/01')).toBe(50));
  it('ISO 與斜線混用', () => expect(elapsedPct('2026-10-01', '2026/10/11', '2026-10-06')).toBe(50));
  it('缺開始日 → 0', () => expect(elapsedPct(null, '2026/10/11', '2026/10/06')).toBe(0));
  it('缺結束日 → 0', () => expect(elapsedPct('2026/10/01', undefined, '2026/10/06')).toBe(0));
  it('缺今天 → 0', () => expect(elapsedPct('2026/10/01', '2026/10/11', null)).toBe(0));
  it('格式錯 → 0', () => expect(elapsedPct('x', 'y', 'z')).toBe(0));
  it('結束早於開始 → 0', () => expect(elapsedPct('2026/10/11', '2026/10/01', '2026/10/05')).toBe(0));
  it('DST 邊界 03/07→03/09 今天 03/08 恆 50', () => {
    expect(elapsedPct('2026/03/07', '2026/03/09', '2026/03/08')).toBe(50);
    expect(elapsedPct('2026-03-07', '2026-03-09', '2026-03-08')).toBe(50);
  });
  it('DST 歐洲邊界 10/24→10/26 今天 10/25 恆 50', () =>
    expect(elapsedPct('2026/10/24', '2026/10/26', '2026/10/25')).toBe(50));
});

describe('gapDays', () => {
  it('18 點 / 78 天 → 14', () => expect(gapDays(-18, 78)).toBe(14));
  it('至少 1 天', () => expect(gapDays(-5, 4)).toBe(1));
  it('總天數 0 → 1', () => expect(gapDays(-30, 0)).toBe(1));
  it('正負號對稱', () => expect(gapDays(18, 78)).toBe(gapDays(-18, 78)));
  it('121 天跨度落後 18 點 → 22 天', () => expect(gapDays(-18, 121)).toBe(22));
});

describe('stateOf', () => {
  it('逾期優先', () => expect(stateOf({ overdue: true, hold: true, prop: false, gap: 30 })).toBe('over'));
  it('暫緩', () => expect(stateOf({ overdue: false, hold: true, prop: false, gap: 0 })).toBe('hold'));
  it('暫緩優先於提案', () => expect(stateOf({ overdue: false, hold: true, prop: true, gap: 0 })).toBe('hold'));
  it('提案', () => expect(stateOf({ overdue: false, hold: false, prop: true, gap: 0 })).toBe('prop'));
  it('落後邊界 -5', () => expect(stateOf({ overdue: false, hold: false, prop: false, gap: -5 })).toBe('behind'));
  it('-4 仍算 ok', () => expect(stateOf({ overdue: false, hold: false, prop: false, gap: -4 })).toBe('ok'));
  it('領先 → ok', () => expect(stateOf({ overdue: false, hold: false, prop: false, gap: 40 })).toBe('ok'));
});

describe('gapInfo', () => {
  const base = { state: 'ok', done: false, gap: 0, prog: 50, el: 50, tot: 100 };
  it('同步', () => expect(gapInfo(base).kind).toBe('sync'));
  it('落後約 N 天', () =>
    expect(gapInfo({ ...base, gap: -18, prog: 36, el: 54, tot: 78 })).toMatchObject({ kind: 'behind', days: 14, pts: 18, text: '落後約 14 天' }));
  it('121 天跨度落後 18 點 → 落後約 22 天', () =>
    expect(gapInfo({ ...base, gap: -18, tot: 121 })).toMatchObject({ kind: 'behind', days: 22, text: '落後約 22 天', sub: '（18 點）' }));
  it('領先約 N 天', () =>
    expect(gapInfo({ ...base, gap: 20, tot: 50 })).toMatchObject({ kind: 'ahead', days: 10, pts: 20, text: '領先約 10 天' }));
  it('領先邊界 +5', () => expect(gapInfo({ ...base, gap: 5 }).kind).toBe('ahead'));
  it('+4 → sync', () => expect(gapInfo({ ...base, gap: 4 }).kind).toBe('sync'));
  it('已完成', () => expect(gapInfo({ ...base, done: true }).kind).toBe('done'));
  it('已完成優先於落後', () => expect(gapInfo({ ...base, done: true, gap: -30 }).kind).toBe('done'));
  it('暫緩優先於落後', () => expect(gapInfo({ ...base, state: 'hold', gap: -30 }).kind).toBe('hold'));
  it('提案', () => expect(gapInfo({ ...base, state: 'prop' }).kind).toBe('prop'));
  it('tip 含進度與應有進度', () =>
    expect(gapInfo({ ...base, gap: -18, prog: 36, el: 54, tot: 78 }).tip).toContain('進度 36%，今天應有 54%'));
});
