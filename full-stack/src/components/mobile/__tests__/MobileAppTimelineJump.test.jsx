import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('時程 → 專案詳情跳轉', () => {
  it('點時程的專案列 → 切到專案分頁並直接顯示該專案詳情；返回後回到清單', () => {
    render(<ThemeProvider><MobileApp initialData={{ session: { name: 'Amy' }, settings: {} }} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: '時程' }));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(screen.getByRole('button', { name: '專案' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('task-one')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回專案清單' }));
    expect(screen.queryByText('task-one')).toBeNull();
  });
});
