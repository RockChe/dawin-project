import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Every mutation has to drop the sessionStorage snapshot, because loadData()
// short-circuits on a cache younger than CACHE_TTL (5 min) and never asks the
// server. A mutation that leaves the cache in place makes the next mount
// re-apply the OLD value — the edit looks lost even though the DB is correct.
//
// This was originally found on updateTask (the reported "can't change the date"
// bug) and fixed there. The same gap existed on every subtask/link/file/import/
// config mutation, so these tests lock the rule in for all of them rather than
// one at a time.

const CACHE_KEY = 'dash_cache';

const mocks = {
  createTask: vi.fn(),
  createSubtask: vi.fn(),
  createLink: vi.fn(),
  toggleSubtask: vi.fn(),
  updateSubtask: vi.fn(),
  deleteSubtask: vi.fn(),
  deleteLink: vi.fn(),
  deleteFile: vi.fn(),
  upsertTasks: vi.fn(),
  saveConfig: vi.fn(),
};

vi.mock('@/server/actions/tasks', () => ({
  createTask: (...a) => mocks.createTask(...a),
  updateTask: vi.fn(async () => ({ success: true })),
  deleteTask: vi.fn(async () => ({ success: true })),
  createSubtask: (...a) => mocks.createSubtask(...a),
  updateSubtask: (...a) => mocks.updateSubtask(...a),
  deleteSubtask: (...a) => mocks.deleteSubtask(...a),
  toggleSubtask: (...a) => mocks.toggleSubtask(...a),
  createLink: (...a) => mocks.createLink(...a),
  deleteLink: (...a) => mocks.deleteLink(...a),
  deleteFile: (...a) => mocks.deleteFile(...a),
  upsertTasks: (...a) => mocks.upsertTasks(...a),
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
vi.mock('@/server/actions/config', () => ({ saveConfig: (...a) => mocks.saveConfig(...a) }));
vi.mock('@/server/actions/dashboard', () => ({ getInitialData: vi.fn(async () => ({})) }));

const { default: useTaskManager } = await import('@/hooks/useTaskManager');

const PROJ_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '11111111-1111-4111-8111-111111111111';
const SUB_ID = '33333333-3333-4333-8333-333333333333';
const LINK_ID = '44444444-4444-4444-8444-444444444444';
const FILE_ID = '55555555-5555-4555-8555-555555555555';

const makeInitialData = () => ({
  projects: [{ id: PROJ_ID, name: 'P1', sortOrder: 1 }],
  tasks: [{ id: TASK_ID, projectId: PROJ_ID, task: 'T1', status: '待辦', sortOrder: 0 }],
  subtasks: [{ id: SUB_ID, taskId: TASK_ID, name: 'S1', done: false, doneDate: null, sortOrder: 0 }],
  links: [{ id: LINK_ID, taskId: TASK_ID, url: 'https://a.example', title: 'a' }],
  files: [{ id: FILE_ID, taskId: TASK_ID, name: 'f1', r2Key: 'k1' }],
  // supplied so mount doesn't fire its own saveConfig('categories', DEFAULT_CATS)
  configs: { categories: ['活動'] },
  session: { role: 'admin' },
  userNames: [],
});

function setup() {
  const data = makeInitialData();
  return renderHook(() => useTaskManager(data));
}

const CASES = [
  ['addTask', r => r.addTask(PROJ_ID, { task: 'new' })],
  ['toggleSub', r => r.toggleSub(SUB_ID)],
  ['updateSub', r => r.updateSub(SUB_ID, 'name', 'S1-edited')],
  ['addSub', r => r.addSub(TASK_ID, { name: 'S2' })],
  ['deleteSub', r => r.deleteSub(SUB_ID)],
  ['addLink', r => r.addLink(TASK_ID, { url: 'https://b.example', title: 'b' })],
  ['deleteLink', r => r.deleteLink(LINK_ID)],
  ['addFile', r => r.addFile(TASK_ID, { id: 'f2', taskId: TASK_ID, name: 'f2', r2Key: 'k2' })],
  ['deleteFile', r => r.deleteFile(FILE_ID)],
  ['saveConfigOwners', r => r.saveConfigOwners(['Rock'])],
  ['saveConfigCats', r => r.saveConfigCats(['活動', '行銷'])],
];

beforeEach(() => {
  try { sessionStorage.clear(); } catch {}
  mocks.createTask.mockResolvedValue({ success: true, task: { id: 'new-task', projectId: PROJ_ID, task: 'new' } });
  mocks.createSubtask.mockResolvedValue({ success: true, subtask: { id: 'new-sub', taskId: TASK_ID, name: 'S2' } });
  mocks.createLink.mockResolvedValue({ success: true, link: { id: 'new-link', taskId: TASK_ID, url: 'https://b.example' } });
  mocks.toggleSubtask.mockResolvedValue({ success: true, done: true, doneDate: '2026-08-15' });
  mocks.updateSubtask.mockResolvedValue({ success: true });
  mocks.deleteSubtask.mockResolvedValue({ success: true });
  mocks.deleteLink.mockResolvedValue({ success: true });
  mocks.deleteFile.mockResolvedValue({ success: true });
  mocks.upsertTasks.mockResolvedValue({ success: true, updated: 0, inserted: 1, failed: 0 });
  mocks.saveConfig.mockResolvedValue({ success: true });
});

describe('cache invalidation on mutation', () => {
  it.each(CASES)('%s drops the stale cache snapshot', async (_name, invoke) => {
    const { result } = setup();
    expect(sessionStorage.getItem(CACHE_KEY)).not.toBeNull();
    await act(async () => { await invoke(result.current); });
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  // importTasks is the exception: it force-refetches, which rewrites the cache
  // with fresh server data. That is strictly better than dropping it, so the
  // contract here is "the server was re-consulted", not "the cache is gone".
  it('importTasks force-refetches instead of leaving a stale snapshot', async () => {
    const { getInitialData } = await import('@/server/actions/dashboard');
    getInitialData.mockClear();
    const { result } = setup();
    await act(async () => { await result.current.importTasks([{ project: 'P1', task: 'imported' }]); });
    expect(getInitialData).toHaveBeenCalled();
  });
});
