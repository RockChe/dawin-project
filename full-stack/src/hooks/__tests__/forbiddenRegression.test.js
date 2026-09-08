import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Regression tests for fix-wave Blocker 1: pulling FORBIDDEN out of
// checkAuthError (useTaskManager.js) was correct — a viewer hitting a
// capability wall shouldn't be logged out — but four call sites
// (addSub / addLink / addProject / deleteAllTasks) never had an error
// branch at all, or silently swallowed non-FORBIDDEN errors. The button
// press became completely silent: no toast, no router.refresh().
//
// Each test asserts the unified shape now used everywhere else in the file:
//   else if (result?.error) { if (!handleForbidden(result)) showToast(result.error, 'error'); }

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const createSubtaskAction = vi.fn();
const createLinkAction = vi.fn();
const createProjectAction = vi.fn();
const deleteAllTasksAction = vi.fn();

vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(async () => ({ success: true })),
  updateTask: vi.fn(async () => ({ success: true })),
  deleteTask: vi.fn(async () => ({ success: true })),
  createSubtask: (...a) => createSubtaskAction(...a),
  updateSubtask: vi.fn(async () => ({ success: true })),
  deleteSubtask: vi.fn(async () => ({ success: true })),
  toggleSubtask: vi.fn(async () => ({ success: true })),
  createLink: (...a) => createLinkAction(...a),
  deleteLink: vi.fn(async () => ({ success: true })),
  deleteFile: vi.fn(async () => ({ success: true })),
  upsertTasks: vi.fn(async () => ({ success: true })),
  updateManyTasks: vi.fn(async () => ({ success: true })),
  deleteManyTasks: vi.fn(async () => ({ success: true })),
  deleteAllTasks: (...a) => deleteAllTasksAction(...a),
}));
vi.mock('@/server/actions/projects', () => ({
  createProject: (...a) => createProjectAction(...a),
  updateProject: vi.fn(async () => ({ success: true })),
  deleteProject: vi.fn(async () => ({ success: true })),
  reorderProjects: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/server/actions/config', () => ({ saveConfig: vi.fn(async () => ({ success: true })) }));
vi.mock('@/server/actions/dashboard', () => ({ getInitialData: vi.fn(async () => ({})) }));

const { default: useTaskManager } = await import('@/hooks/useTaskManager');

const P1 = '22222222-2222-4222-8222-222222222222';
const T1 = '11111111-1111-4111-8111-111111111111';

const makeInitialData = () => ({
  projects: [{ id: P1, name: 'P1', sortOrder: 1 }],
  tasks: [{ id: T1, projectId: P1, task: 'T1', status: '待辦', startDate: '2026-08-01', endDate: '2026-08-10', duration: 9, owner: null, priority: '中', notes: null, sortOrder: 0 }],
  subtasks: [],
  links: [],
  files: [],
  session: { role: 'viewer' },
  userNames: [],
});

function setup() {
  const data = makeInitialData();
  return renderHook(() => useTaskManager(data));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addSub — FORBIDDEN 與一般錯誤都要有反應', () => {
  it('FORBIDDEN → toast 權限不足 + router.refresh()，不再無聲', async () => {
    createSubtaskAction.mockResolvedValueOnce({ error: 'FORBIDDEN' });
    const { result } = setup();
    await act(async () => { await result.current.addSub(T1, { name: 'x' }); });
    expect(refresh).toHaveBeenCalled();
    expect(result.current.toast?.msg).toBe('權限不足');
  });

  it('一般錯誤 → showToast(result.error)，不被吞掉', async () => {
    createSubtaskAction.mockResolvedValueOnce({ error: '新增失敗' });
    const { result } = setup();
    await act(async () => { await result.current.addSub(T1, { name: 'x' }); });
    expect(refresh).not.toHaveBeenCalled();
    expect(result.current.toast?.msg).toBe('新增失敗');
  });
});

describe('addLink — FORBIDDEN 與一般錯誤都要有反應', () => {
  it('FORBIDDEN → toast 權限不足 + router.refresh()', async () => {
    createLinkAction.mockResolvedValueOnce({ error: 'FORBIDDEN' });
    const { result } = setup();
    await act(async () => { await result.current.addLink(T1, { url: 'https://x' }); });
    expect(refresh).toHaveBeenCalled();
    expect(result.current.toast?.msg).toBe('權限不足');
  });

  it('一般錯誤 → showToast(result.error)，不被吞掉', async () => {
    createLinkAction.mockResolvedValueOnce({ error: '新增失敗' });
    const { result } = setup();
    await act(async () => { await result.current.addLink(T1, { url: 'https://x' }); });
    expect(refresh).not.toHaveBeenCalled();
    expect(result.current.toast?.msg).toBe('新增失敗');
  });
});

describe('addProject — FORBIDDEN 與一般錯誤都要有反應', () => {
  it('FORBIDDEN → toast 權限不足 + router.refresh()', async () => {
    createProjectAction.mockResolvedValueOnce({ error: 'FORBIDDEN' });
    const { result } = setup();
    await act(async () => { await result.current.addProject('新專案'); });
    expect(refresh).toHaveBeenCalled();
    expect(result.current.toast?.msg).toBe('權限不足');
  });

  it('一般錯誤 → showToast(result.error)，不被吞掉', async () => {
    createProjectAction.mockResolvedValueOnce({ error: '新增失敗' });
    const { result } = setup();
    await act(async () => { await result.current.addProject('新專案'); });
    expect(refresh).not.toHaveBeenCalled();
    expect(result.current.toast?.msg).toBe('新增失敗');
  });
});

describe('deleteAllTasks — 非 FORBIDDEN 錯誤過去被靜默吞掉', () => {
  it('FORBIDDEN → toast 權限不足 + router.refresh()', async () => {
    deleteAllTasksAction.mockResolvedValueOnce({ error: 'FORBIDDEN' });
    const { result } = setup();
    await act(async () => { await result.current.deleteAllTasks(); });
    expect(refresh).toHaveBeenCalled();
    expect(result.current.toast?.msg).toBe('權限不足');
  });

  it('一般錯誤 → showToast(result.error)，不再靜默吞掉', async () => {
    deleteAllTasksAction.mockResolvedValueOnce({ error: '清除失敗' });
    const { result } = setup();
    await act(async () => { await result.current.deleteAllTasks(); });
    expect(refresh).not.toHaveBeenCalled();
    expect(result.current.toast?.msg).toBe('清除失敗');
  });
});
