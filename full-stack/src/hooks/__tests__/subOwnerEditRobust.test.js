import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { deriveTaskOwner, execTokens, watcherTokens, subOwnerTokens, taskRole, ownerTokens, hasSubOwners } from '@/lib/taskOwner';
import { myRole, roleBadge } from '@/lib/myTasks';

const updateSubtask = vi.fn(async () => ({ success: true }));
const createSubtask = vi.fn();
const deleteSubtask = vi.fn(async () => ({ success: true }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(), updateTask: vi.fn(async () => ({ success: true })), deleteTask: vi.fn(),
  createSubtask: (...a) => createSubtask(...a), updateSubtask: (...a) => updateSubtask(...a), deleteSubtask: (...a) => deleteSubtask(...a),
  toggleSubtask: vi.fn(), createLink: vi.fn(), deleteLink: vi.fn(), deleteFile: vi.fn(), upsertTasks: vi.fn(),
  updateManyTasks: vi.fn(), deleteManyTasks: vi.fn(), deleteAllTasks: vi.fn(), reorderTasks: vi.fn(),
}));
vi.mock('@/server/actions/projects', () => ({ createProject: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn(), reorderProjects: vi.fn() }));
vi.mock('@/server/actions/config', () => ({ saveConfig: vi.fn(async () => ({ success: true })) }));
vi.mock('@/server/actions/dashboard', () => ({ getInitialData: vi.fn(async () => ({})) }));
const { default: useTaskManager } = await import('@/hooks/useTaskManager');

const weird = [undefined, null, '', '—', ' , ,', 0, 5, NaN, true, {}, [], ['A', 'B'], 'A,,B', ',A', 'A,—', '—,—'];

describe('taskOwner 純函式：任意輸入不丟例外', () => {
  it('ownerTokens / execTokens / watcherTokens / deriveTaskOwner / taskRole / hasSubOwners', () => {
    for (const a of weird) for (const b of weird) {
      expect(() => ownerTokens(a)).not.toThrow();
      expect(() => deriveTaskOwner([], a, b)).not.toThrow();
      expect(() => deriveTaskOwner([{ owner: a }], b, a)).not.toThrow();
      expect(() => execTokens({ owner: a, watchers: b }, [{ owner: b }])).not.toThrow();
      expect(() => watcherTokens({ watchers: a })).not.toThrow();
      expect(() => taskRole({ owner: a, watchers: b }, [{ owner: a }], 'A')).not.toThrow();
      expect(() => myRole({ owner: a, watchers: b, subOwner: a }, 'A')).not.toThrow();
      expect(() => roleBadge?.({ owner: a, watchers: b, subOwner: a }, 'A')).not.toThrow();
    }
    expect(() => subOwnerTokens(undefined)).not.toThrow();
    expect(() => subOwnerTokens([{}, { owner: null }, { sortOrder: undefined, createdAt: 'garbage' }])).not.toThrow();
    expect(() => hasSubOwners(null)).not.toThrow();
    expect(() => execTokens(undefined, undefined)).not.toThrow();
    expect(() => execTokens(null, null)).not.toThrow();
    expect(() => taskRole(undefined, undefined, 'A')).not.toThrow();
  });
});

describe('useTaskManager updateSub / addSub / deleteSub：父任務或子任務缺資料', () => {
  const sub = { id: 's1', taskId: 'tX', name: 'S', owner: null };
  const mk = (d) => { const init = { projects: [], tasks: [], subtasks: [], links: [], files: [], session: { role: 'admin' }, userNames: [], ...d }; return renderHook(() => useTaskManager(init)); };

  it('子任務存在但父任務不在 allT（孤兒）：改 owner / 刪除不丟例外', async () => {
    const { result } = mk({ subtasks: [sub] });
    await act(async () => { await result.current.updateSub('s1', 'owner', 'Amy'); });
    await act(async () => { await result.current.deleteSub('s1'); });
    expect(result.current.allS).toEqual([]);
  });

  it('找不到子任務：updateSub / deleteSub 不丟例外', async () => {
    const { result } = mk({});
    await act(async () => { await result.current.updateSub('nope', 'owner', 'Amy'); });
    await act(async () => { await result.current.deleteSub('nope'); });
  });

  it('task.owner=null、watchers undefined、子任務缺 sortOrder/createdAt：改 owner、新增、刪除', async () => {
    createSubtask.mockResolvedValueOnce({ success: true, subtask: { id: 's9', taskId: 't1', name: 'N', owner: 'Bob' } });
    const { result } = mk({
      tasks: [{ id: 't1', projectId: 'p', task: 'T', status: '待辦', owner: null }],
      subtasks: [{ id: 's1', taskId: 't1', name: 'S', owner: undefined }, { id: 's2', taskId: 't1', name: 'S2' }],
    });
    await act(async () => { await result.current.updateSub('s1', 'owner', 'Amy'); });
    expect(result.current.allT[0].owner).toBe('Amy');
    await act(async () => { await result.current.addSub('t1', { name: 'N', owner: 'Bob' }); });
    expect(result.current.allT[0].owner).toBe('Amy,Bob');
    await act(async () => { await result.current.updateSub('s1', 'owner', '—'); });
    await act(async () => { await result.current.deleteSub('s9'); });
    expect(result.current.twp[0]).toBeTruthy();
  });
});
