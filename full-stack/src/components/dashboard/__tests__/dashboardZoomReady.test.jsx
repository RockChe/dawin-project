/**
 * 首次載入不得以「未存檔的預設 zoom(150)」渲染整頁（會先巨大再縮小）。
 * useUserSettings.ready=false 時 Dashboard 只顯示 zoom 1 的 skeleton；ready 後才用載入的 zoom 渲染內容。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

const state = { ready: false, zoom: 150 };

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects: [], allT: [], allS: [], allL: [], allF: [], twp: [], loading: false, userRole: 'admin',
    toast: null, showToast: () => {}, configCats: [], configOwners: [],
    saveConfigCats: () => {}, saveConfigOwners: () => {},
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({
  default: (d) => ({ settings: { ...d, zoom: state.zoom }, updateSetting: () => {}, ready: state.ready }),
}));
vi.mock('@/components/dashboard/tabs/OverviewTab', () => ({ default: () => <div data-testid="content" /> }));
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

const setup = () => {
  localStorage.setItem('dash-activeTab', 'overview');
  return render(<ThemeProvider><Dashboard initialData={{}} /></ThemeProvider>);
};

describe('Dashboard zoom before settings are ready', () => {
  it('renders the skeleton at zoom 1 (not the default 150) and no content while !ready', () => {
    state.ready = false; state.zoom = 150;
    const { container } = setup();
    expect(screen.queryByTestId('content')).toBeNull();
    expect(container.firstChild.style.zoom).toBe('1');
  });

  it('renders content with the loaded zoom once ready', () => {
    state.ready = true; state.zoom = 120;
    const { container } = setup();
    expect(screen.getByTestId('content')).toBeTruthy();
    expect(container.firstChild.style.zoom).toBe('1.2');
  });
});
