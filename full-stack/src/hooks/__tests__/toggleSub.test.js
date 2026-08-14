import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toBusinessDateString } from '@/lib/utils';

// toggleSub had three defects:
//
// 1. The optimistic doneDate used `new Date().toISOString()`, i.e. the UTC
//    calendar day — the previous day for anything toggled before 08:00 Taipei.
// 2. It never reconciled with the server. The server decides the day boundary,
//    so a client in another zone would keep showing its own guess forever.
// 3. No per-row in-flight guard. Two quick clicks on the SAME subtask both read
//    the same pre-update row, and the server's read-toggle-write means one
//    toggle is silently lost while a failed rollback can clobber a successful
//    one. (Raised by external review; the existing concurrency tests only
//    covered two DIFFERENT subtasks.)

const toggleSubtaskAction = vi.fn(async () => ({ success: true, done: true, doneDate: '2026-08-15' }));

vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(async () => ({ success: true })),
  updateTask: vi.fn(async () => ({ success: true })),
  deleteTask: vi.fn(async () => ({ success: true })),
  createSubtask: vi.fn(async () => ({ success: true })),
  updateSubtask: vi.fn(async () => ({ success: true })),
  deleteSubtask: vi.fn(async () => ({ success: true })),
  toggleSubtask: (...a) => toggleSubtaskAction(...a),
  createLink: vi.fn(async () => ({ success: true })),
  deleteLink: vi.fn(async () => ({ success: true })),
  deleteFile: vi.fn(async () => ({ success: true })),
  upsertTasks: vi.fn(async () => ({ success: true })),
  updateManyTasks: vi.fn(async () => ({ success: true })),
  deleteManyTasks: vi.fn(async () => ({ success: true })),
  deleteAllTasks: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/server/actions/projects', () => ({
  createProject: vi.fn(async () => ({ success: true })),
  updateProject: vi.fn(async () => ({ success: true })),
  deleteProject: vi.fn(async () => ({ success: true })),
  reorderProjects: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/server/actions/config', () => ({ saveConfig: vi.fn(async () => ({ success: true })) }));
vi.mock('@/server/actions/dashboard', () => ({ getInitialData: vi.fn(async () => ({})) }));

const { default: useTaskManager } = await import('@/hooks/useTaskManager');

const SUB_ID = '33333333-3333-4333-8333-333333333333';
const TASK_ID = '11111111-1111-4111-8111-111111111111';
const PROJ_ID = '22222222-2222-4222-8222-222222222222';

const makeInitialData = () => ({
  projects: [{ id: PROJ_ID, name: 'P1', sortOrder: 1 }],
  tasks: [{ id: TASK_ID, projectId: PROJ_ID, task: 'T1', status: '待辦', sortOrder: 0 }],
  subtasks: [{ id: SUB_ID, taskId: TASK_ID, name: 'S1', done: false, doneDate: null, sortOrder: 0 }],
  links: [], files: [],
  session: { role: 'admin' },
  userNames: [],
});

function setup() {
  const data = makeInitialData();
  return renderHook(() => useTaskManager(data));
}

beforeEach(() => {
  toggleSubtaskAction.mockClear();
  toggleSubtaskAction.mockImplementation(async () => ({ success: true, done: true, doneDate: '2026-08-15' }));
  try { sessionStorage.clear(); } catch {}
});

describe('toggleSub', () => {
  it('adopts the doneDate the server actually stored', async () => {
    const { result } = setup();
    await act(async () => { await result.current.toggleSub(SUB_ID); });
    expect(result.current.allS[0].doneDate).toBe('2026-08-15');
    expect(result.current.allS[0].done).toBe(true);
  });

  it('uses the business-zone day for the optimistic guess, not the UTC day', async () => {
    // server echoes back whatever the client guessed, so the assertion below
    // is testing the client's own optimistic value
    toggleSubtaskAction.mockImplementation(async () => ({ success: true }));
    const { result } = setup();
    await act(async () => { await result.current.toggleSub(SUB_ID); });
    expect(result.current.allS[0].doneDate).toBe(toBusinessDateString());
  });

  it('ignores a second toggle of the same subtask while the first is in flight', async () => {
    let release;
    toggleSubtaskAction.mockImplementation(() => new Promise(r => { release = () => r({ success: true, done: true, doneDate: '2026-08-15' }); }));
    const { result } = setup();
    await act(async () => {
      const first = result.current.toggleSub(SUB_ID);
      const second = result.current.toggleSub(SUB_ID);
      release();
      await Promise.all([first, second]);
    });
    expect(toggleSubtaskAction).toHaveBeenCalledTimes(1);
  });

  it('rolls the row back on server error without corrupting state', async () => {
    toggleSubtaskAction.mockImplementation(async () => ({ error: '切換子任務狀態失敗' }));
    const { result } = setup();
    await act(async () => { await result.current.toggleSub(SUB_ID); });
    expect(Array.isArray(result.current.allS)).toBe(true);
    expect(result.current.allS[0].done).toBe(false);
    expect(result.current.allS[0].doneDate).toBe(null);
  });

  it('allows a later toggle once the first has settled', async () => {
    const { result } = setup();
    await act(async () => { await result.current.toggleSub(SUB_ID); });
    await act(async () => { await result.current.toggleSub(SUB_ID); });
    expect(toggleSubtaskAction).toHaveBeenCalledTimes(2);
  });
});
