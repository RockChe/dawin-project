import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import OverviewTab from '@/components/dashboard/tabs/OverviewTab';

function renderOverview() {
  const props = {
    filtered: [], twp: [], allS: [], isMobile: false, pcMap: {},
    ganttWidths: null, projBanners: {}, stats: {}, configOwners: [],
  };
  return render(
    <ThemeProvider>
      <OverviewTab {...props} />
    </ThemeProvider>
  );
}

describe('OverviewTab 精簡版', () => {
  it('只保留 Timeline / Upcoming / Status 三塊', () => {
    renderOverview();
    for (const h of ['Project Timeline', 'Upcoming Deadlines', 'Status Distribution']) {
      expect(screen.getByText(h)).toBeTruthy();
    }
  });

  it('移除 Overdue / Project Progress / Team Workload / Tasks per Project', () => {
    renderOverview();
    for (const h of ['Overdue Tasks', 'Project Progress', 'Team Workload', 'Tasks per Project']) {
      expect(screen.queryByText(h)).toBeNull();
    }
  });
});

describe('OverviewTab 專案列順序 = Projects 分頁順序', () => {
  const mk = (project) => ({ id: project, project, progress: 50, start: '2026-01-01', end: '2026-02-01' });
  const labels = (container) =>
    [...container.querySelectorAll('.dash-tl-label')].map(e => e.textContent).filter(Boolean);
  const mount = (projects) => render(
    <ThemeProvider>
      <OverviewTab filtered={[]} twp={['C', 'Z', 'A', 'B'].map(mk)} allS={[]} isMobile={false} pcMap={{}}
        ganttWidths={null} projBanners={{}} stats={{}} configOwners={[]} projects={projects} />
    </ThemeProvider>);

  it('依 projects 的 sortOrder 排，不在清單內的排最後', () => {
    const { container } = mount([{ name: 'A', sortOrder: 1 }, { name: 'B', sortOrder: 2 }, { name: 'C', sortOrder: 3 }]);
    expect(labels(container)).toEqual(['A', 'B', 'C', 'Z']);
  });

  it('沒傳 projects 時維持任務首次出現順序', () => {
    const { container } = mount(undefined);
    expect(labels(container)).toEqual(['C', 'Z', 'A', 'B']);
  });

  it('時間尺度由 props 控制，切換呼叫 onTimeDimChange', () => {
    const onChange = vi.fn();
    render(<ThemeProvider><OverviewTab filtered={[]} twp={[]} allS={[]} isMobile={false} pcMap={{}}
      ganttWidths={null} projBanners={{}} stats={{}} timeDim="季" onTimeDimChange={onChange} /></ThemeProvider>);
    fireEvent.click(screen.getByText('週'));
    expect(onChange).toHaveBeenCalledWith('週');
  });
});
