/**
 * 回報：「點專案中的 subtask 要編輯關注人／執行人時就會爆掉」。
 * 用真的 Dashboard + useTaskManager + ProjectsTab + TaskModal（只 mock server action），
 * 在各種資料形狀（watchers=null、owner=null/'—'/''、子任務 owner 缺值、缺 sortOrder/createdAt）下
 * 走一遍編輯路徑，並包在 ErrorBoundary 內：任何 render 例外都會讓 "Something went wrong" 出現。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const ok = vi.fn(async () => ({ success: true }));
vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(async () => ({ success: true })),
  updateTask: (...a) => ok(...a),
  deleteTask: (...a) => ok(...a),
  createSubtask: vi.fn(async (d) => ({ success: true, subtask: { id: 'new-sub', taskId: d.taskId, name: d.name, owner: d.owner || null, done: false, doneDate: null, notes: null, sortOrder: 0 } })),
  updateSubtask: (...a) => ok(...a),
  deleteSubtask: (...a) => ok(...a),
  toggleSubtask: (...a) => ok(...a),
  createLink: vi.fn(async () => ({ success: true })),
  deleteLink: vi.fn(async () => ({ success: true })),
  deleteFile: vi.fn(async () => ({ success: true })),
  upsertTasks: vi.fn(async () => ({ success: true })),
  updateManyTasks: vi.fn(async () => ({ success: true })),
  deleteManyTasks: vi.fn(async () => ({ success: true })),
  deleteAllTasks: vi.fn(async () => ({ success: true })),
  reorderTasks: vi.fn(async () => ({ success: true })),
  reorderSubtasks: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/server/actions/projects', () => ({
  createProject: vi.fn(async () => ({ success: true })),
  updateProject: vi.fn(async () => ({ success: true })),
  deleteProject: vi.fn(async () => ({ success: true })),
  reorderProjects: vi.fn(async () => ({ success: true })),
  deleteProjectBanner: vi.fn(),
}));
vi.mock('@/server/actions/config', () => ({ saveConfig: vi.fn(async () => ({ success: true })) }));
vi.mock('@/server/actions/dashboard', () => ({ getInitialData: vi.fn(async () => ({})) }));
vi.mock('@/server/actions/userSettings', () => ({
  getUserSettings: vi.fn(async () => ({ success: true, data: {} })),
  setUserSetting: vi.fn(async () => ({ success: true })),
}));

import Dashboard from '@/components/dashboard/Dashboard';

const P = '99999999-9999-4999-8999-999999999999';
const T1 = '11111111-1111-4111-8111-111111111111';

function data(taskOver = {}, subs) {
  return {
    projects: [{ id: P, name: 'Proj', sortOrder: 1 }],
    tasks: [{ id: T1, projectId: P, task: 'Task One', status: '進行中', priority: '中', category: '活動', startDate: '2026-08-01', endDate: '2026-08-30', owner: null, watchers: null, sortOrder: 0, ...taskOver }],
    subtasks: subs ?? [
      { id: 's1', taskId: T1, name: 'Sub One', owner: null, done: false },
      { id: 's2', taskId: T1, name: 'Sub Two', owner: '—', done: false },
      { id: 's3', taskId: T1, name: 'Sub Three', owner: '', done: false, sortOrder: undefined, createdAt: undefined },
    ],
    links: [], files: [], session: { role: 'admin', name: 'Amy' }, userNames: ['Amy', 'Bob', '幸真'],
    settings: { activeTab: 'projects' },
  };
}

let errSpy;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); ok.mockClear(); errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => errSpy.mockRestore());

const mount = (d, role = 'admin') => {
  d.session.role = role;
  render(<ThemeProvider><ErrorBoundary><Dashboard initialData={d} /></ErrorBoundary></ThemeProvider>);
  fireEvent.click(screen.getAllByText('Proj').at(-1)); // 專案卡片 → 詳情
};
const boom = () => screen.queryByText('Something went wrong');
const addTag = (input, name) => { fireEvent.change(input, { target: { value: name } }); fireEvent.keyDown(input, { key: 'Enter' }); };
const crashInfo = () => errSpy.mock.calls.map(c => String(c[0]?.stack || c[0]) + ' ' + String(c[1]?.stack || c[1] || '')).filter(s => /ErrorBoundary|TypeError|ReferenceError/.test(s)).join('\n');

describe('桌機 ProjectsTab：點子任務負責人編輯', () => {
  for (const [label, taskOver] of [
    ['watchers=null owner=null', {}],
    ['watchers=null owner="—"', { owner: '—' }],
    ['watchers="" owner=""', { owner: '', watchers: '' }],
    ['有關注人', { owner: 'Amy,幸真', watchers: '幸真' }],
  ]) {
    it(`${label}：點子任務 owner → TagInput 加人 → 移除，不爆`, async () => {
      mount(data(taskOver));
      expect(boom(), crashInfo()).toBeNull();
      const row = screen.getByText('Sub One').closest('div[style*="flex-wrap"]');
      // 點負責人（目前顯示「—」）
      fireEvent.click(within(row).getByText('—'));
      expect(boom(), crashInfo()).toBeNull();
      addTag(within(row).getByPlaceholderText('負責人...'), 'Bob');
      expect(boom(), crashInfo()).toBeNull();
      await waitFor(() => expect(ok).toHaveBeenCalledWith('s1', { owner: 'Bob' }));
      expect(boom(), crashInfo()).toBeNull();
      // 再加一人、再全部移除
      addTag(within(row).getByRole('textbox', { name: '' }) ?? within(row).getAllByRole('textbox').at(-1), 'Amy');
      expect(boom(), crashInfo()).toBeNull();
      const xs = () => within(row).queryAllByText('×').filter(x => x.style.cursor === 'pointer' && x.tagName === 'SPAN');
      while (xs().length) { fireEvent.click(xs()[0]); await act(async () => {}); expect(boom(), crashInfo()).toBeNull(); }
      expect(boom(), crashInfo()).toBeNull();
    });
  }

  it('下拉建議（mouseDown 選人）、點外面收合，不爆', async () => {
    mount(data({ owner: 'Amy,幸真', watchers: '幸真' }));
    const row = screen.getByText('Sub One').closest('div[style*="flex-wrap"]');
    fireEvent.click(within(row).getByText('—'));
    fireEvent.focus(within(row).getByPlaceholderText('負責人...'));
    fireEvent.mouseDown(await screen.findByText('幸真', { selector: 'div[style*="cursor: pointer"]' }));
    await waitFor(() => expect(ok).toHaveBeenCalledWith('s1', { owner: '幸真' }));
    expect(boom(), crashInfo()).toBeNull();
    fireEvent.mouseDown(document.body);
    expect(boom(), crashInfo()).toBeNull();
  });

  it('harness 自檢：元件丟例外時 ErrorBoundary 文字會出現', () => {
    const Bad = () => { throw new Error('x'); };
    render(<ErrorBoundary><Bad /></ErrorBoundary>);
    expect(boom()).toBeTruthy();
  });

  it('viewer：子任務 owner 唯讀，不爆', () => {
    mount(data({ owner: 'Amy,幸真', watchers: '幸真' }), 'viewer');
    expect(boom(), crashInfo()).toBeNull();
    expect(screen.getByText('Sub One')).toBeTruthy();
  });
});

describe('桌機 TaskModal：編輯關注人／執行人／子任務', () => {
  for (const [label, taskOver, subs] of [
    ['無子任務、watchers=null', {}, []],
    ['有子任務(owner 缺值)、watchers=null', {}, undefined],
    ['有子任務 owner、有關注人', { owner: 'Amy,幸真', watchers: '幸真' }, [{ id: 's1', taskId: T1, name: 'Sub One', owner: 'Amy', done: false, sortOrder: 1 }]],
  ]) {
    it(`${label}：開 modal → 改關注人、執行人、子任務草稿 owner → 儲存，不爆`, async () => {
      mount(data(taskOver, subs));
      fireEvent.click(screen.getAllByText('Task One').at(-1));
      const dlg = screen.getByRole('dialog');
      expect(boom(), crashInfo()).toBeNull();
      addTag(within(dlg).getByText('關注人').parentElement.querySelector('input'), 'Amy');
      expect(boom(), crashInfo()).toBeNull();
      const ex = within(dlg).queryByPlaceholderText('新增執行人...');
      if (ex) { addTag(ex, 'Bob'); expect(boom(), crashInfo()).toBeNull(); }
      // 子任務草稿
      fireEvent.click(within(dlg).getByText('+ 新增子任務'));
      fireEvent.change(within(dlg).getByPlaceholderText('子任務名稱'), { target: { value: 'New sub' } });
      addTag(within(dlg).getByPlaceholderText('負責人...'), 'Bob');
      expect(boom(), crashInfo()).toBeNull();
      fireEvent.click(within(dlg).getByText('新增'));
      await act(async () => {});
      expect(boom(), crashInfo()).toBeNull();
      // 在 modal 內點既有子任務 owner 編輯
      const first = within(dlg).queryAllByText('—')[0] || within(dlg).queryAllByText('Amy')[0];
      if (first) { fireEvent.click(first); expect(boom(), crashInfo()).toBeNull(); }
      fireEvent.click(within(dlg).getByText('確認'));
      await act(async () => {});
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(boom(), crashInfo()).toBeNull();
    });
  }

  it('viewer：開 modal 不爆', () => {
    mount(data({ owner: 'Amy,幸真', watchers: '幸真' }), 'viewer');
    fireEvent.click(screen.getAllByText('Task One').at(-1));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(boom(), crashInfo()).toBeNull();
  });
});
