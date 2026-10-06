/**
 * 回報：「點專案中的 subtask 要編輯關注人／執行人時就會爆掉」——手機版路徑。
 * 真的 MobileApp + useTaskManager（只 mock server action），包在 ErrorBoundary 內。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const ok = vi.fn(async () => ({ success: true }));
vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(async () => ({ success: true })), updateTask: (...a) => ok(...a), deleteTask: (...a) => ok(...a),
  createSubtask: vi.fn(async () => ({ success: true })), updateSubtask: (...a) => ok(...a), deleteSubtask: (...a) => ok(...a),
  toggleSubtask: (...a) => ok(...a), createLink: vi.fn(), deleteLink: vi.fn(), deleteFile: vi.fn(), upsertTasks: vi.fn(),
  updateManyTasks: vi.fn(), deleteManyTasks: vi.fn(), deleteAllTasks: vi.fn(), reorderTasks: vi.fn(),
}));
vi.mock('@/server/actions/projects', () => ({ createProject: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn(), reorderProjects: vi.fn() }));
vi.mock('@/server/actions/config', () => ({ saveConfig: vi.fn(async () => ({ success: true })) }));
vi.mock('@/server/actions/dashboard', () => ({ getInitialData: vi.fn(async () => ({})) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: vi.fn(async () => ({ success: true, data: {} })), setUserSetting: vi.fn(async () => ({ success: true })) }));
vi.mock('@/server/actions/auth', () => ({ logout: vi.fn() }));

import MobileApp from '@/components/mobile/MobileApp';

const P = '99999999-9999-4999-8999-999999999999';
const T1 = '11111111-1111-4111-8111-111111111111';
const data = (taskOver = {}, role = 'admin') => ({
  projects: [{ id: P, name: 'Proj', sortOrder: 1 }],
  tasks: [{ id: T1, projectId: P, task: 'Task One', status: '進行中', priority: '中', category: '活動', startDate: '2026-08-01', endDate: '2026-08-30', owner: null, watchers: null, sortOrder: 0, ...taskOver }],
  subtasks: [
    { id: 's1', taskId: T1, name: 'Sub One', owner: null, done: false },
    { id: 's2', taskId: T1, name: 'Sub Two', owner: '—', done: false, sortOrder: undefined, createdAt: undefined },
    { id: 's3', taskId: T1, name: 'Sub Three', owner: 'Bob', done: false, sortOrder: 3 },
  ],
  links: [], files: [], session: { role, name: 'Amy' }, userNames: ['Amy', 'Bob', '幸真'], settings: {},
});

let errSpy;
beforeEach(() => { sessionStorage.clear(); ok.mockClear(); errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => errSpy.mockRestore());
const boom = () => screen.queryByText('Something went wrong');
const crashInfo = () => errSpy.mock.calls.map(c => String(c[0]?.stack || c[0]) + ' ' + String(c[1]?.stack || c[1] || '')).filter(s => /ErrorBoundary|TypeError|ReferenceError/.test(s)).join('\n');
const addTag = (input, name) => { fireEvent.change(input, { target: { value: name } }); fireEvent.keyDown(input, { key: 'Enter' }); };

describe('手機版：專案 → 任務 → 子任務 / 抽屜編輯關注人、執行人', () => {
  for (const [label, taskOver] of [
    ['watchers=null owner=null', {}],
    ['有關注人', { owner: 'Bob,幸真', watchers: '幸真' }],
  ]) {
    it(`${label}：專案詳情展開子任務、勾選、開抽屜編輯關注人與儲存，不爆`, async () => {
      render(<ThemeProvider><ErrorBoundary><MobileApp initialData={data(taskOver)} /></ErrorBoundary></ThemeProvider>);
      fireEvent.click(screen.getByRole('button', { name: '專案' }));
      fireEvent.click(screen.getByText('Proj'));
      expect(boom(), crashInfo()).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /子任務 0\/3/ }));
      expect(boom(), crashInfo()).toBeNull();
      fireEvent.click(screen.getByRole('checkbox', { name: '完成 Sub One' }));
      await act(async () => {});
      expect(boom(), crashInfo()).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /Task One/ }));
      const dlg = screen.getByRole('dialog');
      expect(boom(), crashInfo()).toBeNull();
      addTag(within(dlg).getByText('關注人（掛名、不一定做子任務）').nextElementSibling.querySelector('input'), 'Amy');
      expect(boom(), crashInfo()).toBeNull();
      fireEvent.click(within(dlg).getByRole('button', { name: '儲存' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(boom(), crashInfo()).toBeNull();
    });
  }

  it('沒有子任務 owner 時，抽屜可編輯執行人並儲存，不爆', async () => {
    const d = data({ owner: 'Zed' });
    d.subtasks = [{ id: 's1', taskId: T1, name: 'Sub One', owner: null, done: false }];
    render(<ThemeProvider><ErrorBoundary><MobileApp initialData={d} /></ErrorBoundary></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: '專案' }));
    fireEvent.click(screen.getByText('Proj'));
    fireEvent.click(screen.getByRole('button', { name: /Task One/ }));
    const dlg = screen.getByRole('dialog');
    addTag(within(dlg).getByText('執行人').nextElementSibling.querySelector('input'), 'Bob');
    fireEvent.click(within(dlg).getByRole('button', { name: '儲存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(boom(), crashInfo()).toBeNull();
  });

  it('viewer：同路徑不爆', () => {
    render(<ThemeProvider><ErrorBoundary><MobileApp initialData={data({ owner: 'Bob,幸真', watchers: '幸真' }, 'viewer')} /></ErrorBoundary></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: '專案' }));
    fireEvent.click(screen.getByText('Proj'));
    fireEvent.click(screen.getByRole('button', { name: /子任務 0\/3/ }));
    fireEvent.click(screen.getByRole('button', { name: /Task One/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(boom(), crashInfo()).toBeNull();
  });
});
