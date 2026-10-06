import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

const projects = [{ id: 'p1', name: 'Alpha', sortOrder: 1 }];
const twp = [{ id: 't1', projectId: 'p1', project: 'Alpha', task: 'task-one', owner: 'Amy', watchers: '', status: '進行中', progress: 50, sDone: 0, sTotal: 0, start: '2026-09-01', end: '2026-12-01' }];
vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects, allT: [], allS: [], twp, loading: false, userRole: 'admin',
    toast: null, showToast: () => {}, updateTask: () => {}, toggleSub: () => {}, addSub: () => {}, configOwners: [],
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({ default: (d) => ({ settings: d, updateSetting: () => {}, ready: true }) }));
vi.mock('@/server/actions/auth', () => ({ logout: vi.fn() }));

import MobileApp from '@/components/mobile/MobileApp';

const renderApp = () => render(<ThemeProvider><MobileApp initialData={{ session: { name: 'Amy' }, settings: {} }} /></ThemeProvider>);
const tabBar = name => screen.getAllByRole('button', { name }).find(b => b.closest('nav')?.getAttribute('aria-label') !== 'breadcrumb');
const crumb = name => within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByRole('button', { name });

describe('時程 → 專案詳情跳轉與返回', () => {
  it('點時程的專案列 → 專案分頁直接顯示詳情，麵包屑是 首頁 › 時程 › 專案名', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: '時程' }));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(screen.getAllByRole('button', { name: '專案' }).some(b => b.getAttribute('aria-current') === 'page')).toBe(true); // 底部分頁列高亮「專案」
    expect(screen.getByText('task-one')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect(within(nav).getByRole('button', { name: '時程' })).toBeTruthy();
    expect(within(nav).queryByRole('button', { name: '專案' })).toBeNull();
  });

  it('點麵包屑的「時程」→ 回到時程畫面（不是專案清單）', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: '時程' }));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    fireEvent.click(crumb('時程'));
    expect(screen.queryByText('task-one')).toBeNull();
    expect(tabBar('時程').getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeTruthy(); // 時程的專案列
  });

  it('專案清單 → 點專案 → 返回 → 清單', () => {
    renderApp();
    fireEvent.click(tabBar('專案'));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(screen.getByText('task-one')).toBeTruthy();
    fireEvent.click(crumb('專案'));
    expect(screen.queryByText('task-one')).toBeNull();
    expect(tabBar('專案').getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('1 個專案')).toBeTruthy();
  });

  it('時程跳進詳情後點底部「專案」→ 顯示清單，且之後返回不再回時程', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: '時程' }));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    fireEvent.click(tabBar('專案'));
    expect(screen.queryByText('task-one')).toBeNull();
    expect(screen.getByText('1 個專案')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ })); // 從清單進詳情 → 來源已清
    fireEvent.click(crumb('專案'));
    expect(screen.getByText('1 個專案')).toBeTruthy();
  });

  it('跳進詳情後換到別的分頁再回專案 → 清單', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: '時程' }));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    fireEvent.click(tabBar('總覽'));
    fireEvent.click(tabBar('專案'));
    expect(screen.getByText('1 個專案')).toBeTruthy();
  });
});
