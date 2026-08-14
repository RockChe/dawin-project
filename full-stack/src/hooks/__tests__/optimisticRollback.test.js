import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Regression tests for the BUG01 rollback anti-pattern spread across
// useTaskManager's delete/toggle/update handlers:
//
//   let prev;
//   setAllX(p => { prev = p; return p.filter(...) });   // read inside updater
//   const result = await someAction();
//   if (result?.error) setAllX(prev);                    // prev may be undefined
//
// React only guarantees a setState updater runs eagerly when the fiber has
// no other pending update already queued (see ReactFiberHooks
// dispatchSetState's eagerState fast path). The very first setState call in
// a batch gets this fast path; every subsequent setState call in the SAME
// synchronous tick (e.g. deleteTask's setAllT/setAllS/setAllL/setAllF, or two
// independent mutations dispatched back-to-back before React flushes) does
// NOT — its updater is deferred to the actual render, so the `prev` variable
// captured in the calling closure is still `undefined` by the time the
// `await` resolves. Calling `setAllX(prev)` then stomps the array with
// `undefined`, and the next render's `twp` memo (via computeAllProgress's
// `for (const s of subs)`) throws — a white-screen crash.
//
// Each test below reproduces a real dispatch pattern that defers the
// updater (either a multi-array cascade delete, or two mutations fired
// without awaiting the first) and asserts the hook survives a rejected
// server action without corrupting state.

const deleteTaskAction = vi.fn(async () => ({ success: true }));
const toggleSubtaskAction = vi.fn(async () => ({ success: true }));
const updateSubtaskAction = vi.fn(async () => ({ success: true }));
const deleteSubtaskAction = vi.fn(async () => ({ success: true }));
const deleteLinkAction = vi.fn(async () => ({ success: true }));
const deleteFileAction = vi.fn(async () => ({ success: true }));
const deleteManyTasksAction = vi.fn(async () => ({ success: true }));
const updateManyTasksAction = vi.fn(async () => ({ success: true }));
const deleteProjectAction = vi.fn(async () => ({ success: true }));

vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(async () => ({ success: true })),
  updateTask: vi.fn(async () => ({ success: true })),
  deleteTask: (...a) => deleteTaskAction(...a),
  createSubtask: vi.fn(async () => ({ success: true })),
  updateSubtask: (...a) => updateSubtaskAction(...a),
  deleteSubtask: (...a) => deleteSubtaskAction(...a),
  toggleSubtask: (...a) => toggleSubtaskAction(...a),
  createLink: vi.fn(async () => ({ success: true })),
  deleteLink: (...a) => deleteLinkAction(...a),
  deleteFile: (...a) => deleteFileAction(...a),
  upsertTasks: vi.fn(async () => ({ success: true })),
  updateManyTasks: (...a) => updateManyTasksAction(...a),
  deleteManyTasks: (...a) => deleteManyTasksAction(...a),
  deleteAllTasks: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/server/actions/projects', () => ({
  createProject: vi.fn(async () => ({ success: true })),
  updateProject: vi.fn(async () => ({ success: true })),
  deleteProject: (...a) => deleteProjectAction(...a),
  reorderProjects: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/server/actions/config', () => ({ saveConfig: vi.fn(async () => ({ success: true })) }));
vi.mock('@/server/actions/dashboard', () => ({ getInitialData: vi.fn(async () => ({})) }));

const { default: useTaskManager } = await import('@/hooks/useTaskManager');

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '33333333-3333-4333-8333-333333333333';
const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '44444444-4444-4444-8444-444444444444';
const T3 = '55555555-5555-4555-8555-555555555555';
const S1 = '66666666-6666-4666-8666-666666666666';
const S2 = '77777777-7777-4777-8777-777777777777';
const S3 = '88888888-8888-4888-8888-888888888888';
const L1 = '99999999-9999-4999-8999-999999999999';
const F1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// NOTE: must be a stable reference per render — useTaskManager's data effect
// depends on `initialData`, so a fresh object each render would re-trigger it
// and spin forever.
const makeInitialData = () => ({
  projects: [
    { id: P1, name: 'P1', sortOrder: 1 },
    { id: P2, name: 'P2', sortOrder: 2 },
  ],
  tasks: [
    { id: T1, projectId: P1, task: 'T1', status: '待辦', startDate: '2026-08-01', endDate: '2026-08-10', duration: 9, owner: null, priority: '中', notes: null, sortOrder: 0 },
    { id: T2, projectId: P1, task: 'T2', status: '待辦', startDate: '2026-08-01', endDate: '2026-08-10', duration: 9, owner: null, priority: '中', notes: null, sortOrder: 1 },
    { id: T3, projectId: P2, task: 'T3', status: '待辦', startDate: '2026-08-01', endDate: '2026-08-10', duration: 9, owner: null, priority: '中', notes: null, sortOrder: 0 },
  ],
  subtasks: [
    { id: S1, taskId: T1, name: 'S1', owner: null, done: false, doneDate: null, notes: null, sortOrder: 0 },
    { id: S2, taskId: T1, name: 'S2', owner: null, done: false, doneDate: null, notes: null, sortOrder: 1 },
    { id: S3, taskId: T2, name: 'S3', owner: null, done: false, doneDate: null, notes: null, sortOrder: 0 },
  ],
  links: [{ id: L1, taskId: T1, url: 'https://x', title: 'L1' }],
  files: [{ id: F1, taskId: T1, name: 'F1', size: 1, mimeType: 'text/plain', r2Key: 'k' }],
  session: { role: 'admin' },
  userNames: [],
});

function setup() {
  const data = makeInitialData();
  return renderHook(() => useTaskManager(data));
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteTaskAction.mockResolvedValue({ success: true });
  toggleSubtaskAction.mockResolvedValue({ success: true });
  updateSubtaskAction.mockResolvedValue({ success: true });
  deleteSubtaskAction.mockResolvedValue({ success: true });
  deleteLinkAction.mockResolvedValue({ success: true });
  deleteFileAction.mockResolvedValue({ success: true });
  deleteManyTasksAction.mockResolvedValue({ success: true });
  updateManyTasksAction.mockResolvedValue({ success: true });
  deleteProjectAction.mockResolvedValue({ success: true });
  try { sessionStorage.clear(); } catch {}
});

describe('deleteTask rollback (4-array cascade — 2nd/3rd/4th setState updater deferred)', () => {
  it('restores tasks/subtasks/links/files without corrupting state when the server rejects', async () => {
    deleteTaskAction.mockResolvedValueOnce({ error: '刪除任務失敗' });
    const { result } = setup();
    await act(async () => { await result.current.deleteTask(T1); });

    expect(Array.isArray(result.current.allS)).toBe(true);
    expect(Array.isArray(result.current.allL)).toBe(true);
    expect(Array.isArray(result.current.allF)).toBe(true);
    expect(result.current.allT.map(t => t.id).sort()).toEqual([T1, T2, T3].sort());
    expect(result.current.allS.map(s => s.id).sort()).toEqual([S1, S2, S3].sort());
    expect(result.current.allL.map(l => l.id)).toEqual([L1]);
    expect(result.current.allF.map(f => f.id)).toEqual([F1]);
    // twp is recomputed via computeAllProgress(allS, allT) on every render —
    // if allS/allT were left `undefined` this access would throw.
    expect(result.current.twp.length).toBe(3);
  });
});

describe('deleteManyTasks rollback (4-array cascade)', () => {
  it('restores tasks/subtasks/links/files without corrupting state when the server rejects', async () => {
    deleteManyTasksAction.mockResolvedValueOnce({ error: '批次刪除失敗' });
    const { result } = setup();
    await act(async () => { await result.current.deleteManyTasks([T1]); });

    expect(Array.isArray(result.current.allS)).toBe(true);
    expect(Array.isArray(result.current.allL)).toBe(true);
    expect(Array.isArray(result.current.allF)).toBe(true);
    expect(result.current.allT.map(t => t.id).sort()).toEqual([T1, T2, T3].sort());
    expect(result.current.allS.map(s => s.id).sort()).toEqual([S1, S2, S3].sort());
    expect(result.current.allL.map(l => l.id)).toEqual([L1]);
    expect(result.current.allF.map(f => f.id)).toEqual([F1]);
    expect(result.current.twp.length).toBe(3);
  });
});

describe('deleteProject rollback (2-array cascade — 2nd setState updater deferred)', () => {
  it('restores the project and its tasks without corrupting state when the server rejects', async () => {
    deleteProjectAction.mockResolvedValueOnce({ error: '刪除專案失敗' });
    const { result } = setup();
    await act(async () => { await result.current.deleteProject(P1); });

    expect(Array.isArray(result.current.allT)).toBe(true);
    expect(result.current.projects.map(p => p.id).sort()).toEqual([P1, P2].sort());
    expect(result.current.allT.map(t => t.id).sort()).toEqual([T1, T2, T3].sort());
    expect(result.current.twp.length).toBe(3);
  });
});

// Below: single-array, single-setState handlers. In isolation, one call gets
// React's eager-updater fast path (fiber has no other pending update), so
// `prev` IS captured correctly. The anti-pattern still breaks under React 18
// automatic batching when two independent mutations are dispatched in the
// same synchronous tick without awaiting the first (e.g. rapid double-toggle,
// or a caller that fires several mutations before yielding) — the SECOND
// dispatch's fiber already has a pending lane, so its updater is deferred and
// its `prev` is `undefined` when the rollback fires.

describe('toggleSub rollback (concurrent dispatch defers the 2nd updater)', () => {
  it('restores the correct subtask on rejection, not `undefined`', async () => {
    toggleSubtaskAction.mockImplementation(async (id) => (id === S2 ? { error: '切換失敗' } : { success: true }));
    const { result } = setup();
    await act(async () => {
      const c1 = result.current.toggleSub(S1);
      const c2 = result.current.toggleSub(S2);
      await Promise.all([c1, c2]);
    });

    expect(Array.isArray(result.current.allS)).toBe(true);
    const s2 = result.current.allS.find(s => s.id === S2);
    expect(s2.done).toBe(false); // rolled back
    const s1 = result.current.allS.find(s => s.id === S1);
    expect(s1.done).toBe(true); // succeeded, stays toggled
  });
});

describe('updateSub rollback (concurrent dispatch defers the 2nd updater)', () => {
  it('restores the correct field on rejection, not `undefined`', async () => {
    updateSubtaskAction.mockImplementation(async (id) => (id === S2 ? { error: '更新失敗' } : { success: true }));
    const { result } = setup();
    await act(async () => {
      const c1 = result.current.updateSub(S1, 'name', 'S1-edited');
      const c2 = result.current.updateSub(S2, 'name', 'S2-edited');
      await Promise.all([c1, c2]);
    });

    expect(Array.isArray(result.current.allS)).toBe(true);
    const s2 = result.current.allS.find(s => s.id === S2);
    expect(s2.name).toBe('S2'); // rolled back
    const s1 = result.current.allS.find(s => s.id === S1);
    expect(s1.name).toBe('S1-edited');
  });
});

describe('deleteSub rollback (concurrent dispatch defers the 2nd updater)', () => {
  it('reinserts the correct subtask on rejection, not `undefined`', async () => {
    deleteSubtaskAction.mockImplementation(async (id) => (id === S2 ? { error: '刪除失敗' } : { success: true }));
    const { result } = setup();
    await act(async () => {
      const c1 = result.current.deleteSub(S1);
      const c2 = result.current.deleteSub(S2);
      await Promise.all([c1, c2]);
    });

    expect(Array.isArray(result.current.allS)).toBe(true);
    expect(result.current.allS.map(s => s.id).sort()).toEqual([S2, S3].sort());
  });
});

describe('deleteLink rollback (concurrent dispatch defers the 2nd updater)', () => {
  it('reinserts the correct link on rejection, not `undefined`', async () => {
    const L2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    deleteLinkAction.mockImplementation(async (id) => (id === L1 ? { error: '刪除失敗' } : { success: true }));
    const { result } = setup();
    // Seed a 2nd link so there is something for the non-erroring call to remove.
    act(() => { result.current.setAllL(p => [...p, { id: L2, taskId: T1, url: 'https://y', title: 'L2' }]); });
    await act(async () => {
      const c1 = result.current.deleteLink(L1);
      const c2 = result.current.deleteLink(L2);
      await Promise.all([c1, c2]);
    });

    expect(Array.isArray(result.current.allL)).toBe(true);
    expect(result.current.allL.map(l => l.id)).toEqual([L1]);
  });
});

describe('deleteFile rollback (concurrent dispatch defers the 2nd updater)', () => {
  it('reinserts the correct file on rejection, not `undefined`', async () => {
    const F2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    deleteFileAction.mockImplementation(async (id) => (id === F1 ? { error: '刪除失敗' } : { success: true }));
    const { result } = setup();
    act(() => { result.current.setAllF(p => [...p, { id: F2, taskId: T1, name: 'F2', size: 1, mimeType: 'text/plain', r2Key: 'k2' }]); });
    await act(async () => {
      const c1 = result.current.deleteFile(F1);
      const c2 = result.current.deleteFile(F2);
      await Promise.all([c1, c2]);
    });

    expect(Array.isArray(result.current.allF)).toBe(true);
    expect(result.current.allF.map(f => f.id)).toEqual([F1]);
  });
});

describe('updateManyTasks rollback (concurrent dispatch defers the 2nd updater)', () => {
  it('restores the correct field on rejection, not `undefined`', async () => {
    updateManyTasksAction.mockImplementation(async (ids) => (ids.includes(T2) ? { error: '批次更新失敗' } : { success: true }));
    const { result } = setup();
    await act(async () => {
      const c1 = result.current.updateManyTasks([T1], 'status', '進行中');
      const c2 = result.current.updateManyTasks([T2], 'status', '進行中');
      await Promise.all([c1, c2]);
    });

    expect(Array.isArray(result.current.allT)).toBe(true);
    const t2 = result.current.allT.find(t => t.id === T2);
    expect(t2.status).toBe('待辦'); // rolled back
    const t1 = result.current.allT.find(t => t.id === T1);
    expect(t1.status).toBe('進行中');
  });
});
