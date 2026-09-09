/**
 * TDD tests for the "today" marker line's todayPct calculation.
 * RED → GREEN → REFACTOR
 *
 * Bug: OverviewTab.jsx / GanttTimeline.jsx used `new Date()` directly inside
 * render to compute todayPct. That reads current-instant milliseconds, which
 * differ between server render and client hydration → hydration mismatch.
 * Fix: quantize "now" to the Asia/Taipei calendar day via
 * `pD(toBusinessDateString())` before using it in the date-math.
 *
 * Functions under test (exported for testing from their respective modules):
 *   computeTodayPct (GanttTimeline.jsx)
 *   computeTodayPct (OverviewTab.jsx)
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { pD } from '@/lib/utils';
import { computeTodayPct as computeTodayPctGantt } from '@/components/dashboard/GanttTimeline';
import { computeTodayPct as computeTodayPctOverview } from '@/components/dashboard/tabs/OverviewTab';

afterEach(() => {
  vi.useRealTimers();
});

describe.each([
  ['GanttTimeline.computeTodayPct', computeTodayPctGantt],
  ['OverviewTab.computeTodayPct', computeTodayPctOverview],
])('%s', (_name, computeTodayPct) => {
  const mn = pD('2026-01-10');
  const td = 30;

  it('同一天內、不同時刻算出的 todayPct 相同（hydration 安全）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T00:05:00Z')); // 08:05 Taipei
    const a = computeTodayPct(mn, td);
    vi.setSystemTime(new Date('2026-01-15T15:59:00Z')); // 23:59 Taipei
    const b = computeTodayPct(mn, td);
    expect(a).toBe(b);
  });

  it('用 Asia/Taipei 的日界，不是 UTC 的', () => {
    // UTC 2026-01-14 23:30 → Taipei 2026-01-15 07:30（隔天）
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-14T23:30:00Z'));
    const pct = computeTodayPct(mn, td);
    const taipeiDayPct = ((pD('2026-01-15') - mn) / 864e5) / td * 100;
    const utcDayPct = ((pD('2026-01-14') - mn) / 864e5) / td * 100;
    expect(pct).toBeCloseTo(taipeiDayPct, 10);
    expect(pct).not.toBeCloseTo(utcDayPct, 5);
  });

  it('跨日之後 todayPct 會前進', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T04:00:00Z')); // 12:00 Taipei
    const day1 = computeTodayPct(mn, td);
    vi.setSystemTime(new Date('2026-01-16T04:00:00Z')); // 12:00 Taipei，隔天
    const day2 = computeTodayPct(mn, td);
    expect(day2).toBeGreaterThan(day1);
  });
});
