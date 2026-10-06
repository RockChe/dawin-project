/**
 * 桌機麵包屑：每個分頁恰好一列（Projects 由 ProjectsTab 自己畫，Dashboard 不重複畫）；
 * Projects 選了專案 = 三層（首頁 › Projects › 專案名）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

const state = { tab: 'overview', changeTab: vi.fn() };

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects: [{ id: 'p1', name: 'Alpha', sortOrder: 1 }], allT: [], allS: [], allL: [], allF: [], twp: [], loading: false, userRole: 'admin',
    toast: null, showToast: () => {}, configCats: [], configOwners: [],
    saveConfigCats: () => {}, saveConfigOwners: () => {},
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({
  default: (d) => ({ settings: { ...d, activeTab: state.tab }, updateSetting: (k, v) => { if (k === 'activeTab') state.changeTab(v); }, ready: true }),
}));
vi.mock('@/components/dashboard/tabs/OverviewTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/SettingsTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/TimelineTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/DashboardHeader', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/MyTasksTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/tabs/DataTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/TaskModal', () => ({ default: () => null }));
vi.mock('@/components/dashboard/FileManagerModal', () => ({ default: () => null }));
// ProjectsTab 用真的（要驗它自己的那一列）；刪除圖示的 server action 不在這裡跑
vi.mock('@/server/actions/projects', () => ({ deleteProjectBanner: vi.fn() }));

import Dashboard from '@/components/dashboard/Dashboard';

const setup = tab => {
  state.tab = tab;
  return render(<ThemeProvider><Dashboard initialData={{ projects: [] }} /></ThemeProvider>);
};
const labels = () => [...document.querySelectorAll('nav[aria-label="breadcrumb"] li')].map(li => li.textContent.replace('›', ''));

describe('Dashboard 麵包屑', () => {
  beforeEach(() => { state.changeTab = vi.fn(); });

  it.each([
    ['overview', ['首頁']],
    ['mytasks', ['首頁', 'My Tasks']],
    ['projects', ['首頁', 'Projects']],
    ['timeline', ['首頁', 'Timeline']],
    ['table', ['首頁', 'Data']],
    ['settings', ['首頁', 'Settings']],
  ])('%s：全頁恰好一個 breadcrumb nav，內容 %j', (tab, expected) => {
    setup(tab);
    expect(document.querySelectorAll('nav[aria-label="breadcrumb"]').length).toBe(1);
    expect(labels()).toEqual(expected);
  });

  it('點「首頁」切到 overview', () => {
    setup('timeline');
    fireEvent.click(screen.getByRole('button', { name: '首頁' }));
    expect(state.changeTab).toHaveBeenCalledWith('overview');
  });

  it('breadcrumb 列在分頁列之後、內容之前', () => {
    setup('mytasks');
    const nav = document.querySelector('nav[aria-label="breadcrumb"]');
    const tabBtn = screen.getByRole('button', { name: 'Timeline' });
    expect(tabBtn.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Projects 選了專案：三層，仍只有一個 nav；Projects 層回清單', () => {
    setup('projects');
    // 專案清單卡片 → 點進詳情
    fireEvent.click(screen.getAllByText('Alpha').at(-1)); // 前面那顆是上方的專案篩選 tag
    expect(document.querySelectorAll('nav[aria-label="breadcrumb"]').length).toBe(1);
    expect(labels()).toEqual(['首頁', 'Projects', 'Alpha']);
    expect(screen.getByRole('button', { name: '← Back' })).toBeTruthy();
    fireEvent.click(within(document.querySelector('nav[aria-label="breadcrumb"]')).getByRole('button', { name: 'Projects' }));
    expect(labels()).toEqual(['首頁', 'Projects']);
  });

  it('Projects 詳情的「首頁」也回 overview', () => {
    setup('projects');
    fireEvent.click(screen.getAllByText('Alpha').at(-1)); // 前面那顆是上方的專案篩選 tag
    fireEvent.click(screen.getByRole('button', { name: '首頁' }));
    expect(state.changeTab).toHaveBeenCalledWith('overview');
  });
});
