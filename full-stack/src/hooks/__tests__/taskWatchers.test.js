import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// 關注人（tasks.watchers）：獨立欄位，tasks.owner = 執行人 ∪ 關注人。
// 樂觀更新要用共享 helper 重算 owner，失敗時 watchers 與 owner 一起還原。

const updateTaskAction = vi.fn(async () => ({ success: true }));
const updateManyTasksAction = vi.fn(async (ids) => ({ success: true, updated: ids.length }));
const updateSubtask = vi.fn(async () => ({ success: true }));
const deleteSubtask = vi.fn(async () => ({ success: true }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(async () => ({ success: true })),
  updateTask: (...a) => updateTaskAction(...a),
  deleteTask: vi.fn(async () => ({ success: true })),
  createSubtask: vi.fn(),
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

const T1 = '11111111-1111-4111-8111-111111111111'; // 子任務有 owner（Felien）+ 關注人 幸真
const T2 = '22222222-2222-4222-8222-222222222222'; // 沒有子任務；手動執行人 Zed + 關注人 幸真
const T3 = '55555555-5555-4555-8555-555555555555'; // 沒有子任務、沒有關注人
const P = '99999999-9999-4999-8999-999999999999';
const S1 = '33333333-3333-4333-8333-333333333333';

const makeData = () => ({
  projects: [{ id: P, name: 'P', sortOrder: 1 }],
  tasks: [
    { id: T1, projectId: P, task: 'T1', status: '待辦', owner: 'Felien,幸真', watchers: '幸真', sortOrder: 0 },
    { id: T2, projectId: P, task: 'T2', status: '待辦', owner: 'Zed,幸真', watchers: '幸真', sortOrder: 1 },
    { id: T3, projectId: P, task: 'T3', status: '待辦', owner: 'Amy', watchers: null, sortOrder: 2 },
  ],
  subtasks: [{ id: S1, taskId: T1, name: 'S1', owner: 'Felien', done: false, sortOrder: 1 }],
  links: [], files: [], session: { role: 'admin' }, userNames: [],
});
const setup = () => { const data = makeData(); return renderHook(() => useTaskManager(data)); };
const row = (r, id) => r.current.allT.find(t => t.id === id);

beforeEach(() => {
  vi.clearAllMocks();
  updateTaskAction.mockImplementation(async () => ({ success: true }));
  try { sessionStorage.clear(); } catch {}
});

describe('updateTask(id, "watchers", v)', () => {
  it('樂觀更新：watchers 正規化、owner = 執行人 ∪ 新關注人；送出的是 { watchers }', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T3, 'watchers', ' 幸真 , ,—'); });
    expect(updateTaskAction).toHaveBeenCalledWith(T3, { watchers: '幸真' });
    expect(row(result, T3)).toMatchObject({ watchers: '幸真', owner: 'Amy,幸真' });
  });

  it('有子任務 owner：owner = 子任務聯集 ∪ 新關注人（舊關注人被換掉）', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T1, 'watchers', 'Bob'); });
    expect(row(result, T1)).toMatchObject({ watchers: 'Bob', owner: 'Felien,Bob' });
  });

  it('沒有子任務 owner：手動執行人由 owner 扣掉舊關注人復原，再接新關注人', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T2, 'watchers', 'Bob'); });
    expect(row(result, T2)).toMatchObject({ watchers: 'Bob', owner: 'Zed,Bob' });
  });

  it('清空關注人 → watchers null，owner 只剩執行人', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T2, 'watchers', '—'); });
    expect(updateTaskAction).toHaveBeenCalledWith(T2, { watchers: null });
    expect(row(result, T2)).toMatchObject({ watchers: null, owner: 'Zed' });
  });

  it('子任務有 owner 時照樣可以改關注人（不像 owner 被鎖）', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T1, 'watchers', 'Bob'); });
    expect(updateTaskAction).toHaveBeenCalledTimes(1);
  });

  it('伺服端回錯誤 → watchers 與 owner 一起還原', async () => {
    updateTaskAction.mockResolvedValue({ error: 'boom' });
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T3, 'watchers', '幸真'); });
    expect(row(result, T3)).toMatchObject({ watchers: null, owner: 'Amy' });
  });
});

describe('updateTask(id, "owner", v)：改執行人不能丟掉關注人', () => {
  it('沒有子任務 owner：新 owner = 輸入值 ∪ 關注人', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T2, 'owner', 'Amy'); });
    expect(row(result, T2).owner).toBe('Amy,幸真');
    expect(updateTaskAction).toHaveBeenCalledWith(T2, { owner: 'Amy' });
  });

  it('輸入值本來就含關注人 → 原樣', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T2, 'owner', 'Amy,幸真'); });
    expect(row(result, T2).owner).toBe('Amy,幸真');
  });

  it('沒有關注人 → 與舊行為相同（含 "—"）', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T3, 'owner', '—'); });
    expect(row(result, T3).owner).toBe('—');
  });

  it('失敗 → owner 還原成舊值', async () => {
    updateTaskAction.mockResolvedValue({ error: 'boom' });
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T2, 'owner', 'Amy'); });
    expect(row(result, T2).owner).toBe('Zed,幸真');
  });

  it('有子任務 owner 的任務仍不接受直接改 owner', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateTask(T1, 'owner', 'Amy'); });
    expect(updateTaskAction).not.toHaveBeenCalled();
  });
});

describe('子任務變動時關注人保留在 owner 聯集裡', () => {
  it('updateSub 改 owner → 父任務 owner = 新推得 ∪ 關注人；失敗還原', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateSub(S1, 'owner', 'Cat'); });
    expect(row(result, T1).owner).toBe('Cat,幸真');

    updateSubtask.mockResolvedValueOnce({ error: 'boom' });
    await act(async () => { await result.current.updateSub(S1, 'owner', 'Dan'); });
    expect(row(result, T1).owner).toBe('Cat,幸真');
  });

  it('刪掉最後一個有 owner 的子任務 → owner 原樣保留（已含關注人）', async () => {
    const { result } = setup();
    await act(async () => { await result.current.deleteSub(S1); });
    expect(row(result, T1).owner).toBe('Felien,幸真');
  });
});

describe('updateManyTasks 改 owner 時保留各任務的關注人，且不送 watchers', () => {
  it('樂觀更新 owner = 輸入 ∪ 該任務關注人', async () => {
    const { result } = setup();
    await act(async () => { await result.current.updateManyTasks([T2, T3], 'owner', 'Amy'); });
    expect(updateManyTasksAction).toHaveBeenCalledWith([T2, T3], { owner: 'Amy' });
    expect(row(result, T2).owner).toBe('Amy,幸真');
    expect(row(result, T3).owner).toBe('Amy');
  });
});

describe('twp 列帶 subOwner（子任務負責人聯集，給「我的任務」判斷執行/關注）', () => {
  it('有子任務 owner → 聯集字串；沒有 → 空字串', () => {
    const { result } = setup();
    const t = id => result.current.twp.find(x => x.id === id);
    expect(t(T1).subOwner).toBe('Felien');
    expect(t(T2).subOwner).toBe('');
    expect(t(T1).watchers).toBe('幸真');
  });
});
