/**
 * 個人設定搬家：欄寬／Timeline 高度／Upcoming／目前分頁／時間尺度 改存 user_settings，
 * 舊 localStorage 值只做一次性遷移；首屏設定來自 initialData.settings。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

const { hook, seen } = vi.hoisted(() => ({
  hook: { settings: {}, updateSetting: null, ready: true, args: null },
  seen: {}, // 各 tab 最後一次收到的 props
}));
hook.updateSetting = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects: [{ id: 'p1', name: 'P1' }], allT: [], allS: [], allL: [], allF: [], twp: [], loading: false, userRole: 'admin',
    toast: null, showToast: () => {}, configCats: [], configOwners: [],
    saveConfigCats: () => {}, saveConfigOwners: () => {},
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({
  default: (...args) => { hook.args = args; return { settings: { ...args[0], ...hook.settings }, updateSetting: hook.updateSetting, ready: hook.ready }; },
}));
vi.mock('@/components/dashboard/tabs/OverviewTab', () => ({ default: (p) => { seen.overview = p; return <div data-testid="overview" />; } }));
vi.mock('@/components/dashboard/tabs/SettingsTab', () => ({ default: (p) => { seen.settings = p; return <div data-testid="settings" />; } }));
vi.mock('@/components/dashboard/tabs/TimelineTab', () => ({ default: (p) => { seen.timeline = p; return <div data-testid="timeline" />; } }));
vi.mock('@/components/dashboard/tabs/DashboardHeader', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/MyTasksTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/DataTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/ProjectsTab', () => ({
  default: (p) => { seen.projects = p; return <div data-testid="projects" />; }, toggleHidden: (a) => a, PROJECT_TASK_VIEW_DEFAULT: {},
}));
vi.mock('@/components/dashboard/TaskModal', () => ({ default: () => null }));
vi.mock('@/components/dashboard/FileManagerModal', () => ({ default: () => null }));

import Dashboard from '@/components/dashboard/Dashboard';

const mount = (initialData = {}) => render(<ThemeProvider><Dashboard initialData={initialData} /></ThemeProvider>);

beforeEach(() => {
  localStorage.clear();
  hook.settings = {}; hook.ready = true; hook.args = null;
  hook.updateSetting.mockReset();
  for (const k of Object.keys(seen)) delete seen[k];
});

describe('first-load settings', () => {
  it('passes initialData.settings to useUserSettings as the initial state', () => {
    const settings = { zoom: 110 };
    mount({ settings });
    expect(hook.args[2]).toBe(settings);
  });
});

describe('active tab from user settings', () => {
  it('renders the saved tab', () => {
    hook.settings = { activeTab: 'timeline' };
    mount();
    expect(screen.getByTestId('timeline')).toBeTruthy();
  });
  it('an invalid saved tab falls back to overview', () => {
    hook.settings = { activeTab: 'bogus' };
    mount();
    expect(screen.getByTestId('overview')).toBeTruthy();
  });
  it('clicking a tab persists it via updateSetting', () => {
    mount();
    fireEvent.click(screen.getByText('Projects'));
    expect(hook.updateSetting).toHaveBeenCalledWith('activeTab', 'projects');
  });
});

describe('settings values reach the tabs', () => {
  it('timelineHeight / upcoming / ganttWidths / time scales come from settings (with defaults)', () => {
    hook.settings = { timeDimOverview: '週', upcomingDays: 14, upcomingLimit: 9, ganttWidths: { overview: { day: 77 } } };
    mount();
    expect(seen.overview.timeDim).toBe('週');
    expect(seen.overview.upcomingDays).toBe(14);
    expect(seen.overview.upcomingLimit).toBe(9);
    expect(seen.overview.ganttWidths.day).toBe(77);
    expect(seen.overview.ganttWidths.week).toBe(50); // 缺的用預設補
    expect(seen.overview.projects).toEqual([{ id: 'p1', name: 'P1' }]);
  });
  it('time scale change goes through updateSetting with a per-surface key', () => {
    mount();
    seen.overview.onTimeDimChange('季');
    expect(hook.updateSetting).toHaveBeenCalledWith('timeDimOverview', '季');
  });
  it('timeline tab gets its own time scale + timelineSort from the shared settings (no own hook)', () => {
    hook.settings = { activeTab: 'timeline', timeDimTimeline: '日', timelineSort: 'name' };
    mount();
    expect(seen.timeline.timeDim).toBe('日');
    expect(seen.timeline.timelineSort).toBe('name');
    seen.timeline.onTimelineSortChange('progress');
    expect(hook.updateSetting).toHaveBeenCalledWith('timelineSort', 'progress');
    seen.timeline.onTimeDimChange('月');
    expect(hook.updateSetting).toHaveBeenCalledWith('timeDimTimeline', '月');
  });
  it('projects tab gets timeDimProject', () => {
    hook.settings = { activeTab: 'projects', timeDimProject: '季' };
    mount();
    expect(seen.projects.timeDim).toBe('季');
    seen.projects.onTimeDimChange('日');
    expect(hook.updateSetting).toHaveBeenCalledWith('timeDimProject', '日');
  });
  it('Settings tab save callbacks persist via updateSetting', () => {
    hook.settings = { activeTab: 'settings' };
    mount();
    seen.settings.saveTimelineHeight('150');
    expect(hook.updateSetting).toHaveBeenCalledWith('timelineHeight', 150);
    seen.settings.saveUpcomingSettings('10', '4');
    expect(hook.updateSetting).toHaveBeenCalledWith('upcomingDays', 10);
    expect(hook.updateSetting).toHaveBeenCalledWith('upcomingLimit', 4);
  });
});

describe('one-time localStorage migration', () => {
  it('adopts old localStorage values (persisting once) when the user has no saved value', () => {
    localStorage.setItem('dash-timelineHeight', '120');
    localStorage.setItem('dash-activeTab', 'projects');
    mount();
    expect(hook.updateSetting).toHaveBeenCalledWith('timelineHeight', 120);
    expect(hook.updateSetting).toHaveBeenCalledWith('activeTab', 'projects');
    // 舊 key 不刪
    expect(localStorage.getItem('dash-timelineHeight')).toBe('120');
  });
  it('does nothing for keys the server already has, or when localStorage is empty', () => {
    localStorage.setItem('dash-timelineHeight', '120');
    hook.settings = { timelineHeight: 80 };
    mount();
    expect(hook.updateSetting).not.toHaveBeenCalled();
  });
  it('does not run before settings are ready', () => {
    localStorage.setItem('dash-timelineHeight', '120');
    hook.ready = false;
    mount();
    expect(hook.updateSetting).not.toHaveBeenCalled();
  });
});
