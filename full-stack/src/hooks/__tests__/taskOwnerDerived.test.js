import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// tasks.owner 由子任務 owner 自動帶出：addSub / updateSub / deleteSub 要同步更新本地父任務的 owner
// （樂觀更新，失敗跟子任務一起 rollback）；有子任務 owner 的任務不能被直接改 owner。

const createSubtask = vi.fn();
const updateSubtask = vi.fn(async () => ({ success: true }));
const deleteSubtask = vi.fn(async () => ({ success: true }));
const updateTaskAction = vi.fn(async () => ({ success: true }));
const updateManyTasksAction = vi.fn(async (ids) => ({ success: true, updated: ids.length }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(async () => ({ success: true })),
  updateTask: (...a) => updateTaskAction(...a),
  deleteTask: vi.fn(async () => ({ success: true })),
  createSubtask: (...a) => createSubtask(...a),
  updateSubtask: (...a) => updateSubtask(...a),
  deleteSubtask: (...a) => deleteSubtask(...a),
  toggleSubtask: vi.fn(async () => ({ success: true })),
  createLink: vi.fn(async () => ({ success: true })),
  deleteLink: vi.fn(async () => ({ success: true })),
  deleteFile: vi.fn(async () => ({ success: true })),
  upsertTasks: vi.fn(async () => ({ success: true })),
  updateManyTasks: (...a) => updateManyTasksAction(...a),
  deleteManyTasks: vi.fn(async () => ({ success: true })),
  deleteAllTasks: vi.fn(async () => ({ success: true })),
  reorderTasks: vi.fn(async () => ({ success: true })),
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

const T1 = '11111111-1111-4111-8111-111111111111'; // 有子任務 owner
const T2 = '22222222-2222-4222-8222-222222222222'; // 沒有子任務
const P = '99999999-9999-4999-8999-999999999999';
const S1 = '33333333-3333-4333-8333-333333333333';
const S2 = '44444444-4444-4444-8444-444444444444';

const makeData = () => ({
  projects: [{ id: P, name: 'P', sortOrder: 1 }],
  tasks: [
    { id: T1, projectId: P, task: 'T1', status: '待辦', owner: 'Amy,Bob', sortOrder: 0 },
    { id: T2, projectId: P, task: 'T2', status: '待辦', owner: 'Manual', sortOrder: 1 },
  ],
  subtasks: [
    { id: S1, taskId: T1, name: 'S1', owner: 'Amy', done: false, sortOrder: 1 },
    { id: S2, taskId: T1, name: 'S2', owner: 'Bob', done: false, sortOrder: 2 },
  ],
  links: [], files: [], session: { role: 'admin' }, userNames: [],
});
const setup = () => { const data = makeData(); return renderHook(() => useTaskManager(data)); };
const ownerOf = (r, id) => r.current.allT.find(t => t.id === id).owner;

beforeEach(() => {
  vi.clearAllMocks();
  updateSubtask.mockImplementation(async () => ({ success: true }));
  deleteSubtask.mockImplementation(async () => ({ success: true }));
  try { sessionStorage.clear(); } catch {}
});

describe('addSub', () => {
  it('成功後父任務 owner 重算（新增子任務帶 owner → 併進推得值）', async () => {
    createSubtask.mockResolvedValue({ success: true, subtask: { id: 'new', taskId: T1, name: 'S3', owner: 'Cat', sortOrder: 3 } });
    const { result } = setup();
    await act(async () => { await result.current.addSub(T1, { name: 'S3', owner: 'Cat' }); });
    expect(ownerOf(result, T1)).toBe('Amy,Bob,Cat');
  });

  it('沒有子任務 owner 的任務新增「有 owner 的子任務」→ 手動 owner 被推得值取代', async () => {
    createSubtask.mockResolvedValue({ success: true, subtask: { id: 'new', taskId: T2, name: 'S', owner: 'Dan', sortOrder: 1 } });
    const { result } = setup();
    await act(async () => { await result.current.addSub(T2, { name: 'S', owner: 'Dan' }); });
    expect(ownerOf(result, T2)).toBe('Dan');
  });

  it('新增沒 owner 的子任務 → 手動 owner 不變', async () => {
    createSubtask.mockResolvedValue({ success: true, subtask: { id: 'new', taskId: T2, name: 'S', owner: null, sortOrder: 1 } });
    const { result } = setup();
    await act(async () => { await result.current.addSub(T2, { name: 'S' }); });
    expect(ownerOf(result, T2)).toBe('Manual');
  });

  it('失敗 → 父任務 owner 不動', async () => {
    createSubtask.mockResolvedValue({ error: 'boom' });
    const { result } = setup();
    await act(async () => { await result.current.addSub(T1, { name: 'S3', owner: 'Cat' }); });
    expect(ownerOf(result, T1)).toBe('Amy,Bob');
  });
});

describe('updateSub', () => {
  it('改 owner → 樂觀更新父任務 owner（server 回來前就變）', async () => {
    let release;
    updateSubtask.mockImplementation(() => new Promise(r => { release = () => r({ success: true }); }));
    const { result } = setup();
    let p;
    act(() => { p = result.current.updateSub(S2, 'owner', 'Cat'); });
    expect(ownerOf(result, T1)).toBe('Amy,Cat');
    await act(async () => { release(); await p; });
    expect(ownerOf(result, T1)).toBe('Amy,Cat');
  });

  it('server 失敗 → 子任務與父任務 owner 一起 rollback', async () => {
    updateSubtask.mockResolvedValue({ error: 'nope' });
    const { result } = setup();
    await act(async () => { await result.current.updateSub(S2, 'owner', 'Cat'); });
    expect(result.current.allS.find(s => s.id === S2).owner).toBe('Bob');
    expect(ownerOf(result, T1)).toBe('Amy,Bob');
  });

  it('改的不是 owner（name）→ 不碰父任務 owner', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateSub(S1, 'name', 'renamed'); });
    expect(ownerOf(result, T1)).toBe('Amy,Bob');
  });

  it('把唯一有 owner 的子任務清空 → 回到原本存的 owner（可再手動編輯）', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateSub(S1, 'owner', '—'); });
    await act(async () => { await result.current.updateSub(S2, 'owner', '—'); });
    expect(ownerOf(result, T1)).toBe('Bob'); // 沒有推得值 → 維持最後一次推得、存下來的值
  });
});

describe('deleteSub', () => {
  it('刪除 → 父任務 owner 樂觀重算', async () => {
    const { result } = setup();
    await act(async () => { await result.current.deleteSub(S1); });
    expect(ownerOf(result, T1)).toBe('Bob');
  });

  it('server 失敗 → 子任務與父任務 owner 一起還原', async () => {
    deleteSubtask.mockResolvedValue({ error: 'nope' });
    const { result } = setup();
    await act(async () => { await result.current.deleteSub(S1); });
    expect(result.current.allS.some(s => s.id === S1)).toBe(true);
    expect(ownerOf(result, T1)).toBe('Amy,Bob');
  });
});

describe('有子任務 owner 的任務不能直接改 owner', () => {
  it('updateTask(owner) → 略過，不呼叫 server、不改本地', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T1, 'owner', 'Zed'); });
    expect(updateTaskAction).not.toHaveBeenCalled();
    expect(ownerOf(result, T1)).toBe('Amy,Bob');
  });

  it('沒有子任務 owner 的任務照常可改', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T2, 'owner', 'Zed'); });
    expect(updateTaskAction).toHaveBeenCalledWith(T2, { owner: 'Zed' });
    expect(ownerOf(result, T2)).toBe('Zed');
  });

  it('updateTask 改別的欄位不受影響', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T1, 'status', '進行中'); });
    expect(updateTaskAction).toHaveBeenCalledWith(T1, { status: '進行中' });
  });

  it('updateManyTasks(owner) → 只送沒被鎖的任務，被略過的不改本地', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateManyTasks([T1, T2], 'owner', 'Zed'); });
    expect(updateManyTasksAction).toHaveBeenCalledWith([T2], { owner: 'Zed' });
    expect(ownerOf(result, T1)).toBe('Amy,Bob');
    expect(ownerOf(result, T2)).toBe('Zed');
  });

  it('updateManyTasks(owner) 全部都被鎖 → 不呼叫 server，並提示', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateManyTasks([T1], 'owner', 'Zed'); });
    expect(updateManyTasksAction).not.toHaveBeenCalled();
    expect(result.current.toast?.msg).toMatch(/由子任務自動帶出/);
  });

  it('updateManyTasks 改 status 不受影響', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateManyTasks([T1, T2], 'status', '已完成'); });
    expect(updateManyTasksAction).toHaveBeenCalledWith([T1, T2], { status: '已完成' });
  });
});
