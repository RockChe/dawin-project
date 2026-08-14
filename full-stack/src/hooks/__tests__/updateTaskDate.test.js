import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Regression tests for BUG — "task 改時間 改不了".
//
// Root cause: updateTask() writes the optimistic value under the FORM field
// name (`start` / `end`), but the `twp` memo re-derives those same keys from
// the DB field names (`start: t.startDate`). Because the derived key is
// written AFTER the `...t` spread, it always wins — so the optimistic date is
// silently discarded and the table/gantt keep rendering the OLD date. The DB
// write itself succeeds, which is why the new date only appears after a
// reload (and even then a stale sessionStorage cache can mask it).
//
// These tests lock the contract: after updateTask(id, 'start', v) the value
// exposed through `twp` (the single source the UI renders from) must be v.

const updateTaskAction = vi.fn(async () => ({ success: true }));

vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(async () => ({ success: true })),
  updateTask: (...a) => updateTaskAction(...a),
  deleteTask: vi.fn(async () => ({ success: true })),
  createSubtask: vi.fn(async () => ({ success: true })),
  updateSubtask: vi.fn(async () => ({ success: true })),
  deleteSubtask: vi.fn(async () => ({ success: true })),
  toggleSubtask: vi.fn(async () => ({ success: true })),
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

const TASK_ID = '11111111-1111-4111-8111-111111111111';
const PROJ_ID = '22222222-2222-4222-8222-222222222222';

// NOTE: must be a stable reference per render — useTaskManager's data effect
// depends on `initialData`, so a fresh object each render would re-trigger it
// and spin forever.
const makeInitialData = () => ({
  projects: [{ id: PROJ_ID, name: 'P1', sortOrder: 1 }],
  tasks: [{
    id: TASK_ID, projectId: PROJ_ID, task: 'T1', status: '待辦',
    startDate: '2026-08-01', endDate: '2026-08-10', duration: 9,
    owner: null, priority: '中', notes: null, sortOrder: 0,
  }],
  subtasks: [], links: [], files: [],
  session: { role: 'admin' },
  userNames: [],
});

function setup() {
  const data = makeInitialData();
  return renderHook(() => useTaskManager(data));
}

beforeEach(() => {
  updateTaskAction.mockClear();
  try { sessionStorage.clear(); } catch {}
});

describe('updateTask — date fields reach the rendered view (twp)', () => {
  it('persists startDate to the server under the DB field name', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(TASK_ID, 'start', '2026-09-01'); });
    expect(updateTaskAction).toHaveBeenCalledWith(TASK_ID, { startDate: '2026-09-01' });
  });

  it('reflects the new start date in twp (optimistic update must not be discarded)', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(TASK_ID, 'start', '2026-09-01'); });
    expect(result.current.twp[0].start).toBe('2026-09-01');
  });

  it('reflects the new end date in twp', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(TASK_ID, 'end', '2026-09-20'); });
    expect(result.current.twp[0].end).toBe('2026-09-20');
  });

  it('keeps startDate/endDate consistent with start/end after an update', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(TASK_ID, 'start', '2026-09-01'); });
    expect(result.current.twp[0].startDate).toBe('2026-09-01');
    expect(result.current.twp[0].start).toBe('2026-09-01');
  });

  // The mount effect seeds sessionStorage['dash_cache'] with a fresh
  // `cachedAt`. loadData() short-circuits on a cache younger than the 5 min
  // TTL, so if a successful edit leaves that cache in place the next mount
  // re-applies the OLD date and never asks the server — the edit looks lost
  // even though the DB is correct. Every other mutation calls
  // invalidateCache(); updateTask must too.
  it('invalidates the sessionStorage cache after a successful date change', async () => {
    const { result } = setup();
    expect(sessionStorage.getItem('dash_cache')).not.toBeNull();
    await act(async () => { await result.current.updateTask(TASK_ID, 'start', '2026-09-01'); });
    expect(sessionStorage.getItem('dash_cache')).toBeNull();
  });

  it('rolls the date back in twp when the server rejects the update', async () => {
    updateTaskAction.mockImplementationOnce(async () => ({ error: '更新任務失敗' }));
    const { result } = setup();
    await act(async () => { await result.current.updateTask(TASK_ID, 'start', '2026-09-01'); });
    expect(result.current.twp[0].start).toBe('2026-08-01');
  });
});
