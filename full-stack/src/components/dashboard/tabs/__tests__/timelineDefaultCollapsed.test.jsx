/**
 * Timeline 系統預設：全部收折。
 * 沒有 localStorage 紀錄且未存過偏好 → 預設收折；明確存過 false → 展開；LS 紀錄優先。
 * 第一次 render 就要收折（不能先展開再收折＝閃一下）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

const seen = []; // 每次 render 時 GanttTimeline 收到的 collapsed

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const settingsHook = vi.fn((d) => ({ settings: d, updateSetting: () => {}, ready: true }));
vi.mock('@/hooks/useUserSettings', () => ({ default: (...a) => settingsHook(...a) }));
vi.mock('@/components/dashboard/GanttTimeline', async (orig) => ({
  ...(await orig()),
  default: ({ collapsed }) => { seen.push(collapsed); return null; },
}));

import TimelineTab from '@/components/dashboard/tabs/TimelineTab';

const twp = [{ projectId: 'p1' }, { projectId: 'p2' }];
const mount = (props = {}, tasks = twp) =>
  render(<ThemeProvider><TimelineTab twp={tasks} allS={[]} fpSet={new Set()} fs={[]} fpr="全部" {...props} /></ThemeProvider>);

describe('TimelineTab default collapse', () => {
  beforeEach(() => { seen.length = 0; localStorage.clear(); });

  it('no LS + no saved preference (prop omitted) → all collapsed on the FIRST render', () => {
    mount();
    expect(seen[0]).toEqual(['p1', 'p2']);
  });

  it('explicitly saved false → expanded', () => {
    mount({ timelineDefaultCollapsed: false });
    expect(seen.at(-1)).toEqual([]);
  });

  it('LS record wins over the default', () => {
    localStorage.setItem('dash-timelineCollapsed', JSON.stringify(['p1']));
    mount({ timelineDefaultCollapsed: true });
    expect(seen.at(-1)).toEqual(['p1']);
  });

  it('projects arriving after mount are collapsed too', () => {
    const { rerender } = mount({}, []);
    rerender(<ThemeProvider><TimelineTab twp={twp} allS={[]} fpSet={new Set()} fs={[]} fpr="全部" /></ThemeProvider>);
    expect(seen.at(-1)).toEqual(['p1', 'p2']);
  });

  it('does not open its own useUserSettings instance (sort comes from props → no second fetch)', () => {
    settingsHook.mockClear();
    mount({ timelineSort: 'name' });
    expect(settingsHook).not.toHaveBeenCalled();
  });
});
