/**
 * Timeline 分頁不列已封存專案（project.archivedAt）：封存專案的 id 併入 GanttTimeline 的 hiddenProjects，
 * 也不計入「全部收折／展開」的專案 id。個人的眼睛隱藏（hiddenProjects prop）照常疊加。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

const seen = []; // { hiddenProjects, collapsed }

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/dashboard/GanttTimeline', async (orig) => ({
  ...(await orig()),
  default: ({ hiddenProjects, collapsed }) => { seen.push({ hiddenProjects, collapsed }); return null; },
}));

import TimelineTab from '@/components/dashboard/tabs/TimelineTab';

const twp = [{ projectId: 'p1' }, { projectId: 'p2' }, { projectId: 'p3' }];
const projects = [
  { id: 'p1', name: 'A' },
  { id: 'p2', name: 'B', archivedAt: '2026-10-01T00:00:00.000Z' },
  { id: 'p3', name: 'C' },
];
const mount = (props = {}) =>
  render(<ThemeProvider><TimelineTab twp={twp} allS={[]} fpSet={new Set()} fs={[]} fpr="全部" projects={projects} {...props} /></ThemeProvider>);

describe('TimelineTab 與封存專案', () => {
  beforeEach(() => { seen.length = 0; localStorage.clear(); });

  it('已封存專案併入 hiddenProjects（不畫在時程上）', () => {
    mount();
    expect(seen.at(-1).hiddenProjects).toEqual(['p2']);
  });

  it('與個人隱藏（眼睛）疊加', () => {
    mount({ hiddenProjects: ['p3'] });
    expect([...seen.at(-1).hiddenProjects].sort()).toEqual(['p2', 'p3']);
  });

  it('預設收折的專案 id 不含已封存專案', () => {
    mount({ timelineDefaultCollapsed: true });
    expect(seen.at(-1).collapsed).toEqual(['p1', 'p3']);
  });
});
