/**
 * 跨專案狀態篩選為多選：pills 與統計卡共用同一組選取集合（陣列，[] = 不篩）。
 * Dashboard 的 hooks 與各 tab 以 stub 取代，只驗 Dashboard 的篩選邏輯（filtered）。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

const twp = [
  { id: 1, task: 'T-doing', project: 'P', status: '進行中', priority: '中', progress: 0, start: '2026-06-01', end: '2026-06-30' },
  { id: 2, task: 'T-todo', project: 'P', status: '待辦', priority: '中', progress: 0, start: '2026-06-01', end: '2026-06-30' },
  { id: 3, task: 'T-done', project: 'P', status: '已完成', priority: '中', progress: 100, start: '2026-06-01', end: '2026-06-30' },
];

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects: [], allT: twp, allS: [], allL: [], allF: [], twp, loading: false, userRole: 'admin',
    toast: null, showToast: () => {}, configCats: [], configOwners: [],
    saveConfigCats: () => {}, saveConfigOwners: () => {},
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({
  default: (d) => ({ settings: d, updateSetting: () => {} }),
}));
vi.mock('@/components/dashboard/tabs/OverviewTab', () => ({
  default: ({ filtered }) => <ul data-testid="list">{filtered.map(t => <li key={t.id}>{t.task}</li>)}</ul>,
}));
vi.mock('@/components/dashboard/tabs/SettingsTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/TimelineTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/DashboardHeader', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/MyTasksTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/DataTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/ProjectsTab', () => ({
  default: () => null, toggleHidden: (a) => a, PROJECT_TASK_VIEW_DEFAULT: {},
}));
vi.mock('@/components/dashboard/TaskModal', () => ({ default: () => null }));
vi.mock('@/components/dashboard/FileManagerModal', () => ({ default: () => null }));

import Dashboard from '@/components/dashboard/Dashboard';

const shown = () => within(screen.getByTestId('list')).queryAllByRole('listitem').map(li => li.textContent);
const pill = name => screen.getByRole('button', { name });
// stat cards are divs whose label is a span (pills are buttons)
const card = name => screen.getAllByText(name).find(el => el.tagName === 'SPAN');

function setup() {
  localStorage.setItem('dash-activeTab', 'overview');
  return render(<ThemeProvider><Dashboard initialData={{}} /></ThemeProvider>);
}

describe('Dashboard status filter (multi-select)', () => {
  it('no selection shows all tasks', () => {
    setup();
    expect(shown()).toEqual(['T-doing', 'T-todo', 'T-done']);
  });

  it('selecting 進行中 + 待辦 shows the union only', () => {
    setup();
    fireEvent.click(pill('進行中'));
    expect(shown()).toEqual(['T-doing']);
    fireEvent.click(pill('待辦'));
    expect(shown()).toEqual(['T-doing', 'T-todo']);
  });

  it('clicking a selected pill again deselects it; none left = all', () => {
    setup();
    fireEvent.click(pill('進行中'));
    fireEvent.click(pill('進行中'));
    expect(shown()).toHaveLength(3);
  });

  it('「全部」clears the selection', () => {
    setup();
    fireEvent.click(pill('進行中'));
    fireEvent.click(pill('待辦'));
    fireEvent.click(pill('全部'));
    expect(shown()).toHaveLength(3);
  });

  it('stat cards toggle the same set', () => {
    setup();
    fireEvent.click(pill('進行中'));
    fireEvent.click(card('待辦'));
    expect(shown()).toEqual(['T-doing', 'T-todo']);
    fireEvent.click(card('進行中'));
    expect(shown()).toEqual(['T-todo']);
  });
});
