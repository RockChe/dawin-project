/**
 * My Tasks 分頁有頁內狀態篩選 → 頂部「跨專案」篩選區與狀態卡要灰掉並說明（同 Projects 分頁的做法）。
 * Dashboard 的 hooks 與各 tab 以 stub 取代，只驗灰掉行為。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

const hook = { tab: 'mytasks' };

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects: [], allT: [], allS: [], allL: [], allF: [], twp: [], loading: false, userRole: 'admin',
    toast: null, showToast: () => {}, configCats: [], configOwners: [],
    saveConfigCats: () => {}, saveConfigOwners: () => {},
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({
  default: () => ({ settings: { activeTab: hook.tab }, updateSetting: () => {}, ready: true }),
}));
vi.mock('@/components/dashboard/tabs/OverviewTab', () => ({ default: () => null }));
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

const setup = tab => {
  hook.tab = tab;
  return render(<ThemeProvider><Dashboard initialData={{}} /></ThemeProvider>);
};
const pillBox = () => screen.getByRole('button', { name: '進行中' }).parentElement;
const cardsBox = () => screen.getByText('全部專案').parentElement.nextElementSibling;

describe('Dashboard 頂部篩選：My Tasks 分頁灰掉', () => {
  it('mytasks：狀態 pills 與狀態卡 aria-disabled、pointer-events none，並顯示說明', () => {
    setup('mytasks');
    for (const el of [pillBox(), cardsBox()]) {
      expect(el.getAttribute('aria-disabled')).toBe('true');
      expect(el.style.pointerEvents).toBe('none');
    }
    expect(pillBox().getAttribute('title')).toBe('My Tasks 分頁使用頁內的篩選');
    expect(screen.getByText(/My Tasks 分頁使用頁內的篩選/)).toBeTruthy();
  });

  it('overview：不灰掉、無說明', () => {
    setup('overview');
    for (const el of [pillBox(), cardsBox()]) {
      expect(el.getAttribute('aria-disabled')).toBe('false');
      expect(el.style.pointerEvents).toBe('auto');
    }
    expect(screen.queryByText(/My Tasks 分頁使用頁內的篩選/)).toBeNull();
  });

  it('projects：仍灰掉（Projects 說明不變）', () => {
    setup('projects');
    expect(pillBox().getAttribute('aria-disabled')).toBe('true');
    expect(pillBox().getAttribute('title')).toBe('Projects 分頁使用專案內的篩選');
    expect(screen.getByText(/Projects 分頁使用下方「本專案」的篩選/)).toBeTruthy();
  });
});
